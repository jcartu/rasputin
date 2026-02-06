import express from 'express';
import * as collaboration from '../services/collaboration.js';
import * as permissions from '../services/permissions.js';
import * as comments from '../services/comments.js';
import * as presence from '../services/presence.js';

const router = express.Router();

router.post('/api/documents', async (req, res) => {
  try {
    const { title, content, language, ownerId } = req.body;
    const userId = req.headers['x-user-id'] || ownerId || 'anonymous';
    
    const doc = collaboration.createDocument({
      title,
      language,
      ownerId: userId,
    });
    
    if (content) {
      const docData = collaboration.getDocument(doc.id);
      if (docData) {
        collaboration.applyDocumentUpdate(doc.id, userId, []);
      }
    }
    
    permissions.initDocumentPermissions(doc.id, userId);
    
    res.json({
      success: true,
      document: doc,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/documents', async (req, res) => {
  try {
    const docs = collaboration.listDocuments();
    res.json({ documents: docs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/documents/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id } = req.params;
    
    if (!permissions.canView(id, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const doc = collaboration.getDocument(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({ document: doc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/documents/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id } = req.params;
    
    if (!permissions.canAdmin(id, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    collaboration.deleteDocument(id);
    permissions.deleteDocumentPermissions(id);
    comments.deleteDocumentComments(id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/documents/:id/users', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id } = req.params;
    
    if (!permissions.canView(id, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const users = presence.getDocumentPresence(id);
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/documents/:id/collaborators', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id } = req.params;
    
    if (!permissions.canView(id, userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const collaborators = permissions.getDocumentCollaborators(id);
    res.json({ collaborators });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/documents/:id/share', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id } = req.params;
    const { targetUserId, permission, expiresIn, maxUses } = req.body;
    
    if (targetUserId) {
      permissions.setUserPermission(id, targetUserId, permission, userId);
      res.json({ success: true });
    } else {
      const link = permissions.createShareLink(id, { 
        permission, 
        expiresIn, 
        maxUses 
      }, userId);
      res.json({ shareLink: link });
    }
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

router.post('/api/documents/:id/share/use', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { linkId } = req.body;
    
    const result = permissions.useShareLink(linkId, userId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/api/documents/:id/share/:linkId', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { linkId } = req.params;
    
    permissions.revokeShareLink(linkId, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

router.get('/api/documents/:id/share/links', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id } = req.params;
    
    const links = permissions.getDocumentShareLinks(id, userId);
    res.json({ links });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

router.post('/api/documents/:id/public', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id } = req.params;
    const { isPublic, permission } = req.body;
    
    permissions.setPublicAccess(id, isPublic, permission, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

router.get('/api/documents/:id/comments', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id } = req.params;
    const { resolved, lineNumber } = req.query;
    
    const docComments = comments.getDocumentComments(id, userId, {
      resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      lineNumber: lineNumber ? parseInt(lineNumber) : undefined,
      parentId: null,
    });
    
    res.json({ comments: docComments });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

router.post('/api/documents/:id/comments', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id } = req.params;
    
    const comment = comments.createComment(id, userId, req.body);
    res.json({ comment });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

router.put('/api/documents/:id/comments/:commentId', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id, commentId } = req.params;
    
    const comment = comments.updateComment(id, commentId, userId, req.body);
    res.json({ comment });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

router.delete('/api/documents/:id/comments/:commentId', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id, commentId } = req.params;
    
    comments.deleteComment(id, commentId, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

router.post('/api/documents/:id/comments/:commentId/resolve', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id, commentId } = req.params;
    
    const comment = comments.resolveComment(id, commentId, userId);
    res.json({ comment });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

router.post('/api/documents/:id/comments/:commentId/unresolve', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id, commentId } = req.params;
    
    const comment = comments.unresolveComment(id, commentId, userId);
    res.json({ comment });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

router.post('/api/documents/:id/comments/:commentId/reactions', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id, commentId } = req.params;
    const { reaction } = req.body;
    
    const comment = comments.addReaction(id, commentId, userId, reaction);
    res.json({ comment });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

router.delete('/api/documents/:id/comments/:commentId/reactions/:reaction', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    const { id, commentId, reaction } = req.params;
    
    comments.removeReaction(id, commentId, userId, reaction);
    res.json({ success: true });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

export default router;
