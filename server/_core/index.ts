import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
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
import { cronScheduler } from "../services/events/cronScheduler";
import { taskQueue } from "../services/jarvis/taskQueue";
import { getDb } from "../db";
import { agentTasks } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

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
      const { html, filename = "report.pdf" } = req.body as {
        html?: string;
        filename?: string;
      };

      if (!html) {
        res.status(400).json({ error: "HTML content required" });
        return;
      }

      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

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

      const pdfBuffer = await page.pdf({
        format: "A4",
        margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
        printBackground: true,
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

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Initialize WebSocket server for real-time streaming
  initializeWebSocket(server);

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
