import { v4 as uuidv4 } from 'uuid';
import * as permissions from './permissions.js';

const documentComments = new Map();
const commentCallbacks = new Map();

function getCommentStore(documentId) {
  if (!documentComments.has(documentId)) {
    documentComments.set(documentId, new Map());
  }
  return documentComments.get(documentId);
}

export function createComment(documentId, userId, data) {
  if (!permissions.canComment(documentId, userId)) {
    throw new Error('Insufficient permissions to comment');
  }
  
  const store = getCommentStore(documentId);
  
  const comment = {
    id: uuidv4(),
    documentId,
    userId,
    content: data.content,
    position: data.position || null,
    selection: data.selection || null,
    lineNumber: data.lineNumber || null,
    parentId: data.parentId || null,
    resolved: false,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    reactions: {},
    mentions: data.mentions || [],
  };
  
  store.set(comment.id, comment);
  broadcastCommentEvent('comment:created', documentId, comment);
  
  return comment;
}

export function updateComment(documentId, commentId, userId, updates) {
  const store = getCommentStore(documentId);
  const comment = store.get(commentId);
  
  if (!comment) throw new Error('Comment not found');
  
  if (comment.userId !== userId && !permissions.canAdmin(documentId, userId)) {
    throw new Error('Cannot edit another user\'s comment');
  }
  
  const allowedUpdates = ['content', 'mentions'];
  allowedUpdates.forEach(key => {
    if (updates[key] !== undefined) {
      comment[key] = updates[key];
    }
  });
  
  comment.updatedAt = new Date();
  broadcastCommentEvent('comment:updated', documentId, comment);
  
  return comment;
}

export function deleteComment(documentId, commentId, userId) {
  const store = getCommentStore(documentId);
  const comment = store.get(commentId);
  
  if (!comment) throw new Error('Comment not found');
  
  if (comment.userId !== userId && !permissions.canAdmin(documentId, userId)) {
    throw new Error('Cannot delete another user\'s comment');
  }
  
  store.forEach((c, id) => {
    if (c.parentId === commentId) {
      store.delete(id);
    }
  });
  
  store.delete(commentId);
  broadcastCommentEvent('comment:deleted', documentId, { id: commentId });
  
  return true;
}

export function resolveComment(documentId, commentId, userId) {
  const store = getCommentStore(documentId);
  const comment = store.get(commentId);
  
  if (!comment) throw new Error('Comment not found');
  
  if (!permissions.canComment(documentId, userId)) {
    throw new Error('Insufficient permissions to resolve comment');
  }
  
  comment.resolved = true;
  comment.resolvedBy = userId;
  comment.resolvedAt = new Date();
  comment.updatedAt = new Date();
  
  broadcastCommentEvent('comment:resolved', documentId, comment);
  
  return comment;
}

export function unresolveComment(documentId, commentId, userId) {
  const store = getCommentStore(documentId);
  const comment = store.get(commentId);
  
  if (!comment) throw new Error('Comment not found');
  
  if (!permissions.canComment(documentId, userId)) {
    throw new Error('Insufficient permissions to unresolve comment');
  }
  
  comment.resolved = false;
  comment.resolvedBy = null;
  comment.resolvedAt = null;
  comment.updatedAt = new Date();
  
  broadcastCommentEvent('comment:unresolved', documentId, comment);
  
  return comment;
}

export function addReaction(documentId, commentId, userId, reaction) {
  const store = getCommentStore(documentId);
  const comment = store.get(commentId);
  
  if (!comment) throw new Error('Comment not found');
  
  if (!permissions.canView(documentId, userId)) {
    throw new Error('Insufficient permissions');
  }
  
  if (!comment.reactions[reaction]) {
    comment.reactions[reaction] = [];
  }
  
  if (!comment.reactions[reaction].includes(userId)) {
    comment.reactions[reaction].push(userId);
  }
  
  broadcastCommentEvent('comment:reaction', documentId, {
    commentId,
    reaction,
    userId,
    action: 'add',
  });
  
  return comment;
}

export function removeReaction(documentId, commentId, userId, reaction) {
  const store = getCommentStore(documentId);
  const comment = store.get(commentId);
  
  if (!comment) throw new Error('Comment not found');
  
  if (comment.reactions[reaction]) {
    const idx = comment.reactions[reaction].indexOf(userId);
    if (idx > -1) {
      comment.reactions[reaction].splice(idx, 1);
    }
    if (comment.reactions[reaction].length === 0) {
      delete comment.reactions[reaction];
    }
  }
  
  broadcastCommentEvent('comment:reaction', documentId, {
    commentId,
    reaction,
    userId,
    action: 'remove',
  });
  
  return comment;
}

export function getDocumentComments(documentId, userId, options = {}) {
  if (!permissions.canView(documentId, userId)) {
    throw new Error('Insufficient permissions to view comments');
  }
  
  const store = getCommentStore(documentId);
  let comments = Array.from(store.values());
  
  if (options.resolved !== undefined) {
    comments = comments.filter(c => c.resolved === options.resolved);
  }
  
  if (options.parentId !== undefined) {
    comments = comments.filter(c => c.parentId === options.parentId);
  }
  
  if (options.lineNumber !== undefined) {
    comments = comments.filter(c => c.lineNumber === options.lineNumber);
  }
  
  comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  return comments;
}

export function getComment(documentId, commentId, userId) {
  if (!permissions.canView(documentId, userId)) {
    throw new Error('Insufficient permissions to view comment');
  }
  
  const store = getCommentStore(documentId);
  return store.get(commentId) || null;
}

export function getCommentThread(documentId, commentId, userId) {
  if (!permissions.canView(documentId, userId)) {
    throw new Error('Insufficient permissions to view comments');
  }
  
  const store = getCommentStore(documentId);
  const rootComment = store.get(commentId);
  
  if (!rootComment) return null;
  
  const replies = Array.from(store.values())
    .filter(c => c.parentId === commentId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  return {
    ...rootComment,
    replies,
  };
}

export function getCommentsByLine(documentId, lineNumber, userId) {
  return getDocumentComments(documentId, userId, { lineNumber, parentId: null });
}

export function deleteDocumentComments(documentId) {
  documentComments.delete(documentId);
  return true;
}

export function onCommentEvent(callback) {
  const id = uuidv4();
  commentCallbacks.set(id, callback);
  return () => commentCallbacks.delete(id);
}

function broadcastCommentEvent(type, documentId, data) {
  commentCallbacks.forEach(callback => {
    callback({ type, documentId, data });
  });
}

export default {
  createComment,
  updateComment,
  deleteComment,
  resolveComment,
  unresolveComment,
  addReaction,
  removeReaction,
  getDocumentComments,
  getComment,
  getCommentThread,
  getCommentsByLine,
  deleteDocumentComments,
  onCommentEvent,
};
