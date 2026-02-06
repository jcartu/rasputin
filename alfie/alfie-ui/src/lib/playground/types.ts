// API Playground Types

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface AuthConfig {
  type: 'none' | 'bearer' | 'api-key' | 'basic' | 'custom';
  bearerToken?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  basicUsername?: string;
  basicPassword?: string;
  customHeaders?: KeyValuePair[];
}

export interface RequestBody {
  type: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary';
  content: string;
  formData?: KeyValuePair[];
}

export interface ApiRequest {
  id: string;
  name: string;
  description?: string;
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body: RequestBody;
  auth: AuthConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
  time: number;
  timestamp: string;
}

export interface RequestCollection {
  id: string;
  name: string;
  description?: string;
  requests: string[]; // Array of request IDs
  createdAt: string;
  updatedAt: string;
  color?: string;
  icon?: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: KeyValuePair[];
  isActive: boolean;
}

export interface WebSocketMessage {
  id: string;
  type: 'sent' | 'received' | 'system';
  content: string;
  timestamp: string;
}

export interface WebSocketConnection {
  id: string;
  url: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  messages: WebSocketMessage[];
  protocols?: string[];
  createdAt: string;
}

export interface EndpointDefinition {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  description: string;
  category: string;
  parameters?: {
    name: string;
    in: 'path' | 'query' | 'header' | 'body';
    type: string;
    required: boolean;
    description?: string;
  }[];
  requestBody?: {
    type: string;
    example?: string;
  };
  responses?: {
    status: number;
    description: string;
    example?: string;
  }[];
}

// Predefined ALFIE API endpoints
export const ALFIE_ENDPOINTS: EndpointDefinition[] = [
  // Sessions
  {
    id: 'sessions-list',
    name: 'List Sessions',
    method: 'GET',
    path: '/api/sessions',
    description: 'Get all chat sessions',
    category: 'Sessions',
    responses: [
      { status: 200, description: 'List of sessions', example: '{"sessions": [...]}' }
    ]
  },
  {
    id: 'sessions-create',
    name: 'Create Session',
    method: 'POST',
    path: '/api/sessions',
    description: 'Create a new chat session',
    category: 'Sessions',
    requestBody: {
      type: 'application/json',
      example: '{"projectPath": "/path/to/project"}'
    },
    responses: [
      { status: 201, description: 'Created session' }
    ]
  },
  {
    id: 'sessions-delete',
    name: 'Delete Session',
    method: 'DELETE',
    path: '/api/sessions/:id',
    description: 'Delete a specific session',
    category: 'Sessions',
    parameters: [
      { name: 'id', in: 'path', type: 'string', required: true, description: 'Session ID' }
    ],
    responses: [
      { status: 200, description: 'Session deleted' }
    ]
  },
  // Export/Import
  {
    id: 'sessions-formats',
    name: 'Get Export Formats',
    method: 'GET',
    path: '/api/sessions/formats',
    description: 'Get available export/import formats',
    category: 'Export/Import',
    responses: [
      { status: 200, description: 'Available formats' }
    ]
  },
  {
    id: 'sessions-export',
    name: 'Export Sessions',
    method: 'POST',
    path: '/api/sessions/export',
    description: 'Export sessions in specified format',
    category: 'Export/Import',
    requestBody: {
      type: 'application/json',
      example: '{"sessionIds": ["id1", "id2"], "format": "json"}'
    }
  },
  {
    id: 'sessions-import',
    name: 'Import Sessions',
    method: 'POST',
    path: '/api/sessions/import',
    description: 'Import sessions from file',
    category: 'Export/Import',
    requestBody: {
      type: 'application/json',
      example: '{"content": "...", "format": "json"}'
    }
  },
  // Chat
  {
    id: 'chat-message',
    name: 'Send Message',
    method: 'POST',
    path: '/api/chat',
    description: 'Send a message to the AI assistant',
    category: 'Chat',
    requestBody: {
      type: 'application/json',
      example: '{"sessionId": "...", "message": "Hello!", "model": "claude-3-opus"}'
    }
  },
  {
    id: 'chat-stream',
    name: 'Stream Message',
    method: 'POST',
    path: '/api/chat/stream',
    description: 'Stream a response from the AI',
    category: 'Chat',
    requestBody: {
      type: 'application/json',
      example: '{"sessionId": "...", "message": "Hello!"}'
    }
  },
  // Analytics
  {
    id: 'analytics-get',
    name: 'Get Analytics',
    method: 'GET',
    path: '/api/analytics',
    description: 'Get usage analytics',
    category: 'Analytics',
    parameters: [
      { name: 'range', in: 'query', type: 'string', required: false, description: 'Time range: 24h, 7d, 30d' }
    ]
  },
  // Health
  {
    id: 'health-check',
    name: 'Health Check',
    method: 'GET',
    path: '/api/health',
    description: 'Check API health status',
    category: 'System',
    responses: [
      { status: 200, description: 'Service is healthy' }
    ]
  },
  // Tools
  {
    id: 'tools-list',
    name: 'List Tools',
    method: 'GET',
    path: '/api/tools',
    description: 'Get available tools',
    category: 'Tools',
  },
  {
    id: 'tools-execute',
    name: 'Execute Tool',
    method: 'POST',
    path: '/api/tools/execute',
    description: 'Execute a specific tool',
    category: 'Tools',
    requestBody: {
      type: 'application/json',
      example: '{"toolName": "read_file", "arguments": {"path": "/file.txt"}}'
    }
  },
  // Files
  {
    id: 'files-list',
    name: 'List Files',
    method: 'GET',
    path: '/api/files',
    description: 'List files in project',
    category: 'Files',
    parameters: [
      { name: 'path', in: 'query', type: 'string', required: false, description: 'Directory path' }
    ]
  },
  {
    id: 'files-read',
    name: 'Read File',
    method: 'GET',
    path: '/api/files/:path',
    description: 'Read file contents',
    category: 'Files',
    parameters: [
      { name: 'path', in: 'path', type: 'string', required: true, description: 'File path' }
    ]
  },
  // Models
  {
    id: 'models-list',
    name: 'List Models',
    method: 'GET',
    path: '/api/models',
    description: 'Get available AI models',
    category: 'Models',
  },
  // WebSocket
  {
    id: 'ws-connect',
    name: 'WebSocket Connect',
    method: 'GET',
    path: '/ws',
    description: 'WebSocket connection endpoint',
    category: 'WebSocket',
  },
];

export const HTTP_METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-emerald-500 bg-emerald-500/10',
  POST: 'text-blue-500 bg-blue-500/10',
  PUT: 'text-amber-500 bg-amber-500/10',
  PATCH: 'text-orange-500 bg-orange-500/10',
  DELETE: 'text-red-500 bg-red-500/10',
  HEAD: 'text-purple-500 bg-purple-500/10',
  OPTIONS: 'text-gray-500 bg-gray-500/10',
};
