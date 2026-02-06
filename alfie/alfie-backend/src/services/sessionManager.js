import { v4 as uuidv4 } from 'uuid';

const sessions = new Map();

export function createLocalSession(gatewaySessionId, metadata = {}) {
  const localId = uuidv4();
  const session = {
    localId,
    gatewaySessionId,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    metadata,
    messages: [],
  };
  sessions.set(localId, session);
  return session;
}

export function getLocalSession(localId) {
  return sessions.get(localId) || null;
}

export function getSessionByGatewayId(gatewaySessionId) {
  for (const session of sessions.values()) {
    if (session.gatewaySessionId === gatewaySessionId) {
      return session;
    }
  }
  return null;
}

export function updateSessionActivity(localId) {
  const session = sessions.get(localId);
  if (session) {
    session.lastActivity = new Date().toISOString();
  }
  return session;
}

export function addMessageToSession(localId, role, content) {
  const session = sessions.get(localId);
  if (session) {
    session.messages.push({
      id: uuidv4(),
      role,
      content,
      timestamp: new Date().toISOString(),
    });
    session.lastActivity = new Date().toISOString();
  }
  return session;
}

export function listLocalSessions() {
  return Array.from(sessions.values());
}

export function deleteLocalSession(localId) {
  return sessions.delete(localId);
}

export function clearAllSessions() {
  sessions.clear();
}

export default {
  createLocalSession,
  getLocalSession,
  getSessionByGatewayId,
  updateSessionActivity,
  addMessageToSession,
  listLocalSessions,
  deleteLocalSession,
  clearAllSessions,
};
