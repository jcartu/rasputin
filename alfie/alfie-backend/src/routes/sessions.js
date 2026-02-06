import { Router } from 'express';
import * as openclawGateway from '../services/openclawGateway.js';
import * as sessionManager from '../services/sessionManager.js';
import config from '../config.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { projectPath, options } = req.body;
    const gatewaySession = await openclawGateway.createSession(
      projectPath || config.workspaceRoot,
      options
    );
    const localSession = sessionManager.createLocalSession(
      gatewaySession.session_id,
      { projectPath }
    );
    res.status(201).json({
      localId: localSession.localId,
      gatewaySessionId: gatewaySession.session_id,
      ...gatewaySession,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session', details: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const localSessions = sessionManager.listLocalSessions();
    res.json({ sessions: localSessions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list sessions', details: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = sessionManager.getLocalSession(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get session', details: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const session = sessionManager.getLocalSession(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    try {
      await openclawGateway.deleteSession(session.gatewaySessionId);
    } catch {
      // Gateway session might already be gone, continue with local cleanup
    }
    
    sessionManager.deleteLocalSession(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session', details: error.message });
  }
});

router.post('/:id/message', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, options } = req.body;
    const session = sessionManager.getLocalSession(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    sessionManager.addMessageToSession(id, 'user', message);
    
    const response = await openclawGateway.sendMessage(
      session.gatewaySessionId,
      message,
      options
    );

    sessionManager.addMessageToSession(id, 'assistant', response.content || response);
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
});

router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const session = sessionManager.getLocalSession(id);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({ messages: session.messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get messages', details: error.message });
  }
});

export default router;
