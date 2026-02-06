/**
 * Secure Sandbox Executor Service
 * 
 * Provides isolated code execution using Docker containers with strict
 * resource limits, network isolation, and security restrictions.
 * 
 * Supports: Python, JavaScript (Node.js), Bash
 */

import { spawn, execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { log } from './logger.js';

// Language configurations with Docker images and execution commands
const LANGUAGE_CONFIG = {
  python: {
    image: 'python:3.11-slim',
    extension: '.py',
    command: ['python3', '-u'],
    fallbackCommand: ['python3', '-u'],
  },
  javascript: {
    image: 'node:20-slim',
    extension: '.js',
    command: ['node'],
    fallbackCommand: ['node'],
  },
  bash: {
    image: 'alpine:3.19',
    extension: '.sh',
    command: ['sh'],
    fallbackCommand: ['bash'],
  },
  typescript: {
    image: 'node:20-slim',
    extension: '.ts',
    command: ['npx', 'tsx'],
    fallbackCommand: ['npx', 'tsx'],
  },
};

// Resource limits
const DEFAULT_LIMITS = {
  timeout: 30000,        // 30 seconds max execution
  memoryMB: 256,         // 256MB memory limit
  cpuShares: 512,        // Half CPU share (1024 = full core)
  maxOutputBytes: 1024 * 1024,  // 1MB max output
  diskMB: 100,           // 100MB disk limit
  pidsLimit: 50,         // Max 50 processes
};

// Security: Blocked patterns in code
const BLOCKED_PATTERNS = [
  // Network access
  /\bsocket\b/i,
  /\brequests\b.*\bget\b/i,
  /\bfetch\b\s*\(/i,
  /\bhttp\b/i,
  /\burllib\b/i,
  // File system escapes
  /\.\.\/\.\.\//,
  /\/etc\/passwd/i,
  /\/proc\//i,
  /\/sys\//i,
  // Process execution (in sandbox, we control this)
  /\bexec\b\s*\(/i,
  /\bspawn\b\s*\(/i,
  /\bfork\b\s*\(/i,
  /child_process/i,
  // Dangerous imports
  /\bctypes\b/i,
  /\bpickle\b/i,
  /\bsubprocess\b.*\bPopen\b/i,
];

// Check if Docker is available
let dockerAvailable = null;

async function checkDockerAvailable() {
  if (dockerAvailable !== null) return dockerAvailable;
  
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 5000 });
    dockerAvailable = true;
    log.info('Docker is available for sandboxed execution');
  } catch {
    dockerAvailable = false;
    log.warn('Docker not available, falling back to local execution with restrictions');
  }
  return dockerAvailable;
}

/**
 * Validate code for security concerns
 */
function validateCode(code, language) {
  const errors = [];
  
  // Check for blocked patterns (relaxed for sandbox environment)
  // We allow most patterns since Docker provides isolation
  if (!dockerAvailable) {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(code)) {
        errors.push(`Potentially unsafe pattern detected: ${pattern.source}`);
      }
    }
  }
  
  // Check code length
  if (code.length > 100000) {
    errors.push('Code exceeds maximum length of 100,000 characters');
  }
  
  return errors;
}

/**
 * Execute code in a Docker container
 */
async function executeInDocker(code, language, stdin, limits) {
  const config = LANGUAGE_CONFIG[language];
  const execId = uuidv4().slice(0, 8);
  const containerName = `sandbox-${execId}`;
  const tmpDir = path.join(os.tmpdir(), `sandbox-${execId}`);
  
  // Create temp directory and code file
  await fs.mkdir(tmpDir, { recursive: true });
  const codeFile = path.join(tmpDir, `code${config.extension}`);
  await fs.writeFile(codeFile, code);
  
  // Prepare stdin file if provided
  let stdinFile = null;
  if (stdin) {
    stdinFile = path.join(tmpDir, 'stdin.txt');
    await fs.writeFile(stdinFile, stdin);
  }
  
  try {
    // Build Docker command with security restrictions
    const dockerArgs = [
      'run',
      '--rm',
      '--name', containerName,
      // Resource limits
      '--memory', `${limits.memoryMB}m`,
      '--memory-swap', `${limits.memoryMB}m`,
      '--cpu-shares', String(limits.cpuShares),
      '--pids-limit', String(limits.pidsLimit),
      // Security restrictions
      '--network', 'none',           // No network access
      '--read-only',                 // Read-only filesystem
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=50m',  // Writable /tmp
      '--security-opt', 'no-new-privileges',
      '--cap-drop', 'ALL',           // Drop all capabilities
      // Mount code
      '-v', `${tmpDir}:/sandbox:ro`,
      '-w', '/sandbox',
    ];
    
    // Add stdin redirect if present
    if (stdinFile) {
      dockerArgs.push('-i');
    }
    
    // Add image and command
    dockerArgs.push(config.image);
    dockerArgs.push(...config.command);
    dockerArgs.push(`/sandbox/code${config.extension}`);
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let killed = false;
      let exitCode = 0;
      
      const proc = spawn('docker', dockerArgs);
      
      // Handle stdin
      if (stdin) {
        proc.stdin.write(stdin);
        proc.stdin.end();
      }
      
      // Collect output with size limit
      proc.stdout.on('data', (data) => {
        if (stdout.length < limits.maxOutputBytes) {
          stdout += data.toString();
        }
      });
      
      proc.stderr.on('data', (data) => {
        if (stderr.length < limits.maxOutputBytes) {
          stderr += data.toString();
        }
      });
      
      // Timeout handler
      const timeoutId = setTimeout(() => {
        killed = true;
        // Kill the container
        try {
          execSync(`docker kill ${containerName}`, { stdio: 'ignore' });
        } catch {
          // Container might have already exited
        }
      }, limits.timeout);
      
      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        exitCode = code || 0;
        
        const executionTime = Date.now() - startTime;
        
        // Truncate output if needed
        if (stdout.length >= limits.maxOutputBytes) {
          stdout = stdout.slice(0, limits.maxOutputBytes) + '\n[Output truncated...]';
        }
        if (stderr.length >= limits.maxOutputBytes) {
          stderr = stderr.slice(0, limits.maxOutputBytes) + '\n[Output truncated...]';
        }
        
        resolve({
          success: !killed && exitCode === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
          executionTime,
          timedOut: killed,
          memoryUsed: null,  // Docker doesn't easily expose this
        });
      });
      
      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          stdout: '',
          stderr: `Failed to start container: ${err.message}`,
          exitCode: 1,
          executionTime: Date.now() - startTime,
          timedOut: false,
          memoryUsed: null,
        });
      });
    });
  } finally {
    // Cleanup temp directory
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Execute code locally with restrictions (fallback when Docker unavailable)
 */
async function executeLocal(code, language, stdin, limits) {
  const config = LANGUAGE_CONFIG[language];
  const execId = uuidv4().slice(0, 8);
  const tmpDir = path.join(os.tmpdir(), `sandbox-local-${execId}`);
  
  // Create temp directory and code file
  await fs.mkdir(tmpDir, { recursive: true });
  const codeFile = path.join(tmpDir, `code${config.extension}`);
  await fs.writeFile(codeFile, code);
  
  try {
    // Determine the command to use
    let command = config.fallbackCommand[0];
    let args = [...config.fallbackCommand.slice(1), codeFile];
    
    // Check if command exists
    try {
      execSync(`which ${command}`, { stdio: 'ignore' });
    } catch {
      // Try alternative commands
      if (language === 'python') {
        command = 'python';
        args = [codeFile];
      } else if (language === 'bash') {
        command = 'sh';
        args = [codeFile];
      }
    }
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let killed = false;
      let exitCode = 0;
      
      const proc = spawn(command, args, {
        cwd: tmpDir,
        env: {
          ...process.env,
          // Restrict environment
          HOME: tmpDir,
          TMPDIR: tmpDir,
          PATH: '/usr/local/bin:/usr/bin:/bin',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      // Handle stdin
      if (stdin) {
        proc.stdin.write(stdin);
        proc.stdin.end();
      } else {
        proc.stdin.end();
      }
      
      // Collect output with size limit
      proc.stdout.on('data', (data) => {
        if (stdout.length < limits.maxOutputBytes) {
          stdout += data.toString();
        }
      });
      
      proc.stderr.on('data', (data) => {
        if (stderr.length < limits.maxOutputBytes) {
          stderr += data.toString();
        }
      });
      
      // Timeout handler
      const timeoutId = setTimeout(() => {
        killed = true;
        proc.kill('SIGKILL');
      }, limits.timeout);
      
      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        exitCode = code || 0;
        
        const executionTime = Date.now() - startTime;
        
        // Truncate output if needed
        if (stdout.length >= limits.maxOutputBytes) {
          stdout = stdout.slice(0, limits.maxOutputBytes) + '\n[Output truncated...]';
        }
        if (stderr.length >= limits.maxOutputBytes) {
          stderr = stderr.slice(0, limits.maxOutputBytes) + '\n[Output truncated...]';
        }
        
        resolve({
          success: !killed && exitCode === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
          executionTime,
          timedOut: killed,
          memoryUsed: null,
        });
      });
      
      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          stdout: '',
          stderr: `Failed to execute: ${err.message}`,
          exitCode: 1,
          executionTime: Date.now() - startTime,
          timedOut: false,
          memoryUsed: null,
        });
      });
    });
  } finally {
    // Cleanup temp directory
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Execute code in a secure sandbox
 * 
 * @param {string} code - The code to execute
 * @param {string} language - Programming language (python, javascript, bash)
 * @param {Object} options - Execution options
 * @param {string} options.stdin - Optional stdin input
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {number} options.memoryMB - Memory limit in MB
 * @returns {Promise<Object>} Execution result
 */
export async function execute(code, language, options = {}) {
  const normalizedLang = language.toLowerCase().replace(/^node\.?js$/, 'javascript');
  
  // Validate language
  if (!LANGUAGE_CONFIG[normalizedLang]) {
    return {
      success: false,
      stdout: '',
      stderr: `Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_CONFIG).join(', ')}`,
      exitCode: 1,
      executionTime: 0,
      timedOut: false,
      memoryUsed: null,
    };
  }
  
  // Validate code
  await checkDockerAvailable();
  const validationErrors = validateCode(code, normalizedLang);
  if (validationErrors.length > 0 && !dockerAvailable) {
    return {
      success: false,
      stdout: '',
      stderr: `Security validation failed:\n${validationErrors.join('\n')}`,
      exitCode: 1,
      executionTime: 0,
      timedOut: false,
      memoryUsed: null,
    };
  }
  
  // Merge options with defaults
  const limits = {
    timeout: Math.min(options.timeout || DEFAULT_LIMITS.timeout, 60000),  // Max 60s
    memoryMB: Math.min(options.memoryMB || DEFAULT_LIMITS.memoryMB, 512), // Max 512MB
    cpuShares: DEFAULT_LIMITS.cpuShares,
    maxOutputBytes: DEFAULT_LIMITS.maxOutputBytes,
    diskMB: DEFAULT_LIMITS.diskMB,
    pidsLimit: DEFAULT_LIMITS.pidsLimit,
  };
  
  const stdin = options.stdin || '';
  
  log.info('Executing code', {
    language: normalizedLang,
    codeLength: code.length,
    hasStdin: !!stdin,
    timeout: limits.timeout,
    useDocker: dockerAvailable,
  });
  
  try {
    let result;
    
    if (dockerAvailable) {
      result = await executeInDocker(code, normalizedLang, stdin, limits);
    } else {
      result = await executeLocal(code, normalizedLang, stdin, limits);
    }
    
    log.info('Code execution completed', {
      language: normalizedLang,
      success: result.success,
      exitCode: result.exitCode,
      executionTime: result.executionTime,
      timedOut: result.timedOut,
    });
    
    return result;
  } catch (err) {
    log.error('Code execution failed', { error: err.message });
    return {
      success: false,
      stdout: '',
      stderr: `Internal error: ${err.message}`,
      exitCode: 1,
      executionTime: 0,
      timedOut: false,
      memoryUsed: null,
    };
  }
}

/**
 * Get list of supported languages
 */
export function getSupportedLanguages() {
  return Object.keys(LANGUAGE_CONFIG).map(lang => ({
    id: lang,
    name: lang.charAt(0).toUpperCase() + lang.slice(1),
    extension: LANGUAGE_CONFIG[lang].extension,
  }));
}

/**
 * Get default code template for a language
 */
export function getCodeTemplate(language) {
  const templates = {
    python: `# Python 3.11
# Standard input is available via input()
# Print output with print()

def main():
    name = input("Enter your name: ")
    print(f"Hello, {name}!")

if __name__ == "__main__":
    main()
`,
    javascript: `// Node.js 20
// Use readline for stdin, console.log for stdout

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter your name: ', (name) => {
  console.log(\`Hello, \${name}!\`);
  rl.close();
});
`,
    bash: `#!/bin/bash
# Bash shell script

echo "Enter your name:"
read name
echo "Hello, $name!"
`,
    typescript: `// TypeScript with tsx
// Compiled and run with Node.js

const greeting = (name: string): string => {
  return \`Hello, \${name}!\`;
};

console.log(greeting("World"));
`,
  };
  
  return templates[language] || `// ${language}\n// Start coding here\n`;
}

/**
 * Check execution environment status
 */
export async function getStatus() {
  await checkDockerAvailable();
  return {
    dockerAvailable,
    supportedLanguages: getSupportedLanguages(),
    defaultLimits: DEFAULT_LIMITS,
  };
}

export default {
  execute,
  getSupportedLanguages,
  getCodeTemplate,
  getStatus,
};
