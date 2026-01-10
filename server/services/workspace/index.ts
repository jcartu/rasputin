/**
 * Workspace Service - Manages persistent development environments for JARVIS
 *
 * In Manus sandbox: Uses direct filesystem operations
 * On production server: Will use Docker/gVisor containers
 */

import * as fs from "fs/promises";
import * as path from "path";
import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import {
  executeInSandbox,
  getSandboxStatus,
  type SandboxConfig,
} from "../sandbox";

const execAsync = promisify(exec);

const USE_SANDBOX = process.env.USE_SANDBOX !== "false";

// Base directory for all workspaces
const WORKSPACES_BASE =
  process.env.WORKSPACES_BASE || "/home/ubuntu/workspaces";

// Templates configuration
export const WORKSPACE_TEMPLATES = {
  blank: {
    id: "blank",
    name: "Blank Project",
    description: "Empty workspace with no files",
    category: "general",
    icon: "folder",
    setupCommands: [],
    defaultFiles: [],
  },
  "node-basic": {
    id: "node-basic",
    name: "Node.js Basic",
    description: "Simple Node.js project with package.json",
    category: "backend",
    icon: "server",
    setupCommands: ["npm init -y"],
    defaultFiles: [
      { path: "index.js", content: 'console.log("Hello from Node.js!");\n' },
      { path: ".gitignore", content: "node_modules/\n.env\n" },
    ],
  },
  "react-vite": {
    id: "react-vite",
    name: "React + Vite",
    description: "Modern React app with Vite bundler",
    category: "frontend",
    icon: "layout",
    setupCommands: [],
    defaultFiles: [
      {
        path: "package.json",
        content:
          JSON.stringify(
            {
              name: "react-app",
              private: true,
              version: "0.0.0",
              type: "module",
              scripts: {
                dev: "vite",
                build: "vite build",
                preview: "vite preview",
              },
              dependencies: {
                react: "^18.2.0",
                "react-dom": "^18.2.0",
              },
              devDependencies: {
                "@vitejs/plugin-react": "^4.0.0",
                vite: "^5.0.0",
              },
            },
            null,
            2
          ) + "\n",
      },
      {
        path: "vite.config.js",
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
      },
      {
        path: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
      },
      {
        path: "src/main.jsx",
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
      },
      {
        path: "src/App.jsx",
        content: `function App() {
  return (
    <div>
      <h1>Hello React!</h1>
    </div>
  )
}

export default App
`,
      },
      { path: ".gitignore", content: "node_modules/\ndist/\n.env\n" },
    ],
    devServerCommand: "npm run dev",
    devServerPort: 5173,
  },
  "python-basic": {
    id: "python-basic",
    name: "Python Basic",
    description: "Simple Python project with virtual environment",
    category: "backend",
    icon: "terminal",
    setupCommands: [],
    defaultFiles: [
      { path: "main.py", content: 'print("Hello from Python!")\n' },
      { path: "requirements.txt", content: "# Add your dependencies here\n" },
      { path: ".gitignore", content: "__pycache__/\n*.pyc\nvenv/\n.env\n" },
    ],
  },
  "express-api": {
    id: "express-api",
    name: "Express.js API",
    description: "REST API with Express.js",
    category: "backend",
    icon: "server",
    setupCommands: [],
    defaultFiles: [
      {
        path: "package.json",
        content:
          JSON.stringify(
            {
              name: "express-api",
              version: "1.0.0",
              main: "index.js",
              scripts: {
                start: "node index.js",
                dev: "node --watch index.js",
              },
              dependencies: {
                express: "^4.18.2",
                cors: "^2.8.5",
              },
            },
            null,
            2
          ) + "\n",
      },
      {
        path: "index.js",
        content: `const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`,
      },
      { path: ".gitignore", content: "node_modules/\n.env\n" },
    ],
    devServerCommand: "npm run dev",
    devServerPort: 3000,
  },
  nextjs: {
    id: "nextjs",
    name: "Next.js App",
    description: "Full-stack React framework with Next.js",
    category: "fullstack",
    icon: "layers",
    setupCommands: [],
    defaultFiles: [
      {
        path: "package.json",
        content:
          JSON.stringify(
            {
              name: "nextjs-app",
              version: "0.1.0",
              private: true,
              scripts: {
                dev: "next dev",
                build: "next build",
                start: "next start",
              },
              dependencies: {
                next: "^14.0.0",
                react: "^18.2.0",
                "react-dom": "^18.2.0",
              },
            },
            null,
            2
          ) + "\n",
      },
      {
        path: "app/page.js",
        content: `export default function Home() {
  return (
    <main>
      <h1>Welcome to Next.js!</h1>
    </main>
  )
}
`,
      },
      {
        path: "app/layout.js",
        content: `export const metadata = {
  title: 'Next.js App',
  description: 'Created with JARVIS',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
      },
      { path: ".gitignore", content: "node_modules/\n.next/\n.env\n" },
    ],
    devServerCommand: "npm run dev",
    devServerPort: 3000,
  },
};

export type TemplateId = keyof typeof WORKSPACE_TEMPLATES;

export interface WorkspaceInfo {
  id: string;
  userId: number;
  name: string;
  basePath: string;
  template: TemplateId;
  status: "creating" | "ready" | "running" | "stopped" | "error";
  gitInitialized: boolean;
  devServerPort?: number;
  devServerUrl?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mimeType?: string;
  lastModified: Date;
}

export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  date: Date;
  filesChanged: number;
}

// Running processes map
const runningProcesses = new Map<string, ChildProcess>();

/**
 * Ensure the workspaces base directory exists
 */
export async function ensureWorkspacesDir(): Promise<void> {
  try {
    await fs.mkdir(WORKSPACES_BASE, { recursive: true });
  } catch (_error) {
    // Directory may already exist
  }
}

/**
 * Get the workspace path for a user and workspace ID
 */
export function getWorkspacePath(userId: number, workspaceId: string): string {
  return path.join(WORKSPACES_BASE, String(userId), workspaceId);
}

/**
 * Create a new workspace
 */
export async function createWorkspace(
  userId: number,
  workspaceId: string,
  name: string,
  template: TemplateId = "blank"
): Promise<WorkspaceInfo> {
  await ensureWorkspacesDir();

  const workspacePath = getWorkspacePath(userId, workspaceId);

  // Create workspace directory
  await fs.mkdir(workspacePath, { recursive: true });

  // Get template config
  const templateConfig =
    WORKSPACE_TEMPLATES[template] || WORKSPACE_TEMPLATES.blank;

  // Create default files from template
  for (const file of templateConfig.defaultFiles || []) {
    const filePath = path.join(workspacePath, file.path);
    const fileDir = path.dirname(filePath);
    await fs.mkdir(fileDir, { recursive: true });
    await fs.writeFile(filePath, file.content, "utf-8");
  }

  // Initialize git repository
  try {
    await execAsync("git init", { cwd: workspacePath });
    await execAsync('git config user.email "jarvis@rasputin.ai"', {
      cwd: workspacePath,
    });
    await execAsync('git config user.name "JARVIS"', { cwd: workspacePath });

    // Initial commit if there are files
    const files = await fs.readdir(workspacePath);
    if (files.length > 0) {
      await execAsync("git add -A", { cwd: workspacePath });
      await execAsync(
        'git commit -m "Initial commit from template: ' + template + '"',
        { cwd: workspacePath }
      );
    }
  } catch (error) {
    console.error("Git init error:", error);
  }

  return {
    id: workspaceId,
    userId,
    name,
    basePath: workspacePath,
    template,
    status: "ready",
    gitInitialized: true,
  };
}

/**
 * Delete a workspace
 */
export async function deleteWorkspace(
  userId: number,
  workspaceId: string
): Promise<void> {
  const workspacePath = getWorkspacePath(userId, workspaceId);

  // Stop any running processes
  await stopDevServer(userId, workspaceId);

  // Remove the directory
  await fs.rm(workspacePath, { recursive: true, force: true });
}

/**
 * List files in a workspace directory
 */
export async function listFiles(
  userId: number,
  workspaceId: string,
  relativePath: string = ""
): Promise<FileInfo[]> {
  const workspacePath = getWorkspacePath(userId, workspaceId);
  const targetPath = path.join(workspacePath, relativePath);

  // Security check - ensure path is within workspace
  const resolvedPath = path.resolve(targetPath);
  if (!resolvedPath.startsWith(workspacePath)) {
    throw new Error("Path traversal attempt detected");
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files: FileInfo[] = [];

  for (const entry of entries) {
    // Skip hidden files and node_modules
    if (entry.name.startsWith(".") && entry.name !== ".gitignore") continue;
    if (entry.name === "node_modules") continue;

    const entryPath = path.join(targetPath, entry.name);
    const stats = await fs.stat(entryPath);

    files.push({
      name: entry.name,
      path: path.join(relativePath, entry.name),
      isDirectory: entry.isDirectory(),
      size: stats.size,
      lastModified: stats.mtime,
      mimeType: entry.isDirectory() ? undefined : getMimeType(entry.name),
    });
  }

  // Sort: directories first, then alphabetically
  files.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return files;
}

/**
 * Read a file from workspace
 */
export async function readFile(
  userId: number,
  workspaceId: string,
  relativePath: string
): Promise<string> {
  const workspacePath = getWorkspacePath(userId, workspaceId);
  const filePath = path.join(workspacePath, relativePath);

  // Security check
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(workspacePath)) {
    throw new Error("Path traversal attempt detected");
  }

  return await fs.readFile(filePath, "utf-8");
}

/**
 * Write a file to workspace
 */
export async function writeFile(
  userId: number,
  workspaceId: string,
  relativePath: string,
  content: string,
  autoCommit: boolean = true
): Promise<void> {
  const workspacePath = getWorkspacePath(userId, workspaceId);
  const filePath = path.join(workspacePath, relativePath);

  // Security check
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(workspacePath)) {
    throw new Error("Path traversal attempt detected");
  }

  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // Write file
  await fs.writeFile(filePath, content, "utf-8");

  // Auto-commit if enabled
  if (autoCommit) {
    try {
      await execAsync(`git add "${relativePath}"`, { cwd: workspacePath });
      await execAsync(`git commit -m "Update ${relativePath}"`, {
        cwd: workspacePath,
      });
    } catch (_error) {
      // Commit may fail if no changes
    }
  }
}

/**
 * Delete a file from workspace
 */
export async function deleteFile(
  userId: number,
  workspaceId: string,
  relativePath: string,
  autoCommit: boolean = true
): Promise<void> {
  const workspacePath = getWorkspacePath(userId, workspaceId);
  const filePath = path.join(workspacePath, relativePath);

  // Security check
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(workspacePath)) {
    throw new Error("Path traversal attempt detected");
  }

  const stats = await fs.stat(filePath);
  if (stats.isDirectory()) {
    await fs.rm(filePath, { recursive: true });
  } else {
    await fs.unlink(filePath);
  }

  // Auto-commit if enabled
  if (autoCommit) {
    try {
      await execAsync(`git add -A`, { cwd: workspacePath });
      await execAsync(`git commit -m "Delete ${relativePath}"`, {
        cwd: workspacePath,
      });
    } catch (_error) {
      // Commit may fail if no changes
    }
  }
}

/**
 * Create a directory in workspace
 */
export async function createDirectory(
  userId: number,
  workspaceId: string,
  relativePath: string
): Promise<void> {
  const workspacePath = getWorkspacePath(userId, workspaceId);
  const dirPath = path.join(workspacePath, relativePath);

  // Security check
  const resolvedPath = path.resolve(dirPath);
  if (!resolvedPath.startsWith(workspacePath)) {
    throw new Error("Path traversal attempt detected");
  }

  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Get git commit history
 */
export async function getCommitHistory(
  userId: number,
  workspaceId: string,
  limit: number = 20
): Promise<GitCommitInfo[]> {
  const workspacePath = getWorkspacePath(userId, workspaceId);

  try {
    const { stdout } = await execAsync(
      `git log --format="%H|%s|%an|%ai" -n ${limit}`,
      { cwd: workspacePath }
    );

    const commits: GitCommitInfo[] = [];
    const lines = stdout.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      const [hash, message, author, date] = line.split("|");

      // Get files changed for this commit
      let filesChanged = 0;
      try {
        const { stdout: diffStat } = await execAsync(
          `git diff --shortstat ${hash}^ ${hash} 2>/dev/null || echo "0"`,
          { cwd: workspacePath }
        );
        const match = diffStat.match(/(\d+) files? changed/);
        filesChanged = match ? parseInt(match[1]) : 0;
      } catch {
        // First commit has no parent
      }

      commits.push({
        hash,
        message,
        author,
        date: new Date(date),
        filesChanged,
      });
    }

    return commits;
  } catch (_error) {
    return [];
  }
}

/**
 * Create a checkpoint (named commit)
 */
export async function createCheckpoint(
  userId: number,
  workspaceId: string,
  name: string,
  message: string
): Promise<GitCommitInfo | null> {
  const workspacePath = getWorkspacePath(userId, workspaceId);

  try {
    // Stage all changes
    await execAsync("git add -A", { cwd: workspacePath });

    // Create commit with checkpoint tag
    const fullMessage = `[CHECKPOINT: ${name}] ${message}`;
    await execAsync(`git commit -m "${fullMessage}" --allow-empty`, {
      cwd: workspacePath,
    });

    // Get the commit info
    const { stdout } = await execAsync(
      'git log --format="%H|%s|%an|%ai" -n 1',
      { cwd: workspacePath }
    );

    const [hash, msg, author, date] = stdout.trim().split("|");

    return {
      hash,
      message: msg,
      author,
      date: new Date(date),
      filesChanged: 0,
    };
  } catch (error) {
    console.error("Checkpoint error:", error);
    return null;
  }
}

/**
 * Rollback to a specific commit
 */
export async function rollbackToCommit(
  userId: number,
  workspaceId: string,
  commitHash: string
): Promise<boolean> {
  const workspacePath = getWorkspacePath(userId, workspaceId);

  try {
    // Hard reset to the commit
    await execAsync(`git reset --hard ${commitHash}`, { cwd: workspacePath });
    return true;
  } catch (error) {
    console.error("Rollback error:", error);
    return false;
  }
}

/**
 * Get git status (changed files)
 */
export async function getGitStatus(
  userId: number,
  workspaceId: string
): Promise<{ modified: string[]; added: string[]; deleted: string[] }> {
  const workspacePath = getWorkspacePath(userId, workspaceId);

  try {
    const { stdout } = await execAsync("git status --porcelain", {
      cwd: workspacePath,
    });

    const modified: string[] = [];
    const added: string[] = [];
    const deleted: string[] = [];

    const lines = stdout.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const status = line.substring(0, 2);
      const file = line.substring(3);

      if (status.includes("M")) modified.push(file);
      else if (status.includes("A") || status.includes("?")) added.push(file);
      else if (status.includes("D")) deleted.push(file);
    }

    return { modified, added, deleted };
  } catch (_error) {
    return { modified: [], added: [], deleted: [] };
  }
}

/**
 * Start dev server for a workspace
 */
export async function startDevServer(
  userId: number,
  workspaceId: string,
  command?: string,
  port?: number
): Promise<{ port: number; url: string } | null> {
  const workspacePath = getWorkspacePath(userId, workspaceId);
  const processKey = `${userId}-${workspaceId}`;

  // Stop existing server if running
  await stopDevServer(userId, workspaceId);

  // Determine command and port
  const template = await detectTemplate(userId, workspaceId);
  const templateConfig = WORKSPACE_TEMPLATES[template as TemplateId];

  const serverCommand =
    command || (templateConfig as any)?.devServerCommand || "npm run dev";
  const serverPort = port || (templateConfig as any)?.devServerPort || 3000;

  // Check if package.json exists and has dependencies
  const packageJsonPath = path.join(workspacePath, "package.json");
  try {
    await fs.access(packageJsonPath);
    // Install dependencies if node_modules doesn't exist
    const nodeModulesPath = path.join(workspacePath, "node_modules");
    try {
      await fs.access(nodeModulesPath);
    } catch {
      console.log("Installing dependencies...");
      await execAsync("npm install", { cwd: workspacePath });
    }
  } catch {
    // No package.json
  }

  // Start the dev server
  const [cmd, ...args] = serverCommand.split(" ");
  const childProcess = spawn(cmd, args, {
    cwd: workspacePath,
    env: { ...process.env, PORT: String(serverPort) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  runningProcesses.set(processKey, childProcess);

  // Log output
  childProcess.stdout?.on("data", data => {
    console.log(`[${workspaceId}] ${data.toString()}`);
  });

  childProcess.stderr?.on("data", data => {
    console.error(`[${workspaceId}] ${data.toString()}`);
  });

  childProcess.on("exit", code => {
    console.log(`[${workspaceId}] Dev server exited with code ${code}`);
    runningProcesses.delete(processKey);
  });

  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    port: serverPort,
    url: `http://localhost:${serverPort}`,
  };
}

/**
 * Stop dev server for a workspace
 */
export async function stopDevServer(
  userId: number,
  workspaceId: string
): Promise<void> {
  const processKey = `${userId}-${workspaceId}`;
  const childProcess = runningProcesses.get(processKey);

  if (childProcess) {
    childProcess.kill("SIGTERM");
    runningProcesses.delete(processKey);

    // Wait for process to exit
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

export async function executeCommand(
  userId: number,
  workspaceId: string,
  command: string,
  timeout: number = 30000,
  options?: { useSandbox?: boolean }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const workspacePath = getWorkspacePath(userId, workspaceId);
  const shouldUseSandbox = options?.useSandbox ?? USE_SANDBOX;

  if (shouldUseSandbox) {
    const status = await getSandboxStatus();
    if (status.dockerAvailable) {
      const sandboxConfig: SandboxConfig = {
        timeoutMs: timeout,
        workspacePath,
        networkEnabled: false,
      };

      const result = await executeInSandbox(command, sandboxConfig);
      return {
        stdout: result.stdout,
        stderr: result.stderr + (result.error ? `\n${result.error}` : ""),
        exitCode: result.exitCode,
      };
    }
  }

  const blockedPatterns = [
    /rm\s+-rf\s+\//,
    /sudo/,
    /chmod\s+777/,
    />\s*\/etc/,
    /curl.*\|.*sh/,
    /wget.*\|.*sh/,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(command)) {
      return {
        stdout: "",
        stderr: "Command blocked for security reasons",
        exitCode: 1,
      };
    }
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workspacePath,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });

    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      message?: string;
      code?: number;
    };
    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || execError.message || "",
      exitCode: execError.code || 1,
    };
  }
}

/**
 * Detect template from existing files
 */
async function detectTemplate(
  userId: number,
  workspaceId: string
): Promise<string> {
  const workspacePath = getWorkspacePath(userId, workspaceId);

  try {
    const packageJsonPath = path.join(workspacePath, "package.json");
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);

    if (pkg.dependencies?.next) return "nextjs";
    if (pkg.dependencies?.react && pkg.devDependencies?.vite)
      return "react-vite";
    if (pkg.dependencies?.express) return "express-api";
    return "node-basic";
  } catch {
    // Check for Python
    try {
      await fs.access(path.join(workspacePath, "requirements.txt"));
      return "python-basic";
    } catch {
      return "blank";
    }
  }
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".js": "application/javascript",
    ".jsx": "application/javascript",
    ".ts": "application/typescript",
    ".tsx": "application/typescript",
    ".json": "application/json",
    ".html": "text/html",
    ".css": "text/css",
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".py": "text/x-python",
    ".sh": "text/x-shellscript",
    ".yml": "text/yaml",
    ".yaml": "text/yaml",
    ".xml": "application/xml",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
  };

  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Calculate file hash
 */
export function calculateHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").substring(0, 16);
}

/**
 * Get workspace disk usage
 */
export async function getDiskUsage(
  userId: number,
  workspaceId: string
): Promise<number> {
  const workspacePath = getWorkspacePath(userId, workspaceId);

  try {
    const { stdout } = await execAsync(`du -sm "${workspacePath}" | cut -f1`);
    return parseInt(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}
