import { Router } from 'express';
import * as sessionManager from '../services/sessionManager.js';
import * as exportService from '../services/exportService.js';
import axios from 'axios';

const router = Router();

router.post('/export', async (req, res) => {
  try {
    const { sessionIds, format = 'json', options = {} } = req.body;

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({ error: 'sessionIds array required' });
    }

    const validFormats = ['json', 'markdown', 'pdf'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` });
    }

    const sessions = sessionIds
      .map((id) => sessionManager.getLocalSession(id))
      .filter(Boolean);

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'No valid sessions found' });
    }

    const isBatch = sessions.length > 1;
    const exportOptions = {
      includeThinking: options.includeThinking || false,
      includeToolCalls: options.includeToolCalls || false,
      encrypt: options.encrypt || false,
      password: options.password || null,
    };

    if (exportOptions.encrypt && !exportOptions.password) {
      return res.status(400).json({ error: 'Password required for encryption' });
    }

    let result;
    let contentType;
    let filename;

    if (format === 'pdf') {
      if (isBatch) {
        return res.status(400).json({ error: 'PDF format only supports single session export' });
      }
      result = await exportService.exportToPDF(sessions[0], exportOptions);
      
      if (exportOptions.encrypt) {
        contentType = 'application/json';
        filename = `session-${sessions[0].localId}.pdf.encrypted`;
      } else {
        contentType = 'application/pdf';
        filename = `session-${sessions[0].localId}.pdf`;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(result);
      }
    } else if (format === 'markdown') {
      if (isBatch) {
        result = await exportService.exportBatch(sessions, 'markdown', exportOptions);
        filename = `sessions-export-${Date.now()}.md${exportOptions.encrypt ? '.encrypted' : ''}`;
      } else {
        result = exportService.exportToMarkdown(sessions[0], exportOptions);
        filename = `session-${sessions[0].localId}.md${exportOptions.encrypt ? '.encrypted' : ''}`;
      }
      contentType = exportOptions.encrypt ? 'application/json' : 'text/markdown';
    } else {
      if (isBatch) {
        result = await exportService.exportBatch(sessions, 'json', exportOptions);
        filename = `sessions-export-${Date.now()}.json${exportOptions.encrypt ? '.encrypted' : ''}`;
      } else {
        result = exportService.exportToJSON(sessions[0], exportOptions);
        filename = `session-${sessions[0].localId}.json${exportOptions.encrypt ? '.encrypted' : ''}`;
      }
      contentType = 'application/json';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(result);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { content, format = 'json', password = null, sourceUrl = null } = req.body;

    let importContent = content;

    if (sourceUrl) {
      try {
        const response = await axios.get(sourceUrl, { 
          timeout: 30000,
          maxContentLength: 50 * 1024 * 1024, 
        });
        importContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      } catch (error) {
        return res.status(400).json({ 
          error: 'Failed to fetch from URL', 
          details: error.message 
        });
      }
    }

    if (!importContent) {
      return res.status(400).json({ error: 'Content or sourceUrl required' });
    }

    let sessions;
    try {
      if (format === 'markdown') {
        sessions = exportService.importFromMarkdown(importContent, password);
      } else {
        sessions = exportService.importFromJSON(importContent, password);
      }
    } catch (parseError) {
      return res.status(400).json({ 
        error: 'Import parse failed', 
        details: parseError.message 
      });
    }

    const imported = [];
    for (const sessionData of sessions) {
      const localSession = sessionManager.createLocalSession(
        sessionData.gatewaySessionId || `imported-${Date.now()}`,
        { 
          importedFrom: sourceUrl || 'file',
          originalId: sessionData.id,
          importedAt: new Date().toISOString(),
        }
      );

      for (const msg of sessionData.messages || []) {
        sessionManager.addMessageToSession(localSession.localId, msg.role, msg.content);
      }

      imported.push({
        localId: localSession.localId,
        name: sessionData.name,
        messageCount: (sessionData.messages || []).length,
      });
    }

    res.json({
      success: true,
      imported,
      count: imported.length,
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Import failed', details: error.message });
  }
});

router.get('/formats', (req, res) => {
  res.json({
    export: [
      { id: 'json', name: 'JSON', description: 'Full data with metadata, importable', batch: true },
      { id: 'markdown', name: 'Markdown', description: 'Human-readable format', batch: true },
      { id: 'pdf', name: 'PDF', description: 'Printable document format', batch: false },
    ],
    import: [
      { id: 'json', name: 'JSON', description: 'Import from ALFIE JSON export' },
      { id: 'markdown', name: 'Markdown', description: 'Import from Markdown format' },
    ],
    encryption: {
      supported: true,
      algorithm: 'AES-256',
    },
  });
});

router.post('/decrypt-preview', async (req, res) => {
  try {
    const { content, password } = req.body;

    if (!content || !password) {
      return res.status(400).json({ error: 'Content and password required' });
    }

    try {
      const decrypted = exportService.decryptData(content, password);
      const preview = decrypted.slice(0, 500) + (decrypted.length > 500 ? '...' : '');
      
      res.json({
        success: true,
        preview,
        length: decrypted.length,
      });
    } catch (decryptError) {
      return res.status(400).json({ 
        error: 'Decryption failed', 
        details: 'Invalid password or corrupted data' 
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Decrypt preview failed', details: error.message });
  }
});

export default router;
