import { Router } from 'express';
import * as openclawGateway from '../services/openclawGateway.js';
import * as sessionManager from '../services/sessionManager.js';

const router = Router();

router.post('/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const session = sessionManager.getLocalSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    sessionManager.addMessageToSession(sessionId, 'user', message);

    let fullResponse = '';
    await openclawGateway.streamMessage(
      session.gatewaySessionId,
      message,
      (chunk) => {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }
    );

    sessionManager.addMessageToSession(sessionId, 'assistant', fullResponse);
    res.write(`data: ${JSON.stringify({ type: 'done', fullResponse })}\n\n`);
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed', details: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

router.post('/tool', async (req, res) => {
  try {
    const { sessionId, toolName, toolInput } = req.body;
    const session = sessionManager.getLocalSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!toolName) {
      return res.status(400).json({ error: 'Tool name is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ type: 'start', toolName })}\n\n`);

    await openclawGateway.executeToolStream(
      session.gatewaySessionId,
      toolName,
      toolInput,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ type: 'done', toolName })}\n\n`);
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Tool execution failed', details: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
