import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASE_DIR = path.resolve(__dirname, '../../data/custom-integrations');

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function normalizeId(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_.-]+/g, '-');
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

export class CustomIntegrationStore {
  constructor(baseDir = DEFAULT_BASE_DIR) {
    this.baseDir = baseDir;
  }

  getUserDir(userId) {
    return path.join(this.baseDir, safeId(userId));
  }

  getIntegrationPath(userId, integrationId) {
    return path.join(this.getUserDir(userId), `${safeId(integrationId)}.json`);
  }

  async createIntegration(userId, config) {
    if (!userId) {
      throw new Error('createIntegration requires userId');
    }
    if (!config?.name) {
      throw new Error('createIntegration requires config.name');
    }
    const id = config.id || normalizeId(config.name) || crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      ...config,
      id,
      userId,
      createdAt: now,
      updatedAt: now
    };
    await writeJson(this.getIntegrationPath(userId, id), record);
    return record;
  }

  async updateIntegration(userId, integrationId, updates = {}) {
    if (!userId || !integrationId) {
      throw new Error('updateIntegration requires userId and integrationId');
    }
    const existing = await this.getIntegration(userId, integrationId);
    if (!existing) {
      return null;
    }
    const updated = {
      ...existing,
      ...updates,
      id: integrationId,
      userId,
      updatedAt: new Date().toISOString()
    };
    await writeJson(this.getIntegrationPath(userId, integrationId), updated);
    return updated;
  }

  async getIntegration(userId, integrationId) {
    if (!userId || !integrationId) {
      throw new Error('getIntegration requires userId and integrationId');
    }
    return readJson(this.getIntegrationPath(userId, integrationId));
  }

  async listIntegrations(userId) {
    if (!userId) {
      throw new Error('listIntegrations requires userId');
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

  async deleteIntegration(userId, integrationId) {
    if (!userId || !integrationId) {
      throw new Error('deleteIntegration requires userId and integrationId');
    }
    const filePath = this.getIntegrationPath(userId, integrationId);
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

export default new CustomIntegrationStore();
