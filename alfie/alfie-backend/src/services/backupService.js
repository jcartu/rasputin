import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import CryptoJS from 'crypto-js';
import config from '../config.js';

// Backup types
export const BackupType = {
  DATABASE: 'database',
  FILES: 'files',
  CONFIGURATIONS: 'configurations',
  SESSIONS: 'sessions',
  FULL: 'full',
};

// Backup strategies
export const BackupStrategy = {
  FULL: 'full',
  INCREMENTAL: 'incremental',
  DIFFERENTIAL: 'differential',
};

// Backup status
export const BackupStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

// In-memory storage for backups metadata
const backupsIndex = {
  backups: [],
  lastFullBackup: {},
  schedules: [],
  retentionPolicies: [],
};

// Backup directory
const getBackupDir = () => config.backupDir || path.join(config.workspaceRoot, '.backups');
const getBackupIndexPath = () => path.join(getBackupDir(), 'backup-index.json');

/**
 * Initialize backup system
 */
export async function initialize() {
  const backupDir = getBackupDir();
  
  try {
    await fs.mkdir(backupDir, { recursive: true });
    await fs.mkdir(path.join(backupDir, 'database'), { recursive: true });
    await fs.mkdir(path.join(backupDir, 'files'), { recursive: true });
    await fs.mkdir(path.join(backupDir, 'configurations'), { recursive: true });
    await fs.mkdir(path.join(backupDir, 'sessions'), { recursive: true });
    await fs.mkdir(path.join(backupDir, 'full'), { recursive: true });
    
    // Load existing index
    try {
      const indexData = await fs.readFile(getBackupIndexPath(), 'utf-8');
      const parsed = JSON.parse(indexData);
      Object.assign(backupsIndex, parsed);
    } catch {
      // No existing index, use defaults
      await saveIndex();
    }
    
    console.log('✅ Backup system initialized at:', backupDir);
    return { success: true, backupDir };
  } catch (error) {
    console.error('❌ Failed to initialize backup system:', error);
    throw error;
  }
}

/**
 * Save backup index
 */
async function saveIndex() {
  await fs.writeFile(getBackupIndexPath(), JSON.stringify(backupsIndex, null, 2));
}

/**
 * Generate backup ID
 */
function generateBackupId() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = crypto.randomBytes(4).toString('hex');
  return `backup-${timestamp}-${random}`;
}

/**
 * Calculate file checksum
 */
async function calculateChecksum(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = createReadStream(filePath);
  
  return new Promise((resolve, reject) => {
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Encrypt backup data
 */
export function encryptBackup(data, password) {
  const encrypted = CryptoJS.AES.encrypt(
    typeof data === 'string' ? data : JSON.stringify(data),
    password
  ).toString();
  
  return {
    encrypted: true,
    algorithm: 'AES-256',
    data: encrypted,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Decrypt backup data
 */
export function decryptBackup(encryptedData, password) {
  try {
    const parsed = typeof encryptedData === 'string' ? JSON.parse(encryptedData) : encryptedData;
    if (!parsed.encrypted) {
      return parsed;
    }
    const decrypted = CryptoJS.AES.decrypt(parsed.data, password);
    const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
    try {
      return JSON.parse(decryptedStr);
    } catch {
      return decryptedStr;
    }
  } catch (error) {
    throw new Error('Decryption failed. Check your password.');
  }
}

/**
 * Compress data
 */
async function compressFile(inputPath, outputPath) {
  const source = createReadStream(inputPath);
  const destination = createWriteStream(outputPath);
  const gzip = createGzip({ level: 9 });
  
  await pipeline(source, gzip, destination);
}

/**
 * Decompress data
 */
async function decompressFile(inputPath, outputPath) {
  const source = createReadStream(inputPath);
  const destination = createWriteStream(outputPath);
  const gunzip = createGunzip();
  
  await pipeline(source, gunzip, destination);
}

/**
 * Get files changed since a specific backup
 */
async function getChangedFilesSince(directory, sinceBackup, recursive = true) {
  const changedFiles = [];
  const sinceTime = new Date(sinceBackup.timestamp).getTime();
  
  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && recursive) {
          // Skip backup directory and node_modules
          if (!fullPath.includes('.backups') && !fullPath.includes('node_modules')) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            if (stats.mtimeMs > sinceTime) {
              changedFiles.push({
                path: fullPath,
                relativePath: path.relative(directory, fullPath),
                size: stats.size,
                mtime: stats.mtime.toISOString(),
              });
            }
          } catch {
            // Skip inaccessible files
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
  
  await scanDir(directory);
  return changedFiles;
}

/**
 * Backup database (sessions data)
 */
async function backupDatabase(backupId, options = {}) {
  const { encrypt, password, strategy = BackupStrategy.FULL } = options;
  const sessionsPath = path.join(config.workspaceRoot, 'sessions');
  const backupPath = path.join(getBackupDir(), 'database', `${backupId}.json`);
  
  let sessionsData = { sessions: [], timestamp: new Date().toISOString() };
  
  try {
    // Try to read sessions from various sources
    const sources = [
      sessionsPath,
      path.join(config.workspaceRoot, 'data', 'sessions'),
      path.join(config.workspaceRoot, '.openclaw', 'sessions'),
    ];
    
    for (const source of sources) {
      try {
        const files = await fs.readdir(source);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const content = await fs.readFile(path.join(source, file), 'utf-8');
            sessionsData.sessions.push({
              file,
              content: JSON.parse(content),
            });
          }
        }
      } catch {
        // Source doesn't exist
      }
    }
  } catch {
    // No sessions found
  }
  
  // Handle incremental/differential
  if (strategy !== BackupStrategy.FULL && backupsIndex.lastFullBackup.database) {
    const lastFull = backupsIndex.backups.find(b => b.id === backupsIndex.lastFullBackup.database);
    if (lastFull) {
      sessionsData.baseBackupId = lastFull.id;
      sessionsData.strategy = strategy;
    }
  }
  
  let finalData = JSON.stringify(sessionsData, null, 2);
  
  if (encrypt && password) {
    finalData = JSON.stringify(encryptBackup(sessionsData, password));
  }
  
  await fs.writeFile(backupPath, finalData);
  
  // Compress
  const compressedPath = `${backupPath}.gz`;
  await compressFile(backupPath, compressedPath);
  await fs.unlink(backupPath);
  
  const stats = await fs.stat(compressedPath);
  const checksum = await calculateChecksum(compressedPath);
  
  return {
    type: BackupType.DATABASE,
    path: compressedPath,
    size: stats.size,
    checksum,
    encrypted: encrypt || false,
    sessionsCount: sessionsData.sessions.length,
  };
}

/**
 * Backup files
 */
async function backupFiles(backupId, options = {}) {
  const { encrypt, password, strategy = BackupStrategy.FULL, paths = [config.workspaceRoot] } = options;
  const backupPath = path.join(getBackupDir(), 'files', `${backupId}.json`);
  
  const filesData = {
    timestamp: new Date().toISOString(),
    strategy,
    files: [],
  };
  
  // Get files to backup
  let filesToBackup = [];
  
  if (strategy === BackupStrategy.FULL) {
    for (const p of paths) {
      const files = await getAllFiles(p);
      filesToBackup.push(...files);
    }
  } else {
    // Incremental or Differential
    const baseBackupId = strategy === BackupStrategy.INCREMENTAL
      ? getLastBackupOfType(BackupType.FILES)?.id
      : backupsIndex.lastFullBackup.files;
    
    if (baseBackupId) {
      const baseBackup = backupsIndex.backups.find(b => b.id === baseBackupId);
      if (baseBackup) {
        filesData.baseBackupId = baseBackupId;
        for (const p of paths) {
          const changed = await getChangedFilesSince(p, baseBackup);
          filesToBackup.push(...changed);
        }
      }
    } else {
      // No base backup, do full
      for (const p of paths) {
        const files = await getAllFiles(p);
        filesToBackup.push(...files);
      }
    }
  }
  
  // Store file contents (for small files) or references
  for (const file of filesToBackup) {
    try {
      const stats = await fs.stat(file.path || file);
      const filePath = file.path || file;
      
      if (stats.size < 1024 * 1024) { // Less than 1MB
        const content = await fs.readFile(filePath, 'base64');
        filesData.files.push({
          path: file.relativePath || path.relative(config.workspaceRoot, filePath),
          content,
          encoding: 'base64',
          size: stats.size,
          mtime: stats.mtime.toISOString(),
        });
      } else {
        // Just store reference and checksum for large files
        const checksum = await calculateChecksum(filePath);
        filesData.files.push({
          path: file.relativePath || path.relative(config.workspaceRoot, filePath),
          size: stats.size,
          mtime: stats.mtime.toISOString(),
          checksum,
          largeFile: true,
        });
      }
    } catch {
      // Skip inaccessible files
    }
  }
  
  let finalData = JSON.stringify(filesData, null, 2);
  
  if (encrypt && password) {
    finalData = JSON.stringify(encryptBackup(filesData, password));
  }
  
  await fs.writeFile(backupPath, finalData);
  
  // Compress
  const compressedPath = `${backupPath}.gz`;
  await compressFile(backupPath, compressedPath);
  await fs.unlink(backupPath);
  
  const stats = await fs.stat(compressedPath);
  const checksum = await calculateChecksum(compressedPath);
  
  return {
    type: BackupType.FILES,
    path: compressedPath,
    size: stats.size,
    checksum,
    encrypted: encrypt || false,
    filesCount: filesData.files.length,
  };
}

/**
 * Get all files in directory
 */
async function getAllFiles(directory, recursive = true) {
  const files = [];
  
  async function scanDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && recursive) {
          // Skip backup directory, node_modules, .git
          if (!fullPath.includes('.backups') && 
              !fullPath.includes('node_modules') &&
              !fullPath.includes('.git')) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            files.push({
              path: fullPath,
              relativePath: path.relative(directory, fullPath),
              size: stats.size,
              mtime: stats.mtime.toISOString(),
            });
          } catch {
            // Skip inaccessible files
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
  
  await scanDir(directory);
  return files;
}

/**
 * Backup configurations
 */
async function backupConfigurations(backupId, options = {}) {
  const { encrypt, password } = options;
  const backupPath = path.join(getBackupDir(), 'configurations', `${backupId}.json`);
  
  const configData = {
    timestamp: new Date().toISOString(),
    configs: [],
  };
  
  // Config file patterns
  const configPatterns = [
    '.env',
    '.env.local',
    '.env.production',
    'config.js',
    'config.json',
    'package.json',
    'tsconfig.json',
    'next.config.mjs',
    'tailwind.config.ts',
    'postcss.config.mjs',
  ];
  
  // Search in workspace root and common subdirectories
  const searchDirs = [
    config.workspaceRoot,
    path.join(config.workspaceRoot, 'alfie-backend'),
    path.join(config.workspaceRoot, 'alfie-ui'),
  ];
  
  for (const dir of searchDirs) {
    for (const pattern of configPatterns) {
      try {
        const filePath = path.join(dir, pattern);
        const content = await fs.readFile(filePath, 'utf-8');
        configData.configs.push({
          path: path.relative(config.workspaceRoot, filePath),
          content,
          mtime: (await fs.stat(filePath)).mtime.toISOString(),
        });
      } catch {
        // File doesn't exist
      }
    }
  }
  
  let finalData = JSON.stringify(configData, null, 2);
  
  if (encrypt && password) {
    finalData = JSON.stringify(encryptBackup(configData, password));
  }
  
  await fs.writeFile(backupPath, finalData);
  
  // Compress
  const compressedPath = `${backupPath}.gz`;
  await compressFile(backupPath, compressedPath);
  await fs.unlink(backupPath);
  
  const stats = await fs.stat(compressedPath);
  const checksum = await calculateChecksum(compressedPath);
  
  return {
    type: BackupType.CONFIGURATIONS,
    path: compressedPath,
    size: stats.size,
    checksum,
    encrypted: encrypt || false,
    configsCount: configData.configs.length,
  };
}

/**
 * Create a backup
 */
export async function createBackup(options = {}) {
  const {
    types = [BackupType.DATABASE, BackupType.FILES, BackupType.CONFIGURATIONS],
    strategy = BackupStrategy.FULL,
    encrypt = false,
    password = null,
    name = null,
    description = null,
  } = options;
  
  if (encrypt && !password) {
    throw new Error('Password required for encryption');
  }
  
  const backupId = generateBackupId();
  const startTime = Date.now();
  
  const backup = {
    id: backupId,
    name: name || `Backup ${new Date().toLocaleString()}`,
    description,
    timestamp: new Date().toISOString(),
    strategy,
    status: BackupStatus.IN_PROGRESS,
    encrypted: encrypt,
    types,
    components: [],
    totalSize: 0,
    duration: 0,
  };
  
  backupsIndex.backups.push(backup);
  await saveIndex();
  
  try {
    // Perform backups based on types
    for (const type of types) {
      let result;
      
      switch (type) {
        case BackupType.DATABASE:
        case BackupType.SESSIONS:
          result = await backupDatabase(backupId, { encrypt, password, strategy });
          break;
        case BackupType.FILES:
          result = await backupFiles(backupId, { encrypt, password, strategy });
          break;
        case BackupType.CONFIGURATIONS:
          result = await backupConfigurations(backupId, { encrypt, password });
          break;
        case BackupType.FULL:
          // Full backup includes all types
          result = await backupDatabase(backupId, { encrypt, password, strategy });
          backup.components.push(result);
          backup.totalSize += result.size;
          
          result = await backupFiles(backupId, { encrypt, password, strategy });
          backup.components.push(result);
          backup.totalSize += result.size;
          
          result = await backupConfigurations(backupId, { encrypt, password });
          break;
        default:
          continue;
      }
      
      if (result) {
        backup.components.push(result);
        backup.totalSize += result.size;
      }
    }
    
    backup.status = BackupStatus.COMPLETED;
    backup.duration = Date.now() - startTime;
    
    // Update last full backup references
    if (strategy === BackupStrategy.FULL) {
      for (const comp of backup.components) {
        backupsIndex.lastFullBackup[comp.type] = backupId;
      }
    }
    
    await saveIndex();
    
    console.log(`✅ Backup ${backupId} completed in ${backup.duration}ms`);
    return backup;
  } catch (error) {
    backup.status = BackupStatus.FAILED;
    backup.error = error.message;
    backup.duration = Date.now() - startTime;
    await saveIndex();
    throw error;
  }
}

/**
 * List all backups
 */
export async function listBackups(options = {}) {
  const { type, status, limit = 50, offset = 0 } = options;
  
  let filtered = [...backupsIndex.backups];
  
  if (type) {
    filtered = filtered.filter(b => b.types?.includes(type));
  }
  
  if (status) {
    filtered = filtered.filter(b => b.status === status);
  }
  
  // Sort by timestamp descending
  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  return {
    backups: filtered.slice(offset, offset + limit),
    total: filtered.length,
    offset,
    limit,
  };
}

/**
 * Get backup details
 */
export async function getBackup(backupId) {
  const backup = backupsIndex.backups.find(b => b.id === backupId);
  if (!backup) {
    throw new Error(`Backup ${backupId} not found`);
  }
  return backup;
}

/**
 * Get last backup of a type
 */
function getLastBackupOfType(type) {
  const filtered = backupsIndex.backups
    .filter(b => b.types?.includes(type) && b.status === BackupStatus.COMPLETED)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  return filtered[0] || null;
}

/**
 * Restore from backup
 */
export async function restoreBackup(backupId, options = {}) {
  const { password = null, targetDir = null, dryRun = false, components = null } = options;
  
  const backup = await getBackup(backupId);
  
  if (backup.encrypted && !password) {
    throw new Error('Password required for encrypted backup');
  }
  
  const restoreDir = targetDir || config.workspaceRoot;
  const restoredItems = [];
  
  const componentsToRestore = components 
    ? backup.components.filter(c => components.includes(c.type))
    : backup.components;
  
  for (const component of componentsToRestore) {
    try {
      // Decompress
      const tempPath = component.path.replace('.gz', '.temp.json');
      await decompressFile(component.path, tempPath);
      
      // Read and decrypt if needed
      let data = await fs.readFile(tempPath, 'utf-8');
      
      if (backup.encrypted && password) {
        data = decryptBackup(data, password);
      } else {
        data = JSON.parse(data);
      }
      
      await fs.unlink(tempPath);
      
      if (dryRun) {
        restoredItems.push({
          type: component.type,
          items: component.type === BackupType.FILES 
            ? data.files?.length || 0
            : component.type === BackupType.CONFIGURATIONS
            ? data.configs?.length || 0
            : data.sessions?.length || 0,
          dryRun: true,
        });
        continue;
      }
      
      // Restore based on type
      switch (component.type) {
        case BackupType.DATABASE:
        case BackupType.SESSIONS:
          for (const session of data.sessions || []) {
            const targetPath = path.join(restoreDir, 'sessions', session.file);
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await fs.writeFile(targetPath, JSON.stringify(session.content, null, 2));
            restoredItems.push({ type: 'session', file: session.file });
          }
          break;
          
        case BackupType.FILES:
          for (const file of data.files || []) {
            if (file.content) {
              const targetPath = path.join(restoreDir, file.path);
              await fs.mkdir(path.dirname(targetPath), { recursive: true });
              await fs.writeFile(targetPath, Buffer.from(file.content, file.encoding || 'utf-8'));
              restoredItems.push({ type: 'file', path: file.path });
            }
          }
          break;
          
        case BackupType.CONFIGURATIONS:
          for (const cfg of data.configs || []) {
            const targetPath = path.join(restoreDir, cfg.path);
            await fs.mkdir(path.dirname(targetPath), { recursive: true });
            await fs.writeFile(targetPath, cfg.content);
            restoredItems.push({ type: 'config', path: cfg.path });
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to restore component ${component.type}:`, error);
      restoredItems.push({
        type: component.type,
        error: error.message,
      });
    }
  }
  
  return {
    backupId,
    restoredAt: new Date().toISOString(),
    targetDir: restoreDir,
    dryRun,
    items: restoredItems,
    itemCount: restoredItems.filter(i => !i.error).length,
  };
}

/**
 * Delete backup
 */
export async function deleteBackup(backupId) {
  const backup = await getBackup(backupId);
  
  // Delete backup files
  for (const component of backup.components) {
    try {
      await fs.unlink(component.path);
    } catch {
      // File may already be deleted
    }
  }
  
  // Remove from index
  backupsIndex.backups = backupsIndex.backups.filter(b => b.id !== backupId);
  
  // Update last full backup references if needed
  for (const [type, id] of Object.entries(backupsIndex.lastFullBackup)) {
    if (id === backupId) {
      const lastFull = backupsIndex.backups
        .filter(b => b.types?.includes(type) && b.strategy === BackupStrategy.FULL && b.status === BackupStatus.COMPLETED)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      
      backupsIndex.lastFullBackup[type] = lastFull?.id || null;
    }
  }
  
  await saveIndex();
  
  return { deleted: true, backupId };
}

/**
 * Get backup chain (for incremental/differential restore)
 */
export async function getBackupChain(backupId) {
  const backup = await getBackup(backupId);
  const chain = [backup];
  
  // Follow the chain back to full backup
  for (const component of backup.components) {
    // Need to read backup file to get baseBackupId
    try {
      const tempPath = component.path.replace('.gz', '.temp.json');
      await decompressFile(component.path, tempPath);
      const data = JSON.parse(await fs.readFile(tempPath, 'utf-8'));
      await fs.unlink(tempPath);
      
      if (data.baseBackupId) {
        const baseChain = await getBackupChain(data.baseBackupId);
        chain.push(...baseChain);
      }
    } catch {
      // No chain data
    }
  }
  
  return chain;
}

/**
 * Get point-in-time recovery options
 */
export async function getPointInTimeOptions(type = null) {
  let backups = backupsIndex.backups
    .filter(b => b.status === BackupStatus.COMPLETED)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (type) {
    backups = backups.filter(b => b.types?.includes(type));
  }
  
  return backups.map(b => ({
    id: b.id,
    name: b.name,
    timestamp: b.timestamp,
    types: b.types,
    strategy: b.strategy,
    encrypted: b.encrypted,
    totalSize: b.totalSize,
  }));
}

/**
 * Get backup statistics
 */
export async function getStatistics() {
  const backups = backupsIndex.backups;
  const completed = backups.filter(b => b.status === BackupStatus.COMPLETED);
  const failed = backups.filter(b => b.status === BackupStatus.FAILED);
  
  const totalSize = completed.reduce((sum, b) => sum + (b.totalSize || 0), 0);
  const avgDuration = completed.length > 0
    ? completed.reduce((sum, b) => sum + (b.duration || 0), 0) / completed.length
    : 0;
  
  return {
    total: backups.length,
    completed: completed.length,
    failed: failed.length,
    pending: backups.filter(b => b.status === BackupStatus.PENDING).length,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    avgDuration: Math.round(avgDuration),
    lastFullBackup: backupsIndex.lastFullBackup,
    oldestBackup: completed.length > 0 
      ? completed.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))[0]?.timestamp
      : null,
    newestBackup: completed.length > 0
      ? completed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]?.timestamp
      : null,
  };
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Verify backup integrity
 */
export async function verifyBackup(backupId) {
  const backup = await getBackup(backupId);
  const results = [];
  
  for (const component of backup.components) {
    try {
      // Check file exists
      await fs.access(component.path);
      
      // Verify checksum
      const currentChecksum = await calculateChecksum(component.path);
      const checksumValid = currentChecksum === component.checksum;
      
      // Try to decompress
      const tempPath = component.path.replace('.gz', '.verify.json');
      await decompressFile(component.path, tempPath);
      await fs.unlink(tempPath);
      
      results.push({
        type: component.type,
        path: component.path,
        checksumValid,
        decompressValid: true,
        status: checksumValid ? 'valid' : 'checksum_mismatch',
      });
    } catch (error) {
      results.push({
        type: component.type,
        path: component.path,
        status: 'error',
        error: error.message,
      });
    }
  }
  
  const allValid = results.every(r => r.status === 'valid');
  
  return {
    backupId,
    verifiedAt: new Date().toISOString(),
    valid: allValid,
    components: results,
  };
}

export default {
  BackupType,
  BackupStrategy,
  BackupStatus,
  initialize,
  createBackup,
  listBackups,
  getBackup,
  restoreBackup,
  deleteBackup,
  getBackupChain,
  getPointInTimeOptions,
  getStatistics,
  verifyBackup,
  encryptBackup,
  decryptBackup,
};
