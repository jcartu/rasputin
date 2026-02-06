/**
 * Email Routes - API endpoints for email operations
 */
import express from 'express';
import * as emailService from '../services/emailService.js';
import * as emailAiService from '../services/emailAiService.js';
import { log } from '../services/logger.js';

const router = express.Router();

/**
 * Get supported email providers
 */
router.get('/api/email/providers', (req, res) => {
  try {
    const providers = emailService.getSupportedProviders();
    res.json({ providers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get OAuth authorization URL for a provider
 */
router.post('/api/email/oauth/authorize', (req, res) => {
  try {
    const { provider, redirectUri } = req.body;
    const userId = req.user?.id || req.body.userId || 'default';

    if (!provider || !redirectUri) {
      return res.status(400).json({ error: 'provider and redirectUri required' });
    }

    const { url, state } = emailService.getAuthorizationUrl(provider, userId, redirectUri);
    res.json({ url, state });
  } catch (error) {
    log.error('OAuth authorize failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handle OAuth callback
 */
router.post('/api/email/oauth/callback', async (req, res) => {
  try {
    const { provider, code, state, redirectUri } = req.body;

    if (!provider || !code || !state) {
      return res.status(400).json({ error: 'provider, code, and state required' });
    }

    const result = await emailService.handleOAuthCallback(provider, code, state, redirectUri);
    res.json(result);
  } catch (error) {
    log.error('OAuth callback failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Connect IMAP account
 */
router.post('/api/email/imap/connect', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId || 'default';
    const { email, password, imapHost, imapPort, smtpHost, smtpPort, useTls } = req.body;

    if (!email || !password || !imapHost) {
      return res.status(400).json({ error: 'email, password, and imapHost required' });
    }

    const result = await emailService.connectImapAccount(userId, {
      email, password, imapHost, imapPort, smtpHost, smtpPort, useTls
    });
    res.json(result);
  } catch (error) {
    log.error('IMAP connect failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * List connected email accounts
 */
router.get('/api/email/accounts', (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId || 'default';
    const accounts = emailService.getAccounts(userId);
    res.json({ accounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Disconnect email account
 */
router.delete('/api/email/accounts/:accountId', (req, res) => {
  try {
    const { accountId } = req.params;
    emailService.disconnectAccount(accountId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * List emails
 */
router.get('/api/email/accounts/:accountId/emails', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { folder, limit, offset, query } = req.query;

    const emails = await emailService.listEmails(accountId, {
      folder,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      query
    });

    res.json({ emails, count: emails.length });
  } catch (error) {
    log.error('List emails failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get single email
 */
router.get('/api/email/accounts/:accountId/emails/:emailId', async (req, res) => {
  try {
    const { accountId, emailId } = req.params;
    const email = await emailService.getEmail(accountId, emailId);

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json({ email });
  } catch (error) {
    log.error('Get email failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send email
 */
router.post('/api/email/accounts/:accountId/send', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { to, cc, bcc, subject, body, htmlBody, attachments, replyToId } = req.body;

    if (!to?.length || !subject) {
      return res.status(400).json({ error: 'to and subject required' });
    }

    const result = await emailService.sendEmail(accountId, {
      to, cc, bcc, subject, body, htmlBody, attachments, replyToId
    });

    res.json(result);
  } catch (error) {
    log.error('Send email failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mark email as read/unread
 */
router.post('/api/email/accounts/:accountId/emails/:emailId/read', async (req, res) => {
  try {
    const { accountId, emailId } = req.params;
    const { isRead } = req.body;

    const result = await emailService.markAsRead(accountId, emailId, isRead !== false);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete email
 */
router.delete('/api/email/accounts/:accountId/emails/:emailId', async (req, res) => {
  try {
    const { accountId, emailId } = req.params;
    const { permanent } = req.query;

    const result = await emailService.deleteEmail(accountId, emailId, permanent === 'true');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get folders/labels
 */
router.get('/api/email/accounts/:accountId/folders', async (req, res) => {
  try {
    const { accountId } = req.params;
    const folders = await emailService.getFolders(accountId);
    res.json({ folders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search emails
 */
router.post('/api/email/accounts/:accountId/search', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { query, folder, limit } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query required' });
    }

    const emails = await emailService.searchEmails(accountId, query, {
      folder,
      limit: parseInt(limit) || 50
    });

    res.json({ emails, count: emails.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get attachment
 */
router.get('/api/email/accounts/:accountId/emails/:emailId/attachments/:attachmentId', async (req, res) => {
  try {
    const { accountId, emailId, attachmentId } = req.params;
    const attachment = await emailService.getAttachment(accountId, emailId, attachmentId);

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Return base64 content
    res.json(attachment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Drafts =====

/**
 * Save draft
 */
router.post('/api/email/accounts/:accountId/drafts', async (req, res) => {
  try {
    const { accountId } = req.params;
    const draftData = req.body;

    const result = await emailService.saveDraft(accountId, draftData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get drafts
 */
router.get('/api/email/accounts/:accountId/drafts', (req, res) => {
  try {
    const { accountId } = req.params;
    const drafts = emailService.getDrafts(accountId);
    res.json({ drafts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete draft
 */
router.delete('/api/email/drafts/:draftId', (req, res) => {
  try {
    const { draftId } = req.params;
    emailService.deleteDraft(draftId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== AI Features =====

/**
 * Generate smart reply suggestions
 */
router.post('/api/email/ai/smart-replies', async (req, res) => {
  try {
    const { email, tone, count } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email required' });
    }

    const suggestions = await emailAiService.generateSmartReplies(email, { tone, count });
    res.json({ suggestions });
  } catch (error) {
    log.error('Smart replies failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Summarize email(s)
 */
router.post('/api/email/ai/summarize', async (req, res) => {
  try {
    const { emails, style, includeActionItems } = req.body;

    if (!emails) {
      return res.status(400).json({ error: 'emails required' });
    }

    const summary = await emailAiService.summarizeEmail(emails, { style, includeActionItems });
    res.json(summary);
  } catch (error) {
    log.error('Summarize failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * AI-assisted compose
 */
router.post('/api/email/ai/compose', async (req, res) => {
  try {
    const { intent, content, context, tone, language } = req.body;

    if (!intent || !content) {
      return res.status(400).json({ error: 'intent and content required' });
    }

    const result = await emailAiService.assistCompose({ intent, content, context, tone, language });
    res.json(result);
  } catch (error) {
    log.error('AI compose failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Autocomplete text
 */
router.post('/api/email/ai/autocomplete', async (req, res) => {
  try {
    const { text, context } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }

    const result = await emailAiService.autocomplete(text, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Analyze email
 */
router.post('/api/email/ai/analyze', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email required' });
    }

    const analysis = await emailAiService.analyzeEmail(email);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Extract action items
 */
router.post('/api/email/ai/action-items', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email required' });
    }

    const result = await emailAiService.extractActionItems(email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Convert email to chat session
 */
router.post('/api/email/convert-to-session', async (req, res) => {
  try {
    const { email, includeThread } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email required' });
    }

    const session = emailAiService.convertToSession(email, { includeThread });
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
