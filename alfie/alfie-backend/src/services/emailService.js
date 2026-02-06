/**
 * Email Service - Unified email client supporting Gmail, Outlook, and IMAP
 */
import crypto from 'crypto';
import config from '../config.js';
import { log } from './logger.js';

// In-memory storage for email accounts and cached emails
const emailAccounts = new Map();
const emailCache = new Map();
const drafts = new Map();

// Provider configurations
const PROVIDERS = {
  gmail: {
    name: 'Gmail',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    apiBase: 'https://gmail.googleapis.com/gmail/v1',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
      'openid',
      'email',
      'profile'
    ]
  },
  outlook: {
    name: 'Microsoft Outlook',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    apiBase: 'https://graph.microsoft.com/v1.0',
    scopes: [
      'offline_access',
      'User.Read',
      'Mail.Read',
      'Mail.Send',
      'Mail.ReadWrite'
    ]
  },
  imap: {
    name: 'IMAP',
    // IMAP uses direct connection, no OAuth
  }
};

// Pending OAuth states
const pendingOAuthStates = new Map();

/**
 * Generate a secure random state for OAuth
 */
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get OAuth authorization URL for a provider
 */
export function getAuthorizationUrl(provider, userId, redirectUri) {
  const providerConfig = PROVIDERS[provider];
  if (!providerConfig || provider === 'imap') {
    throw new Error(`OAuth not supported for provider: ${provider}`);
  }

  const clientId = config.email?.[provider]?.clientId;
  if (!clientId) {
    throw new Error(`Email OAuth not configured for provider: ${provider}`);
  }

  const state = generateState();
  pendingOAuthStates.set(state, {
    provider,
    userId,
    redirectUri,
    createdAt: Date.now()
  });

  // Clean up expired states after 10 minutes
  setTimeout(() => pendingOAuthStates.delete(state), 10 * 60 * 1000);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: providerConfig.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent'
  });

  return {
    url: `${providerConfig.authUrl}?${params.toString()}`,
    state
  };
}

/**
 * Validate OAuth state
 */
export function validateState(state) {
  const stateData = pendingOAuthStates.get(state);
  if (!stateData) {
    return { valid: false, error: 'Invalid or expired state' };
  }
  pendingOAuthStates.delete(state);
  return { valid: true, data: stateData };
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(provider, code, redirectUri) {
  const providerConfig = PROVIDERS[provider];
  const clientId = config.email?.[provider]?.clientId;
  const clientSecret = config.email?.[provider]?.clientSecret;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const response = await fetch(providerConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token
 */
async function refreshAccessToken(provider, refreshToken) {
  const providerConfig = PROVIDERS[provider];
  const clientId = config.email?.[provider]?.clientId;
  const clientSecret = config.email?.[provider]?.clientSecret;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const response = await fetch(providerConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  return response.json();
}

/**
 * Handle OAuth callback
 */
export async function handleOAuthCallback(provider, code, state, redirectUri) {
  const stateValidation = validateState(state);
  if (!stateValidation.valid) {
    throw new Error(stateValidation.error);
  }

  const { userId } = stateValidation.data;
  const tokens = await exchangeCodeForTokens(provider, code, redirectUri);

  // Get user info to get email address
  let userEmail;
  if (provider === 'gmail') {
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    }).then(r => r.json());
    userEmail = userInfo.email;
  } else if (provider === 'outlook') {
    const userInfo = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    }).then(r => r.json());
    userEmail = userInfo.mail || userInfo.userPrincipalName;
  }

  // Store account
  const accountId = crypto.randomUUID();
  const account = {
    id: accountId,
    userId,
    provider,
    email: userEmail,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in * 1000),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  emailAccounts.set(accountId, account);
  log.info('Email account connected', { accountId, provider, email: userEmail });

  return {
    accountId,
    email: userEmail,
    provider
  };
}

/**
 * Connect IMAP account
 */
export async function connectImapAccount(userId, config) {
  const { email, password, imapHost, imapPort, smtpHost, smtpPort, useTls } = config;

  // Validate IMAP connection (simplified - in production, actually test the connection)
  const accountId = crypto.randomUUID();
  const account = {
    id: accountId,
    userId,
    provider: 'imap',
    email,
    imapConfig: {
      host: imapHost,
      port: imapPort || 993,
      secure: useTls !== false
    },
    smtpConfig: {
      host: smtpHost,
      port: smtpPort || 587,
      secure: useTls !== false
    },
    // Store encrypted in production
    credentials: { email, password },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  emailAccounts.set(accountId, account);
  log.info('IMAP account connected', { accountId, email });

  return {
    accountId,
    email,
    provider: 'imap'
  };
}

/**
 * Get valid access token (refresh if needed)
 */
async function getValidToken(account) {
  if (account.provider === 'imap') {
    return null; // IMAP doesn't use OAuth tokens
  }

  if (Date.now() < account.expiresAt - 60000) {
    return account.accessToken;
  }

  // Token expired or about to expire, refresh it
  const tokens = await refreshAccessToken(account.provider, account.refreshToken);
  account.accessToken = tokens.access_token;
  account.expiresAt = Date.now() + (tokens.expires_in * 1000);
  if (tokens.refresh_token) {
    account.refreshToken = tokens.refresh_token;
  }
  account.updatedAt = new Date();
  emailAccounts.set(account.id, account);

  return account.accessToken;
}

/**
 * List emails from inbox
 */
export async function listEmails(accountId, options = {}) {
  const account = emailAccounts.get(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const { folder = 'inbox', limit = 50, offset = 0, query } = options;
  const token = await getValidToken(account);

  let emails = [];

  if (account.provider === 'gmail') {
    emails = await fetchGmailEmails(token, { folder, limit, offset, query });
  } else if (account.provider === 'outlook') {
    emails = await fetchOutlookEmails(token, { folder, limit, offset, query });
  } else if (account.provider === 'imap') {
    emails = await fetchImapEmails(account, { folder, limit, offset, query });
  }

  // Cache emails
  emails.forEach(email => {
    emailCache.set(`${accountId}:${email.id}`, email);
  });

  return emails;
}

/**
 * Fetch emails from Gmail
 */
async function fetchGmailEmails(token, options) {
  const { folder, limit, offset, query } = options;
  
  let q = '';
  if (folder === 'inbox') q = 'in:inbox';
  else if (folder === 'sent') q = 'in:sent';
  else if (folder === 'drafts') q = 'in:drafts';
  else if (folder === 'trash') q = 'in:trash';
  else if (folder === 'spam') q = 'in:spam';
  if (query) q += ` ${query}`;

  const params = new URLSearchParams({
    maxResults: String(limit),
    q
  });

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!listResponse.ok) {
    throw new Error('Failed to fetch Gmail messages');
  }

  const listData = await listResponse.json();
  if (!listData.messages) {
    return [];
  }

  // Fetch full message details
  const emails = await Promise.all(
    listData.messages.slice(offset, offset + limit).map(async (msg) => {
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const msgData = await msgResponse.json();
      return parseGmailMessage(msgData);
    })
  );

  return emails;
}

/**
 * Parse Gmail message format
 */
function parseGmailMessage(msg) {
  const headers = msg.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

  let body = '';
  let htmlBody = '';
  const attachments = [];

  function extractParts(parts) {
    for (const part of parts || []) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
      } else if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size
        });
      } else if (part.parts) {
        extractParts(part.parts);
      }
    }
  }

  if (msg.payload?.body?.data) {
    body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
  } else {
    extractParts(msg.payload?.parts);
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: parseEmailAddress(getHeader('From')),
    to: parseEmailAddresses(getHeader('To')),
    cc: parseEmailAddresses(getHeader('Cc')),
    bcc: parseEmailAddresses(getHeader('Bcc')),
    subject: getHeader('Subject') || '(No subject)',
    body,
    htmlBody,
    date: new Date(parseInt(msg.internalDate)),
    labels: msg.labelIds || [],
    isRead: !msg.labelIds?.includes('UNREAD'),
    isStarred: msg.labelIds?.includes('STARRED'),
    snippet: msg.snippet,
    attachments
  };
}

/**
 * Fetch emails from Outlook
 */
async function fetchOutlookEmails(token, options) {
  const { folder, limit, offset, query } = options;

  let folderPath = 'inbox';
  if (folder === 'sent') folderPath = 'sentItems';
  else if (folder === 'drafts') folderPath = 'drafts';
  else if (folder === 'trash') folderPath = 'deletedItems';
  else if (folder === 'spam') folderPath = 'junkemail';

  let url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folderPath}/messages`;
  url += `?$top=${limit}&$skip=${offset}&$orderby=receivedDateTime desc`;
  
  if (query) {
    url += `&$search="${encodeURIComponent(query)}"`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Outlook messages');
  }

  const data = await response.json();
  return (data.value || []).map(parseOutlookMessage);
}

/**
 * Parse Outlook message format
 */
function parseOutlookMessage(msg) {
  return {
    id: msg.id,
    threadId: msg.conversationId,
    from: {
      email: msg.from?.emailAddress?.address,
      name: msg.from?.emailAddress?.name
    },
    to: (msg.toRecipients || []).map(r => ({
      email: r.emailAddress?.address,
      name: r.emailAddress?.name
    })),
    cc: (msg.ccRecipients || []).map(r => ({
      email: r.emailAddress?.address,
      name: r.emailAddress?.name
    })),
    bcc: (msg.bccRecipients || []).map(r => ({
      email: r.emailAddress?.address,
      name: r.emailAddress?.name
    })),
    subject: msg.subject || '(No subject)',
    body: msg.body?.contentType === 'text' ? msg.body?.content : '',
    htmlBody: msg.body?.contentType === 'html' ? msg.body?.content : '',
    date: new Date(msg.receivedDateTime),
    labels: msg.categories || [],
    isRead: msg.isRead,
    isStarred: msg.flag?.flagStatus === 'flagged',
    snippet: msg.bodyPreview,
    attachments: msg.hasAttachments ? [] : [] // Would need separate API call
  };
}

/**
 * Fetch emails from IMAP (simplified - production would use real IMAP library)
 */
async function fetchImapEmails(account, options) {
  // In production, use imap library to connect and fetch
  log.warn('IMAP email fetching not fully implemented');
  return [];
}

/**
 * Get single email by ID
 */
export async function getEmail(accountId, emailId) {
  // Check cache first
  const cacheKey = `${accountId}:${emailId}`;
  if (emailCache.has(cacheKey)) {
    return emailCache.get(cacheKey);
  }

  const account = emailAccounts.get(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const token = await getValidToken(account);
  let email;

  if (account.provider === 'gmail') {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    email = parseGmailMessage(data);
  } else if (account.provider === 'outlook') {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${emailId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    email = parseOutlookMessage(data);
  }

  if (email) {
    emailCache.set(cacheKey, email);
  }

  return email;
}

/**
 * Send email
 */
export async function sendEmail(accountId, emailData) {
  const account = emailAccounts.get(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const token = await getValidToken(account);
  const { to, cc, bcc, subject, body, htmlBody, attachments, replyToId } = emailData;

  if (account.provider === 'gmail') {
    return sendGmailEmail(token, { to, cc, bcc, subject, body, htmlBody, attachments, replyToId });
  } else if (account.provider === 'outlook') {
    return sendOutlookEmail(token, { to, cc, bcc, subject, body, htmlBody, attachments, replyToId });
  } else if (account.provider === 'imap') {
    return sendImapEmail(account, { to, cc, bcc, subject, body, htmlBody, attachments });
  }
}

/**
 * Send email via Gmail
 */
async function sendGmailEmail(token, emailData) {
  const { to, cc, bcc, subject, body, htmlBody, attachments, replyToId } = emailData;

  // Build MIME message
  const boundary = crypto.randomBytes(16).toString('hex');
  let message = '';

  message += `To: ${to.map(formatEmailAddress).join(', ')}\r\n`;
  if (cc?.length) message += `Cc: ${cc.map(formatEmailAddress).join(', ')}\r\n`;
  if (bcc?.length) message += `Bcc: ${bcc.map(formatEmailAddress).join(', ')}\r\n`;
  message += `Subject: ${subject}\r\n`;
  message += `MIME-Version: 1.0\r\n`;

  if (attachments?.length) {
    message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    message += `--${boundary}\r\n`;
    message += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
    message += htmlBody || body;
    message += `\r\n`;

    for (const attachment of attachments) {
      message += `--${boundary}\r\n`;
      message += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n`;
      message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n\r\n`;
      message += attachment.content;
      message += `\r\n`;
    }
    message += `--${boundary}--`;
  } else {
    message += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
    message += htmlBody || body;
  }

  const encodedMessage = Buffer.from(message).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const url = replyToId
    ? `https://gmail.googleapis.com/gmail/v1/users/me/messages/${replyToId}/reply`
    : 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encodedMessage })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  const result = await response.json();
  log.info('Email sent via Gmail', { messageId: result.id });
  return { success: true, messageId: result.id };
}

/**
 * Send email via Outlook
 */
async function sendOutlookEmail(token, emailData) {
  const { to, cc, bcc, subject, body, htmlBody, replyToId } = emailData;

  const message = {
    subject,
    body: {
      contentType: htmlBody ? 'HTML' : 'Text',
      content: htmlBody || body
    },
    toRecipients: to.map(addr => ({
      emailAddress: { address: addr.email, name: addr.name }
    })),
    ccRecipients: (cc || []).map(addr => ({
      emailAddress: { address: addr.email, name: addr.name }
    })),
    bccRecipients: (bcc || []).map(addr => ({
      emailAddress: { address: addr.email, name: addr.name }
    }))
  };

  const url = replyToId
    ? `https://graph.microsoft.com/v1.0/me/messages/${replyToId}/reply`
    : 'https://graph.microsoft.com/v1.0/me/sendMail';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(replyToId ? { comment: htmlBody || body } : { message, saveToSentItems: true })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  log.info('Email sent via Outlook');
  return { success: true };
}

/**
 * Send email via SMTP (for IMAP accounts)
 */
async function sendImapEmail(account, emailData) {
  // In production, use nodemailer to send via SMTP
  log.warn('SMTP email sending not fully implemented');
  throw new Error('SMTP sending not implemented');
}

/**
 * Save draft
 */
export async function saveDraft(accountId, draftData) {
  const account = emailAccounts.get(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const draftId = draftData.id || crypto.randomUUID();
  const draft = {
    id: draftId,
    accountId,
    ...draftData,
    updatedAt: new Date()
  };

  drafts.set(draftId, draft);

  // Also save to provider if OAuth
  const token = await getValidToken(account);
  if (account.provider === 'gmail' && token) {
    // Save to Gmail drafts
    // Simplified - would need full MIME building
  } else if (account.provider === 'outlook' && token) {
    // Save to Outlook drafts
  }

  return { success: true, draftId };
}

/**
 * Get drafts
 */
export function getDrafts(accountId) {
  const accountDrafts = [];
  for (const [id, draft] of drafts) {
    if (draft.accountId === accountId) {
      accountDrafts.push(draft);
    }
  }
  return accountDrafts.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Delete draft
 */
export function deleteDraft(draftId) {
  return drafts.delete(draftId);
}

/**
 * Mark email as read/unread
 */
export async function markAsRead(accountId, emailId, isRead = true) {
  const account = emailAccounts.get(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const token = await getValidToken(account);

  if (account.provider === 'gmail') {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`;
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        removeLabelIds: isRead ? ['UNREAD'] : [],
        addLabelIds: isRead ? [] : ['UNREAD']
      })
    });
  } else if (account.provider === 'outlook') {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${emailId}`;
    await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isRead })
    });
  }

  // Update cache
  const cacheKey = `${accountId}:${emailId}`;
  if (emailCache.has(cacheKey)) {
    const email = emailCache.get(cacheKey);
    email.isRead = isRead;
    emailCache.set(cacheKey, email);
  }

  return { success: true };
}

/**
 * Delete email
 */
export async function deleteEmail(accountId, emailId, permanent = false) {
  const account = emailAccounts.get(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const token = await getValidToken(account);

  if (account.provider === 'gmail') {
    const url = permanent
      ? `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}`
      : `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/trash`;
    await fetch(url, {
      method: permanent ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  } else if (account.provider === 'outlook') {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${emailId}`;
    if (permanent) {
      await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    } else {
      await fetch(`${url}/move`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ destinationId: 'deleteditems' })
      });
    }
  }

  // Remove from cache
  emailCache.delete(`${accountId}:${emailId}`);

  return { success: true };
}

/**
 * Get attachment
 */
export async function getAttachment(accountId, emailId, attachmentId) {
  const account = emailAccounts.get(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const token = await getValidToken(account);

  if (account.provider === 'gmail') {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/attachments/${attachmentId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    return {
      content: data.data,
      size: data.size
    };
  } else if (account.provider === 'outlook') {
    const url = `https://graph.microsoft.com/v1.0/me/messages/${emailId}/attachments/${attachmentId}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    return {
      content: data.contentBytes,
      contentType: data.contentType,
      filename: data.name,
      size: data.size
    };
  }
}

/**
 * Search emails
 */
export async function searchEmails(accountId, query, options = {}) {
  return listEmails(accountId, { ...options, query });
}

/**
 * Get folders/labels
 */
export async function getFolders(accountId) {
  const account = emailAccounts.get(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const token = await getValidToken(account);

  if (account.provider === 'gmail') {
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    return (data.labels || []).map(l => ({
      id: l.id,
      name: l.name,
      type: l.type
    }));
  } else if (account.provider === 'outlook') {
    const response = await fetch(
      'https://graph.microsoft.com/v1.0/me/mailFolders',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    return (data.value || []).map(f => ({
      id: f.id,
      name: f.displayName,
      unreadCount: f.unreadItemCount,
      totalCount: f.totalItemCount
    }));
  }

  return [];
}

/**
 * Get connected accounts for a user
 */
export function getAccounts(userId) {
  const userAccounts = [];
  for (const [id, account] of emailAccounts) {
    if (account.userId === userId) {
      userAccounts.push({
        id: account.id,
        provider: account.provider,
        email: account.email,
        createdAt: account.createdAt
      });
    }
  }
  return userAccounts;
}

/**
 * Disconnect account
 */
export function disconnectAccount(accountId) {
  const account = emailAccounts.get(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  // Clear cached emails for this account
  for (const key of emailCache.keys()) {
    if (key.startsWith(`${accountId}:`)) {
      emailCache.delete(key);
    }
  }

  // Clear drafts
  for (const [draftId, draft] of drafts) {
    if (draft.accountId === accountId) {
      drafts.delete(draftId);
    }
  }

  emailAccounts.delete(accountId);
  log.info('Email account disconnected', { accountId });

  return { success: true };
}

/**
 * Check if provider is configured
 */
export function isProviderConfigured(provider) {
  if (provider === 'imap') return true;
  return !!(config.email?.[provider]?.clientId && config.email?.[provider]?.clientSecret);
}

/**
 * Get supported providers
 */
export function getSupportedProviders() {
  return Object.entries(PROVIDERS).map(([id, provider]) => ({
    id,
    name: provider.name,
    configured: isProviderConfigured(id),
    oauth: id !== 'imap'
  }));
}

// Utility functions
function parseEmailAddress(str) {
  if (!str) return null;
  const match = str.match(/(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?/);
  if (match) {
    return { name: match[1] || '', email: match[2] };
  }
  return { email: str, name: '' };
}

function parseEmailAddresses(str) {
  if (!str) return [];
  return str.split(',').map(s => parseEmailAddress(s.trim())).filter(Boolean);
}

function formatEmailAddress(addr) {
  if (addr.name) {
    return `"${addr.name}" <${addr.email}>`;
  }
  return addr.email;
}

export default {
  getAuthorizationUrl,
  validateState,
  handleOAuthCallback,
  connectImapAccount,
  listEmails,
  getEmail,
  sendEmail,
  saveDraft,
  getDrafts,
  deleteDraft,
  markAsRead,
  deleteEmail,
  getAttachment,
  searchEmails,
  getFolders,
  getAccounts,
  disconnectAccount,
  isProviderConfigured,
  getSupportedProviders
};
