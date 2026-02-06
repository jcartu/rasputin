import express from 'express';
import * as sandboxExecutor from '../services/sandboxExecutor.js';
import { log } from '../services/logger.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { code, language, stdin, timeout, memoryMB } = req.body;
  
  if (!code) {
    return res.status(400).json({ 
      success: false,
      error: 'Code is required' 
    });
  }
  
  if (!language) {
    return res.status(400).json({ 
      success: false,
      error: 'Language is required' 
    });
  }
  
  try {
    const result = await sandboxExecutor.execute(code, language, {
      stdin,
      timeout,
      memoryMB,
    });
    
    res.json(result);
  } catch (error) {
    log.error('Execute endpoint error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
      stdout: '',
      stderr: '',
      exitCode: 1,
      executionTime: 0,
      timedOut: false,
    });
  }
});

router.get('/languages', (req, res) => {
  const languages = sandboxExecutor.getSupportedLanguages();
  res.json({ languages });
});

router.get('/template/:language', (req, res) => {
  const { language } = req.params;
  const template = sandboxExecutor.getCodeTemplate(language);
  res.json({ 
    language, 
    template,
    extension: sandboxExecutor.getSupportedLanguages()
      .find(l => l.id === language)?.extension || '.txt'
  });
});

router.get('/status', async (req, res) => {
  try {
    const status = await sandboxExecutor.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
