import { v4 as uuidv4 } from 'uuid';

const ACTIVITY_TIMEOUT = 30000;
const TYPING_TIMEOUT = 3000;

const users = new Map();
const documentPresence = new Map();
const typingTimers = new Map();
const activityTimers = new Map();

export function registerUser(clientId, userInfo = {}) {
  const user = {
    id: clientId,
    name: userInfo.name || 'Anonymous',
    email: userInfo.email || null,
    avatar: userInfo.avatar || null,
    color: userInfo.color || generateUserColor(clientId),
    status: 'online',
    lastActivity: Date.now(),
    currentDocument: null,
    cursor: null,
    selection: null,
    isTyping: false,
  };
  
  users.set(clientId, user);
  startActivityTimer(clientId);
  
  return user;
}

export function unregisterUser(clientId) {
  const user = users.get(clientId);
  if (!user) return;
  
  if (user.currentDocument) {
    leaveDocumentPresence(clientId, user.currentDocument);
  }
  
  clearTimeout(typingTimers.get(clientId));
  clearTimeout(activityTimers.get(clientId));
  typingTimers.delete(clientId);
  activityTimers.delete(clientId);
  users.delete(clientId);
  
  return user;
}

export function getUser(clientId) {
  return users.get(clientId) || null;
}

export function updateUserActivity(clientId) {
  const user = users.get(clientId);
  if (!user) return;
  
  user.lastActivity = Date.now();
  user.status = 'online';
  
  startActivityTimer(clientId);
}

function startActivityTimer(clientId) {
  clearTimeout(activityTimers.get(clientId));
  
  activityTimers.set(clientId, setTimeout(() => {
    const user = users.get(clientId);
    if (user) {
      user.status = 'away';
      broadcastPresenceUpdate(clientId, user.currentDocument);
    }
  }, ACTIVITY_TIMEOUT));
}

export function joinDocumentPresence(clientId, documentId) {
  const user = users.get(clientId);
  if (!user) return null;
  
  if (user.currentDocument && user.currentDocument !== documentId) {
    leaveDocumentPresence(clientId, user.currentDocument);
  }
  
  user.currentDocument = documentId;
  user.cursor = null;
  user.selection = null;
  
  if (!documentPresence.has(documentId)) {
    documentPresence.set(documentId, new Set());
  }
  documentPresence.get(documentId).add(clientId);
  
  broadcastPresenceUpdate(clientId, documentId);
  
  return getDocumentPresence(documentId);
}

export function leaveDocumentPresence(clientId, documentId) {
  const user = users.get(clientId);
  if (!user) return;
  
  const docPresence = documentPresence.get(documentId);
  if (docPresence) {
    docPresence.delete(clientId);
    if (docPresence.size === 0) {
      documentPresence.delete(documentId);
    }
  }
  
  if (user.currentDocument === documentId) {
    user.currentDocument = null;
    user.cursor = null;
    user.selection = null;
  }
  
  broadcastPresenceUpdate(clientId, documentId, true);
}

export function updateCursor(clientId, cursor) {
  const user = users.get(clientId);
  if (!user) return;
  
  user.cursor = cursor;
  user.lastActivity = Date.now();
  
  broadcastPresenceUpdate(clientId, user.currentDocument);
}

export function updateSelection(clientId, selection) {
  const user = users.get(clientId);
  if (!user) return;
  
  user.selection = selection;
  user.lastActivity = Date.now();
  
  broadcastPresenceUpdate(clientId, user.currentDocument);
}

export function setTyping(clientId, isTyping) {
  const user = users.get(clientId);
  if (!user) return;
  
  user.isTyping = isTyping;
  user.lastActivity = Date.now();
  
  clearTimeout(typingTimers.get(clientId));
  
  if (isTyping) {
    typingTimers.set(clientId, setTimeout(() => {
      const u = users.get(clientId);
      if (u) {
        u.isTyping = false;
        broadcastPresenceUpdate(clientId, u.currentDocument);
      }
    }, TYPING_TIMEOUT));
  }
  
  broadcastPresenceUpdate(clientId, user.currentDocument);
}

export function getDocumentPresence(documentId) {
  const clientIds = documentPresence.get(documentId) || new Set();
  const presentUsers = [];
  
  clientIds.forEach(clientId => {
    const user = users.get(clientId);
    if (user) {
      presentUsers.push({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        color: user.color,
        status: user.status,
        cursor: user.cursor,
        selection: user.selection,
        isTyping: user.isTyping,
        lastActivity: user.lastActivity,
      });
    }
  });
  
  return presentUsers;
}

export function getTypingUsers(documentId) {
  return getDocumentPresence(documentId).filter(u => u.isTyping);
}

export function getActiveUsers(documentId) {
  return getDocumentPresence(documentId).filter(u => u.status === 'online');
}

const presenceCallbacks = new Map();

export function onPresenceUpdate(callback) {
  const id = uuidv4();
  presenceCallbacks.set(id, callback);
  return () => presenceCallbacks.delete(id);
}

function broadcastPresenceUpdate(clientId, documentId, isLeaving = false) {
  if (!documentId) return;
  
  const presence = getDocumentPresence(documentId);
  const user = users.get(clientId);
  
  presenceCallbacks.forEach(callback => {
    callback({
      type: isLeaving ? 'user:left' : 'presence:update',
      documentId,
      userId: clientId,
      user: isLeaving ? { id: clientId } : user,
      allUsers: presence,
    });
  });
}

function generateUserColor(clientId) {
  const colors = [
    '#EF4444', '#F97316', '#F59E0B', '#84CC16',
    '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
    '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
  ];
  
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = clientId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export default {
  registerUser,
  unregisterUser,
  getUser,
  updateUserActivity,
  joinDocumentPresence,
  leaveDocumentPresence,
  updateCursor,
  updateSelection,
  setTyping,
  getDocumentPresence,
  getTypingUsers,
  getActiveUsers,
  onPresenceUpdate,
};
