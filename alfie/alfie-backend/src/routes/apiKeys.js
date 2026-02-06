import { Router } from 'express';
import * as apiKeyService from '../services/apiKeyService.js';
import { authenticate, requirePermission, requireOwnerOrPermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../services/rbacService.js';
import * as rbacService from '../services/rbacService.js';

const router = Router();

router.use(authenticate({ required: true, allowApiKey: false }));

router.get('/', requirePermission(PERMISSIONS.APIKEYS_READ), (req, res) => {
  try {
    const isAdmin = rbacService.userHasPermission(req.auth.user, PERMISSIONS.APIKEYS_MANAGE);
    
    if (isAdmin && req.query.all === 'true') {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const result = apiKeyService.listAllApiKeys({ page, limit });
      return res.json(result);
    }

    const keys = apiKeyService.listUserApiKeys(req.auth.user.id);
    res.json({ keys });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list API keys',
      message: error.message
    });
  }
});

router.get('/:id', requirePermission(PERMISSIONS.APIKEYS_READ), (req, res) => {
  try {
    const key = apiKeyService.getApiKey(req.params.id);
    
    if (!key) {
      return res.status(404).json({
        error: 'Not found',
        message: 'API key not found'
      });
    }

    const isOwner = key.userId === req.auth.user.id;
    const canManage = rbacService.userHasPermission(req.auth.user, PERMISSIONS.APIKEYS_MANAGE);

    if (!isOwner && !canManage) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    res.json({ key });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get API key',
      message: error.message
    });
  }
});

router.post('/', requirePermission(PERMISSIONS.APIKEYS_CREATE), async (req, res) => {
  try {
    const { 
      name, 
      permissions = [], 
      allowedIps = [], 
      allowedOrigins = [],
      rateLimit = 0,
      expiresIn = null
    } = req.body;

    if (!name || name.length < 1 || name.length > 100) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Name is required and must be 1-100 characters'
      });
    }

    const userPermissions = req.auth.permissions;
    for (const perm of permissions) {
      if (!rbacService.hasPermission(userPermissions, perm)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Cannot grant permission you don't have: ${perm}`
        });
      }
    }

    const key = await apiKeyService.createApiKey({
      name,
      userId: req.auth.user.id,
      permissions: permissions.length > 0 ? permissions : Array.from(userPermissions),
      allowedIps,
      allowedOrigins,
      rateLimit,
      expiresIn,
      metadata: { createdVia: 'api' }
    });

    res.status(201).json({
      message: 'API key created',
      key,
      warning: 'Save this key securely. It will not be shown again.'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create API key',
      message: error.message
    });
  }
});

router.patch('/:id', requirePermission(PERMISSIONS.APIKEYS_READ), async (req, res) => {
  try {
    const { id } = req.params;
    const key = apiKeyService.getApiKey(id);

    if (!key) {
      return res.status(404).json({
        error: 'Not found',
        message: 'API key not found'
      });
    }

    const isOwner = key.userId === req.auth.user.id;
    const canManage = rbacService.userHasPermission(req.auth.user, PERMISSIONS.APIKEYS_MANAGE);

    if (!isOwner && !canManage) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    const { name, permissions, allowedIps, allowedOrigins, rateLimit, isActive } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (name.length < 1 || name.length > 100) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Name must be 1-100 characters'
        });
      }
      updates.name = name;
    }

    if (permissions !== undefined) {
      const userPermissions = req.auth.permissions;
      for (const perm of permissions) {
        if (!rbacService.hasPermission(userPermissions, perm)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: `Cannot grant permission you don't have: ${perm}`
          });
        }
      }
      updates.permissions = permissions;
    }

    if (allowedIps !== undefined) updates.allowedIps = allowedIps;
    if (allowedOrigins !== undefined) updates.allowedOrigins = allowedOrigins;
    if (rateLimit !== undefined) updates.rateLimit = rateLimit;
    if (isActive !== undefined && canManage) updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No valid updates provided'
      });
    }

    const updatedKey = apiKeyService.updateApiKey(id, updates);
    res.json({
      message: 'API key updated',
      key: updatedKey
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update API key',
      message: error.message
    });
  }
});

router.delete('/:id', requirePermission(PERMISSIONS.APIKEYS_DELETE), (req, res) => {
  try {
    const { id } = req.params;
    const key = apiKeyService.getApiKey(id);

    if (!key) {
      return res.status(404).json({
        error: 'Not found',
        message: 'API key not found'
      });
    }

    const isOwner = key.userId === req.auth.user.id;
    const canManage = rbacService.userHasPermission(req.auth.user, PERMISSIONS.APIKEYS_MANAGE);

    if (!isOwner && !canManage) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    apiKeyService.deleteApiKey(id);
    res.json({ message: 'API key deleted' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete API key',
      message: error.message
    });
  }
});

router.post('/:id/regenerate', requirePermission(PERMISSIONS.APIKEYS_CREATE), async (req, res) => {
  try {
    const { id } = req.params;
    const key = apiKeyService.getApiKey(id);

    if (!key) {
      return res.status(404).json({
        error: 'Not found',
        message: 'API key not found'
      });
    }

    const isOwner = key.userId === req.auth.user.id;
    const canManage = rbacService.userHasPermission(req.auth.user, PERMISSIONS.APIKEYS_MANAGE);

    if (!isOwner && !canManage) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    const newKey = await apiKeyService.regenerateApiKey(id);
    res.json({
      message: 'API key regenerated',
      key: newKey,
      warning: 'Save this key securely. It will not be shown again.'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to regenerate API key',
      message: error.message
    });
  }
});

router.post('/:id/revoke', requirePermission(PERMISSIONS.APIKEYS_DELETE), (req, res) => {
  try {
    const { id } = req.params;
    const key = apiKeyService.getApiKey(id);

    if (!key) {
      return res.status(404).json({
        error: 'Not found',
        message: 'API key not found'
      });
    }

    const isOwner = key.userId === req.auth.user.id;
    const canManage = rbacService.userHasPermission(req.auth.user, PERMISSIONS.APIKEYS_MANAGE);

    if (!isOwner && !canManage) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied'
      });
    }

    apiKeyService.revokeApiKey(id);
    res.json({ message: 'API key revoked' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to revoke API key',
      message: error.message
    });
  }
});

export default router;
