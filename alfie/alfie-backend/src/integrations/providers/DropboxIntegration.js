import crypto from 'crypto';
import BaseIntegration from '../BaseIntegration.js';

const AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';
const API_BASE_URL = 'https://api.dropboxapi.com/2/';
const CONTENT_BASE_URL = 'https://content.dropboxapi.com/2/';
const DEFAULT_SCOPES = ['files.content.read', 'files.content.write', 'sharing.read'];

class DropboxIntegration extends BaseIntegration {
  constructor({ clientId, clientSecret, accessToken = null, refreshToken = null } = {}) {
    super({
      name: 'dropbox',
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
      response_type: 'code',
      redirect_uri: redirectUri,
      token_access_type: 'offline',
      scope: scopes.join(' '),
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  async handleCallback(code, redirectUri) {
    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dropbox token exchange failed: ${error}`);
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
      throw new Error('Dropbox refresh token not set');
    }

    const params = new URLSearchParams({
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dropbox token refresh failed: ${error}`);
    }

    const data = await response.json();
    this.setTokens({ accessToken: data.access_token });
    return data;
  }

  async dropboxRequest(path, body = {}, { api = true } = {}) {
    if (!this.accessToken) {
      throw new Error('Dropbox access token not set');
    }

    const baseUrl = api ? API_BASE_URL : CONTENT_BASE_URL;
    const url = this.buildUrl(path, undefined).replace(this.apiBaseUrl, baseUrl);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dropbox request failed: ${error}`);
    }

    return response.json();
  }

  normalizeContent(content) {
    if (Buffer.isBuffer(content)) return content;
    if (content instanceof Uint8Array) return Buffer.from(content);
    if (typeof content === 'string') return Buffer.from(content);
    throw new Error('Unsupported content type for upload');
  }

  async listFolder(path = '', recursive = false) {
    return this.dropboxRequest('files/list_folder', {
      path,
      recursive,
      include_media_info: true,
      include_has_explicit_shared_members: false,
      include_deleted: false,
    });
  }

  async getMetadata(path) {
    return this.dropboxRequest('files/get_metadata', {
      path,
      include_media_info: true,
      include_deleted: false,
    });
  }

  async downloadFile(path) {
    if (!this.accessToken) {
      throw new Error('Dropbox access token not set');
    }

    const url = new URL('files/download', CONTENT_BASE_URL).toString();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path }),
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dropbox download failed: ${error}`);
    }

    const metadata = response.headers.get('dropbox-api-result');
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      metadata: metadata ? JSON.parse(metadata) : null,
      content: buffer,
    };
  }

  async uploadFile(path, content, mode = 'add') {
    const buffer = this.normalizeContent(content);
    if (buffer.length > 8 * 1024 * 1024) {
      const result = await this.uploadSession(path, buffer, mode);
      this.emitFileEvent(mode === 'add' ? 'file_created' : 'file_updated', { resource: 'file', data: result });
      return result;
    }

    const url = new URL('files/upload', CONTENT_BASE_URL).toString();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path, mode, mute: false }),
      },
      body: buffer,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dropbox upload failed: ${error}`);
    }

    const result = await response.json();
    this.emitFileEvent(mode === 'add' ? 'file_created' : 'file_updated', { resource: 'file', data: result });
    return result;
  }

  async deleteFile(path) {
    const result = await this.dropboxRequest('files/delete_v2', { path });
    this.emitFileEvent('file_deleted', { resource: 'file', data: result });
    return result;
  }

  async createFolder(path) {
    const result = await this.dropboxRequest('files/create_folder_v2', { path, autorename: false });
    this.emitFileEvent('file_created', { resource: 'folder', data: result });
    return result;
  }

  async shareFile(path, settings = {}) {
    return this.dropboxRequest('sharing/create_shared_link_with_settings', {
      path,
      settings,
    });
  }

  async getSharedLinkMetadata(url) {
    return this.dropboxRequest('sharing/get_shared_link_metadata', { url });
  }

  async listFolderLongpoll(cursor) {
    return this.dropboxRequest('files/list_folder/longpoll', { cursor, timeout: 30 });
  }

  async uploadSession(path, buffer, mode) {
    const startUrl = new URL('files/upload_session/start', CONTENT_BASE_URL).toString();
    const appendUrl = new URL('files/upload_session/append_v2', CONTENT_BASE_URL).toString();
    const finishUrl = new URL('files/upload_session/finish', CONTENT_BASE_URL).toString();

    const chunkSize = 8 * 1024 * 1024;
    let offset = 0;
    let sessionId;

    const firstChunk = buffer.slice(0, chunkSize);
    let response = await fetch(startUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ close: false }),
      },
      body: firstChunk,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dropbox upload session start failed: ${error}`);
    }

    const startResult = await response.json();
    sessionId = startResult.session_id;
    offset += firstChunk.length;

    while (offset < buffer.length - chunkSize) {
      const chunk = buffer.slice(offset, offset + chunkSize);
      response = await fetch(appendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({ cursor: { session_id: sessionId, offset }, close: false }),
        },
        body: chunk,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Dropbox upload session append failed: ${error}`);
      }

      offset += chunk.length;
    }

    const lastChunk = buffer.slice(offset);
    response = await fetch(finishUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          cursor: { session_id: sessionId, offset },
          commit: { path, mode, mute: false },
        }),
      },
      body: lastChunk,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dropbox upload session finish failed: ${error}`);
    }

    return response.json();
  }
}

export default DropboxIntegration;
