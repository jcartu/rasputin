import crypto from 'crypto';
import config from '../config.js';
import * as User from '../models/User.js';
import * as jwtService from './jwtService.js';

const pendingOAuthStates = new Map();

const PROVIDERS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile']
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    emailsUrl: 'https://api.github.com/user/emails',
    scopes: ['read:user', 'user:email']
  }
};

function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

export function getAuthorizationUrl(provider, redirectUri, additionalParams = {}) {
  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  const clientId = config.oauth[provider]?.clientId;
  if (!clientId) {
    throw new Error(`OAuth not configured for provider: ${provider}`);
  }

  const state = generateState();
  pendingOAuthStates.set(state, {
    provider,
    redirectUri,
    createdAt: Date.now(),
    ...additionalParams
  });

  setTimeout(() => pendingOAuthStates.delete(state), 10 * 60 * 1000);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: providerConfig.scopes.join(' '),
    state,
    ...additionalParams
  });

  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }

  return {
    url: `${providerConfig.authUrl}?${params.toString()}`,
    state
  };
}

export function validateState(state) {
  const stateData = pendingOAuthStates.get(state);
  if (!stateData) {
    return { valid: false, error: 'Invalid or expired state' };
  }
  pendingOAuthStates.delete(state);
  return { valid: true, data: stateData };
}

async function exchangeCodeForTokens(provider, code, redirectUri) {
  const providerConfig = PROVIDERS[provider];
  const clientId = config.oauth[provider]?.clientId;
  const clientSecret = config.oauth[provider]?.clientSecret;

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

async function getGoogleUserInfo(accessToken) {
  const response = await fetch(PROVIDERS.google.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google user info');
  }

  const data = await response.json();
  return {
    providerId: data.id,
    email: data.email,
    name: data.name,
    picture: data.picture,
    verified: data.verified_email
  };
}

async function getGitHubUserInfo(accessToken) {
  const userResponse = await fetch(PROVIDERS.github.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });

  if (!userResponse.ok) {
    throw new Error('Failed to fetch GitHub user info');
  }

  const userData = await userResponse.json();

  let email = userData.email;
  if (!email) {
    const emailsResponse = await fetch(PROVIDERS.github.emailsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (emailsResponse.ok) {
      const emails = await emailsResponse.json();
      const primaryEmail = emails.find(e => e.primary && e.verified);
      email = primaryEmail?.email || emails[0]?.email;
    }
  }

  return {
    providerId: String(userData.id),
    email,
    name: userData.name || userData.login,
    picture: userData.avatar_url,
    username: userData.login,
    verified: true
  };
}

export async function handleCallback(provider, code, state, redirectUri) {
  const stateValidation = validateState(state);
  if (!stateValidation.valid) {
    throw new Error(stateValidation.error);
  }

  if (stateValidation.data.provider !== provider) {
    throw new Error('Provider mismatch');
  }

  const tokens = await exchangeCodeForTokens(provider, code, redirectUri);

  let userInfo;
  if (provider === 'google') {
    userInfo = await getGoogleUserInfo(tokens.access_token);
  } else if (provider === 'github') {
    userInfo = await getGitHubUserInfo(tokens.access_token);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  if (!userInfo.email) {
    throw new Error('Email not available from OAuth provider');
  }

  let user = User.findByOAuthInternal(provider, userInfo.providerId);

  if (!user) {
    const existingUser = User.findByEmailInternal(userInfo.email);
    if (existingUser) {
      await User.updateUser(existingUser.id, {
        oauth: {
          provider,
          providerId: userInfo.providerId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          picture: userInfo.picture
        },
        isVerified: true
      });
      user = User.findByIdInternal(existingUser.id);
    }
  }

  if (!user) {
    const username = userInfo.username || 
      userInfo.name?.toLowerCase().replace(/\s+/g, '_') || 
      userInfo.email.split('@')[0];

    let finalUsername = username;
    let counter = 1;
    while (Array.from(await User.listUsers({ limit: 1000 }).users)
      .some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
      finalUsername = `${username}${counter++}`;
    }

    const newUser = await User.createUser({
      email: userInfo.email,
      username: finalUsername,
      password: null,
      roles: ['user'],
      isVerified: true,
      oauth: {
        provider,
        providerId: userInfo.providerId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        picture: userInfo.picture
      },
      metadata: { source: `oauth:${provider}` }
    });

    user = User.findByIdInternal(newUser.id);
  } else {
    await User.updateUser(user.id, {
      oauth: {
        ...user.oauth,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || user.oauth?.refreshToken
      }
    });
  }

  User.updateLastLogin(user.id);
  const authTokens = jwtService.generateTokenPair(user, { provider });

  return {
    user: User.findById(user.id),
    tokens: authTokens,
    isNewUser: !user.lastLoginAt
  };
}

export function getSupportedProviders() {
  const supported = [];
  for (const provider of Object.keys(PROVIDERS)) {
    if (config.oauth[provider]?.clientId && config.oauth[provider]?.clientSecret) {
      supported.push({
        name: provider,
        displayName: provider.charAt(0).toUpperCase() + provider.slice(1)
      });
    }
  }
  return supported;
}

export function isProviderConfigured(provider) {
  return !!(config.oauth[provider]?.clientId && config.oauth[provider]?.clientSecret);
}

export default {
  getAuthorizationUrl,
  validateState,
  handleCallback,
  getSupportedProviders,
  isProviderConfigured
};
