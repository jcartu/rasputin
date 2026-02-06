import { Router } from 'express';
import * as User from '../models/User.js';
import * as jwtService from '../services/jwtService.js';
import { authenticate, requirePermission, requireOwnerOrPermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../services/rbacService.js';
import * as rbacService from '../services/rbacService.js';

const router = Router();

router.use(authenticate({ required: true }));

router.get('/', requirePermission(PERMISSIONS.USERS_READ), (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const includeInactive = req.query.include_inactive === 'true' && 
      rbacService.userHasPermission(req.auth.user, PERMISSIONS.USERS_MANAGE);

    const result = User.listUsers({ page, limit, includeInactive });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list users',
      message: error.message
    });
  }
});

router.get('/roles', requirePermission(PERMISSIONS.USERS_READ), (req, res) => {
  res.json({
    roles: rbacService.getAvailableRoles()
  });
});

router.get('/permissions', requirePermission(PERMISSIONS.USERS_MANAGE), (req, res) => {
  res.json({
    permissions: rbacService.getAvailablePermissions()
  });
});

router.get('/:id', requireOwnerOrPermission('id', PERMISSIONS.USERS_READ), (req, res) => {
  try {
    const user = User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found'
      });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get user',
      message: error.message
    });
  }
});

router.post('/', requirePermission(PERMISSIONS.USERS_CREATE), async (req, res) => {
  try {
    const { email, username, password, roles, permissions, isVerified } = req.body;

    if (!email || !username) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and username are required'
      });
    }

    const requestedRoles = roles || ['user'];
    for (const role of requestedRoles) {
      if (!rbacService.isValidRole(role)) {
        return res.status(400).json({
          error: 'Validation error',
          message: `Invalid role: ${role}`
        });
      }
    }

    if (!rbacService.userHasRole(req.auth.user, 'admin')) {
      const restrictedRoles = ['admin', 'manager'];
      if (requestedRoles.some(r => restrictedRoles.includes(r))) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot assign admin or manager roles'
        });
      }
    }

    const user = await User.createUser({
      email,
      username,
      password: password || null,
      roles: requestedRoles,
      permissions: permissions || [],
      isVerified: isVerified || false,
      metadata: { createdBy: req.auth.user.id }
    });

    res.status(201).json({
      message: 'User created',
      user
    });
  } catch (error) {
    if (error.message.includes('already')) {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      });
    }
    res.status(500).json({
      error: 'Failed to create user',
      message: error.message
    });
  }
});

router.patch('/:id', requireOwnerOrPermission('id', PERMISSIONS.USERS_UPDATE), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, username, password, roles, permissions, isActive, isVerified } = req.body;
    
    const existingUser = User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found'
      });
    }

    const updates = {};
    const isAdmin = rbacService.userHasRole(req.auth.user, 'admin');
    const isManager = rbacService.userHasPermission(req.auth.user, PERMISSIONS.USERS_MANAGE);

    if (email !== undefined) updates.email = email;
    if (username !== undefined) updates.username = username;
    if (password !== undefined) updates.password = password;

    if (roles !== undefined) {
      if (!isManager) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot modify roles'
        });
      }

      for (const role of roles) {
        if (!rbacService.isValidRole(role)) {
          return res.status(400).json({
            error: 'Validation error',
            message: `Invalid role: ${role}`
          });
        }
      }

      if (!isAdmin) {
        if (roles.includes('admin') || existingUser.roles.includes('admin')) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Cannot modify admin role'
          });
        }
      }

      updates.roles = roles;
    }

    if (permissions !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only admins can modify direct permissions'
        });
      }
      updates.permissions = permissions;
    }

    if (isActive !== undefined) {
      if (!isManager) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot modify account status'
        });
      }
      if (id === req.auth.user.id) {
        return res.status(400).json({
          error: 'Invalid operation',
          message: 'Cannot deactivate your own account'
        });
      }
      updates.isActive = isActive;
    }

    if (isVerified !== undefined && isManager) {
      updates.isVerified = isVerified;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No valid updates provided'
      });
    }

    const updatedUser = await User.updateUser(id, updates);
    res.json({
      message: 'User updated',
      user: updatedUser
    });
  } catch (error) {
    if (error.message.includes('already')) {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      });
    }
    res.status(500).json({
      error: 'Failed to update user',
      message: error.message
    });
  }
});

router.delete('/:id', requirePermission(PERMISSIONS.USERS_DELETE), (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.auth.user.id) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'Cannot delete your own account'
      });
    }

    const user = User.findById(id);
    if (!user) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found'
      });
    }

    if (user.roles.includes('admin') && !rbacService.userHasRole(req.auth.user, 'admin')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Cannot delete admin users'
      });
    }

    jwtService.revokeAllUserTokens(id);
    User.deleteUser(id);

    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete user',
      message: error.message
    });
  }
});

router.post('/:id/disable', requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.auth.user.id) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'Cannot disable your own account'
      });
    }

    const user = User.findById(id);
    if (!user) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found'
      });
    }

    await User.updateUser(id, { isActive: false });
    jwtService.revokeAllUserTokens(id);

    res.json({ message: 'User disabled' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to disable user',
      message: error.message
    });
  }
});

router.post('/:id/enable', requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;

    const user = User.findById(id);
    if (!user) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found'
      });
    }

    await User.updateUser(id, { isActive: true });

    res.json({ message: 'User enabled' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to enable user',
      message: error.message
    });
  }
});

export default router;
