import crypto from 'crypto';
import BaseIntegration from '../BaseIntegration.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_BASE_URL = 'https://www.googleapis.com/drive/v3/';
const UPLOAD_BASE_URL = 'https://www.googleapis.com/upload/drive/v3/';
const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
];

class GoogleDriveIntegration extends BaseIntegration {
  constructor({ clientId, clientSecret, accessToken = null, refreshToken = null } = {}) {
    super({
      name: 'google-drive',
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
      apiBaseUrl: API_BASE_URL,
      authUrl: AUTH_URL,
      tokenUrl: TOKEN_URL,
      defaultHeaders: {
        Accept: 'application/json',
      },
    });
  }

  getAuthUrl(redirectUri, scopes = DEFAULT_SCOPES) {
    const state = crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async handleCallback(code, redirectUri) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google token exchange failed: ${error}`);
    }

    const data = await response.json();
    this.setTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.refreshToken,
    });

    return data;
  }

  async refreshToken() {
    if (!this.refreshToken) {
      throw new Error('Google Drive refresh token not set');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google token refresh failed: ${error}`);
    }

    const data = await response.json();
    this.setTokens({ accessToken: data.access_token });
    return data;
  }

  async driveRequest(path, { method = 'GET', query, body, headers = {}, raw = false, upload = false } = {}) {
    if (!this.accessToken) {
      throw new Error('Google Drive access token not set');
    }

    const baseUrl = upload ? UPLOAD_BASE_URL : this.apiBaseUrl;
    const url = this.buildUrl(path, query).replace(this.apiBaseUrl, baseUrl);

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...this.defaultHeaders,
        ...headers,
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Drive request failed: ${error}`);
    }

    if (raw) return response;
    return response.json();
  }

  async listFiles(query = undefined, pageToken = undefined) {
    const fields = 'nextPageToken,files(id,name,mimeType,modifiedTime,size,thumbnailLink,iconLink,webViewLink,parents)';
    return this.driveRequest('files', {
      query: {
        q: query,
        pageToken,
        pageSize: 100,
        fields,
      },
    });
  }

  async getFile(fileId, fields = undefined) {
    const defaultFields = 'id,name,mimeType,modifiedTime,size,thumbnailLink,iconLink,webViewLink,parents,owners';
    return this.driveRequest(`files/${fileId}`, {
      query: { fields: fields || defaultFields },
    });
  }

  async downloadFile(fileId) {
    const response = await this.driveRequest(`files/${fileId}`, {
      query: { alt: 'media' },
      raw: true,
    });

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  }

  normalizeContent(content) {
    if (Buffer.isBuffer(content)) return content;
    if (content instanceof Uint8Array) return Buffer.from(content);
    if (typeof content === 'string') return Buffer.from(content);
    throw new Error('Unsupported content type for upload');
  }

  async uploadFile(name, mimeType, content, folderId = undefined) {
    const buffer = this.normalizeContent(content);
    const metadata = {
      name,
      mimeType,
      ...(folderId ? { parents: [folderId] } : {}),
    };

    if (buffer.length > 5 * 1024 * 1024) {
      return this.uploadResumable(metadata, buffer);
    }

    return this.uploadMultipart(metadata, buffer);
  }

  async updateFile(fileId, content = undefined, metadata = undefined) {
    if (!content) {
      return this.driveRequest(`files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata || {}),
      });
    }

    const buffer = this.normalizeContent(content);
    const uploadMetadata = metadata || {};

    const result = buffer.length > 5 * 1024 * 1024
      ? await this.uploadResumable(uploadMetadata, buffer, fileId)
      : await this.uploadMultipart(uploadMetadata, buffer, fileId);

    this.emitFileEvent('file_updated', { resource: 'file', data: result });
    return result;
  }

  async deleteFile(fileId) {
    const result = await this.driveRequest(`files/${fileId}`, { method: 'DELETE', raw: true });
    this.emitFileEvent('file_deleted', { resource: 'file', id: fileId });
    return result.ok;
  }

  async createFolder(name, parentId = undefined) {
    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    };

    const result = await this.driveRequest('files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });

    this.emitFileEvent('file_created', { resource: 'folder', data: result });
    return result;
  }

  async shareFile(fileId, email, role = 'reader') {
    return this.driveRequest(`files/${fileId}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'user', role, emailAddress: email }),
    });
  }

  async watchFile(fileId, webhookUrl) {
    const channelId = crypto.randomUUID();
    const body = {
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
    };

    return this.driveRequest(`files/${fileId}/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  handleWebhook(headers, body = {}) {
    const state = headers['x-goog-resource-state'] || headers['X-Goog-Resource-State'];
    const resourceId = headers['x-goog-resource-id'] || headers['X-Goog-Resource-Id'];
    const channelId = headers['x-goog-channel-id'] || headers['X-Goog-Channel-Id'];
    const changed = headers['x-goog-changed'] || headers['X-Goog-Changed'];

    const payload = {
      state,
      resourceId,
      channelId,
      changed,
      body,
    };

    if (state === 'add') {
      this.emitFileEvent('file_created', payload);
    } else if (state === 'update') {
      this.emitFileEvent('file_updated', payload);
    } else if (state === 'trash' || state === 'remove' || state === 'delete') {
      this.emitFileEvent('file_deleted', payload);
    }

    return payload;
  }

  async uploadMultipart(metadata, buffer, fileId = undefined) {
    const boundary = `alfie-${crypto.randomUUID()}`;
    const delimiter = `--${boundary}`;
    const closeDelimiter = `--${boundary}--`;

    const multipartBody = Buffer.concat([
      Buffer.from(`${delimiter}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
      Buffer.from(JSON.stringify(metadata)),
      Buffer.from(`\r\n${delimiter}\r\nContent-Type: ${metadata.mimeType || 'application/octet-stream'}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n${closeDelimiter}`),
    ]);

    const path = fileId ? `files/${fileId}` : 'files';
    const method = fileId ? 'PATCH' : 'POST';

    const result = await this.driveRequest(path, {
      method,
      upload: true,
      query: { uploadType: 'multipart' },
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!fileId) {
      this.emitFileEvent('file_created', { resource: 'file', data: result });
    }

    return result;
  }

  async uploadResumable(metadata, buffer, fileId = undefined) {
    const initPath = fileId ? `files/${fileId}` : 'files';
    const initMethod = fileId ? 'PATCH' : 'POST';

    const initResponse = await this.driveRequest(initPath, {
      method: initMethod,
      upload: true,
      query: { uploadType: 'resumable' },
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': metadata.mimeType || 'application/octet-stream',
        'X-Upload-Content-Length': buffer.length,
      },
      body: JSON.stringify(metadata),
      raw: true,
    });

    const uploadUrl = initResponse.headers.get('location');
    if (!uploadUrl) {
      throw new Error('Failed to initiate resumable upload');
    }

    const chunkSize = 8 * 1024 * 1024;
    let offset = 0;
    let lastResponse = null;

    while (offset < buffer.length) {
      const end = Math.min(offset + chunkSize, buffer.length);
      const chunk = buffer.slice(offset, end);
      const contentRange = `bytes ${offset}-${end - 1}/${buffer.length}`;

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': chunk.length,
          'Content-Range': contentRange,
        },
        body: chunk,
      });

      if (!response.ok && response.status !== 308) {
        const error = await response.text();
        throw new Error(`Resumable upload failed: ${error}`);
      }

      lastResponse = response;
      offset = end;
    }

    const result = lastResponse?.status === 200 || lastResponse?.status === 201
      ? await lastResponse.json()
      : null;

    if (result && !fileId) {
      this.emitFileEvent('file_created', { resource: 'file', data: result });
    }

    return result;
  }
}

export default GoogleDriveIntegration;
