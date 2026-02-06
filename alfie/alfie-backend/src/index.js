import * as gpuMonitor from './services/gpuMonitor.js';
import express from 'express';
import cors from 'cors';
import http from 'http';
import os from 'os';
import config from './config.js';
import * as cache from './services/cache.js';
import { cacheResponse } from './middleware/cacheMiddleware.js';
import IntegrationRegistry from './integrations/IntegrationRegistry.js';
import SlackIntegration from './integrations/providers/SlackIntegration.js';
import DiscordIntegration from './integrations/providers/DiscordIntegration.js';
import GitHubIntegration from './integrations/providers/GitHubIntegration.js';
import GitLabIntegration from './integrations/providers/GitLabIntegration.js';
import LinearIntegration from './integrations/providers/LinearIntegration.js';
import NotionIntegration from './integrations/providers/NotionIntegration.js';
import GoogleDriveIntegration from './integrations/providers/GoogleDriveIntegration.js';
import DropboxIntegration from './integrations/providers/DropboxIntegration.js';
import JiraIntegration from './integrations/providers/JiraIntegration.js';
import * as websocketService from './services/websocket.js';
import * as openclawGateway from './services/openclawGateway.js';
import * as secondBrain from './services/secondBrain.js';
import * as searchService from './services/searchService.js';
import * as backupService from './services/backupService.js';
import * as webhookService from './services/webhookService.js';
import * as User from './models/User.js';
import filesRouter from './routes/files.js';
import workflowsRouter from './routes/workflows.js';
import analyticsRouter from './routes/analytics.js';
import exportImportRouter from './routes/exportImport.js';
import performanceRouter from './routes/performance.js';
import templatesRouter from './routes/templates.js';
import collaborationRouter from './routes/collaboration.js';
import backupRouter from './routes/backup.js';
import executeRouter from './routes/execute.js';
import sharesRouter from './routes/shares.js';
import webhooksRouter from './routes/webhooks.js';
import finetuneRouter from './routes/finetune.js';
import integrationsRouter from './routes/integrations.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import apiKeysRouter from './routes/apiKeys.js';
import emailRouter from './routes/email.js';
import notebooksRouter from './routes/notebooks.js';
import ragRouter from './routes/rag.js';
import modelsRouter from './routes/models.js';
import meetingsRouter from './routes/meetings.js';
import { setupSwagger } from './docs/swagger.js';
import { performanceMiddleware } from './middleware/performanceMiddleware.js';
import { onAlert } from './services/performanceMonitor.js';
import { log } from './services/logger.js';
import * as collaboration from './services/collaboration.js';
import * as presence from './services/presence.js';
import * as comments from './services/comments.js';
import { legacyAuthenticate } from './middleware/authMiddleware.js';
import { perUserRateLimit, globalRateLimit } from './middleware/rateLimitMiddleware.js';
import { 
  helmetMiddleware, 
  securityHeaders, 
  requestSanitizer,
  requestIdMiddleware,
  errorHandler,
  generateCsrfTokenEndpoint
} from './middleware/securityMiddleware.js';

import {
  logger,
  logEvent,
  EventType,
  initSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  flushSentry,
  closeSentry,
  healthRouter,
  setReady,
  setShuttingDown,
  addHealthCheck,
  metricsMiddleware,
  errorTrackingMiddleware,
  wsActiveConnections,
  wsConnectionsTotal,
  recordWsMessage,
  gatewayStatus,
  sessionsTotal,
  activeSessions,
  recordGatewayRequest,
  recordSearch,
  recordError,
  chatMessagesTotal,
  memoryQueriesTotal,
} from './observability/index.js';

export { webhookService };

const app = express();
const server = http.createServer(app);

function registerIntegrations() {
  const definitions = [
    {
      config: {
        id: 'slack',
        name: 'Slack',
        description: 'Slack messaging, channels, and notifications',
        icon: 'slack',
        category: 'communication',
        authType: 'oauth2',
        scopes: ['channels:read', 'channels:history', 'chat:write', 'users:read', 'incoming-webhook']
      },
      factory: () => new SlackIntegration(),
      actions: ['listChannels', 'getChannelHistory', 'sendMessage'],
      webhookHandler: ({ headers, payload, rawBody }) => {
        const client = new SlackIntegration();
        if (headers['x-webhook-secret']) {
          client.webhookSecret = headers['x-webhook-secret'];
        }
        return client.handleWebhook(rawBody, headers['x-slack-signature'], headers['x-slack-request-timestamp']);
      }
    },
    {
      config: {
        id: 'discord',
        name: 'Discord',
        description: 'Discord guilds, channels, and bot messaging',
        icon: 'discord',
        category: 'communication',
        authType: 'oauth2',
        scopes: ['identify', 'guilds', 'bot', 'webhook.incoming']
      },
      factory: () => new DiscordIntegration(),
      actions: ['listGuilds', 'listChannels', 'sendMessage'],
      webhookHandler: ({ headers, payload }) => {
        const client = new DiscordIntegration();
        if (headers['x-webhook-secret']) {
          client.webhookSecret = headers['x-webhook-secret'];
        }
        return client.handleWebhook(payload, headers['x-signature-ed25519'], headers['x-signature-timestamp']);
      }
    },
    {
      config: {
        id: 'github',
        name: 'GitHub',
        description: 'GitHub repositories, issues, and pull requests',
        icon: 'github',
        category: 'version-control',
        authType: 'oauth2',
        scopes: ['repo', 'read:user', 'user:email', 'read:org', 'write:repo_hook']
      },
      factory: () => new GitHubIntegration(),
      actions: ['listRepositories', 'listIssues', 'listPullRequests', 'createIssue', 'createPullRequest'],
      webhookHandler: ({ headers, rawBody }) => {
        const client = new GitHubIntegration();
        if (headers['x-webhook-secret']) {
          client.webhookSecret = headers['x-webhook-secret'];
        }
        return client.handleWebhook(rawBody, headers['x-hub-signature-256'] || headers['x-hub-signature']);
      }
    },
    {
      config: {
        id: 'gitlab',
        name: 'GitLab',
        description: 'GitLab projects, issues, and merge requests',
        icon: 'gitlab',
        category: 'version-control',
        authType: 'oauth2',
        scopes: ['api', 'read_user', 'read_repository', 'write_repository']
      },
      factory: () => new GitLabIntegration(),
      actions: ['listProjects', 'listIssues', 'listMergeRequests', 'createIssue', 'createMergeRequest'],
      webhookHandler: ({ headers, payload }) => {
        const client = new GitLabIntegration();
        if (headers['x-webhook-secret']) {
          client.webhookToken = headers['x-webhook-secret'];
        }
        return client.handleWebhook(payload, headers['x-gitlab-token']);
      }
    },
    {
      config: {
        id: 'linear',
        name: 'Linear',
        description: 'Linear issues, projects, and workflows',
        icon: 'linear',
        category: 'project-management',
        authType: 'oauth2',
        scopes: ['read', 'write', 'issues:create', 'comments:create']
      },
      factory: () => new LinearIntegration(),
      actions: ['listTeams', 'listProjects', 'listIssues', 'createIssue', 'updateIssue', 'addComment'],
      webhookHandler: ({ headers, rawBody }) => {
        const client = new LinearIntegration();
        if (headers['x-webhook-secret']) {
          client.webhookSecret = headers['x-webhook-secret'];
        }
        return client.handleWebhook(rawBody, headers['linear-signature'] || headers['x-linear-signature']);
      }
    },
    {
      config: {
        id: 'notion',
        name: 'Notion',
        description: 'Notion databases, pages, and documentation',
        icon: 'notion',
        category: 'project-management',
        authType: 'oauth2',
        scopes: ['read', 'write']
      },
      factory: () => new NotionIntegration(),
      actions: ['listDatabases', 'queryDatabase', 'createPage', 'updatePage', 'search']
    },
    {
      config: {
        id: 'google-drive',
        name: 'Google Drive',
        description: 'Google Drive files and folders',
        icon: 'google-drive',
        category: 'storage',
        authType: 'oauth2',
        scopes: ['https://www.googleapis.com/auth/drive']
      },
      factory: () => new GoogleDriveIntegration(),
      actions: ['listFiles', 'getFile', 'downloadFile', 'uploadFile', 'createFolder']
    },
    {
      config: {
        id: 'dropbox',
        name: 'Dropbox',
        description: 'Dropbox file synchronization and sharing',
        icon: 'dropbox',
        category: 'storage',
        authType: 'oauth2',
        scopes: ['files.metadata.read', 'files.content.read', 'files.content.write']
      },
      factory: () => new DropboxIntegration(),
      actions: ['listFiles', 'downloadFile', 'uploadFile', 'createFolder', 'getSharedLinks']
    },
    {
      config: {
        id: 'jira',
        name: 'Jira',
        description: 'Jira issues and project tracking',
        icon: 'jira',
        category: 'project-management',
        authType: 'oauth2',
        scopes: ['read:jira-work', 'write:jira-work']
      },
      factory: () => new JiraIntegration(),
      actions: ['listProjects', 'listIssues', 'createIssue', 'addComment']
    }
  ];

  definitions.forEach(definition => {
    IntegrationRegistry.registerIntegration(definition);
  });
}

initSentry({ app });

app.use(sentryRequestHandler());
app.use(sentryTracingHandler());
app.use(requestIdMiddleware);
app.use(helmetMiddleware);
app.use(securityHeaders);

app.use(cors({
  origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-CSRF-Token', 'X-Session-ID', 'X-Request-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Request-ID']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestSanitizer);
app.use(metricsMiddleware());
app.use(performanceMiddleware);
app.use(globalRateLimit);
app.use(healthRouter);
app.use(filesRouter);
app.use(workflowsRouter);
app.use(integrationsRouter);
app.use('/api/performance', performanceRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/sessions', exportImportRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/backup', backupRouter);
app.use('/api/execute', executeRouter);
app.use('/api/shares', sharesRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/finetune', finetuneRouter);
app.use(emailRouter);
app.use(collaborationRouter);
app.use('/api/notebooks', notebooksRouter);
app.use('/api/rag', ragRouter);
app.use('/api/meetings', meetingsRouter);
app.use(modelsRouter);

setupSwagger(app);

app.use('/api/auth', authRouter);
app.get('/api/csrf-token', generateCsrfTokenEndpoint);
app.use('/api/users', usersRouter);
app.use('/api/keys', apiKeysRouter);

backupService.initialize().catch(err => {
  console.warn('⚠️  Backup system initialization warning:', err.message);
});

async function initializeAuth() {
  if (config.admin.autoCreate) {
    await User.initializeDefaultAdmin(config.admin.defaultPassword);
  }
}

// Health check
app.get('/api/health', async (req, res) => {
  const gatewayStatus = await openclawGateway.getGatewayStatus();
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    gateway: gatewayStatus
  });
});

// Sessions API
app.get('/api/sessions', cacheResponse({ ttl: 30 }), async (req, res) => {
  try {
    const sessions = await openclawGateway.listSessions();
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { projectPath, options } = req.body;
    const session = await openclawGateway.createSession(
      projectPath || config.workspaceRoot,
      options
    );
    
    webhookService.emitEvent(webhookService.WEBHOOK_EVENTS.SESSION_STARTED, {
      sessionId: session.session_id,
      projectPath: projectPath || config.workspaceRoot,
      timestamp: new Date().toISOString(),
    });
    
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await openclawGateway.getSession(req.params.id);
    res.json(session);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const result = await openclawGateway.deleteSession(req.params.id);
    
    webhookService.emitEvent(webhookService.WEBHOOK_EVENTS.SESSION_ENDED, {
      sessionId: req.params.id,
      timestamp: new Date().toISOString(),
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message, options } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message required' });
    }
    
    webhookService.emitEvent(webhookService.WEBHOOK_EVENTS.MESSAGE_CREATED, {
      sessionId,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });
    
    const response = await openclawGateway.sendMessage(sessionId, message, options);
    
    webhookService.emitEvent(webhookService.WEBHOOK_EVENTS.MESSAGE_CREATED, {
      sessionId,
      role: 'assistant',
      content: response.content || response,
      timestamp: new Date().toISOString(),
    });
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/memories/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query required' });
    }
    const memories = await secondBrain.queryMemories(query);
    res.json({ memories, count: memories.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/search', async (req, res) => {
  try {
    const { query, types, limit, sessionId, path } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query required' });
    }
    const results = await searchService.search(query, { types, limit, sessionId, path });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/search/quick', cacheResponse({ ttl: 60 }), async (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 10;
    if (!query) {
      return res.status(400).json({ error: 'q query param required' });
    }
    const results = await searchService.quickSearch(query, { limit });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/search/deep', async (req, res) => {
  try {
    const { query, limit } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query required' });
    }
    const results = await searchService.deepSearch(query, { limit });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/system/stats', cacheResponse({ ttl: 10 }), (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  res.json({
    cpu: Math.round(os.loadavg()[0] * 10) / 10,
    memory: Math.round((usedMem / totalMem) * 100),
    uptime: process.uptime(),
    totalMemory: totalMem,
    freeMemory: freeMem
  });
});

app.get('/api/system/gpu', cacheResponse({ ttl: 10 }), async (req, res) => {
  try {
    const stats = await gpuMonitor.getGPUStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connections
app.get('/api/ws/clients', (req, res) => {
  const clients = websocketService.getConnectedClients();
  res.json({ clients, count: clients.length });
});

const wss = websocketService.setupWebSocket(server);
gpuMonitor.startGPUMonitoring(wss);

onAlert((alert) => {
  log.warn('Performance alert triggered', alert);
  websocketService.broadcast({
    type: 'performance_alert',
    payload: alert,
  });
});

app.use(errorTrackingMiddleware());
app.use(sentryErrorHandler());
app.use(errorHandler);

addHealthCheck('gateway', async () => {
  const startTime = Date.now();
  try {
    const status = await openclawGateway.getGatewayStatus();
    gatewayStatus.set(status.connected ? 1 : 0);
    return {
      status: status.connected ? 'healthy' : 'degraded',
      latency: Date.now() - startTime,
      error: status.error,
    };
  } catch (error) {
    gatewayStatus.set(0);
    return { status: 'unhealthy', error: error.message };
  }
}, false);

async function gracefulShutdown(signal) {
  logger.info({ event: 'shutdown.initiated', signal }, `Received ${signal}`);
  setShuttingDown(true);
  
  const shutdownTimeout = setTimeout(() => {
    logger.error({ event: 'shutdown.timeout' }, 'Shutdown timed out');
    process.exit(1);
  }, 30000);
  
  try {
    server.close();
    wss.clients.forEach(client => { client.close(); });
    await cache.close();
    await flushSentry(2000);
    await closeSentry(2000);
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.fatal({ event: 'uncaught_exception', error: { name: error.name, message: error.message, stack: error.stack } });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ event: 'unhandled_rejection', reason: String(reason) });
});

const PORT = config.port;
const HOST = config.host;

initializeAuth().then(() => {
  registerIntegrations();
  server.listen(PORT, HOST, async () => {
    logEvent(EventType.SYSTEM_STARTUP, { host: HOST, port: PORT });
    logger.info({ event: 'server.started', host: HOST, port: PORT }, 'ALFIE Backend started');
    
    console.log(`\n🚀 ALFIE Backend running on http://${HOST}:${PORT}`);
    console.log(`📡 WebSocket available at ws://${HOST}:${PORT}/ws`);
    console.log(`📊 Performance dashboard at http://${HOST}:${PORT}/api/performance/dashboard`);
    console.log(`📈 Prometheus metrics at http://${HOST}:${PORT}/metrics`);
    console.log(`🏥 Health endpoints: /health, /ready, /live`);
    console.log(`🔐 Auth: JWT + API Keys + OAuth enabled`);
    console.log(`🛡️  Security: Helmet + Rate Limiting + RBAC enabled`);
    console.log(`🔗 OpenClaw Gateway: ${config.openclawGatewayUrl}\n`);
    
    try {
      const status = await openclawGateway.getGatewayStatus();
      if (status.connected) {
        gatewayStatus.set(1);
        logger.info({ event: 'gateway.connected' }, 'Connected to OpenClaw Gateway');
        console.log('✅ Connected to OpenClaw Gateway\n');
      } else {
        gatewayStatus.set(0);
        logger.warn({ event: 'gateway.unreachable', error: status.error }, 'Gateway not reachable');
        console.log('⚠️  OpenClaw Gateway not reachable:', status.error);
        console.log('   Make sure OpenClaw is running on', config.openclawGatewayUrl, '\n');
      }
    } catch (err) {
      gatewayStatus.set(0);
      logger.error({ event: 'gateway.error', error: err.message }, 'Could not verify Gateway');
      console.log('⚠️  Could not verify OpenClaw Gateway:', err.message, '\n');
    }
    
    setReady(true);
    logger.info({ event: 'server.ready' }, 'Server is ready');
  });
});
