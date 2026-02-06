import PDFDocument from 'pdfkit';
import CryptoJS from 'crypto-js';
import { marked } from 'marked';

// Export formats
export const EXPORT_FORMATS = {
  JSON: 'json',
  MARKDOWN: 'markdown',
  PDF: 'pdf',
};

/**
 * Export session to JSON format
 */
export function exportToJSON(session, options = {}) {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    format: 'alfie-session',
    session: {
      id: session.id || session.localId,
      name: session.name || `Session ${session.id}`,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt || session.lastActivity,
      metadata: session.metadata || {},
      messages: session.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        thinking: options.includeThinking ? msg.thinking : undefined,
        toolCalls: options.includeToolCalls ? msg.toolCalls : undefined,
      })),
    },
  };

  if (options.encrypt && options.password) {
    return encryptData(JSON.stringify(exportData), options.password);
  }

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export session to Markdown format
 */
export function exportToMarkdown(session, options = {}) {
  const lines = [];
  const sessionName = session.name || `Session ${session.id || session.localId}`;
  
  lines.push(`# ${sessionName}`);
  lines.push('');
  lines.push(`**Created:** ${new Date(session.createdAt).toLocaleString()}`);
  lines.push(`**Last Updated:** ${new Date(session.updatedAt || session.lastActivity).toLocaleString()}`);
  lines.push(`**Messages:** ${session.messages.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of session.messages) {
    const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
    const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';
    
    lines.push(`## ${role}`);
    if (timestamp) {
      lines.push(`*${timestamp}*`);
    }
    lines.push('');
    
    if (options.includeThinking && msg.thinking) {
      lines.push('<details>');
      lines.push('<summary>Thinking</summary>');
      lines.push('');
      lines.push('```');
      lines.push(msg.thinking);
      lines.push('```');
      lines.push('</details>');
      lines.push('');
    }
    
    lines.push(msg.content);
    lines.push('');
    
    if (options.includeToolCalls && msg.toolCalls?.length) {
      lines.push('<details>');
      lines.push('<summary>Tool Calls</summary>');
      lines.push('');
      for (const tool of msg.toolCalls) {
        lines.push(`- **${tool.name}**: ${tool.status}`);
        if (tool.result) {
          lines.push('  ```');
          lines.push(`  ${tool.result.slice(0, 200)}${tool.result.length > 200 ? '...' : ''}`);
          lines.push('  ```');
        }
      }
      lines.push('</details>');
      lines.push('');
    }
    
    lines.push('---');
    lines.push('');
  }

  const markdown = lines.join('\n');

  if (options.encrypt && options.password) {
    return encryptData(markdown, options.password);
  }

  return markdown;
}

/**
 * Export session to PDF format
 */
export async function exportToPDF(session, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: session.name || `Session ${session.id || session.localId}`,
          Author: 'ALFIE Export',
          Subject: 'Chat Session Export',
          CreationDate: new Date(),
        },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        if (options.encrypt && options.password) {
          // For PDF encryption, we'll encrypt the base64-encoded PDF
          const base64 = pdfBuffer.toString('base64');
          resolve(encryptData(base64, options.password));
        } else {
          resolve(pdfBuffer);
        }
      });
      doc.on('error', reject);

      // Title
      const sessionName = session.name || `Session ${session.id || session.localId}`;
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#6366f1');
      doc.text(sessionName, { align: 'center' });
      doc.moveDown(0.5);

      // Metadata
      doc.fontSize(10).font('Helvetica').fillColor('#666666');
      doc.text(`Created: ${new Date(session.createdAt).toLocaleString()}`, { align: 'center' });
      doc.text(`Messages: ${session.messages.length}`, { align: 'center' });
      doc.moveDown(1);

      // Divider
      doc.strokeColor('#e5e7eb').lineWidth(1);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Messages
      for (const msg of session.messages) {
        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
        }

        const isUser = msg.role === 'user';
        const roleLabel = isUser ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
        const roleColor = isUser ? '#3b82f6' : msg.role === 'assistant' ? '#10b981' : '#8b5cf6';

        // Role header
        doc.fontSize(12).font('Helvetica-Bold').fillColor(roleColor);
        doc.text(roleLabel);

        // Timestamp
        if (msg.timestamp) {
          doc.fontSize(8).font('Helvetica').fillColor('#999999');
          doc.text(new Date(msg.timestamp).toLocaleString());
        }

        doc.moveDown(0.3);

        // Content
        doc.fontSize(10).font('Helvetica').fillColor('#333333');
        const content = msg.content || '';
        // Truncate very long messages for PDF
        const displayContent = content.length > 3000 ? content.slice(0, 3000) + '\n\n[Content truncated...]' : content;
        doc.text(displayContent, {
          align: 'left',
          lineGap: 2,
        });

        doc.moveDown(1);

        // Divider between messages
        doc.strokeColor('#f3f4f6').lineWidth(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
      }

      // Footer on last page
      doc.fontSize(8).fillColor('#999999');
      doc.text(
        `Exported by ALFIE on ${new Date().toLocaleString()}`,
        50,
        doc.page.height - 40,
        { align: 'center' }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Encrypt data with AES-256
 */
export function encryptData(data, password) {
  const encrypted = CryptoJS.AES.encrypt(data, password).toString();
  return JSON.stringify({
    encrypted: true,
    algorithm: 'AES-256',
    data: encrypted,
  });
}

/**
 * Decrypt data
 */
export function decryptData(encryptedJson, password) {
  try {
    const parsed = typeof encryptedJson === 'string' ? JSON.parse(encryptedJson) : encryptedJson;
    if (!parsed.encrypted) {
      return encryptedJson;
    }
    const decrypted = CryptoJS.AES.decrypt(parsed.data, password);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    throw new Error('Decryption failed. Check your password.');
  }
}

/**
 * Import session from JSON
 */
export function importFromJSON(jsonString, password = null) {
  let data = jsonString;

  // Handle encrypted data
  if (typeof jsonString === 'string') {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.encrypted) {
        if (!password) {
          throw new Error('Password required for encrypted file');
        }
        data = decryptData(jsonString, password);
      }
    } catch (e) {
      if (e.message.includes('Password required') || e.message.includes('Decryption failed')) {
        throw e;
      }
      // Not JSON, might be plain text
    }
  }

  const parsed = typeof data === 'string' ? JSON.parse(data) : data;

  // Validate format
  if (!parsed.session && !parsed.sessions) {
    throw new Error('Invalid export format: missing session data');
  }

  return parsed.sessions || [parsed.session];
}

/**
 * Import session from Markdown
 */
export function importFromMarkdown(markdown, password = null) {
  let content = markdown;

  // Handle encrypted data
  try {
    const parsed = JSON.parse(markdown);
    if (parsed.encrypted) {
      if (!password) {
        throw new Error('Password required for encrypted file');
      }
      content = decryptData(markdown, password);
    }
  } catch (e) {
    if (e.message.includes('Password required') || e.message.includes('Decryption failed')) {
      throw e;
    }
    // Not encrypted, continue with plain markdown
  }

  const messages = [];
  const lines = content.split('\n');
  
  let sessionName = 'Imported Session';
  let currentRole = null;
  let currentContent = [];
  let inDetails = false;

  for (const line of lines) {
    // Extract session name from H1
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      sessionName = line.slice(2).trim();
      continue;
    }

    // Detect role headers
    if (line.startsWith('## User')) {
      if (currentRole && currentContent.length) {
        messages.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${messages.length}`,
          role: currentRole,
          content: currentContent.join('\n').trim(),
          timestamp: new Date().toISOString(),
        });
      }
      currentRole = 'user';
      currentContent = [];
      continue;
    }

    if (line.startsWith('## Assistant')) {
      if (currentRole && currentContent.length) {
        messages.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${messages.length}`,
          role: currentRole,
          content: currentContent.join('\n').trim(),
          timestamp: new Date().toISOString(),
        });
      }
      currentRole = 'assistant';
      currentContent = [];
      continue;
    }

    if (line.startsWith('## System')) {
      if (currentRole && currentContent.length) {
        messages.push({
          id: crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${messages.length}`,
          role: currentRole,
          content: currentContent.join('\n').trim(),
          timestamp: new Date().toISOString(),
        });
      }
      currentRole = 'system';
      currentContent = [];
      continue;
    }

    // Skip details sections and metadata
    if (line.startsWith('<details>')) {
      inDetails = true;
      continue;
    }
    if (line.startsWith('</details>')) {
      inDetails = false;
      continue;
    }
    if (inDetails) continue;
    if (line.startsWith('**Created:**') || line.startsWith('**Last Updated:**') || line.startsWith('**Messages:**')) continue;
    if (line.startsWith('*') && line.endsWith('*') && line.length < 100) continue; // Skip timestamps
    if (line === '---') continue;

    // Collect content
    if (currentRole) {
      currentContent.push(line);
    }
  }

  // Add last message
  if (currentRole && currentContent.length) {
    messages.push({
      id: crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${messages.length}`,
      role: currentRole,
      content: currentContent.join('\n').trim(),
      timestamp: new Date().toISOString(),
    });
  }

  return [{
    id: crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
    name: sessionName,
    messages,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }];
}

/**
 * Export multiple sessions (batch export)
 */
export async function exportBatch(sessions, format, options = {}) {
  if (format === EXPORT_FORMATS.JSON) {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      format: 'alfie-sessions-batch',
      count: sessions.length,
      sessions: sessions.map((session) => ({
        id: session.id || session.localId,
        name: session.name || `Session ${session.id}`,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt || session.lastActivity,
        metadata: session.metadata || {},
        messages: session.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
      })),
    };

    if (options.encrypt && options.password) {
      return encryptData(JSON.stringify(exportData), options.password);
    }

    return JSON.stringify(exportData, null, 2);
  }

  if (format === EXPORT_FORMATS.MARKDOWN) {
    const parts = sessions.map((session) => exportToMarkdown(session, { ...options, encrypt: false }));
    const combined = parts.join('\n\n---\n\n# Next Session\n\n');
    
    if (options.encrypt && options.password) {
      return encryptData(combined, options.password);
    }
    
    return combined;
  }

  throw new Error(`Batch export not supported for format: ${format}`);
}

export default {
  EXPORT_FORMATS,
  exportToJSON,
  exportToMarkdown,
  exportToPDF,
  encryptData,
  decryptData,
  importFromJSON,
  importFromMarkdown,
  exportBatch,
};
