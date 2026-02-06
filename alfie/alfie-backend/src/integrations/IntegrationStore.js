import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASE_DIR = path.resolve(__dirname, '../../data/integrations');

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function readJson(filePath) {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
}

export class IntegrationStore {
  constructor(baseDir = DEFAULT_BASE_DIR) {
    this.baseDir = baseDir;
  }

  getUserDir(userId) {
    return path.join(this.baseDir, safeId(userId));
  }

  getInstancePath(userId, integrationId) {
    return path.join(this.getUserDir(userId), `${safeId(integrationId)}.json`);
  }

  async saveInstance(userId, integrationId, data) {
    if (!userId || !integrationId) {
      throw new Error('saveInstance requires userId and integrationId');
    }
    const filePath = this.getInstancePath(userId, integrationId);
    const existing = await readJson(filePath);
    const now = new Date().toISOString();
    const merged = {
      ...existing,
      ...data,
      userId,
      integrationId,
      updatedAt: now,
      createdAt: existing?.createdAt || now
    };
    await writeJson(filePath, merged);
    return merged;
  }

  async getInstance(userId, integrationId) {
    if (!userId || !integrationId) {
      throw new Error('getInstance requires userId and integrationId');
    }
    const filePath = this.getInstancePath(userId, integrationId);
    return readJson(filePath);
  }

  async listUserIntegrations(userId) {
    if (!userId) {
      throw new Error('listUserIntegrations requires userId');
    }
    const userDir = this.getUserDir(userId);
    try {
      const entries = await fs.readdir(userDir);
      const results = await Promise.all(
        entries
          .filter(entry => entry.endsWith('.json'))
          .map(entry => readJson(path.join(userDir, entry)))
      );
      return results.filter(Boolean);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async deleteInstance(userId, integrationId) {
    if (!userId || !integrationId) {
      throw new Error('deleteInstance requires userId and integrationId');
    }
    const filePath = this.getInstancePath(userId, integrationId);
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
}

export default new IntegrationStore();
