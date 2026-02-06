import { Router } from 'express';
import * as shareService from '../services/shareService.js';

const router = Router();

/**
 * @route POST /api/shares
 * @description Create a new share for a session
 */
router.post('/', async (req, res) => {
  try {
    const {
      sessionId,
      title,
      description,
      visibility,
      viewOnly,
      allowComments,
      allowCopy,
      allowEmbed,
      password,
      expiresIn,
      maxViews,
      allowedEmails,
      createSnapshot,
      snapshotName,
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const share = shareService.createShare(sessionId, {
      title,
      description,
      visibility,
      viewOnly,
      allowComments,
      allowCopy,
      allowEmbed,
      password,
      expiresIn,
      maxViews,
      allowedEmails,
      createSnapshot,
      snapshotName,
    });

    res.status(201).json(share);
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/shares
 * @description List all shares (dashboard)
 */
router.get('/', async (req, res) => {
  try {
    const { status, visibility, sortBy, sortOrder, page, limit } = req.query;

    const result = shareService.listAllShares({
      status,
      visibility,
      sortBy,
      sortOrder,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    res.json(result);
  } catch (error) {
    console.error('List shares error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/shares/stats
 * @description Get share statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = shareService.getShareStats();
    res.json(stats);
  } catch (error) {
    console.error('Share stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/shares/session/:sessionId
 * @description List shares for a specific session
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const shares = shareService.listSharesForSession(sessionId);
    res.json({ shares });
  } catch (error) {
    console.error('List session shares error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/shares/:id
 * @description Get share by ID (for management)
 */
router.get('/:id', async (req, res) => {
  try {
    const share = shareService.getShareById(req.params.id);
    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }
    res.json({
      ...share,
      shareUrl: `/share/${share.token}`,
      hasPassword: !!share.passwordHash,
    });
  } catch (error) {
    console.error('Get share error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route PUT /api/shares/:id
 * @description Update a share
 */
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body;
    const share = shareService.updateShare(req.params.id, updates);
    res.json({
      ...share,
      shareUrl: `/share/${share.token}`,
      hasPassword: !!share.passwordHash,
    });
  } catch (error) {
    console.error('Update share error:', error);
    if (error.message === 'Share not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route DELETE /api/shares/:id
 * @description Delete a share
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = shareService.deleteShare(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Share not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete share error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/shares/:id/regenerate-token
 * @description Regenerate share token
 */
router.post('/:id/regenerate-token', async (req, res) => {
  try {
    const share = shareService.regenerateShareToken(req.params.id);
    res.json({
      ...share,
      shareUrl: `/share/${share.token}`,
      hasPassword: !!share.passwordHash,
    });
  } catch (error) {
    console.error('Regenerate token error:', error);
    if (error.message === 'Share not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/shares/access/:token
 * @description Access a shared session (public endpoint)
 */
router.post('/access/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password, email } = req.body;

    const result = shareService.accessShare(token, { password, email });

    if (!result.valid) {
      const status = result.requiresPassword ? 401 : 403;
      return res.status(status).json({ 
        error: result.error,
        requiresPassword: result.requiresPassword || false,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Access share error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/shares/verify-password/:token
 * @description Verify share password without accessing
 */
router.post('/verify-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const result = shareService.verifySharePassword(token, password);
    res.json(result);
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/shares/check/:token
 * @description Check share status without accessing (for preview)
 */
router.get('/check/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const share = shareService.getShareByToken(token);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    // Check expiration
    const isExpired = share.expiresAt && new Date(share.expiresAt) <= new Date();
    const isMaxViewsReached = share.maxViews && share.viewCount >= share.maxViews;

    res.json({
      exists: true,
      title: share.title,
      description: share.description,
      requiresPassword: !!share.passwordHash,
      isExpired,
      isMaxViewsReached,
      visibility: share.visibility,
      viewOnly: share.viewOnly,
      allowCopy: share.allowCopy,
      createdAt: share.createdAt,
    });
  } catch (error) {
    console.error('Check share error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SNAPSHOTS ====================

/**
 * @route POST /api/shares/snapshots
 * @description Create a snapshot of a session
 */
router.post('/snapshots', async (req, res) => {
  try {
    const { sessionId, name, description } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const snapshot = shareService.createSnapshot(sessionId, { name, description });
    res.status(201).json(snapshot);
  } catch (error) {
    console.error('Create snapshot error:', error);
    if (error.message === 'Session not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/shares/snapshots/:sessionId
 * @description List snapshots for a session
 */
router.get('/snapshots/:sessionId', async (req, res) => {
  try {
    const snapshots = shareService.listSnapshots(req.params.sessionId);
    res.json({ snapshots });
  } catch (error) {
    console.error('List snapshots error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/shares/snapshot/:id
 * @description Get a specific snapshot
 */
router.get('/snapshot/:id', async (req, res) => {
  try {
    const snapshot = shareService.getSnapshot(req.params.id);
    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    res.json(snapshot);
  } catch (error) {
    console.error('Get snapshot error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route DELETE /api/shares/snapshot/:id
 * @description Delete a snapshot
 */
router.delete('/snapshot/:id', async (req, res) => {
  try {
    const deleted = shareService.deleteSnapshot(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete snapshot error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
