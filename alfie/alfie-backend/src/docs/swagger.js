import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

/**
 * OpenAPI 3.0 Specification for ALFIE Backend API
 */
const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'ALFIE Backend API',
    version: '1.0.0',
    description: `
## Overview

ALFIE Backend is a real-time communication server that bridges the ALFIE UI with the OpenClaw gateway.
It provides session management, file operations, system monitoring, and WebSocket-based streaming capabilities.

## Features

- **Session Management**: Create, manage, and interact with OpenClaw sessions
- **Chat Interface**: Send messages and receive AI responses
- **File Operations**: Browse, read, write, and delete files in the workspace
- **System Monitoring**: Real-time CPU, memory, and GPU statistics
- **WebSocket Support**: Real-time bidirectional communication
- **Memory Search**: Query the Second Brain memory store

## Authentication

Most endpoints require Bearer token authentication. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-api-token>
\`\`\`

## Rate Limiting

Currently, no rate limiting is enforced. This may change in future versions.

## Error Handling

All endpoints return consistent error responses with the following structure:
\`\`\`json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
\`\`\`
    `,
    contact: {
      name: 'ALFIE Team',
      url: 'https://github.com/alfie-ui/alfie-backend',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Local development server',
    },
    {
      url: 'http://0.0.0.0:3001',
      description: 'Local network server',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Health check and system status endpoints',
    },
    {
      name: 'Sessions',
      description: 'Session management for OpenClaw gateway interactions',
    },
    {
      name: 'Chat',
      description: 'Chat and messaging endpoints',
    },
    {
      name: 'Files',
      description: 'File system operations',
    },
    {
      name: 'System',
      description: 'System monitoring and statistics',
    },
    {
      name: 'Memory',
      description: 'Second Brain memory search',
    },
    {
      name: 'WebSocket',
      description: 'WebSocket connection management',
    },
    {
      name: 'Search',
      description: 'Universal search across sessions, messages, files, and memories',
    },
    {
      name: 'Analytics',
      description: 'Usage analytics and statistics tracking',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your API token',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message',
            example: 'Session not found',
          },
          details: {
            type: 'string',
            description: 'Additional error details',
            example: 'The requested session ID does not exist',
          },
        },
        required: ['error'],
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['ok', 'healthy', 'unhealthy'],
            example: 'ok',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
          },
          gateway: {
            $ref: '#/components/schemas/GatewayStatus',
          },
        },
      },
      GatewayStatus: {
        type: 'object',
        properties: {
          connected: {
            type: 'boolean',
            example: true,
          },
          url: {
            type: 'string',
            example: 'http://localhost:8080',
          },
          error: {
            type: 'string',
            description: 'Error message if not connected',
          },
        },
      },
      Session: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'Gateway session identifier',
            example: 'ses_abc123xyz',
          },
          localId: {
            type: 'string',
            description: 'Local session identifier',
            example: 'local_123456',
          },
          gatewaySessionId: {
            type: 'string',
            description: 'Reference to gateway session',
            example: 'ses_abc123xyz',
          },
          projectPath: {
            type: 'string',
            description: 'Workspace project path',
            example: '/home/user/projects/myapp',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
          },
          messages: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Message',
            },
          },
        },
      },
      SessionCreate: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Optional project path. Defaults to workspace root.',
            example: '/home/user/projects/myapp',
          },
          options: {
            type: 'object',
            description: 'Additional session options',
            properties: {
              model: {
                type: 'string',
                example: 'claude-3-opus',
              },
              temperature: {
                type: 'number',
                example: 0.7,
              },
            },
          },
        },
      },
      Message: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['user', 'assistant', 'system'],
            example: 'user',
          },
          content: {
            type: 'string',
            example: 'Hello, can you help me with my code?',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
          },
        },
        required: ['role', 'content'],
      },
      ChatRequest: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Session ID to send message to',
            example: 'ses_abc123xyz',
          },
          message: {
            type: 'string',
            description: 'Message content',
            example: 'Explain this function to me',
          },
          options: {
            type: 'object',
            description: 'Additional options for the message',
            properties: {
              stream: {
                type: 'boolean',
                example: false,
              },
            },
          },
        },
        required: ['sessionId', 'message'],
      },
      ChatResponse: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'AI response content',
            example: 'This function calculates the factorial of a number...',
          },
          role: {
            type: 'string',
            enum: ['assistant'],
            example: 'assistant',
          },
          model: {
            type: 'string',
            example: 'claude-3-opus',
          },
          usage: {
            type: 'object',
            properties: {
              prompt_tokens: {
                type: 'integer',
                example: 150,
              },
              completion_tokens: {
                type: 'integer',
                example: 250,
              },
              total_tokens: {
                type: 'integer',
                example: 400,
              },
            },
          },
        },
      },
      FileInfo: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            example: 'index.js',
          },
          type: {
            type: 'string',
            enum: ['file', 'directory'],
            example: 'file',
          },
          size: {
            type: 'integer',
            description: 'File size in bytes',
            example: 2048,
          },
          modified: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
          },
        },
      },
      FileListResponse: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            example: './src',
          },
          files: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/FileInfo',
            },
          },
        },
      },
      FileReadResponse: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            example: './src/index.js',
          },
          content: {
            type: 'string',
            example: "import express from 'express';...",
          },
        },
      },
      FileWriteRequest: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to write to',
            example: './src/newfile.js',
          },
          content: {
            type: 'string',
            description: 'File content',
            example: 'console.log("Hello World");',
          },
        },
        required: ['path', 'content'],
      },
      FileDeleteRequest: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to delete',
            example: './src/oldfile.js',
          },
        },
        required: ['path'],
      },
      SystemStats: {
        type: 'object',
        properties: {
          cpu: {
            type: 'number',
            description: 'CPU load average (1 min)',
            example: 2.5,
          },
          memory: {
            type: 'integer',
            description: 'Memory usage percentage',
            example: 65,
          },
          uptime: {
            type: 'number',
            description: 'Process uptime in seconds',
            example: 3600.5,
          },
          totalMemory: {
            type: 'integer',
            description: 'Total system memory in bytes',
            example: 17179869184,
          },
          freeMemory: {
            type: 'integer',
            description: 'Free system memory in bytes',
            example: 8589934592,
          },
        },
      },
      GPUStats: {
        type: 'object',
        properties: {
          available: {
            type: 'boolean',
            description: 'Whether GPU monitoring is available',
            example: true,
          },
          gpus: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/GPUInfo',
            },
          },
          message: {
            type: 'string',
            description: 'Message if GPU not available',
            example: 'nvidia-smi not available',
          },
        },
      },
      GPUInfo: {
        type: 'object',
        properties: {
          index: {
            type: 'integer',
            example: 0,
          },
          name: {
            type: 'string',
            example: 'NVIDIA GeForce RTX 4090',
          },
          memory: {
            type: 'object',
            properties: {
              total: {
                type: 'integer',
                description: 'Total memory in bytes',
                example: 25769803776,
              },
              used: {
                type: 'integer',
                description: 'Used memory in bytes',
                example: 5368709120,
              },
              free: {
                type: 'integer',
                description: 'Free memory in bytes',
                example: 20401094656,
              },
              usagePercent: {
                type: 'integer',
                example: 21,
              },
            },
          },
          utilization: {
            type: 'integer',
            description: 'GPU utilization percentage',
            example: 45,
          },
          temperature: {
            type: 'integer',
            description: 'GPU temperature in Celsius',
            example: 65,
          },
        },
      },
      MemorySearchRequest: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query for memories',
            example: 'authentication implementation',
          },
        },
        required: ['query'],
      },
      MemorySearchResponse: {
        type: 'object',
        properties: {
          memories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: 'mem_123',
                },
                content: {
                  type: 'string',
                  example: 'Implementation details for JWT authentication...',
                },
                score: {
                  type: 'number',
                  example: 0.95,
                },
                metadata: {
                  type: 'object',
                },
              },
            },
          },
          count: {
            type: 'integer',
            example: 5,
          },
        },
      },
      WebSocketClients: {
        type: 'object',
        properties: {
          clients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: 'ws_client_123',
                },
                connectedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
          count: {
            type: 'integer',
            example: 3,
          },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          path: {
            type: 'string',
            example: './src/file.js',
          },
        },
      },
      SearchResult: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['session', 'message', 'file', 'memory'],
            description: 'Type of search result',
            example: 'message',
          },
          id: {
            type: 'string',
            description: 'Unique identifier for the result',
            example: 'msg_abc123',
          },
          title: {
            type: 'string',
            description: 'Result title',
            example: 'Assistant',
          },
          subtitle: {
            type: 'string',
            description: 'Result subtitle (context info)',
            example: 'Session: My Project',
          },
          excerpt: {
            type: 'string',
            description: 'Highlighted excerpt with <<matched>> markers',
            example: '...implementation of <<authentication>> using JWT...',
          },
          score: {
            type: 'number',
            description: 'Relevance score (0-1)',
            example: 0.95,
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'Result timestamp if applicable',
          },
          data: {
            type: 'object',
            description: 'Additional type-specific data',
          },
        },
      },
      SearchResponse: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/SearchResult',
            },
          },
          total: {
            type: 'integer',
            description: 'Total results returned',
            example: 25,
          },
          query: {
            type: 'string',
            example: 'authentication',
          },
          types: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: ['session', 'message', 'file', 'memory'],
          },
        },
      },
      AnalyticsSummary: {
        type: 'object',
        properties: {
          totalSessions: {
            type: 'integer',
            example: 150,
          },
          totalMessages: {
            type: 'integer',
            example: 4500,
          },
          totalToolCalls: {
            type: 'integer',
            example: 2800,
          },
          totalTokens: {
            type: 'integer',
            example: 2500000,
          },
          inputTokens: {
            type: 'integer',
            example: 1000000,
          },
          outputTokens: {
            type: 'integer',
            example: 1500000,
          },
          estimatedCost: {
            type: 'number',
            description: 'Estimated cost in USD',
            example: 45.50,
          },
          avgSessionDuration: {
            type: 'integer',
            description: 'Average session duration in minutes',
            example: 35,
          },
          avgMessagesPerSession: {
            type: 'integer',
            example: 30,
          },
          avgTokensPerSession: {
            type: 'integer',
            example: 16667,
          },
          timeRange: {
            type: 'string',
            enum: ['24h', '7d', '30d'],
            example: '30d',
          },
        },
      },
      UsageDataPoint: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            format: 'date',
            example: '2024-01-15',
          },
          sessions: {
            type: 'integer',
            example: 5,
          },
          messages: {
            type: 'integer',
            example: 150,
          },
          toolCalls: {
            type: 'integer',
            example: 95,
          },
          tokens: {
            type: 'integer',
            example: 85000,
          },
        },
      },
      ToolUsage: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            example: 'read_file',
          },
          count: {
            type: 'integer',
            example: 450,
          },
        },
      },
      ModelDistribution: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            example: 'claude-3-opus',
          },
          count: {
            type: 'integer',
            example: 75,
          },
          percentage: {
            type: 'integer',
            example: 50,
          },
        },
      },
      SessionLeaderboardEntry: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'ses_abc123',
          },
          date: {
            type: 'string',
            format: 'date-time',
          },
          duration: {
            type: 'integer',
            description: 'Duration in minutes',
            example: 45,
          },
          messageCount: {
            type: 'integer',
            example: 35,
          },
          tokenCount: {
            type: 'integer',
            example: 45000,
          },
          model: {
            type: 'string',
            example: 'claude-3-opus',
          },
          toolCalls: {
            type: 'integer',
            example: 25,
          },
        },
      },
      AnalyticsResponse: {
        type: 'object',
        properties: {
          summary: {
            $ref: '#/components/schemas/AnalyticsSummary',
          },
          usageOverTime: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/UsageDataPoint',
            },
          },
          mostUsedTools: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ToolUsage',
            },
          },
          peakHours: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                hour: {
                  type: 'string',
                  example: '14:00',
                },
                count: {
                  type: 'integer',
                  example: 250,
                },
              },
            },
          },
          modelDistribution: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ModelDistribution',
            },
          },
          sessionLeaderboard: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/SessionLeaderboardEntry',
            },
          },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad Request - Invalid or missing parameters',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'sessionId and message required',
            },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized - Missing or invalid authentication',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'Missing authorization header',
            },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden - Invalid token',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'Invalid token',
            },
          },
        },
      },
      NotFound: {
        description: 'Not Found - Resource does not exist',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'Session not found',
            },
          },
        },
      },
      InternalServerError: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'Failed to process request',
              details: 'Connection timeout',
            },
          },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns the health status of the API server and gateway connection',
        operationId: 'getHealth',
        responses: {
          200: {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse',
                },
                example: {
                  status: 'ok',
                  timestamp: '2024-01-15T10:30:00.000Z',
                  gateway: {
                    connected: true,
                    url: 'http://localhost:8080',
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/sessions': {
      get: {
        tags: ['Sessions'],
        summary: 'List all sessions',
        description: 'Retrieves a list of all active sessions from the OpenClaw gateway',
        operationId: 'listSessions',
        responses: {
          200: {
            description: 'List of sessions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sessions: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/Session',
                      },
                    },
                  },
                },
                example: {
                  sessions: [
                    {
                      session_id: 'ses_abc123',
                      projectPath: '/home/user/project',
                      createdAt: '2024-01-15T10:30:00.000Z',
                    },
                  ],
                },
              },
            },
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
      post: {
        tags: ['Sessions'],
        summary: 'Create a new session',
        description: 'Creates a new session with the OpenClaw gateway for AI interactions',
        operationId: 'createSession',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SessionCreate',
              },
              examples: {
                default: {
                  summary: 'Default session',
                  value: {},
                },
                withPath: {
                  summary: 'Session with project path',
                  value: {
                    projectPath: '/home/user/projects/myapp',
                  },
                },
                withOptions: {
                  summary: 'Session with options',
                  value: {
                    projectPath: '/home/user/projects/myapp',
                    options: {
                      model: 'claude-3-opus',
                      temperature: 0.7,
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Session created successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Session',
                },
                example: {
                  session_id: 'ses_abc123xyz',
                  localId: 'local_123456',
                  gatewaySessionId: 'ses_abc123xyz',
                  projectPath: '/home/user/projects/myapp',
                },
              },
            },
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/sessions/{id}': {
      get: {
        tags: ['Sessions'],
        summary: 'Get session details',
        description: 'Retrieves details of a specific session by ID',
        operationId: 'getSession',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Session ID',
            schema: {
              type: 'string',
            },
            example: 'ses_abc123xyz',
          },
        ],
        responses: {
          200: {
            description: 'Session details',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Session',
                },
              },
            },
          },
          404: {
            $ref: '#/components/responses/NotFound',
          },
        },
      },
      delete: {
        tags: ['Sessions'],
        summary: 'Delete a session',
        description: 'Deletes a session and cleans up associated resources',
        operationId: 'deleteSession',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Session ID to delete',
            schema: {
              type: 'string',
            },
            example: 'ses_abc123xyz',
          },
        ],
        responses: {
          200: {
            description: 'Session deleted successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SuccessResponse',
                },
                example: {
                  success: true,
                },
              },
            },
          },
          404: {
            $ref: '#/components/responses/NotFound',
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/chat': {
      post: {
        tags: ['Chat'],
        summary: 'Send a chat message',
        description: 'Sends a message to the AI assistant and receives a response',
        operationId: 'sendChat',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ChatRequest',
              },
              examples: {
                simple: {
                  summary: 'Simple message',
                  value: {
                    sessionId: 'ses_abc123xyz',
                    message: 'Explain this code to me',
                  },
                },
                withOptions: {
                  summary: 'Message with options',
                  value: {
                    sessionId: 'ses_abc123xyz',
                    message: 'Write a function to sort an array',
                    options: {
                      stream: false,
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'AI response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ChatResponse',
                },
                example: {
                  content: 'Here is a function to sort an array:\n\n```javascript\nfunction sortArray(arr) {\n  return arr.sort((a, b) => a - b);\n}\n```',
                  role: 'assistant',
                },
              },
            },
          },
          400: {
            $ref: '#/components/responses/BadRequest',
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/files': {
      get: {
        tags: ['Files'],
        summary: 'List directory contents',
        description: 'Lists files and directories at the specified path',
        operationId: 'listFiles',
        parameters: [
          {
            name: 'path',
            in: 'query',
            required: false,
            description: 'Directory path (relative to workspace root). Defaults to "."',
            schema: {
              type: 'string',
              default: '.',
            },
            example: './src',
          },
        ],
        responses: {
          200: {
            description: 'List of files and directories',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/FileListResponse',
                },
                example: {
                  path: './src',
                  files: [
                    {
                      name: 'index.js',
                      type: 'file',
                      size: 2048,
                      modified: '2024-01-15T10:30:00.000Z',
                    },
                    {
                      name: 'routes',
                      type: 'directory',
                      size: 4096,
                      modified: '2024-01-14T15:00:00.000Z',
                    },
                  ],
                },
              },
            },
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/files/read': {
      get: {
        tags: ['Files'],
        summary: 'Read file contents',
        description: 'Reads and returns the contents of a file',
        operationId: 'readFile',
        parameters: [
          {
            name: 'path',
            in: 'query',
            required: true,
            description: 'File path to read',
            schema: {
              type: 'string',
            },
            example: './src/index.js',
          },
        ],
        responses: {
          200: {
            description: 'File contents',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/FileReadResponse',
                },
                example: {
                  path: './src/index.js',
                  content: "import express from 'express';\nconst app = express();\n...",
                },
              },
            },
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/files/write': {
      post: {
        tags: ['Files'],
        summary: 'Write file contents',
        description: 'Writes content to a file, creating it if it does not exist',
        operationId: 'writeFile',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FileWriteRequest',
              },
              example: {
                path: './src/newfile.js',
                content: 'console.log("Hello World");',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'File written successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SuccessResponse',
                },
                example: {
                  success: true,
                  path: './src/newfile.js',
                },
              },
            },
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/files/delete': {
      post: {
        tags: ['Files'],
        summary: 'Delete a file',
        description: 'Deletes a file from the filesystem',
        operationId: 'deleteFile',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/FileDeleteRequest',
              },
              example: {
                path: './src/oldfile.js',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'File deleted successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SuccessResponse',
                },
                example: {
                  success: true,
                  path: './src/oldfile.js',
                },
              },
            },
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/system/stats': {
      get: {
        tags: ['System'],
        summary: 'Get system statistics',
        description: 'Returns CPU, memory, and process statistics',
        operationId: 'getSystemStats',
        responses: {
          200: {
            description: 'System statistics',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SystemStats',
                },
                example: {
                  cpu: 2.5,
                  memory: 65,
                  uptime: 3600.5,
                  totalMemory: 17179869184,
                  freeMemory: 8589934592,
                },
              },
            },
          },
        },
      },
    },
    '/api/system/gpu': {
      get: {
        tags: ['System'],
        summary: 'Get GPU statistics',
        description: 'Returns GPU utilization, memory, and temperature statistics (requires nvidia-smi)',
        operationId: 'getGPUStats',
        responses: {
          200: {
            description: 'GPU statistics',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GPUStats',
                },
                examples: {
                  available: {
                    summary: 'GPU available',
                    value: {
                      available: true,
                      gpus: [
                        {
                          index: 0,
                          name: 'NVIDIA GeForce RTX 4090',
                          memory: {
                            total: 25769803776,
                            used: 5368709120,
                            free: 20401094656,
                            usagePercent: 21,
                          },
                          utilization: 45,
                          temperature: 65,
                        },
                      ],
                    },
                  },
                  unavailable: {
                    summary: 'GPU not available',
                    value: {
                      available: false,
                      gpus: [],
                      message: 'nvidia-smi not available',
                    },
                  },
                },
              },
            },
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/memories/search': {
      post: {
        tags: ['Memory'],
        summary: 'Search memories',
        description: 'Searches the Second Brain memory store for relevant memories',
        operationId: 'searchMemories',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/MemorySearchRequest',
              },
              example: {
                query: 'authentication implementation',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MemorySearchResponse',
                },
                example: {
                  memories: [
                    {
                      id: 'mem_123',
                      content: 'JWT authentication was implemented using...',
                      score: 0.95,
                      metadata: {},
                    },
                  ],
                  count: 1,
                },
              },
            },
          },
          400: {
            $ref: '#/components/responses/BadRequest',
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/ws/clients': {
      get: {
        tags: ['WebSocket'],
        summary: 'List WebSocket clients',
        description: 'Returns a list of currently connected WebSocket clients',
        operationId: 'listWebSocketClients',
        responses: {
          200: {
            description: 'List of connected clients',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WebSocketClients',
                },
                example: {
                  clients: [
                    {
                      id: 'ws_client_123',
                      connectedAt: '2024-01-15T10:30:00.000Z',
                    },
                  ],
                  count: 1,
                },
              },
            },
          },
        },
      },
    },
    '/api/search': {
      post: {
        tags: ['Search'],
        summary: 'Universal search',
        description: 'Searches across sessions, messages, files, and memories (Second Brain with 438K+ memories)',
        operationId: 'search',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query (min 2 characters)',
                    example: 'authentication',
                  },
                  types: {
                    type: 'array',
                    description: 'Types to search',
                    items: {
                      type: 'string',
                      enum: ['session', 'message', 'file', 'memory'],
                    },
                    default: ['session', 'message', 'file', 'memory'],
                  },
                  limit: {
                    type: 'integer',
                    description: 'Maximum results to return',
                    default: 50,
                  },
                  sessionId: {
                    type: 'string',
                    description: 'Limit message search to specific session',
                  },
                  path: {
                    type: 'string',
                    description: 'Base path for file search',
                  },
                },
                required: ['query'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SearchResponse',
                },
              },
            },
          },
          400: {
            $ref: '#/components/responses/BadRequest',
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/search/quick': {
      get: {
        tags: ['Search'],
        summary: 'Quick search',
        description: 'Optimized for command palette - instant results from sessions and messages only',
        operationId: 'quickSearch',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            description: 'Search query',
            schema: {
              type: 'string',
            },
            example: 'config',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Maximum results',
            schema: {
              type: 'integer',
              default: 10,
            },
          },
        ],
        responses: {
          200: {
            description: 'Quick search results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    results: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/SearchResult',
                      },
                    },
                    query: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
          400: {
            $ref: '#/components/responses/BadRequest',
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/search/deep': {
      post: {
        tags: ['Search'],
        summary: 'Deep search',
        description: 'Thorough search including Second Brain memories - may take longer',
        operationId: 'deepSearch',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'Search query',
                    example: 'authentication implementation',
                  },
                  limit: {
                    type: 'integer',
                    default: 100,
                  },
                },
                required: ['query'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Deep search results',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/SearchResponse',
                },
              },
            },
          },
          400: {
            $ref: '#/components/responses/BadRequest',
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/analytics': {
      get: {
        tags: ['Analytics'],
        summary: 'Get analytics data',
        description: 'Returns comprehensive analytics including usage over time, tool usage, model distribution, and session leaderboard',
        operationId: 'getAnalytics',
        parameters: [
          {
            name: 'range',
            in: 'query',
            required: false,
            description: 'Time range for analytics',
            schema: {
              type: 'string',
              enum: ['24h', '7d', '30d'],
              default: '30d',
            },
          },
        ],
        responses: {
          200: {
            description: 'Analytics data',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AnalyticsResponse',
                },
              },
            },
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/analytics/track': {
      post: {
        tags: ['Analytics'],
        summary: 'Track an event',
        description: 'Records an analytics event for future analysis',
        operationId: 'trackEvent',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  event: {
                    type: 'string',
                    description: 'Event type name',
                    example: 'session_started',
                  },
                  data: {
                    type: 'object',
                    description: 'Event payload',
                    example: {
                      sessionId: 'ses_123',
                      model: 'claude-3-opus',
                    },
                  },
                },
                required: ['event'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Event tracked successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: {
                      type: 'boolean',
                      example: true,
                    },
                    tracked: {
                      type: 'string',
                      example: 'session_started',
                    },
                  },
                },
              },
            },
          },
          400: {
            $ref: '#/components/responses/BadRequest',
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
    '/api/analytics/export': {
      get: {
        tags: ['Analytics'],
        summary: 'Export analytics data',
        description: 'Exports raw analytics data in JSON or CSV format',
        operationId: 'exportAnalytics',
        parameters: [
          {
            name: 'format',
            in: 'query',
            required: false,
            description: 'Export format',
            schema: {
              type: 'string',
              enum: ['json', 'csv'],
              default: 'json',
            },
          },
        ],
        responses: {
          200: {
            description: 'Exported analytics data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    exportedAt: {
                      type: 'string',
                      format: 'date-time',
                    },
                    sessions: {
                      type: 'array',
                      items: {
                        type: 'object',
                      },
                    },
                    messages: {
                      type: 'array',
                      items: {
                        type: 'object',
                      },
                    },
                    toolCalls: {
                      type: 'array',
                      items: {
                        type: 'object',
                      },
                    },
                  },
                },
              },
              'text/csv': {
                schema: {
                  type: 'string',
                },
              },
            },
          },
          500: {
            $ref: '#/components/responses/InternalServerError',
          },
        },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: [], // We're using inline definitions
};

export const swaggerSpec = swaggerJsdoc(options);
export { swaggerUi };

export function setupSwagger(app) {
  // Serve Swagger UI
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 30px 0 }
        .swagger-ui .info .title { font-size: 2.5em }
      `,
      customSiteTitle: 'ALFIE Backend API Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
      },
    })
  );

  // Serve raw OpenAPI spec as JSON
  app.get('/api/docs/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve raw OpenAPI spec as YAML
  app.get('/api/docs/openapi.yaml', (req, res) => {
    res.setHeader('Content-Type', 'text/yaml');
    const yaml = jsonToYaml(swaggerSpec);
    res.send(yaml);
  });

  console.log('📚 Swagger UI available at /api/docs');
}

// Simple JSON to YAML converter for OpenAPI spec
function jsonToYaml(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  let result = '';

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        result += `${spaces}-\n${jsonToYaml(item, indent + 1)}`;
      } else {
        result += `${spaces}- ${formatYamlValue(item)}\n`;
      }
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value) && value.length === 0) {
          result += `${spaces}${key}: []\n`;
        } else if (typeof value === 'object' && Object.keys(value).length === 0) {
          result += `${spaces}${key}: {}\n`;
        } else {
          result += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
        }
      } else {
        result += `${spaces}${key}: ${formatYamlValue(value)}\n`;
      }
    }
  }

  return result;
}

function formatYamlValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return '';
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') {
    if (value.includes('\n') || value.includes(':') || value.includes('#') || 
        value.includes('"') || value.includes("'") || value.startsWith(' ') ||
        value.endsWith(' ') || value === '') {
      return `"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return value;
  }
  return String(value);
}

export default { setupSwagger, swaggerSpec, swaggerUi };
