import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');
const MAX_FILE_SIZE = parseInt(process.env.LOG_MAX_SIZE || '10485760', 10);
const MAX_FILES = parseInt(process.env.LOG_MAX_FILES || '5', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

class Logger {
  constructor() {
    this.currentLevel = LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.info;
    this.logFile = null;
    this.logFilePath = null;
    this.currentFileSize = 0;
    this._initLogDirectory();
  }

  _initLogDirectory() {
    try {
      if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
      }
      this._openLogFile();
    } catch (error) {
      console.error('Failed to initialize log directory:', error.message);
    }
  }

  _openLogFile() {
    const date = new Date().toISOString().split('T')[0];
    this.logFilePath = path.join(LOG_DIR, `alfie-${date}.log`);
    
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        this.currentFileSize = stats.size;
      } else {
        this.currentFileSize = 0;
      }
      
      this.logFile = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    } catch (error) {
      console.error('Failed to open log file:', error.message);
      this.logFile = null;
    }
  }

  _rotateIfNeeded() {
    if (this.currentFileSize < MAX_FILE_SIZE) return;

    try {
      if (this.logFile) {
        this.logFile.end();
      }

      const files = fs.readdirSync(LOG_DIR)
        .filter(f => f.startsWith('alfie-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(LOG_DIR, f),
          time: fs.statSync(path.join(LOG_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.path === this.logFilePath) {
          const rotatedPath = `${file.path}.${Date.now()}`;
          fs.renameSync(file.path, rotatedPath);
        }
      }

      const allLogFiles = fs.readdirSync(LOG_DIR)
        .filter(f => f.startsWith('alfie-'))
        .map(f => ({
          name: f,
          path: path.join(LOG_DIR, f),
          time: fs.statSync(path.join(LOG_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (allLogFiles.length > MAX_FILES) {
        for (let i = MAX_FILES; i < allLogFiles.length; i++) {
          fs.unlinkSync(allLogFiles[i].path);
        }
      }

      this._openLogFile();
    } catch (error) {
      console.error('Log rotation failed:', error.message);
    }
  }

  _formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && Object.keys(data).length > 0 ? { data } : {}),
    };
    return JSON.stringify(logEntry);
  }

  _write(level, message, data) {
    if (LOG_LEVELS[level] > this.currentLevel) return;

    const formatted = this._formatMessage(level, message, data);
    
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](formatted);

    if (this.logFile) {
      const line = formatted + '\n';
      this.logFile.write(line);
      this.currentFileSize += Buffer.byteLength(line);
      this._rotateIfNeeded();
    }
  }

  error(message, data) {
    this._write('error', message, data);
  }

  warn(message, data) {
    this._write('warn', message, data);
  }

  info(message, data) {
    this._write('info', message, data);
  }

  debug(message, data) {
    this._write('debug', message, data);
  }

  close() {
    if (this.logFile) {
      this.logFile.end();
      this.logFile = null;
    }
  }
}

const logger = new Logger();

export const log = {
  error: (message, data) => logger.error(message, data),
  warn: (message, data) => logger.warn(message, data),
  info: (message, data) => logger.info(message, data),
  debug: (message, data) => logger.debug(message, data),
  close: () => logger.close(),
};

export default log;
