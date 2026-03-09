import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import path from "path";
import multer from "multer";
import * as fs from "fs/promises";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import {
  processFile,
  processMultipleFiles,
  generateFileContext,
  type ProcessedFile as _ProcessedFile,
} from "../services/fileProcessor";
import {
  registerAuthRoutes,
  ensureDefaultUser,
  ensureSilvsUser,
  ensureDirkUser,
  ensureAlakazamUser,
} from "./auth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initializeWebSocket } from "../services/websocket";
import { initializeWorkspaceStream } from "../services/workspaceStream";
import { cronScheduler } from "../services/events/cronScheduler";
import { taskQueue } from "../services/jarvis/taskQueue";
import { getDb } from "../db";
import { agentTasks } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import alfieRestApi from "../restApi";

async function cleanupStaleTasks(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    const result = await db
      .update(agentTasks)
      .set({
        status: "failed",
        errorMessage: "Task interrupted by server restart",
      })
      .where(eq(agentTasks.status, "running"));

    const affectedRows =
      (result as unknown as { affectedRows?: number })?.affectedRows || 0;
    if (affectedRows > 0) {
      console.info(
        `[Startup] Cleaned up ${affectedRows} stale running task(s)`
      );
    }
  } catch (error) {
    console.error("[Startup] Failed to cleanup stale tasks:", error);
  }
}

const JARVIS_WORKSPACE_PATH = "/tmp/jarvis-workspace";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());

  registerAuthRoutes(app);
  await ensureDefaultUser();
  await ensureSilvsUser();
  await ensureDirkUser();
  await ensureAlakazamUser();

  await cleanupStaleTasks();

  // Serve JARVIS workspace files for download
  app.use(
    "/api/files/workspace",
    express.static(JARVIS_WORKSPACE_PATH, {
      dotfiles: "allow",
      index: false,
    })
  );

  // File upload configuration
  const uploadDir = path.join(JARVIS_WORKSPACE_PATH, "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext).slice(0, 50);
      cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  });

  // Universal file upload endpoint
  app.post(
    "/api/files/upload",
    upload.array("files", 10),
    async (req, res): Promise<void> => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          res.status(400).json({ error: "No files uploaded" });
          return;
        }

        const analyzeWithVision = req.body.analyzeWithVision !== "false";
        const transcribeAudio = req.body.transcribeAudio !== "false";
        const extractVideoFrames = req.body.extractVideoFrames !== "false";
        const customPrompt = req.body.prompt as string | undefined;

        const fileInfos = files.map(f => ({
          path: f.path,
          mimeType: f.mimetype,
          name: f.originalname,
        }));

        const processed = await processMultipleFiles(fileInfos, {
          analyzeWithVision,
          transcribeAudio,
          extractVideoFrames,
          customPrompt,
        });

        const context = generateFileContext(processed);

        res.json({
          success: true,
          files: processed.map(p => ({
            originalName: p.originalName,
            mimeType: p.mimeType,
            category: p.category,
            size: p.size,
            storagePath: p.storagePath,
            downloadUrl: `/api/files/workspace/uploads/${path.basename(p.storagePath)}`,
            hasText: !!p.extractedText,
            hasAnalysis: !!p.analysis,
            error: p.error,
          })),
          context,
          processed,
        });
      } catch (error) {
        console.error("[Upload] Error processing files:", error);
        res.status(500).json({
          error: "Failed to process files",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Single file processing endpoint (for already uploaded files)
  app.post(
    "/api/files/process",
    express.json(),
    async (req, res): Promise<void> => {
      try {
        const { filePath, mimeType, originalName, options } = req.body as {
          filePath: string;
          mimeType: string;
          originalName: string;
          options?: {
            analyzeWithVision?: boolean;
            transcribeAudio?: boolean;
            extractVideoFrames?: boolean;
            customPrompt?: string;
          };
        };

        if (!filePath || !mimeType || !originalName) {
          res.status(400).json({ error: "Missing required fields" });
          return;
        }

        const fullPath = filePath.startsWith("/")
          ? filePath
          : path.join(JARVIS_WORKSPACE_PATH, filePath);

        if (!fullPath.startsWith(JARVIS_WORKSPACE_PATH)) {
          res.status(403).json({ error: "Access denied" });
          return;
        }

        const processed = await processFile(
          fullPath,
          mimeType,
          originalName,
          options || {}
        );

        res.json({
          success: true,
          ...processed,
          context: generateFileContext([processed]),
        });
      } catch (error) {
        console.error("[Process] Error:", error);
        res.status(500).json({
          error: "Failed to process file",
          details: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Serve generated images (from DALL-E, Flux, etc.)
  app.use(
    "/generated",
    express.static(path.join(process.cwd(), "public", "generated"), {
      maxAge: "1d",
    })
  );

  // List files in JARVIS workspace
  app.get("/api/files/workspace-list", async (req, res) => {
    try {
      const fs = await import("fs/promises");
      const subPath = (req.query.path as string) || "";
      const fullPath = path.join(JARVIS_WORKSPACE_PATH, subPath);

      if (!fullPath.startsWith(JARVIS_WORKSPACE_PATH)) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const stats = await fs.stat(fullPath).catch(() => null);
      if (!stats) {
        res.status(404).json({ error: "Path not found" });
        return;
      }

      if (stats.isFile()) {
        res.json({
          type: "file",
          name: path.basename(fullPath),
          size: stats.size,
          modified: stats.mtime,
          downloadUrl: `/api/files/workspace/${subPath}`,
        });
        return;
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const files = await Promise.all(
        entries.map(async entry => {
          const entryPath = path.join(fullPath, entry.name);
          const entryStats = await fs.stat(entryPath).catch(() => null);
          const relativePath = path.join(subPath, entry.name);
          return {
            name: entry.name,
            type: entry.isDirectory() ? "directory" : "file",
            size: entryStats?.size || 0,
            modified: entryStats?.mtime || null,
            downloadUrl: entry.isFile()
              ? `/api/files/workspace/${relativePath}`
              : null,
          };
        })
      );

      res.json({ type: "directory", path: subPath || "/", files });
    } catch (error) {
      console.error("[Workspace] Error listing files:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  app.post("/api/files/export-pdf", express.json(), async (req, res) => {
    try {
      const {
        html,
        url,
        filename = "report.pdf",
      } = req.body as {
        html?: string;
        url?: string;
        filename?: string;
      };

      if (!html && !url) {
        res.status(400).json({ error: "HTML content or URL required" });
        return;
      }

      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      if (url) {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(1000);
      } else if (html) {
        const isCompleteDocument =
          html.trim().toLowerCase().startsWith("<!doctype") ||
          html.trim().toLowerCase().startsWith("<html");

        if (isCompleteDocument) {
          await page.setContent(html, { waitUntil: "networkidle" });
          await page.waitForTimeout(500);
        } else {
          const styledHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  max-width: 800px;
                  margin: 0 auto;
                  padding: 40px;
                  color: #333;
                }
                h1, h2, h3 { color: #1a1a1a; margin-top: 1.5em; }
                h1 { border-bottom: 2px solid #0066cc; padding-bottom: 0.3em; }
                code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
                pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
                pre code { background: none; padding: 0; }
                blockquote { border-left: 4px solid #0066cc; margin-left: 0; padding-left: 16px; color: #666; }
                table { border-collapse: collapse; width: 100%; margin: 1em 0; }
                th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
                th { background: #f4f4f4; }
                a { color: #0066cc; }
                img { max-width: 100%; height: auto; }
              </style>
            </head>
            <body>${html}</body>
            </html>
          `;
          await page.setContent(styledHtml, { waitUntil: "networkidle" });
        }
      }

      // Wait for Chart.js and other JS to render (charts render to canvas)
      await page.waitForSelector("canvas", { timeout: 3000 }).catch(() => {});
      // Extra time for chart animations to complete
      await new Promise(resolve => setTimeout(resolve, 1500));

      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
        printBackground: true,
        preferCSSPageSize: true,
      });

      await browser.close();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("[PDF Export] Error:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  app.post("/api/jarvis/publish-report", express.json(), async (req, res) => {
    try {
      const { filePath, title } = req.body as {
        filePath: string;
        title?: string;
      };

      if (!filePath) {
        res.status(400).json({ error: "filePath required" });
        return;
      }

      const fs = await import("fs/promises");
      const path = await import("path");
      const os = await import("os");
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      const htmlContent = await fs.readFile(filePath, "utf-8");
      const projectName = title
        ? title
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .slice(0, 30)
        : `report-${Date.now()}`;
      const tempDir = path.join(os.tmpdir(), `vercel-report-${Date.now()}`);

      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(path.join(tempDir, "index.html"), htmlContent);
      await fs.writeFile(
        path.join(tempDir, "vercel.json"),
        JSON.stringify({
          name: projectName,
          version: 2,
          builds: [{ src: "index.html", use: "@vercel/static" }],
          routes: [{ src: "/(.*)", dest: "/index.html" }],
        })
      );

      const vercelToken = process.env.VERCEL_TOKEN;
      if (!vercelToken) {
        res.status(400).json({
          error: "VERCEL_TOKEN not configured",
          message: "Set VERCEL_TOKEN environment variable to enable publishing",
        });
        return;
      }

      const { stdout, stderr } = await execAsync(
        `npx vercel --yes --prod --token ${vercelToken}`,
        {
          cwd: tempDir,
          timeout: 120000,
          env: { ...process.env, VERCEL_TOKEN: vercelToken },
        }
      );

      const urlMatch = (stdout + stderr).match(/https:\/\/[^\s]+\.vercel\.app/);
      const deployedUrl = urlMatch?.[0];

      await fs.rm(tempDir, { recursive: true, force: true });

      if (deployedUrl) {
        console.info(`[Report] Published to: ${deployedUrl}`);
        res.json({ url: deployedUrl, projectName });
      } else {
        console.error("[Report] No URL found in output:", stdout, stderr);
        res
          .status(500)
          .json({ error: "Deployment succeeded but no URL found" });
      }
    } catch (error) {
      console.error("[Report Publish] Error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to publish report", message });
    }
  });

  // ALFIE REST API (bypasses auth for internal ALFIE→Rasputin integration)
  app.use("/api/alfie", alfieRestApi);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  const ioServer = initializeWebSocket(server);
    initializeWorkspaceStream(ioServer);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Start the cron scheduler for scheduled JARVIS tasks
    cronScheduler.start();
    console.log("Cron scheduler started for scheduled tasks");

    // Start the async task queue worker
    taskQueue.startWorker(2000); // Poll every 2 seconds
    console.log("Async task queue worker started");
  });
}

startServer().catch(console.error);
