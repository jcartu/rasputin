import { BaseTool } from '../BaseTool.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const execFileAsync = promisify(execFile);

const DOCKER_IMAGE = 'alfie-sandbox';
const TIMEOUT_MS = 60000;
const MAX_MEMORY = '512m';
const MAX_CPU = '1.0';

export class CodeSandboxTool extends BaseTool {
  constructor() {
    super({
      name: 'execute_code',
      description: 'Execute Python or JavaScript code in a secure sandbox. Returns stdout, stderr, and exit code. Use for calculations, data processing, file generation, etc.',
      parameters: {
        properties: {
          language: { type: 'string', enum: ['python', 'javascript'], description: 'Programming language' },
          code: { type: 'string', description: 'Code to execute' },
        },
        required: ['language', 'code'],
      },
    });
    this.timeout = TIMEOUT_MS;
  }

  async execute(input, context) {
    const { language, code } = input;
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'alfie-sandbox-'));
    const ext = language === 'python' ? '.py' : '.js';
    const filename = `script${ext}`;
    const filepath = path.join(tmpDir, filename);

    try {
      await writeFile(filepath, code, 'utf-8');

      const cmd = language === 'python' ? 'python3' : 'node';

      try {
        const { stdout, stderr } = await execFileAsync('docker', [
          'run', '--rm',
          '--memory', MAX_MEMORY,
          '--cpus', MAX_CPU,
          '--network', 'none',
          '--read-only',
          '--user', '65534:65534',
          '--tmpfs', '/tmp:rw,noexec,size=64m',
          '-v', `${filepath}:/sandbox/${filename}:ro`,
          '-w', '/sandbox',
          DOCKER_IMAGE,
          cmd, filename,
        ], { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 });

        return { stdout: stdout.slice(0, 10000), stderr: stderr.slice(0, 5000), exitCode: 0 };
      } catch (dockerError) {
        if (dockerError.code === 'ENOENT' || dockerError.message?.includes('No such image')) {
          const { stdout, stderr } = await execFileAsync(cmd, [filepath], {
            timeout: TIMEOUT_MS,
            maxBuffer: 1024 * 1024,
            cwd: tmpDir,
          });
          return { stdout: stdout.slice(0, 10000), stderr: stderr.slice(0, 5000), exitCode: 0, note: 'Executed without Docker sandbox' };
        }
        return {
          stdout: (dockerError.stdout || '').slice(0, 10000),
          stderr: (dockerError.stderr || dockerError.message).slice(0, 5000),
          exitCode: dockerError.code || 1,
        };
      }
    } finally {
      await unlink(filepath).catch(() => {});
    }
  }
}
