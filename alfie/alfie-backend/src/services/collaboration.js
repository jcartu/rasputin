/**
 * Collaboration Service - Y.js CRDT-based real-time document collaboration
 * Implements Google Docs-like collaborative editing with OT/CRDT
 */

import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

// Document storage - in production, use Redis/PostgreSQL
const documents = new Map();
const documentClients = new Map(); // documentId -> Set of clientIds
const clientDocuments = new Map(); // clientId -> Set of documentIds

// Message types for WebSocket communication
export const CollabMessageType = {
  SYNC_STEP_1: 0,
  SYNC_STEP_2: 1,
  SYNC_UPDATE: 2,
  AWARENESS_UPDATE: 3,
  QUERY_AWARENESS: 4,
};

/**
 * Document class - wraps Y.js document with metadata
 */
class CollaborativeDocument {
  constructor(id, metadata = {}) {
    this.id = id;
    this.ydoc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.ydoc);
    this.metadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      ownerId: metadata.ownerId || null,
      title: metadata.title || 'Untitled Document',
      language: metadata.language || 'plaintext',
      ...metadata,
    };
    
    // Initialize document content
    this.content = this.ydoc.getText('content');
    this.comments = this.ydoc.getArray('comments');
    this.selections = this.ydoc.getMap('selections');
    
    // Track document changes
    this.ydoc.on('update', (update, origin) => {
      this.metadata.updatedAt = new Date();
      this.broadcastUpdate(update, origin);
    });
    
    // Track awareness changes
    this.awareness.on('change', (changes, origin) => {
      this.broadcastAwareness(changes, origin);
    });
  }

  /**
   * Broadcast document update to all connected clients
   */
  broadcastUpdate(update, origin) {
    const clients = documentClients.get(this.id) || new Set();
    clients.forEach(clientId => {
      if (clientId !== origin) {
        const callback = clientUpdateCallbacks.get(clientId);
        if (callback) {
          callback({
            type: 'doc:update',
            documentId: this.id,
            update: Array.from(update),
          });
        }
      }
    });
  }

  /**
   * Broadcast awareness update to all connected clients
   */
  broadcastAwareness(changes, origin) {
    const clients = documentClients.get(this.id) || new Set();
    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
      this.awareness,
      changes.added.concat(changes.updated).concat(changes.removed)
    );
    
    clients.forEach(clientId => {
      if (clientId !== origin) {
        const callback = clientUpdateCallbacks.get(clientId);
        if (callback) {
          callback({
            type: 'awareness:update',
            documentId: this.id,
            update: Array.from(awarenessUpdate),
          });
        }
      }
    });
  }

  /**
   * Apply update from client
   */
  applyUpdate(update, origin) {
    Y.applyUpdate(this.ydoc, new Uint8Array(update), origin);
  }

  /**
   * Get current document state as string
   */
  getContent() {
    return this.content.toString();
  }

  /**
   * Set document content (replaces all content)
   */
  setContent(text) {
    this.ydoc.transact(() => {
      this.content.delete(0, this.content.length);
      this.content.insert(0, text);
    });
  }

  /**
   * Get sync state for new client
   */
  getStateVector() {
    return Y.encodeStateVector(this.ydoc);
  }

  /**
   * Get document state since given state vector
   */
  getStateDiff(stateVector) {
    return Y.encodeStateAsUpdate(this.ydoc, stateVector);
  }

  /**
   * Get full document state
   */
  getFullState() {
    return Y.encodeStateAsUpdate(this.ydoc);
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.awareness.destroy();
    this.ydoc.destroy();
  }
}

// Client update callbacks
const clientUpdateCallbacks = new Map();

/**
 * Create a new collaborative document
 */
export function createDocument(metadata = {}) {
  const id = uuidv4();
  const doc = new CollaborativeDocument(id, metadata);
  documents.set(id, doc);
  documentClients.set(id, new Set());
  
  return {
    id,
    metadata: doc.metadata,
    state: Array.from(doc.getFullState()),
  };
}

/**
 * Get document by ID
 */
export function getDocument(documentId) {
  const doc = documents.get(documentId);
  if (!doc) return null;
  
  return {
    id: doc.id,
    metadata: doc.metadata,
    content: doc.getContent(),
    state: Array.from(doc.getFullState()),
  };
}

/**
 * Delete a document
 */
export function deleteDocument(documentId) {
  const doc = documents.get(documentId);
  if (!doc) return false;
  
  doc.destroy();
  documents.delete(documentId);
  documentClients.delete(documentId);
  
  return true;
}

/**
 * Join a document for collaboration
 */
export function joinDocument(documentId, clientId, userInfo, updateCallback) {
  const doc = documents.get(documentId);
  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }
  
  // Track client connection
  if (!documentClients.has(documentId)) {
    documentClients.set(documentId, new Set());
  }
  documentClients.get(documentId).add(clientId);
  
  if (!clientDocuments.has(clientId)) {
    clientDocuments.set(clientId, new Set());
  }
  clientDocuments.get(clientId).add(documentId);
  
  // Store callback for updates
  clientUpdateCallbacks.set(clientId, updateCallback);
  
  // Set awareness for this client
  doc.awareness.setLocalStateField('user', {
    id: clientId,
    name: userInfo?.name || 'Anonymous',
    color: userInfo?.color || getRandomColor(),
    avatar: userInfo?.avatar || null,
  });
  
  // Get current awareness states
  const awarenessStates = {};
  doc.awareness.getStates().forEach((state, id) => {
    awarenessStates[id] = state;
  });
  
  return {
    documentId,
    content: doc.getContent(),
    state: Array.from(doc.getFullState()),
    awarenessStates,
    metadata: doc.metadata,
  };
}

/**
 * Leave a document
 */
export function leaveDocument(documentId, clientId) {
  const doc = documents.get(documentId);
  if (!doc) return;
  
  // Remove from awareness
  doc.awareness.setLocalState(null);
  
  // Remove client tracking
  documentClients.get(documentId)?.delete(clientId);
  clientDocuments.get(clientId)?.delete(documentId);
  clientUpdateCallbacks.delete(clientId);
  
  // If no clients left, optionally clean up the document
  if (documentClients.get(documentId)?.size === 0) {
    // Keep document in memory for now, could persist to disk here
    console.log(`Document ${documentId} has no active clients`);
  }
}

/**
 * Handle client disconnection
 */
export function handleClientDisconnect(clientId) {
  const docs = clientDocuments.get(clientId) || new Set();
  docs.forEach(documentId => {
    leaveDocument(documentId, clientId);
  });
  clientDocuments.delete(clientId);
  clientUpdateCallbacks.delete(clientId);
}

/**
 * Apply document update from client
 */
export function applyDocumentUpdate(documentId, clientId, update) {
  const doc = documents.get(documentId);
  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }
  
  doc.applyUpdate(update, clientId);
}

/**
 * Apply awareness update from client
 */
export function applyAwarenessUpdate(documentId, clientId, update) {
  const doc = documents.get(documentId);
  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }
  
  awarenessProtocol.applyAwarenessUpdate(
    doc.awareness,
    new Uint8Array(update),
    clientId
  );
}

/**
 * Update user cursor position
 */
export function updateCursor(documentId, clientId, cursor) {
  const doc = documents.get(documentId);
  if (!doc) return;
  
  doc.awareness.setLocalStateField('cursor', cursor);
}

/**
 * Update user selection
 */
export function updateSelection(documentId, clientId, selection) {
  const doc = documents.get(documentId);
  if (!doc) return;
  
  doc.awareness.setLocalStateField('selection', selection);
}

/**
 * Update user typing state
 */
export function updateTypingState(documentId, clientId, isTyping) {
  const doc = documents.get(documentId);
  if (!doc) return;
  
  doc.awareness.setLocalStateField('isTyping', isTyping);
}

/**
 * Get all users in a document
 */
export function getDocumentUsers(documentId) {
  const doc = documents.get(documentId);
  if (!doc) return [];
  
  const users = [];
  doc.awareness.getStates().forEach((state, clientId) => {
    if (state.user) {
      users.push({
        clientId,
        ...state.user,
        cursor: state.cursor,
        selection: state.selection,
        isTyping: state.isTyping,
      });
    }
  });
  
  return users;
}

/**
 * List all documents
 */
export function listDocuments() {
  return Array.from(documents.values()).map(doc => ({
    id: doc.id,
    metadata: doc.metadata,
    activeUsers: documentClients.get(doc.id)?.size || 0,
  }));
}

/**
 * Get random color for user
 */
function getRandomColor() {
  const colors = [
    '#F87171', // red
    '#FB923C', // orange
    '#FBBF24', // amber
    '#34D399', // emerald
    '#22D3EE', // cyan
    '#60A5FA', // blue
    '#A78BFA', // violet
    '#F472B6', // pink
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Encode WebSocket message for Y.js sync
 */
export function encodeMessage(type, data) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, type);
  
  switch (type) {
    case CollabMessageType.SYNC_STEP_1:
    case CollabMessageType.SYNC_STEP_2:
    case CollabMessageType.SYNC_UPDATE:
    case CollabMessageType.AWARENESS_UPDATE:
      encoding.writeVarUint8Array(encoder, new Uint8Array(data));
      break;
  }
  
  return Array.from(encoding.toUint8Array(encoder));
}

/**
 * Decode WebSocket message for Y.js sync
 */
export function decodeMessage(data) {
  const decoder = decoding.createDecoder(new Uint8Array(data));
  const type = decoding.readVarUint(decoder);
  
  let payload;
  switch (type) {
    case CollabMessageType.SYNC_STEP_1:
    case CollabMessageType.SYNC_STEP_2:
    case CollabMessageType.SYNC_UPDATE:
    case CollabMessageType.AWARENESS_UPDATE:
      payload = Array.from(decoding.readVarUint8Array(decoder));
      break;
  }
  
  return { type, payload };
}

export default {
  createDocument,
  getDocument,
  deleteDocument,
  joinDocument,
  leaveDocument,
  handleClientDisconnect,
  applyDocumentUpdate,
  applyAwarenessUpdate,
  updateCursor,
  updateSelection,
  updateTypingState,
  getDocumentUsers,
  listDocuments,
  encodeMessage,
  decodeMessage,
  CollabMessageType,
};
