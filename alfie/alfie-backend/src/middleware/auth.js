import config from '../config.js';
import * as jwtService from '../services/jwtService.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Invalid authorization format. Use: Bearer <token>' });
  }
  
  if (token !== config.apiToken) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  
  next();
}

export function authenticateWs(token) {
  if (!token) return false;
  if (token === config.apiToken) return true;
  const verification = jwtService.verifyAccessToken(token);
  return verification.valid;
}

export default { authenticate, authenticateWs };
