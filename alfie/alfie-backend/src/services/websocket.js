import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { authenticateWs } from '../middleware/auth.js';
import config from '../config.js';
import * as openclawGateway from './openclawGateway.js';
import * as sessionManager from './sessionManager.js';
import * as secondBrain from './secondBrain.js';
import { sendToOpenClaw, streamToOpenClaw, checkConnection } from './sessionBridge.js';
import { recordWsConnection, recordWsMessage, recordWsLatency } from './performanceMonitor.js';
import * as collaboration from './collaboration.js';
import * as presenceService from './presence.js';
import * as commentsService from './comments.js';
import * as permissionsService from './permissions.js';

const clients = new Map();

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!authenticateWs(token)) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const clientId = uuidv4();
    const client = {
      id: clientId,
      ws,
      sessionId: null,
      isAlive: true,
    };
    clients.set(clientId, client);
    recordWsConnection(1);

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', async (data) => {
      const messageStartTime = Date.now();
      recordWsMessage('in');
      try {
        const message = JSON.parse(data.toString());
        await handleMessage(client, message);
        recordWsLatency(Date.now() - messageStartTime);
      } catch (error) {
        sendError(ws, 'Invalid message format', error.message);
      }
    });

    ws.on('close', () => {
      const disconnectingClient = clients.get(clientId);
      if (disconnectingClient?.currentDocumentId) {
        collaboration.leaveDocument(disconnectingClient.currentDocumentId, clientId);
        presenceService.leaveDocumentPresence(clientId, disconnectingClient.currentDocumentId);
        broadcastToDocument(disconnectingClient.currentDocumentId, {
          type: 'presence:left',
          payload: { userId: clientId },
        }, clientId);
      }
      presenceService.unregisterUser(clientId);
      collaboration.handleClientDisconnect(clientId);
      clients.delete(clientId);
      recordWsConnection(-1);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error.message);
      clients.delete(clientId);
    });

    send(ws, { type: 'connected', clientId });
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = Array.from(clients.values()).find(c => c.ws === ws);
      if (client && !client.isAlive) {
        clients.delete(client.id);
        ws.terminate();
      } else if (client) {
        client.isAlive = false;
        ws.ping();
      }
    });
  }, config.wsHeartbeatInterval);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

async function handleMessage(client, message) {
  const { type, payload } = message;
  const { ws } = client;

  switch (type) {
    case 'ping':
      send(ws, { type: 'pong' });
      break;

    case 'session:create':
      await handleCreateSession(client, payload);
      break;

    case 'session:join':
      await handleJoinSession(client, payload);
      break;

    case 'message:send':
      await handleSendMessage(client, payload);
      break;

    case 'message:stream':
      await handleStreamMessage(client, payload);
      break;

    case 'tool:execute':
      await handleToolExecute(client, payload);
      break;

    case 'collab:join':
      await handleCollabJoin(client, payload);
      break;

    case 'collab:leave':
      await handleCollabLeave(client, payload);
      break;

    case 'collab:update':
      await handleCollabUpdate(client, payload);
      break;

    case 'collab:awareness':
      await handleCollabAwareness(client, payload);
      break;

    case 'presence:cursor':
      await handlePresenceCursor(client, payload);
      break;

    case 'presence:selection':
      await handlePresenceSelection(client, payload);
      break;

    case 'presence:typing':
      await handlePresenceTyping(client, payload);
      break;

    case 'comment:create':
      await handleCommentCreate(client, payload);
      break;

    case 'comment:update':
      await handleCommentUpdate(client, payload);
      break;

    case 'comment:delete':
      await handleCommentDelete(client, payload);
      break;

    case 'comment:resolve':
      await handleCommentResolve(client, payload);
      break;

    default:
      sendError(ws, 'Unknown message type', type);
  }
}

async function handleCreateSession(client, payload) {
  const { ws } = client;
  try {
    const { projectPath, options } = payload || {};
    const gatewaySession = await openclawGateway.createSession(
      projectPath || config.workspaceRoot,
      options
    );
    const localSession = sessionManager.createLocalSession(
      gatewaySession.session_id,
      { projectPath }
    );
    client.sessionId = localSession.localId;
    
    send(ws, {
      type: 'session:created',
      payload: {
        localId: localSession.localId,
        gatewaySessionId: gatewaySession.session_id,
        ...gatewaySession,
      },
    });
  } catch (error) {
    sendError(ws, 'Failed to create session', error.message);
  }
}

async function handleJoinSession(client, payload) {
  const { ws } = client;
  try {
    const { sessionId } = payload;
    const session = sessionManager.getLocalSession(sessionId);
    
    if (!session) {
      sendError(ws, 'Session not found', sessionId);
      return;
    }
    
    client.sessionId = sessionId;
    send(ws, {
      type: 'session:joined',
      payload: session,
    });
  } catch (error) {
    sendError(ws, 'Failed to join session', error.message);
  }
}

async function handleSendMessage(client, payload) {
  const { ws, sessionId } = client;
  
  if (!sessionId) {
    sendError(ws, 'No active session');
    return;
  }
  
  try {
    const { message, options } = payload;
    const session = sessionManager.getLocalSession(sessionId);
    
    if (!session) {
      sendError(ws, 'Session not found');
      return;
    }

    sessionManager.addMessageToSession(sessionId, 'user', message);
    
    const enrichedMessage = await secondBrain.enrichWithMemories(message);
    
    const connectionStatus = await checkConnection();
    
    let response;
    if (connectionStatus.connected) {
      const result = await sendToOpenClaw(enrichedMessage);
      response = result.response;
    } else {
      response = await openclawGateway.sendMessage(
        session.gatewaySessionId,
        enrichedMessage,
        options
      );
    }

    const responseContent = typeof response === 'object' ? (response.content || JSON.stringify(response)) : response;
    sessionManager.addMessageToSession(sessionId, 'assistant', responseContent);
    
    send(ws, {
      type: 'message:response',
      payload: { content: responseContent, raw: response },
    });
  } catch (error) {
    sendError(ws, 'Failed to send message', error.message);
  }
}

async function handleStreamMessage(client, payload) {
  const { ws, sessionId } = client;
  
  if (!sessionId) {
    sendError(ws, 'No active session');
    return;
  }
  
  try {
    const { message } = payload;
    const session = sessionManager.getLocalSession(sessionId);
    
    if (!session) {
      sendError(ws, 'Session not found');
      return;
    }

    sessionManager.addMessageToSession(sessionId, 'user', message);
    
    const enrichedMessage = await secondBrain.enrichWithMemories(message);
    
    send(ws, { type: 'stream:start' });
    
    const connectionStatus = await checkConnection();
    let fullResponse = '';
    
    if (connectionStatus.connected) {
      const stream = streamToOpenClaw(enrichedMessage);
      
      await new Promise((resolve, reject) => {
        stream.on('chunk', (chunk) => {
          fullResponse += chunk;
          send(ws, {
            type: 'stream:chunk',
            payload: { chunk },
          });
        });
        
        stream.on('end', () => {
          resolve();
        });
        
        stream.on('error', (err) => {
          reject(err);
        });
      });
    } else {
      await openclawGateway.streamMessage(
        session.gatewaySessionId,
        enrichedMessage,
        (chunk) => {
          fullResponse += chunk;
          send(ws, {
            type: 'stream:chunk',
            payload: { chunk },
          });
        }
      );
    }

    sessionManager.addMessageToSession(sessionId, 'assistant', fullResponse);
    
    send(ws, {
      type: 'stream:end',
      payload: { fullResponse },
    });
  } catch (error) {
    send(ws, { type: 'stream:error', payload: { error: error.message } });
  }
}

async function handleToolExecute(client, payload) {
  const { ws, sessionId } = client;
  
  if (!sessionId) {
    sendError(ws, 'No active session');
    return;
  }
  
  try {
    const { toolName, toolInput } = payload;
    const session = sessionManager.getLocalSession(sessionId);
    
    if (!session) {
      sendError(ws, 'Session not found');
      return;
    }

    send(ws, { type: 'tool:start', payload: { toolName } });
    
    await openclawGateway.executeToolStream(
      session.gatewaySessionId,
      toolName,
      toolInput,
      (chunk) => {
        send(ws, {
          type: 'tool:chunk',
          payload: { chunk },
        });
      }
    );

    send(ws, { type: 'tool:end', payload: { toolName } });
  } catch (error) {
    send(ws, { type: 'tool:error', payload: { error: error.message } });
  }
}

async function handleCollabJoin(client, payload) {
  const { ws, id: clientId } = client;
  
  try {
    const { documentId, userInfo } = payload;
    
    if (!permissionsService.canView(documentId, userInfo?.userId || clientId)) {
      sendError(ws, 'Access denied to document');
      return;
    }
    
    presenceService.registerUser(clientId, userInfo);
    
    const docState = collaboration.joinDocument(documentId, clientId, userInfo, (update) => {
      send(ws, update);
    });
    
    presenceService.joinDocumentPresence(clientId, documentId);
    
    client.currentDocumentId = documentId;
    client.userId = userInfo?.userId || clientId;
    
    send(ws, {
      type: 'collab:joined',
      payload: {
        documentId,
        content: docState.content,
        state: docState.state,
        users: presenceService.getDocumentPresence(documentId),
        metadata: docState.metadata,
        permission: permissionsService.getUserPermissionLevel(documentId, client.userId),
      },
    });
    
    broadcastToDocument(documentId, {
      type: 'presence:joined',
      payload: {
        user: presenceService.getUser(clientId),
        documentId,
      },
    }, clientId);
    
  } catch (error) {
    sendError(ws, 'Failed to join collaboration', error.message);
  }
}

async function handleCollabLeave(client, payload) {
  const { ws, id: clientId, currentDocumentId } = client;
  const documentId = payload?.documentId || currentDocumentId;
  
  if (!documentId) return;
  
  try {
    collaboration.leaveDocument(documentId, clientId);
    presenceService.leaveDocumentPresence(clientId, documentId);
    
    client.currentDocumentId = null;
    
    broadcastToDocument(documentId, {
      type: 'presence:left',
      payload: { userId: clientId, documentId },
    }, clientId);
    
    send(ws, { type: 'collab:left', payload: { documentId } });
  } catch (error) {
    sendError(ws, 'Failed to leave collaboration', error.message);
  }
}

async function handleCollabUpdate(client, payload) {
  const { ws, id: clientId, currentDocumentId, userId } = client;
  const documentId = payload?.documentId || currentDocumentId;
  
  if (!documentId) {
    sendError(ws, 'No active document');
    return;
  }
  
  if (!permissionsService.canEdit(documentId, userId)) {
    sendError(ws, 'No edit permission');
    return;
  }
  
  try {
    collaboration.applyDocumentUpdate(documentId, clientId, payload.update);
  } catch (error) {
    sendError(ws, 'Failed to apply update', error.message);
  }
}

async function handleCollabAwareness(client, payload) {
  const { id: clientId, currentDocumentId } = client;
  const documentId = payload?.documentId || currentDocumentId;
  
  if (!documentId) return;
  
  try {
    collaboration.applyAwarenessUpdate(documentId, clientId, payload.update);
  } catch (error) {
    console.error('Awareness update error:', error.message);
  }
}

async function handlePresenceCursor(client, payload) {
  const { id: clientId, currentDocumentId } = client;
  const documentId = payload?.documentId || currentDocumentId;
  
  if (!documentId) return;
  
  presenceService.updateCursor(clientId, payload.cursor);
  
  broadcastToDocument(documentId, {
    type: 'presence:cursor',
    payload: {
      userId: clientId,
      cursor: payload.cursor,
    },
  }, clientId);
}

async function handlePresenceSelection(client, payload) {
  const { id: clientId, currentDocumentId } = client;
  const documentId = payload?.documentId || currentDocumentId;
  
  if (!documentId) return;
  
  presenceService.updateSelection(clientId, payload.selection);
  
  broadcastToDocument(documentId, {
    type: 'presence:selection',
    payload: {
      userId: clientId,
      selection: payload.selection,
    },
  }, clientId);
}

async function handlePresenceTyping(client, payload) {
  const { id: clientId, currentDocumentId } = client;
  const documentId = payload?.documentId || currentDocumentId;
  
  if (!documentId) return;
  
  presenceService.setTyping(clientId, payload.isTyping);
  
  broadcastToDocument(documentId, {
    type: 'presence:typing',
    payload: {
      userId: clientId,
      isTyping: payload.isTyping,
    },
  }, clientId);
}

async function handleCommentCreate(client, payload) {
  const { ws, id: clientId, currentDocumentId, userId } = client;
  const documentId = payload?.documentId || currentDocumentId;
  
  if (!documentId) {
    sendError(ws, 'No active document');
    return;
  }
  
  try {
    const comment = commentsService.createComment(documentId, userId, payload);
    
    broadcastToDocument(documentId, {
      type: 'comment:created',
      payload: { comment },
    });
  } catch (error) {
    sendError(ws, 'Failed to create comment', error.message);
  }
}

async function handleCommentUpdate(client, payload) {
  const { ws, currentDocumentId, userId } = client;
  const documentId = payload?.documentId || currentDocumentId;
  
  if (!documentId) {
    sendError(ws, 'No active document');
    return;
  }
  
  try {
    const comment = commentsService.updateComment(documentId, payload.commentId, userId, payload);
    
    broadcastToDocument(documentId, {
      type: 'comment:updated',
      payload: { comment },
    });
  } catch (error) {
    sendError(ws, 'Failed to update comment', error.message);
  }
}

async function handleCommentDelete(client, payload) {
  const { ws, currentDocumentId, userId } = client;
  const documentId = payload?.documentId || currentDocumentId;
  
  if (!documentId) {
    sendError(ws, 'No active document');
    return;
  }
  
  try {
    commentsService.deleteComment(documentId, payload.commentId, userId);
    
    broadcastToDocument(documentId, {
      type: 'comment:deleted',
      payload: { commentId: payload.commentId },
    });
  } catch (error) {
    sendError(ws, 'Failed to delete comment', error.message);
  }
}

async function handleCommentResolve(client, payload) {
  const { ws, currentDocumentId, userId } = client;
  const documentId = payload?.documentId || currentDocumentId;
  
  if (!documentId) {
    sendError(ws, 'No active document');
    return;
  }
  
  try {
    const comment = payload.resolved
      ? commentsService.resolveComment(documentId, payload.commentId, userId)
      : commentsService.unresolveComment(documentId, payload.commentId, userId);
    
    broadcastToDocument(documentId, {
      type: 'comment:resolved',
      payload: { comment, resolved: payload.resolved },
    });
  } catch (error) {
    sendError(ws, 'Failed to resolve comment', error.message);
  }
}

function broadcastToDocument(documentId, message, excludeClientId = null) {
  clients.forEach((client) => {
    if (client.currentDocumentId === documentId && client.id !== excludeClientId) {
      send(client.ws, message);
    }
  });
}

function send(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
    recordWsMessage('out');
  }
}

function sendError(ws, error, details = null) {
  send(ws, {
    type: 'error',
    payload: { error, details },
  });
}

export function broadcast(message, filter = null) {
  clients.forEach((client) => {
    if (!filter || filter(client)) {
      send(client.ws, message);
    }
  });
}

export function getConnectedClients() {
  return Array.from(clients.values()).map(({ id, sessionId, isAlive }) => ({
    id,
    sessionId,
    isAlive,
  }));
}

export default {
  setupWebSocket,
  broadcast,
  getConnectedClients,
};
