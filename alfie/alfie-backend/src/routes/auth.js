import { Router } from 'express';
import * as User from '../models/User.js';
import * as jwtService from '../services/jwtService.js';
import * as oauthService from '../services/oauthService.js';
import { authenticate, requirePermission } from '../middleware/authMiddleware.js';
import { authRateLimit, strictRateLimit } from '../middleware/rateLimitMiddleware.js';
import { PERMISSIONS } from '../services/rbacService.js';
import config from '../config.js';

const router = Router();

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordMinLength = 8;

function validateEmail(email) {
  return emailRegex.test(email);
}

function validatePassword(password) {
  if (password.length < passwordMinLength) {
    return { valid: false, error: `Password must be at least ${passwordMinLength} characters` };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true };
}

router.post('/register', authRateLimit, async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email, username, and password are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid email format'
      });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Username must be between 3 and 30 characters'
      });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Username can only contain letters, numbers, underscores, and hyphens'
      });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Validation error',
        message: passwordValidation.error
      });
    }

    const user = await User.createUser({
      email,
      username,
      password,
      roles: ['user'],
      metadata: {
        registrationIp: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    const tokens = jwtService.generateTokenPair(user, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({
      message: 'Registration successful',
      user,
      ...tokens
    });
  } catch (error) {
    if (error.message.includes('already')) {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      });
    }
    res.status(500).json({
      error: 'Registration failed',
      message: error.message
    });
  }
});

router.post('/login', authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required'
      });
    }

    const user = User.findByEmailInternal(email);
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account disabled',
        message: 'Your account has been disabled'
      });
    }

    const passwordValid = await User.verifyPassword(user, password);
    if (!passwordValid) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    User.updateLastLogin(user.id);

    const tokens = jwtService.generateTokenPair(user, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      message: 'Login successful',
      user: User.findById(user.id),
      ...tokens
    });
  } catch (error) {
    res.status(500).json({
      error: 'Login failed',
      message: error.message
    });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Refresh token is required'
      });
    }

    const tokens = await jwtService.refreshTokens(refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      message: 'Token refreshed',
      ...tokens
    });
  } catch (error) {
    res.status(401).json({
      error: 'Token refresh failed',
      message: error.message
    });
  }
});

router.post('/logout', authenticate({ required: true }), (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      jwtService.blacklistToken(token);
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

router.post('/logout/all', authenticate({ required: true }), (req, res) => {
  try {
    const count = jwtService.revokeAllUserTokens(req.auth.user.id);
    
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      jwtService.blacklistToken(token);
    }

    res.json({ 
      message: 'All sessions terminated',
      revokedTokens: count
    });
  } catch (error) {
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

router.get('/me', authenticate({ required: true }), (req, res) => {
  res.json({
    user: req.auth.user,
    permissions: Array.from(req.auth.permissions),
    authMethod: req.auth.method
  });
});

router.patch('/me', authenticate({ required: true }), async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    const updates = {};

    if (username) {
      if (username.length < 3 || username.length > 30) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Username must be between 3 and 30 characters'
        });
      }
      updates.username = username;
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Current password is required to change password'
        });
      }

      const user = User.findByIdInternal(req.auth.user.id);
      const passwordValid = await User.verifyPassword(user, currentPassword);
      if (!passwordValid) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Current password is incorrect'
        });
      }

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          error: 'Validation error',
          message: passwordValidation.error
        });
      }

      updates.password = newPassword;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No valid updates provided'
      });
    }

    const updatedUser = await User.updateUser(req.auth.user.id, updates);
    res.json({
      message: 'Profile updated',
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
      error: 'Update failed',
      message: error.message
    });
  }
});

router.post('/password/reset-request', strictRateLimit, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email is required'
      });
    }

    const user = User.findByEmail(email);
    
    if (user) {
      const resetToken = jwtService.generatePasswordResetToken(user.id);
      console.log(`Password reset token for ${email}: ${resetToken}`);
    }

    res.json({
      message: 'If an account exists with this email, a password reset link has been sent'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Request failed',
      message: error.message
    });
  }
});

router.post('/password/reset', strictRateLimit, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Token and new password are required'
      });
    }

    const verification = jwtService.verifyPasswordResetToken(token);
    if (!verification.valid) {
      return res.status(400).json({
        error: 'Invalid token',
        message: verification.error
      });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Validation error',
        message: passwordValidation.error
      });
    }

    await User.updateUser(verification.userId, { password: newPassword });
    jwtService.revokeAllUserTokens(verification.userId);

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({
      error: 'Reset failed',
      message: error.message
    });
  }
});

router.get('/oauth/providers', (req, res) => {
  res.json({
    providers: oauthService.getSupportedProviders()
  });
});

router.get('/oauth/:provider', (req, res) => {
  try {
    const { provider } = req.params;
    const redirectUri = req.query.redirect_uri || 
      `${req.protocol}://${req.get('host')}/api/auth/oauth/${provider}/callback`;

    const { url, state } = oauthService.getAuthorizationUrl(provider, redirectUri);

    res.json({ url, state });
  } catch (error) {
    res.status(400).json({
      error: 'OAuth error',
      message: error.message
    });
  }
});

router.get('/oauth/:provider/callback', async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      return res.status(400).json({
        error: 'OAuth error',
        message: oauthError
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        error: 'Invalid callback',
        message: 'Missing code or state parameter'
      });
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/oauth/${provider}/callback`;
    const result = await oauthService.handleCallback(provider, code, state, redirectUri);

    if (config.oauth.callbackUrl) {
      const params = new URLSearchParams({
        access_token: result.tokens.accessToken,
        refresh_token: result.tokens.refreshToken,
        token_type: result.tokens.tokenType,
        expires_in: result.tokens.expiresIn,
        is_new_user: result.isNewUser
      });
      return res.redirect(`${config.oauth.callbackUrl}?${params.toString()}`);
    }

    res.json({
      message: result.isNewUser ? 'Account created' : 'Login successful',
      user: result.user,
      ...result.tokens
    });
  } catch (error) {
    res.status(400).json({
      error: 'OAuth callback failed',
      message: error.message
    });
  }
});

router.post('/oauth/:provider/callback', async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state, redirect_uri } = req.body;

    if (!code || !state) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Missing code or state'
      });
    }

    const result = await oauthService.handleCallback(provider, code, state, redirect_uri);

    res.json({
      message: result.isNewUser ? 'Account created' : 'Login successful',
      user: result.user,
      ...result.tokens
    });
  } catch (error) {
    res.status(400).json({
      error: 'OAuth callback failed',
      message: error.message
    });
  }
});

export default router;
