# ALFIE Backend

A real-time communication server bridging the ALFIE UI with the OpenClaw gateway. Provides session management, file operations, system monitoring, universal search, analytics, and WebSocket-based streaming.

## Features

- **Session Management** - Create and manage OpenClaw gateway sessions
- **Chat Interface** - Send messages and receive AI responses (streaming supported)
- **File Operations** - Browse, read, write, and delete workspace files
- **System Monitoring** - Real-time CPU, memory, and GPU statistics
- **Universal Search** - Search across sessions, messages, files, and 438K+ memories
- **Analytics Dashboard** - Usage tracking, cost estimation, and insights
- **WebSocket Support** - Real-time bidirectional communication
- **Second Brain** - Query semantic memory store

## Quick Start

### Prerequisites

- Node.js 18+
- OpenClaw gateway running (default: `http://localhost:8080`)
- (Optional) NVIDIA GPU with `nvidia-smi` for GPU monitoring

### Installation

```bash
git clone <repository-url>
cd alfie-backend
npm install
```

### Configuration

Create a `.env` file:

```env
# Server
PORT=3001
HOST=0.0.0.0

# Authentication
API_TOKEN=your-secret-token

# OpenClaw Gateway
OPENCLAW_GATEWAY_URL=http://localhost:8080
OPENCLAW_API_KEY=your-api-key

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Workspace
WORKSPACE_ROOT=/path/to/workspace
MAX_FILE_SIZE=10485760

# WebSocket
WS_HEARTBEAT_INTERVAL=30000
WS_CLIENT_TIMEOUT=60000
```

### Running

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server starts at `http://localhost:3001` with WebSocket at `ws://localhost:3001/ws`.

## API Documentation

Interactive API documentation is available at:

```
http://localhost:3001/api/docs
```

OpenAPI spec downloads:
- JSON: `http://localhost:3001/api/docs/openapi.json`
- YAML: `http://localhost:3001/api/docs/openapi.yaml`

## API Overview

### Health & System

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check with gateway status |
| `/api/system/stats` | GET | CPU, memory, uptime statistics |
| `/api/system/gpu` | GET | GPU utilization and temperature |

### Sessions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET | List all sessions |
| `/api/sessions` | POST | Create new session |
| `/api/sessions/:id` | GET | Get session details |
| `/api/sessions/:id` | DELETE | Delete session |

### Chat

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message, get response |

### Files

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/files` | GET | List directory contents |
| `/api/files/read` | GET | Read file contents |
| `/api/files/write` | POST | Write file |
| `/api/files/delete` | POST | Delete file |

### Search

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search` | POST | Universal search |
| `/api/search/quick` | GET | Fast search (command palette) |
| `/api/search/deep` | POST | Thorough search with memories |

### Analytics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics` | GET | Usage analytics |
| `/api/analytics/track` | POST | Track custom event |
| `/api/analytics/export` | GET | Export data (JSON/CSV) |

### Memory & WebSocket

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/memories/search` | POST | Search Second Brain |
| `/api/ws/clients` | GET | List WebSocket clients |

## WebSocket

Connect to `ws://localhost:3001/ws` for real-time events:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'gpu_stats':
      console.log('GPU:', data.payload);
      break;
    case 'session_update':
      console.log('Session:', data.payload);
      break;
  }
};
```

### Event Types

| Type | Description |
|------|-------------|
| `gpu_stats` | GPU monitoring updates |
| `session_update` | Session state changes |
| `message_chunk` | Streaming message chunks |
| `heartbeat` | Connection keep-alive |

## Project Structure

```
alfie-backend/
├── src/
│   ├── index.js           # Main application entry
│   ├── config.js          # Configuration management
│   ├── docs/
│   │   └── swagger.js     # OpenAPI specification
│   ├── middleware/
│   │   └── auth.js        # Authentication middleware
│   ├── routes/
│   │   ├── files.js       # File operations
│   │   ├── sessions.js    # Session management
│   │   ├── stream.js      # Streaming endpoints
│   │   ├── system.js      # System monitoring
│   │   └── analytics.js   # Analytics endpoints
│   └── services/
│       ├── websocket.js       # WebSocket server
│       ├── sessionManager.js  # Session state
│       ├── sessionBridge.js   # Gateway bridge
│       ├── openclawGateway.js # Gateway client
│       ├── gpuMonitor.js      # GPU monitoring
│       ├── secondBrain.js     # Memory search
│       └── searchService.js   # Universal search
├── package.json
├── .env.example
├── README.md
└── CONTRIBUTING.md
```

## Authentication

Most endpoints accept Bearer token authentication:

```bash
curl -H "Authorization: Bearer your-token" http://localhost:3001/api/sessions
```

Configure the token via `API_TOKEN` environment variable.

## Error Handling

All errors return consistent JSON:

```json
{
  "error": "Error message",
  "details": "Additional context (optional)"
}
```

HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing auth)
- `403` - Forbidden (invalid token)
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable

## Development

```bash
# Run with auto-reload
npm run dev

# Check logs
tail -f logs/app.log
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `HOST` | 0.0.0.0 | Bind address |
| `API_TOKEN` | alfie-dev-token | Auth token |
| `OPENCLAW_GATEWAY_URL` | http://localhost:8080 | Gateway URL |
| `WORKSPACE_ROOT` | cwd | File operations root |
| `MAX_FILE_SIZE` | 10MB | Max upload size |
| `WS_HEARTBEAT_INTERVAL` | 30000 | WS ping interval (ms) |
| `WS_CLIENT_TIMEOUT` | 60000 | WS client timeout (ms) |

## License

MIT License - see [LICENSE](LICENSE) for details.
