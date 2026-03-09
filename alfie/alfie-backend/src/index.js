import config from './config.js';
import * as gpuMonitor from './services/gpuMonitor.js';
import * as llmService from './services/llmService.js';
import * as modelRouter from './services/modelRouter.js';
import * as chatHistory from './services/chatHistory.js';
import * as projectService from './services/projectService.js';
import * as perplexityService from './services/perplexityService.js';
import * as ragService from './services/ragService.js';
import express from 'express';
import cors from 'cors';
import http from 'http';
import os from 'os';
import path from 'path';
import multer from 'multer';
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
import * as User from './services/userService.js';
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
import agentRouter from './routes/agent.js';
import scheduleRouter from './routes/schedule.js';
import skillsRouter from './routes/skills.js';
import projectsRouter from './routes/projects.js';
import exportRouter from './routes/export.js';
import taskShareRoutes from './routes/taskShare.js';
import { startWorker } from './workers/agentWorker.js';
import * as schedulerService from './services/schedulerService.js';
import * as skillsService from './services/skillsService.js';
import * as queueService from './services/queueService.js';
import { setupSwagger } from './docs/swagger.js';
import { performanceMiddleware } from './middleware/performanceMiddleware.js';
import { onAlert } from './services/performanceMonitor.js';
import { log } from './services/logger.js';
import { globalRateLimit } from './middleware/rateLimitMiddleware.js';
import { authenticate } from './middleware/authMiddleware.js';
import { deleteFile, getFile, getUploadDir, saveFile } from './services/fileService.js';
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
  gatewayStatus,
} from './observability/index.js';

export { webhookService };

const app = express();
const server = http.createServer(app);

const uploadDir = getUploadDir();
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const blockedExtensions = new Set(['.exe', '.sh', '.bat']);
    if (blockedExtensions.has(extension)) {
      cb(new Error('Unsupported file type'));
      return;
    }
    cb(null, true);
  },
});

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
      webhookHandler: ({ headers, rawBody }) => {
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

const requireAuth = authenticate({ required: true });

app.post('/api/upload', requireAuth, upload.array('files'), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'files required' });
    }

    const savedFiles = await Promise.all(files.map((file) => saveFile(file)));
    return res.json({ files: savedFiles });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/upload/:fileId', requireAuth, async (req, res) => {
  try {
    const file = await getFile(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'file not found' });
    }
    return res.json(file);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.delete('/api/upload/:fileId', requireAuth, async (req, res) => {
  try {
    const deleted = await deleteFile(req.params.fileId);
    if (!deleted) {
      return res.status(404).json({ error: 'file not found' });
    }
    return res.json({ success: true, file: deleted });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/upload/:fileId/content', requireAuth, async (req, res) => {
  try {
    const file = await getFile(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: 'file not found' });
    }
    return res.download(file.path, file.originalName);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.use(healthRouter);
setupSwagger(app);
app.use('/api/auth', authRouter);
app.get('/api/csrf-token', generateCsrfTokenEndpoint);

app.use((req, res, next) => {
  const p = req.path;
  if (p === '/api/health' || p === '/api/csrf-token') return next();
  if (p.startsWith('/api/auth')) return next();
  if (p.startsWith('/api/shared')) return next();
  if (p === '/health' || p === '/ready' || p === '/live' || p === '/metrics') return next();
  if (!p.startsWith('/api/')) return next();
  return requireAuth(req, res, next);
});

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
app.use('/api/users', usersRouter);
app.use('/api/keys', apiKeysRouter);
app.use(modelsRouter);
app.use('/api/agent', agentRouter);
app.use('/api/schedules', scheduleRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/export', exportRouter);
app.use('/api/agent', taskShareRoutes);
app.use('/api/shared', taskShareRoutes);

app.get('/api/models', requireAuth, (req, res) => {
  try {
    const models = modelRouter.listModels();
    res.json({ models });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/models/:model(*)', requireAuth, async (req, res, next) => {
  try {
    const model = req.params.model;
    const reserved = new Set(['providers', 'endpoints', 'marketplace']);
    if (reserved.has(model)) {
      return next();
    }
    const models = modelRouter.listModels();
    const modelInfo = models.find((item) => item.id === model);

    if (!modelInfo) {
      return res.status(404).json({ error: 'Model not found' });
    }

    const health = await modelRouter.healthCheck(model);
    res.json({ ...modelInfo, health });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
  const [llmStatus, searchStatus, ragStatus, queueStatus] = await Promise.all([
    llmService.healthCheck(),
    perplexityService.healthCheck(),
    ragService.healthCheck(),
    queueService.healthCheck(),
  ]);
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    llm: llmStatus,
    search: searchStatus,
    rag: ragStatus,
    queue: queueStatus,
  });
});

app.post('/api/rag/embed', requireAuth, async (req, res) => {
  try {
    const { documentId, text, metadata } = req.body;
    if (!documentId || !text) {
      return res.status(400).json({ error: 'documentId and text required' });
    }

    const result = await ragService.embedDocument(documentId, text, metadata);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/rag/query', requireAuth, async (req, res) => {
  try {
    const { query, topK } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query required' });
    }

    const results = await ragService.retrieveContext(query, topK);
    return res.json({ results, count: results.length });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/rag/health', requireAuth, async (_req, res) => {
  const status = await ragService.healthCheck();
  return res.json(status);
});

app.delete('/api/rag/document/:id', requireAuth, async (req, res) => {
  try {
    const result = await ragService.deleteDocument(req.params.id);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Conversations API
app.get('/api/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    const conversations = await chatHistory.listConversations(userId, limit, offset);
    if (conversations?.error) {
      return res.status(500).json({ error: conversations.error });
    }
    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/conversations/search', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const query = req.query.q;
    const limit = parseInt(req.query.limit, 10) || 20;
    if (!query) {
      return res.status(400).json({ error: 'q query param required' });
    }
    const conversations = await chatHistory.searchConversations(userId, query, limit);
    if (conversations?.error) {
      return res.status(500).json({ error: conversations.error });
    }
    res.json({ conversations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/conversations/:threadId', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const conversation = await chatHistory.getConversation(userId, req.params.threadId);
    if (conversation?.error) {
      return res.status(500).json({ error: conversation.error });
    }
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { threadId, title, metadata } = req.body;
    if (!threadId) {
      return res.status(400).json({ error: 'threadId required' });
    }
    const conversation = await chatHistory.createConversation(userId, threadId, title, metadata);
    if (conversation?.error) {
      return res.status(500).json({ error: conversation.error });
    }
    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/conversations/:threadId', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { title, metadata } = req.body;
    if (title === undefined && metadata === undefined) {
      return res.status(400).json({ error: 'title or metadata required' });
    }
    const conversation = await chatHistory.updateConversation(userId, req.params.threadId, {
      title,
      metadata,
    });
    if (conversation?.error) {
      return res.status(500).json({ error: conversation.error });
    }
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/conversations/:threadId', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const result = await chatHistory.deleteConversation(userId, req.params.threadId);
    if (result?.error) {
      return res.status(500).json({ error: result.error });
    }
    if (!result?.deleted) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/conversations/:threadId/messages', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const { role, content, artifacts } = req.body;
    if (!role || !content) {
      return res.status(400).json({ error: 'role and content required' });
    }
    const message = await chatHistory.addMessage(userId, req.params.threadId, {
      role,
      content,
      artifacts,
    });
    if (message?.error) {
      return res.status(500).json({ error: message.error });
    }
    if (!message) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/conversations/:threadId/messages', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.user.id;
    const limit = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;
    const messages = await chatHistory.getMessages(userId, req.params.threadId, limit, offset);
    if (messages?.error) {
      return res.status(500).json({ error: messages.error });
    }
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sessions API
app.get('/api/sessions', requireAuth, cacheResponse({ ttl: 30 }), async (req, res) => {
  try {
    const sessions = await openclawGateway.listSessions();
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions', requireAuth, async (req, res) => {
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

app.get('/api/sessions/:id', requireAuth, async (req, res) => {
  try {
    const session = await openclawGateway.getSession(req.params.id);
    res.json(session);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.delete('/api/sessions/:id', requireAuth, async (req, res) => {
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

app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, options } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }
    
    const messages = [{ role: 'user', content: message }];
    const result = await llmService.chatCompletion(messages, options);
    
    res.json({ content: result.content, model: result.model, usage: result.usage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/stream', requireAuth, async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const messages = [
      ...(history || []),
      { role: 'user', content: message },
    ];

    await llmService.chatCompletionStream(messages, (chunk) => {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    });

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

app.get('/api/llm/health', requireAuth, async (_req, res) => {
  const status = await llmService.healthCheck();
  res.json(status);
});

app.post('/api/memories/search', requireAuth, async (req, res) => {
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

app.post('/api/search', requireAuth, async (req, res) => {
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

app.get('/api/search/quick', requireAuth, cacheResponse({ ttl: 60 }), async (req, res) => {
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

app.post('/api/search/deep', requireAuth, async (req, res) => {
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

app.post('/api/search/web', requireAuth, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query required' });
    }
    const result = await perplexityService.search(query);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TTS via ElevenLabs
app.post('/api/tts', requireAuth, async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text required' });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    const selectedVoiceId = voiceId || 'onwK4e9ZLuTAKqWW03F9';
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      return res.status(response.status).json({ error: 'Failed to generate speech' });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=3600',
    });
    res.send(buffer);
  } catch (error) {
    console.error('TTS endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/system/stats', requireAuth, cacheResponse({ ttl: 10 }), (_req, res) => {
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

app.get('/api/system/gpu', requireAuth, cacheResponse({ ttl: 10 }), async (_req, res) => {
  try {
    const stats = await gpuMonitor.getGPUStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connections
app.get('/api/ws/clients', requireAuth, (_req, res) => {
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
    
    startWorker();
    await schedulerService.initialize();
    await skillsService.initialize();
    await projectService.initialize();
    setReady(true);
    logger.info({ event: 'server.ready' }, 'Server is ready');
  });
});
