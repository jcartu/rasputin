import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as ragService from './ragService.js';

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.tsv',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.html',
  '.css',
  '.scss',
  '.sql',
  '.yaml',
  '.yml',
  '.xml',
  '.toml',
  '.ini',
  '.log',
]);

const PDF_MIME_TYPES = new Set(['application/pdf']);

function getManifestPath() {
  return path.join(getUploadDir(), 'manifest.json');
}

async function readManifest() {
  try {
    const data = await fsp.readFile(getManifestPath(), 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    console.error('Failed to read upload manifest:', error.message);
    return {};
  }
}

async function writeManifest(manifest) {
  await fsp.writeFile(
    getManifestPath(),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

async function updateManifest(fileId, updates) {
  const manifest = await readManifest();
  if (!manifest[fileId]) return null;

  const updated = {
    ...manifest[fileId],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  manifest[fileId] = updated;
  await writeManifest(manifest);
  return updated;
}

function isTextType(extension, mimeType) {
  if (mimeType?.startsWith('text/')) return true;
  if (mimeType === 'application/json') return true;
  return TEXT_EXTENSIONS.has(extension);
}

function shouldSkipExtraction(mimeType) {
  return Boolean(mimeType?.startsWith('image/'));
}

async function runExtraction(fileId, filePath, mimeType, originalName) {
  const extension = path.extname(originalName || filePath).toLowerCase();

  if (shouldSkipExtraction(mimeType)) {
    await updateManifest(fileId, {
      extractedText: '',
      extractedTextPreview: '',
      extractionStatus: 'skipped',
      extractedTextNote: 'Image OCR not supported yet.',
    });
    return;
  }

  try {
    const extractedText = await extractText(filePath, mimeType, extension);
    const preview = extractedText.slice(0, 2000);

    await updateManifest(fileId, {
      extractedText,
      extractedTextPreview: preview,
      extractionStatus: 'complete',
      extractedTextNote: '',
    });

    if (extractedText.trim()) {
      ragService
        .embedDocument(fileId, extractedText, {
          source: originalName || filePath,
          mimeType,
          filename: originalName,
        })
        .then(() => {
          console.info('RAG embed completed for upload', { fileId });
        })
        .catch(error => {
          console.error('RAG embed failed for upload', {
            fileId,
            error: error.message,
          });
        });
    }
  } catch (error) {
    await updateManifest(fileId, {
      extractedText: '',
      extractedTextPreview: '',
      extractionStatus: 'failed',
      extractedTextNote: error.message,
    });
  }
}

export function getUploadDir() {
  const uploadDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

export async function saveFile(file) {
  const uploadDir = getUploadDir();
  const id = uuidv4();
  const extension = path.extname(file.originalname || '').toLowerCase();
  const filename = extension ? `${id}${extension}` : id;
  const finalPath = path.join(uploadDir, filename);

  if (file.path && file.path !== finalPath) {
    await fsp.rename(file.path, finalPath);
  } else if (file.buffer) {
    await fsp.writeFile(finalPath, file.buffer);
  }

  const metadata = {
    id,
    filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: finalPath,
    uploadedAt: new Date().toISOString(),
    extractedText: '',
    extractedTextPreview: '',
    extractionStatus: 'pending',
    extractedTextNote: '',
  };

  const manifest = await readManifest();
  manifest[id] = metadata;
  await writeManifest(manifest);

  setImmediate(() => {
    runExtraction(id, finalPath, metadata.mimeType, metadata.originalName).catch(
      (error) => {
        console.error('File extraction failed:', error.message);
      }
    );
  });

  return metadata;
}

export async function getFile(fileId) {
  const manifest = await readManifest();
  return manifest[fileId] || null;
}

export async function deleteFile(fileId) {
  const manifest = await readManifest();
  const entry = manifest[fileId];
  if (!entry) return null;

  try {
    await fsp.unlink(entry.path);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  delete manifest[fileId];
  await writeManifest(manifest);
  return entry;
}

export async function extractText(filePath, mimeType, extension = '') {
  const normalizedExtension = extension || path.extname(filePath).toLowerCase();

  if (PDF_MIME_TYPES.has(mimeType) || normalizedExtension === '.pdf') {
    try {
      const module = await import('pdf-parse');
      const pdfParse = module.default || module;
      const data = await fsp.readFile(filePath);
      const parsed = await pdfParse(data);
      return parsed.text || '';
    } catch (error) {
      throw new Error('PDF text extraction unavailable. Install pdf-parse to enable.');
    }
  }

  if (isTextType(normalizedExtension, mimeType)) {
    return fsp.readFile(filePath, 'utf-8');
  }

  return '';
}

export default {
  saveFile,
  getFile,
  deleteFile,
  extractText,
  getUploadDir,
};
