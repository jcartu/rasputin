import { create } from 'zustand';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Awareness } from 'y-protocols/awareness';

export interface CollaboratorInfo {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  cursor?: CursorPosition | null;
  selection?: SelectionRange | null;
  isTyping?: boolean;
  status?: 'online' | 'away' | 'offline';
}

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface SelectionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface Comment {
  id: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  content: string;
  lineNumber?: number;
  selection?: SelectionRange;
  parentId?: string | null;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  reactions: Record<string, string[]>;
  replies?: Comment[];
}

export interface DocumentMetadata {
  id: string;
  title: string;
  language: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShareLink {
  id: string;
  permission: number;
  expiresAt?: string;
  maxUses?: number;
  uses: number;
  active: boolean;
}

export const PermissionLevel = {
  NONE: 0,
  VIEW: 1,
  COMMENT: 2,
  EDIT: 3,
  ADMIN: 4,
} as const;

interface CollaborationState {
  isConnected: boolean;
  documentId: string | null;
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  awareness: Awareness | null;
  
  collaborators: CollaboratorInfo[];
  localUser: CollaboratorInfo | null;
  
  comments: Comment[];
  activeCommentId: string | null;
  
  metadata: DocumentMetadata | null;
  permission: number;
  
  isTyping: boolean;
  typingUsers: string[];
  
  shareLinks: ShareLink[];
  
  connect: (documentId: string, userInfo: Partial<CollaboratorInfo>) => Promise<void>;
  disconnect: () => void;
  
  updateCursor: (cursor: CursorPosition | null) => void;
  updateSelection: (selection: SelectionRange | null) => void;
  setTyping: (isTyping: boolean) => void;
  
  addComment: (content: string, options?: { lineNumber?: number; selection?: SelectionRange; parentId?: string }) => Promise<Comment>;
  updateComment: (commentId: string, content: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  resolveComment: (commentId: string) => Promise<void>;
  unresolveComment: (commentId: string) => Promise<void>;
  addReaction: (commentId: string, reaction: string) => Promise<void>;
  setActiveComment: (commentId: string | null) => void;
  
  createShareLink: (permission: number, options?: { expiresIn?: number; maxUses?: number }) => Promise<ShareLink>;
  revokeShareLink: (linkId: string) => Promise<void>;
  setPermission: (userId: string, permission: number) => Promise<void>;
  setPublicAccess: (isPublic: boolean, permission?: number) => Promise<void>;
  
  setCollaborators: (collaborators: CollaboratorInfo[]) => void;
  addCollaborator: (collaborator: CollaboratorInfo) => void;
  removeCollaborator: (userId: string) => void;
  updateCollaborator: (userId: string, updates: Partial<CollaboratorInfo>) => void;
  setComments: (comments: Comment[]) => void;
  setMetadata: (metadata: DocumentMetadata | null) => void;
  setPermissionLevel: (level: number) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export const useCollaborationStore = create<CollaborationState>()((set, get) => ({
  isConnected: false,
  documentId: null,
  ydoc: null,
  provider: null,
  awareness: null,
  
  collaborators: [],
  localUser: null,
  
  comments: [],
  activeCommentId: null,
  
  metadata: null,
  permission: PermissionLevel.NONE,
  
  isTyping: false,
  typingUsers: [],
  
  shareLinks: [],

  connect: async (documentId: string, userInfo: Partial<CollaboratorInfo>) => {
    const { disconnect, ydoc: existingDoc } = get();
    
    if (existingDoc) {
      disconnect();
    }
    
    const ydoc = new Y.Doc();
    
    const localUser: CollaboratorInfo = {
      id: userInfo.id || crypto.randomUUID(),
      name: userInfo.name || 'Anonymous',
      color: userInfo.color || generateColor(),
      avatar: userInfo.avatar,
      cursor: null,
      selection: null,
      isTyping: false,
      status: 'online',
    };
    
    set({ 
      ydoc, 
      documentId, 
      localUser,
      isConnected: false,
    });
    
    try {
      const response = await fetch(`${API_BASE}/api/documents/${documentId}`, {
        headers: { 'x-user-id': localUser.id },
      });
      
      if (!response.ok) {
        throw new Error('Failed to access document');
      }
      
      const { document } = await response.json();
      
      set({ 
        metadata: document.metadata,
        permission: document.permission || PermissionLevel.VIEW,
      });
      
      const commentsResponse = await fetch(`${API_BASE}/api/documents/${documentId}/comments`, {
        headers: { 'x-user-id': localUser.id },
      });
      
      if (commentsResponse.ok) {
        const { comments } = await commentsResponse.json();
        set({ comments });
      }
      
      const ws = new WebSocket(`${WS_URL}?token=${localUser.id}`);
      
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'collab:join',
          payload: { documentId, userInfo: localUser },
        }));
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message, get, set);
      };
      
      ws.onclose = () => {
        set({ isConnected: false });
      };
      
      (window as unknown as { _collabWs?: WebSocket })._collabWs = ws;
      
      set({ isConnected: true });
      
    } catch (error) {
      console.error('Failed to connect to collaboration:', error);
      throw error;
    }
  },

  disconnect: () => {
    const { ydoc, documentId } = get();
    const ws = (window as unknown as { _collabWs?: WebSocket })._collabWs;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'collab:leave',
        payload: { documentId },
      }));
      ws.close();
    }
    
    if (ydoc) {
      ydoc.destroy();
    }
    
    set({
      isConnected: false,
      documentId: null,
      ydoc: null,
      provider: null,
      awareness: null,
      collaborators: [],
      localUser: null,
      comments: [],
      metadata: null,
      permission: PermissionLevel.NONE,
    });
  },

  updateCursor: (cursor) => {
    const { localUser, documentId } = get();
    if (!localUser) return;
    
    const ws = (window as unknown as { _collabWs?: WebSocket })._collabWs;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'presence:cursor',
        payload: { documentId, cursor },
      }));
    }
    
    set({ localUser: { ...localUser, cursor } });
  },

  updateSelection: (selection) => {
    const { localUser, documentId } = get();
    if (!localUser) return;
    
    const ws = (window as unknown as { _collabWs?: WebSocket })._collabWs;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'presence:selection',
        payload: { documentId, selection },
      }));
    }
    
    set({ localUser: { ...localUser, selection } });
  },

  setTyping: (isTyping) => {
    const { localUser, documentId } = get();
    if (!localUser) return;
    
    const ws = (window as unknown as { _collabWs?: WebSocket })._collabWs;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'presence:typing',
        payload: { documentId, isTyping },
      }));
    }
    
    set({ isTyping, localUser: { ...localUser, isTyping } });
  },

  addComment: async (content, options = {}) => {
    const { documentId, localUser } = get();
    if (!documentId || !localUser) throw new Error('Not connected');
    
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': localUser.id,
      },
      body: JSON.stringify({
        content,
        lineNumber: options.lineNumber,
        selection: options.selection,
        parentId: options.parentId,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to create comment');
    
    const { comment } = await response.json();
    return comment;
  },

  updateComment: async (commentId, content) => {
    const { documentId, localUser } = get();
    if (!documentId || !localUser) throw new Error('Not connected');
    
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/comments/${commentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': localUser.id,
      },
      body: JSON.stringify({ content }),
    });
    
    if (!response.ok) throw new Error('Failed to update comment');
  },

  deleteComment: async (commentId) => {
    const { documentId, localUser } = get();
    if (!documentId || !localUser) throw new Error('Not connected');
    
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': localUser.id },
    });
    
    if (!response.ok) throw new Error('Failed to delete comment');
  },

  resolveComment: async (commentId) => {
    const { documentId, localUser } = get();
    if (!documentId || !localUser) throw new Error('Not connected');
    
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/comments/${commentId}/resolve`, {
      method: 'POST',
      headers: { 'x-user-id': localUser.id },
    });
    
    if (!response.ok) throw new Error('Failed to resolve comment');
  },

  unresolveComment: async (commentId) => {
    const { documentId, localUser } = get();
    if (!documentId || !localUser) throw new Error('Not connected');
    
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/comments/${commentId}/unresolve`, {
      method: 'POST',
      headers: { 'x-user-id': localUser.id },
    });
    
    if (!response.ok) throw new Error('Failed to unresolve comment');
  },

  addReaction: async (commentId, reaction) => {
    const { documentId, localUser } = get();
    if (!documentId || !localUser) throw new Error('Not connected');
    
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/comments/${commentId}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': localUser.id,
      },
      body: JSON.stringify({ reaction }),
    });
    
    if (!response.ok) throw new Error('Failed to add reaction');
  },

  setActiveComment: (commentId) => {
    set({ activeCommentId: commentId });
  },

  createShareLink: async (permission, options = {}) => {
    const { documentId, localUser } = get();
    if (!documentId || !localUser) throw new Error('Not connected');
    
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': localUser.id,
      },
      body: JSON.stringify({
        permission,
        expiresIn: options.expiresIn,
        maxUses: options.maxUses,
      }),
    });
    
    if (!response.ok) throw new Error('Failed to create share link');
    
    const { shareLink } = await response.json();
    
    set(state => ({
      shareLinks: [...state.shareLinks, shareLink],
    }));
    
    return shareLink;
  },

  revokeShareLink: async (linkId) => {
    const { documentId, localUser } = get();
    if (!documentId || !localUser) throw new Error('Not connected');
    
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/share/${linkId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': localUser.id },
    });
    
    if (!response.ok) throw new Error('Failed to revoke share link');
    
    set(state => ({
      shareLinks: state.shareLinks.filter(l => l.id !== linkId),
    }));
  },

  setPermission: async (userId, permission) => {
    const { documentId, localUser } = get();
    if (!documentId || !localUser) throw new Error('Not connected');
    
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': localUser.id,
      },
      body: JSON.stringify({ targetUserId: userId, permission }),
    });
    
    if (!response.ok) throw new Error('Failed to set permission');
  },

  setPublicAccess: async (isPublic, permission = PermissionLevel.VIEW) => {
    const { documentId, localUser } = get();
    if (!documentId || !localUser) throw new Error('Not connected');
    
    const response = await fetch(`${API_BASE}/api/documents/${documentId}/public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': localUser.id,
      },
      body: JSON.stringify({ isPublic, permission }),
    });
    
    if (!response.ok) throw new Error('Failed to set public access');
  },

  setCollaborators: (collaborators) => set({ collaborators }),
  addCollaborator: (collaborator) => set(state => ({
    collaborators: [...state.collaborators.filter(c => c.id !== collaborator.id), collaborator],
  })),
  removeCollaborator: (userId) => set(state => ({
    collaborators: state.collaborators.filter(c => c.id !== userId),
  })),
  updateCollaborator: (userId, updates) => set(state => ({
    collaborators: state.collaborators.map(c => 
      c.id === userId ? { ...c, ...updates } : c
    ),
  })),
  setComments: (comments) => set({ comments }),
  setMetadata: (metadata) => set({ metadata }),
  setPermissionLevel: (level) => set({ permission: level }),
}));

function handleWebSocketMessage(
  message: { type: string; payload: unknown },
  get: () => CollaborationState,
  set: (state: Partial<CollaborationState> | ((state: CollaborationState) => Partial<CollaborationState>)) => void
) {
  const { type, payload } = message;
  
  switch (type) {
    case 'collab:joined': {
      const data = payload as {
        users: CollaboratorInfo[];
        metadata: DocumentMetadata;
        permission: number;
      };
      set({
        collaborators: data.users,
        metadata: data.metadata,
        permission: data.permission,
        isConnected: true,
      });
      break;
    }
    
    case 'presence:joined': {
      const data = payload as { user: CollaboratorInfo };
      get().addCollaborator(data.user);
      break;
    }
    
    case 'presence:left': {
      const data = payload as { userId: string };
      get().removeCollaborator(data.userId);
      break;
    }
    
    case 'presence:cursor': {
      const data = payload as { userId: string; cursor: CursorPosition | null };
      get().updateCollaborator(data.userId, { cursor: data.cursor });
      break;
    }
    
    case 'presence:selection': {
      const data = payload as { userId: string; selection: SelectionRange | null };
      get().updateCollaborator(data.userId, { selection: data.selection });
      break;
    }
    
    case 'presence:typing': {
      const data = payload as { userId: string; isTyping: boolean };
      get().updateCollaborator(data.userId, { isTyping: data.isTyping });
      
      const typingUsers = get().collaborators
        .filter(c => c.isTyping)
        .map(c => c.name);
      set({ typingUsers });
      break;
    }
    
    case 'comment:created': {
      const data = payload as { comment: Comment };
      set(state => ({
        comments: [...state.comments, data.comment],
      }));
      break;
    }
    
    case 'comment:updated': {
      const data = payload as { comment: Comment };
      set(state => ({
        comments: state.comments.map(c => 
          c.id === data.comment.id ? data.comment : c
        ),
      }));
      break;
    }
    
    case 'comment:deleted': {
      const data = payload as { commentId: string };
      set(state => ({
        comments: state.comments.filter(c => c.id !== data.commentId),
      }));
      break;
    }
    
    case 'comment:resolved': {
      const data = payload as { comment: Comment };
      set(state => ({
        comments: state.comments.map(c => 
          c.id === data.comment.id ? data.comment : c
        ),
      }));
      break;
    }
  }
}

function generateColor(): string {
  const colors = [
    '#EF4444', '#F97316', '#F59E0B', '#84CC16',
    '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
    '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
