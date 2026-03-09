import { BaseTool } from '../BaseTool.js';
import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import path from 'path';

const WORKSPACE_ROOT = process.env.ALFIE_WORKSPACE_ROOT || '/tmp/alfie-workspaces';

function getUserWorkspace(userId) {
  return path.join(WORKSPACE_ROOT, userId);
}

function validatePath(userWorkspace, requestedPath) {
  const resolved = path.resolve(userWorkspace, requestedPath);
  if (!resolved.startsWith(userWorkspace)) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

export class FileOperationsTool extends BaseTool {
  constructor() {
    super({
      name: 'file_operations',
      description: 'Read, write, or list files in the user workspace. Operations: read_file, write_file, list_directory.',
      parameters: {
        properties: {
          operation: { type: 'string', enum: ['read_file', 'write_file', 'list_directory'], description: 'File operation to perform' },
          path: { type: 'string', description: 'File or directory path (relative to workspace)' },
          content: { type: 'string', description: 'Content to write (for write_file)' },
        },
        required: ['operation', 'path'],
      },
    });
  }

  async execute(input, context) {
    const userId = context.userId;
    if (!userId) throw new Error('No userId in context');
    
    const workspace = getUserWorkspace(userId);
    await mkdir(workspace, { recursive: true });
    const safePath = validatePath(workspace, input.path);
    
    switch (input.operation) {
      case 'read_file': {
        const content = await readFile(safePath, 'utf-8');
        return content.slice(0, 50000);
      }
      case 'write_file': {
        if (!input.content) throw new Error('content required for write_file');
        await mkdir(path.dirname(safePath), { recursive: true });
        await writeFile(safePath, input.content, 'utf-8');
        return `Written ${input.content.length} bytes to ${input.path}`;
      }
      case 'list_directory': {
        const entries = await readdir(safePath, { withFileTypes: true });
        return entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'directory' : 'file',
        }));
      }
      default:
        throw new Error(`Unknown operation: ${input.operation}`);
    }
  }
}
