import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { watch } from 'chokidar';

const router = express.Router();

router.get('/api/files', async (req, res) => {
  try {
    const dirPath = req.query.path || '.';
    const fullPath = path.join(process.cwd(), dirPath);
    const files = await fs.readdir(fullPath, { withFileTypes: true });
    const result = await Promise.all(files.map(async f => {
      const stats = await fs.stat(path.join(fullPath, f.name));
      return {
        name: f.name,
        type: f.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime
      };
    }));
    res.json({ path: dirPath, files: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/files/read', async (req, res) => {
  try {
    const filePath = req.query.path;
    const content = await fs.readFile(filePath, 'utf8');
    res.json({ path: filePath, content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/files/write', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    await fs.writeFile(filePath, content, 'utf8');
    res.json({ success: true, path: filePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/files/delete', async (req, res) => {
  try {
    const { path: filePath } = req.body;
    await fs.unlink(filePath);
    res.json({ success: true, path: filePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
