import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initializeWebSocket } from "../services/websocket";
import { cronScheduler } from "../services/events/cronScheduler";

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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Google OAuth routes
  registerGoogleAuthRoutes(app);

  // Serve JARVIS workspace files for download
  app.use(
    "/api/files/workspace",
    express.static(JARVIS_WORKSPACE_PATH, {
      dotfiles: "allow",
      index: false,
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
  });
}

startServer().catch(console.error);
