import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { kernelManager } from '../services/kernelManager.js';
import { logger } from '../observability/logger.js';

const router = Router();
const NOTEBOOKS_DIR = process.env.NOTEBOOKS_DIR || path.join(process.cwd(), 'notebooks');

async function ensureNotebooksDir() {
  try {
    await fs.mkdir(NOTEBOOKS_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

router.get('/kernels', async (req, res) => {
  try {
    const specs = await kernelManager.getAvailableKernels();
    res.json({ kernelspecs: specs });
  } catch (err) {
    logger.error({ err }, 'Failed to get kernel specs');
    res.status(500).json({ error: err.message });
  }
});

router.get('/kernels/running', (req, res) => {
  try {
    const kernels = kernelManager.getRunningKernels();
    res.json(kernels);
  } catch (err) {
    logger.error({ err }, 'Failed to get running kernels');
    res.status(500).json({ error: err.message });
  }
});

router.post('/kernels', async (req, res) => {
  try {
    const { name = 'python3' } = req.body;
    const kernel = await kernelManager.startKernel(name);
    res.json(kernel.getInfo());
  } catch (err) {
    logger.error({ err }, 'Failed to start kernel');
    res.status(500).json({ error: err.message });
  }
});

router.get('/kernels/:kernelId', (req, res) => {
  try {
    const info = kernelManager.getKernelInfo(req.params.kernelId);
    if (!info) {
      return res.status(404).json({ error: 'Kernel not found' });
    }
    res.json(info);
  } catch (err) {
    logger.error({ err }, 'Failed to get kernel info');
    res.status(500).json({ error: err.message });
  }
});

router.delete('/kernels/:kernelId', async (req, res) => {
  try {
    await kernelManager.shutdownKernel(req.params.kernelId);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Failed to shutdown kernel');
    res.status(500).json({ error: err.message });
  }
});

router.post('/kernels/:kernelId/interrupt', async (req, res) => {
  try {
    await kernelManager.interruptKernel(req.params.kernelId);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Failed to interrupt kernel');
    res.status(500).json({ error: err.message });
  }
});

router.post('/kernels/:kernelId/restart', async (req, res) => {
  try {
    await kernelManager.restartKernel(req.params.kernelId);
    const info = kernelManager.getKernelInfo(req.params.kernelId);
    res.json(info);
  } catch (err) {
    logger.error({ err }, 'Failed to restart kernel');
    res.status(500).json({ error: err.message });
  }
});

router.post('/kernels/:kernelId/execute', async (req, res) => {
  try {
    const { code, cellId, silent = false } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }
    
    const result = await kernelManager.executeCode(
      req.params.kernelId,
      code,
      cellId || uuidv4(),
      silent
    );
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Failed to execute code');
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    await ensureNotebooksDir();
    const files = await fs.readdir(NOTEBOOKS_DIR);
    const notebooks = [];
    
    for (const file of files) {
      if (file.endsWith('.ipynb')) {
        const filePath = path.join(NOTEBOOKS_DIR, file);
        const stats = await fs.stat(filePath);
        notebooks.push({
          name: file.replace('.ipynb', ''),
          path: filePath,
          lastModified: stats.mtime.toISOString(),
          size: stats.size,
          type: 'notebook'
        });
      }
    }
    
    res.json(notebooks);
  } catch (err) {
    logger.error({ err }, 'Failed to list notebooks');
    res.status(500).json({ error: err.message });
  }
});

router.get('/:name', async (req, res) => {
  try {
    const filePath = path.join(NOTEBOOKS_DIR, `${req.params.name}.ipynb`);
    const content = await fs.readFile(filePath, 'utf-8');
    const notebook = JSON.parse(content);
    res.json(notebook);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    logger.error({ err }, 'Failed to read notebook');
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    await ensureNotebooksDir();
    const { name = 'Untitled', content } = req.body;
    
    const notebook = content || {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: {
          name: 'python3',
          display_name: 'Python 3',
          language: 'python'
        },
        language_info: {
          name: 'python',
          version: '3.11',
          mimetype: 'text/x-python',
          file_extension: '.py'
        },
        title: name
      },
      cells: [{
        id: uuidv4(),
        cell_type: 'code',
        source: '',
        metadata: { trusted: true },
        outputs: [],
        execution_count: null
      }]
    };
    
    let fileName = `${name}.ipynb`;
    let filePath = path.join(NOTEBOOKS_DIR, fileName);
    let counter = 1;
    
    while (true) {
      try {
        await fs.access(filePath);
        fileName = `${name}_${counter}.ipynb`;
        filePath = path.join(NOTEBOOKS_DIR, fileName);
        counter++;
      } catch {
        break;
      }
    }
    
    await fs.writeFile(filePath, JSON.stringify(notebook, null, 2));
    
    res.json({
      name: fileName.replace('.ipynb', ''),
      path: filePath,
      lastModified: new Date().toISOString(),
      type: 'notebook'
    });
  } catch (err) {
    logger.error({ err }, 'Failed to create notebook');
    res.status(500).json({ error: err.message });
  }
});

router.put('/:name', async (req, res) => {
  try {
    const filePath = path.join(NOTEBOOKS_DIR, `${req.params.name}.ipynb`);
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const notebook = typeof content === 'string' ? JSON.parse(content) : content;
    await fs.writeFile(filePath, JSON.stringify(notebook, null, 2));
    
    res.json({
      name: req.params.name,
      path: filePath,
      lastModified: new Date().toISOString(),
      type: 'notebook'
    });
  } catch (err) {
    logger.error({ err }, 'Failed to save notebook');
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:name', async (req, res) => {
  try {
    const filePath = path.join(NOTEBOOKS_DIR, `${req.params.name}.ipynb`);
    await fs.unlink(filePath);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    logger.error({ err }, 'Failed to delete notebook');
    res.status(500).json({ error: err.message });
  }
});

router.post('/:name/rename', async (req, res) => {
  try {
    const { newName } = req.body;
    if (!newName) {
      return res.status(400).json({ error: 'New name is required' });
    }
    
    const oldPath = path.join(NOTEBOOKS_DIR, `${req.params.name}.ipynb`);
    const newPath = path.join(NOTEBOOKS_DIR, `${newName}.ipynb`);
    
    await fs.rename(oldPath, newPath);
    
    res.json({
      name: newName,
      path: newPath,
      lastModified: new Date().toISOString(),
      type: 'notebook'
    });
  } catch (err) {
    logger.error({ err }, 'Failed to rename notebook');
    res.status(500).json({ error: err.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    await ensureNotebooksDir();
    const { content, name = 'Imported' } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const notebook = typeof content === 'string' ? JSON.parse(content) : content;
    
    notebook.cells = notebook.cells.map(cell => ({
      ...cell,
      id: cell.id || uuidv4()
    }));
    
    let fileName = `${name}.ipynb`;
    let filePath = path.join(NOTEBOOKS_DIR, fileName);
    let counter = 1;
    
    while (true) {
      try {
        await fs.access(filePath);
        fileName = `${name}_${counter}.ipynb`;
        filePath = path.join(NOTEBOOKS_DIR, fileName);
        counter++;
      } catch {
        break;
      }
    }
    
    await fs.writeFile(filePath, JSON.stringify(notebook, null, 2));
    
    res.json({
      name: fileName.replace('.ipynb', ''),
      path: filePath,
      content: notebook,
      lastModified: new Date().toISOString(),
      type: 'notebook'
    });
  } catch (err) {
    logger.error({ err }, 'Failed to import notebook');
    res.status(500).json({ error: err.message });
  }
});

router.get('/:name/export', async (req, res) => {
  try {
    const filePath = path.join(NOTEBOOKS_DIR, `${req.params.name}.ipynb`);
    const content = await fs.readFile(filePath, 'utf-8');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}.ipynb"`);
    res.send(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    logger.error({ err }, 'Failed to export notebook');
    res.status(500).json({ error: err.message });
  }
});

router.post('/from-session', async (req, res) => {
  try {
    await ensureNotebooksDir();
    const { messages, sessionName = 'Session', sessionId } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }
    
    const cells = [];
    
    cells.push({
      id: uuidv4(),
      cell_type: 'markdown',
      source: `# ${sessionName}\n\nConverted from chat session on ${new Date().toLocaleDateString()}`,
      metadata: { trusted: true }
    });
    
    for (const msg of messages) {
      if (msg.role === 'user') {
        cells.push({
          id: uuidv4(),
          cell_type: 'markdown',
          source: `**User:**\n\n${msg.content}`,
          metadata: { trusted: true }
        });
      } else if (msg.role === 'assistant') {
        const parts = extractCodeBlocks(msg.content);
        for (const part of parts) {
          if (part.isCode) {
            cells.push({
              id: uuidv4(),
              cell_type: 'code',
              source: part.content,
              metadata: { trusted: true },
              outputs: [],
              execution_count: null
            });
          } else if (part.content.trim()) {
            cells.push({
              id: uuidv4(),
              cell_type: 'markdown',
              source: `**Assistant:**\n\n${part.content}`,
              metadata: { trusted: true }
            });
          }
        }
      }
    }
    
    const notebook = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: {
          name: 'python3',
          display_name: 'Python 3',
          language: 'python'
        },
        language_info: {
          name: 'python',
          version: '3.11'
        },
        title: sessionName,
        session_id: sessionId
      },
      cells
    };
    
    const safeName = sessionName.replace(/[^a-zA-Z0-9-_]/g, '_');
    let fileName = `${safeName}.ipynb`;
    let filePath = path.join(NOTEBOOKS_DIR, fileName);
    let counter = 1;
    
    while (true) {
      try {
        await fs.access(filePath);
        fileName = `${safeName}_${counter}.ipynb`;
        filePath = path.join(NOTEBOOKS_DIR, fileName);
        counter++;
      } catch {
        break;
      }
    }
    
    await fs.writeFile(filePath, JSON.stringify(notebook, null, 2));
    
    res.json({
      name: fileName.replace('.ipynb', ''),
      path: filePath,
      content: notebook,
      lastModified: new Date().toISOString(),
      type: 'notebook'
    });
  } catch (err) {
    logger.error({ err }, 'Failed to convert session to notebook');
    res.status(500).json({ error: err.message });
  }
});

function extractCodeBlocks(content) {
  const parts = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match = codeBlockRegex.exec(content);
  
  while (match !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index);
      if (text.trim()) {
        parts.push({ content: text.trim(), isCode: false });
      }
    }
    
    const language = match[1] || 'python';
    const code = match[2].trim();
    if (code) {
      const executableLangs = ['python', 'py', 'javascript', 'js', 'typescript', 'ts', 'r', 'julia', 'bash', 'sh'];
      if (executableLangs.includes(language.toLowerCase())) {
        parts.push({ content: code, isCode: true, language });
      } else {
        parts.push({ content: `\`\`\`${language}\n${code}\n\`\`\``, isCode: false });
      }
    }
    
    lastIndex = match.index + match[0].length;
    match = codeBlockRegex.exec(content);
  }
  
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex);
    if (text.trim()) {
      parts.push({ content: text.trim(), isCode: false });
    }
  }
  
  return parts;
}

export default router;
