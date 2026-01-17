# RASPUTIN Technical Audit

> **Generated**: January 17, 2026
> **Version**: 1.0.0
> **Stack**: React 19 + Tailwind 4 + Vite | Express + tRPC 11 | MySQL/TiDB (Drizzle ORM) | Manus OAuth

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Environment Variables](#environment-variables)
4. [Dependencies](#dependencies)
5. [Database Schema](#database-schema)
6. [API Endpoints (tRPC)](#api-endpoints-trpc)
7. [JARVIS Tool Definitions](#jarvis-tool-definitions)
8. [Exported Functions & Classes](#exported-functions--classes)
9. [File Structure](#file-structure)
10. [Service Modules](#service-modules)

---

## Project Overview

**RASPUTIN** is a multi-model AI consensus and synthesis engine with autonomous agent capabilities (JARVIS). Key features:

- **Multi-Model Consensus**: Query GPT-5, Claude 4.5, Gemini 3, Grok 4.1, Sonar Pro simultaneously
- **JARVIS Agent**: Autonomous agent with 130+ tools for code, research, deployments
- **Voice Interface**: Wake word "Hey JARVIS", ElevenLabs TTS
- **Infrastructure Monitoring**: SSH management, health checks, auto-remediation
- **Multi-Agent Orchestration**: Swarm intelligence, agent teams, negotiations
- **RAG Codebase Indexing**: Vector search with Qdrant
- **Self-Evolution**: Tool generation, skill acquisition, memory system

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React 19)                        │
│  Pages: Chat, Agent, Memory, Infrastructure, MultiAgent, etc.   │
│  Components: JarvisStreamView, VoiceConversation, WorkspaceIDE  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ tRPC + WebSocket
┌──────────────────────────────▼──────────────────────────────────┐
│                         SERVER (Express)                         │
│  routers.ts → 15 tRPC routers with 100+ procedures              │
│  services/ → JARVIS, Memory, MultiAgent, RAG, Events, etc.      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   MySQL/TiDB  │    │     Qdrant       │    │      Redis       │
│  (Drizzle ORM)│    │  (Vector Store)  │    │   (Event Bus)    │
│   60+ tables  │    │  User memories   │    │  Pub/Sub, Cache  │
└───────────────┘    └──────────────────┘    └──────────────────┘
```

---

## Environment Variables

| Variable              | Description                          | Required |
| --------------------- | ------------------------------------ | -------- |
| `DATABASE_URL`        | MySQL/TiDB connection string         | Yes      |
| `JWT_SECRET`          | Session signing secret               | Yes      |
| `ANTHROPIC_API_KEY`   | Claude API key                       | Yes      |
| `OPENROUTER_API_KEY`  | Multi-model routing API              | Yes      |
| `GEMINI_API_KEY`      | Google Gemini API                    | No       |
| `XAI_API_KEY`         | Grok API                             | No       |
| `SONAR_API_KEY`       | Perplexity Sonar API                 | No       |
| `OPENAI_API_KEY`      | OpenAI API (embeddings)              | No       |
| `CEREBRAS_API_KEY`    | Cerebras inference                   | No       |
| `ELEVENLABS_API_KEY`  | Text-to-speech                       | No       |
| `QDRANT_URL`          | Vector database URL                  | No       |
| `REDIS_URL`           | Redis connection for event bus       | No       |
| `OLLAMA_URL`          | Local LLM inference                  | No       |
| `VLLM_URL`            | vLLM inference server                | No       |
| `GITHUB_TOKEN`        | GitHub API access                    | No       |
| `SENDGRID_API_KEY`    | Email sending                        | No       |
| `SLACK_WEBHOOK_URL`   | Slack notifications                  | No       |
| `VERCEL_TOKEN`        | Vercel deployments                   | No       |
| `REPLICATE_API_TOKEN` | Replicate API                        | No       |
| `FLUX_URL`            | Flux image generation                | No       |
| `SEARXNG_URL`         | SearXNG search engine                | No       |
| `OAUTH_SERVER_URL`    | Manus OAuth server                   | No       |
| `PORT`                | Server port (default: 3000)          | No       |
| `NODE_ENV`            | Environment (development/production) | No       |

---

## Dependencies

### Production Dependencies

| Package                  | Version   | Purpose                 |
| ------------------------ | --------- | ----------------------- |
| `@anthropic-ai/sdk`      | ^0.71.2   | Claude API SDK          |
| `@trpc/server`           | ^11.6.0   | tRPC server             |
| `@trpc/client`           | ^11.6.0   | tRPC client             |
| `@trpc/react-query`      | ^11.6.0   | React Query integration |
| `@tanstack/react-query`  | ^5.90.2   | Data fetching           |
| `@qdrant/js-client-rest` | ^1.16.2   | Qdrant vector DB        |
| `drizzle-orm`            | ^0.44.5   | Type-safe ORM           |
| `express`                | ^4.21.2   | HTTP server             |
| `socket.io`              | ^4.8.3    | WebSocket server        |
| `socket.io-client`       | ^4.8.3    | WebSocket client        |
| `ioredis`                | ^5.9.1    | Redis client            |
| `mysql2`                 | ^3.15.0   | MySQL driver            |
| `jose`                   | 6.1.0     | JWT handling            |
| `zod`                    | ^4.1.12   | Schema validation       |
| `react`                  | ^19.2.1   | UI framework            |
| `react-dom`              | ^19.2.1   | React DOM               |
| `wouter`                 | ^3.3.5    | Routing                 |
| `framer-motion`          | ^12.23.22 | Animations              |
| `lucide-react`           | ^0.453.0  | Icons                   |
| `tailwind-merge`         | ^3.3.1    | CSS utilities           |
| `marked`                 | ^17.0.1   | Markdown parsing        |
| `streamdown`             | ^1.4.0    | Streaming markdown      |
| `playwright`             | ^1.57.0   | Browser automation      |
| `ssh2`                   | ^1.17.0   | SSH client              |
| `docx`                   | ^9.5.1    | DOCX generation         |
| `pptxgenjs`              | ^4.0.1    | PPTX generation         |
| `exceljs`                | ^4.4.0    | Excel generation        |
| `axios`                  | ^1.12.0   | HTTP client             |
| `nanoid`                 | ^5.1.5    | ID generation           |
| `sonner`                 | ^2.0.7    | Toast notifications     |

### Development Dependencies

| Package       | Version | Purpose         |
| ------------- | ------- | --------------- |
| `typescript`  | 5.9.3   | Type checking   |
| `vite`        | ^7.1.7  | Build tool      |
| `vitest`      | ^2.1.4  | Testing         |
| `eslint`      | ^9.39.2 | Linting         |
| `prettier`    | ^3.6.2  | Formatting      |
| `tailwindcss` | ^4.1.14 | CSS framework   |
| `drizzle-kit` | ^0.31.4 | DB migrations   |
| `esbuild`     | ^0.25.0 | Server bundling |
| `tsx`         | ^4.19.1 | TS execution    |

---

## Database Schema

### Core Tables (60+ total)

#### Authentication & Users

- `users` - User accounts with OAuth/password auth

#### Chat System

- `chats` - Conversation threads
- `messages` - User queries and AI responses
- `modelResponses` - Individual model outputs
- `synthesisPipelineStages` - Multi-stage synthesis progress

#### JARVIS Agent

- `agentTasks` - Persistent task storage
- `agentMessages` - Conversation history within tasks
- `agentToolCalls` - Detailed tool execution logs
- `agentFiles` - Files generated by agent
- `agentSkills` - Learned capabilities
- `usageTracking` - API usage per user

#### Scheduled Tasks

- `scheduledTasks` - Cron-like task definitions
- `scheduledTaskRuns` - Execution history

#### Workspaces (Code Projects)

- `workspaces` - User code workspaces
- `workspaceFiles` - Files in workspaces
- `workspaceCommits` - Git-like checkpoints
- `workspaceTemplates` - Project templates
- `workspaceProcesses` - Running processes

#### SSH Management

- `sshHosts` - SSH host configurations
- `sshCredentials` - Stored credentials
- `sshPermissions` - User permissions
- `sshAuditLog` - Command audit trail
- `pendingApprovals` - Commands awaiting approval

#### Memory System

- `episodicMemories` - Task experiences
- `semanticMemories` - Learned facts
- `proceduralMemories` - Learned procedures/skills
- `memoryEmbeddings` - Vector embeddings
- `memoryAccessLog` - Memory access patterns
- `learningEvents` - Learning milestones
- `trainingData` - Fine-tuning data

#### Infrastructure Monitoring

- `infrastructureHosts` - Monitored hosts
- `healthMetrics` - System metrics
- `alertRules` - Alert definitions
- `incidents` - Active incidents
- `remediations` - Auto-remediation actions
- `incidentActions` - Remediation history

#### Multi-Agent System

- `agents` - Agent configurations
- `interAgentMessages` - Agent-to-agent communication
- `agentSubtasks` - Delegated subtasks

#### RAG (Codebase Indexing)

- `codebaseProjects` - Indexed projects
- `codeChunks` - Code fragments with embeddings
- `codeRelationships` - Symbol relationships
- `codeSymbols` - Function/class definitions

#### Events & Webhooks

- `webhookEndpoints` - Incoming webhook URLs
- `eventTriggers` - Event trigger definitions
- `eventActions` - Actions on events
- `eventLog` - Event history
- `eventCronJobs` - Scheduled events

#### Self-Evolution

- `dynamicTools` - AI-generated tools
- `dynamicAgentTypes` - AI-generated agent types
- `selfModificationLog` - Self-modification audit

#### Caching & Async

- `knowledgeCache` - LRU knowledge cache
- `asyncTaskQueue` - Background task queue
- `asyncTaskLogs` - Async task logs

---

## API Endpoints (tRPC)

### Router: `debug`

| Procedure | Type  | Description                       |
| --------- | ----- | --------------------------------- |
| `apiKeys` | query | List configured API keys (masked) |

### Router: `auth`

| Procedure | Type     | Description             |
| --------- | -------- | ----------------------- |
| `me`      | query    | Get current user        |
| `logout`  | mutation | Log out current session |

### Router: `models`

| Procedure    | Type  | Description               |
| ------------ | ----- | ------------------------- |
| `list`       | query | List available AI models  |
| `getForTier` | query | Get models for speed tier |

### Router: `chats`

| Procedure        | Type     | Description             |
| ---------------- | -------- | ----------------------- |
| `list`           | query    | List user's chats       |
| `get`            | query    | Get chat with messages  |
| `create`         | mutation | Create new chat         |
| `update`         | mutation | Update chat settings    |
| `delete`         | mutation | Delete chat             |
| `cleanupEmpty`   | mutation | Remove empty chats      |
| `getEmptyCount`  | query    | Count empty chats       |
| `generateTitle`  | mutation | AI-generate chat title  |
| `exportMarkdown` | query    | Export chat as markdown |
| `search`         | query    | Search chat history     |

### Router: `query`

| Procedure           | Type     | Description                      |
| ------------------- | -------- | -------------------------------- |
| `submit`            | mutation | Submit consensus/synthesis query |
| `getModelResponses` | query    | Get individual model responses   |
| `getPipelineStages` | query    | Get synthesis stages             |

### Router: `jarvis`

| Procedure            | Type     | Description                |
| -------------------- | -------- | -------------------------- |
| `listTasks`          | query    | List agent tasks           |
| `getTaskMessages`    | query    | Get task conversation      |
| `getActiveTask`      | query    | Get currently running task |
| `getTask`            | query    | Get task with full details |
| `deleteTask`         | mutation | Delete agent task          |
| `checkRateLimit`     | query    | Check daily rate limit     |
| `getUsageStats`      | query    | Get usage statistics       |
| `executeTask`        | mutation | Execute agent task         |
| `resumeTask`         | mutation | Resume paused task         |
| `listDevServers`     | query    | List running dev servers   |
| `getDevServerInfo`   | query    | Get dev server details     |
| `submitAsyncTask`    | mutation | Submit background task     |
| `getAsyncTaskStatus` | query    | Get async task status      |
| `listAsyncTasks`     | query    | List async tasks           |
| `cancelAsyncTask`    | mutation | Cancel async task          |
| `getAsyncTaskLogs`   | query    | Get async task logs        |
| `getQueueStats`      | query    | Get task queue stats       |
| `exportReportPdf`    | mutation | Export report as PDF       |

### Router: `voice`

| Procedure      | Type     | Description              |
| -------------- | -------- | ------------------------ |
| `getVoices`    | query    | List available voices    |
| `textToSpeech` | mutation | Convert text to speech   |
| `transcribe`   | mutation | Transcribe audio to text |
| `getUsage`     | query    | Get voice API usage      |

### Router: `workspace`

| Procedure          | Type     | Description            |
| ------------------ | -------- | ---------------------- |
| `list`             | query    | List workspaces        |
| `get`              | query    | Get workspace details  |
| `create`           | mutation | Create workspace       |
| `delete`           | mutation | Delete workspace       |
| `listFiles`        | query    | List workspace files   |
| `readFile`         | query    | Read file content      |
| `writeFile`        | mutation | Write file content     |
| `deleteFile`       | mutation | Delete file            |
| `createDirectory`  | mutation | Create directory       |
| `getCommits`       | query    | Get commit history     |
| `getGitStatus`     | query    | Get git status         |
| `createCheckpoint` | mutation | Create checkpoint      |
| `rollback`         | mutation | Rollback to checkpoint |
| `executeCommand`   | mutation | Execute shell command  |
| `startDevServer`   | mutation | Start dev server       |
| `stopDevServer`    | mutation | Stop dev server        |
| `getTemplates`     | query    | Get project templates  |
| `getDiskUsage`     | query    | Get disk usage         |

### Router: `schedule`

| Procedure | Type     | Description           |
| --------- | -------- | --------------------- |
| `list`    | query    | List scheduled tasks  |
| `create`  | mutation | Create scheduled task |
| `update`  | mutation | Update scheduled task |
| `delete`  | mutation | Delete scheduled task |
| `toggle`  | mutation | Enable/disable task   |

### Router: `ssh`

| Procedure             | Type     | Description              |
| --------------------- | -------- | ------------------------ |
| `listHosts`           | query    | List SSH hosts           |
| `getHost`             | query    | Get host details         |
| `createHost`          | mutation | Add SSH host             |
| `updateHost`          | mutation | Update SSH host          |
| `deleteHost`          | mutation | Remove SSH host          |
| `testConnection`      | mutation | Test SSH connection      |
| `verifyHostKey`       | mutation | Verify host key          |
| `executeCommand`      | mutation | Execute SSH command      |
| `readFile`            | query    | Read remote file         |
| `writeFile`           | mutation | Write remote file        |
| `listDirectory`       | query    | List remote directory    |
| `getPermissions`      | query    | Get user SSH permissions |
| `updatePermissions`   | mutation | Update permissions       |
| `getAuditLog`         | query    | Get SSH audit log        |
| `getPendingApprovals` | query    | Get pending approvals    |
| `getApprovalHistory`  | query    | Get approval history     |
| `approveCommand`      | mutation | Approve command          |
| `rejectCommand`       | mutation | Reject command           |

### Router: `infrastructure`

| Procedure         | Type     | Description            |
| ----------------- | -------- | ---------------------- |
| `listHosts`       | query    | List monitored hosts   |
| `addHost`         | mutation | Add host to monitoring |
| `removeHost`      | mutation | Remove from monitoring |
| `getMetrics`      | query    | Get host metrics       |
| `getIncidents`    | query    | Get incidents          |
| `getAlertRules`   | query    | Get alert rules        |
| `createAlertRule` | mutation | Create alert rule      |

### Router: `agents`

| Procedure     | Type     | Description        |
| ------------- | -------- | ------------------ |
| `list`        | query    | List agents        |
| `create`      | mutation | Create agent       |
| `runTask`     | mutation | Run agent task     |
| `getMessages` | query    | Get agent messages |

### Router: `rag`

| Procedure         | Type     | Description           |
| ----------------- | -------- | --------------------- |
| `listProjects`    | query    | List indexed projects |
| `indexProject`    | mutation | Index codebase        |
| `search`          | query    | Semantic code search  |
| `getProjectStats` | query    | Get indexing stats    |

### Router: `events`

| Procedure           | Type     | Description            |
| ------------------- | -------- | ---------------------- |
| `listWebhooks`      | query    | List webhook endpoints |
| `createWebhook`     | mutation | Create webhook         |
| `deleteWebhook`     | mutation | Delete webhook         |
| `createTrigger`     | mutation | Create event trigger   |
| `createCronTrigger` | mutation | Create cron trigger    |
| `listCronTriggers`  | query    | List cron triggers     |
| `createAction`      | mutation | Create event action    |
| `getTriggerActions` | query    | Get trigger actions    |
| `testWebhook`       | mutation | Test webhook           |

### Router: `memory`

| Procedure              | Type  | Description              |
| ---------------------- | ----- | ------------------------ |
| `getStats`             | query | Get memory statistics    |
| `getQdrantCollections` | query | List Qdrant collections  |
| `listEpisodic`         | query | List episodic memories   |
| `listSemantic`         | query | List semantic memories   |
| `listProcedural`       | query | List procedural memories |
| `search`               | query | Semantic memory search   |
| `listLearningEvents`   | query | List learning events     |

---

## JARVIS Tool Definitions

### 130+ Available Tools

#### Core Tools

| Tool           | Description                           |
| -------------- | ------------------------------------- |
| `web_search`   | Search the web using multiple engines |
| `browse_url`   | Fetch and parse webpage content       |
| `calculate`    | Evaluate mathematical expressions     |
| `get_datetime` | Get current date/time                 |
| `get_weather`  | Get weather information               |
| `http_request` | Make HTTP requests                    |
| `json_tool`    | Parse/generate JSON                   |
| `text_process` | Text manipulation operations          |

#### File Operations

| Tool                 | Description               |
| -------------------- | ------------------------- |
| `read_file`          | Read file contents        |
| `write_file`         | Write/create files        |
| `list_files`         | List directory contents   |
| `find_in_file`       | Search within files       |
| `search_and_replace` | Find and replace in files |
| `insert_at_line`     | Insert content at line    |
| `delete_lines`       | Delete lines from file    |
| `replace_lines`      | Replace lines in file     |

#### Code Execution

| Tool                 | Description                         |
| -------------------- | ----------------------------------- |
| `execute_python`     | Execute Python code (sandboxed)     |
| `execute_javascript` | Execute JavaScript code (sandboxed) |
| `run_shell`          | Execute shell commands              |

#### Document Generation

| Tool                       | Description                       |
| -------------------------- | --------------------------------- |
| `write_docx`               | Generate Word documents           |
| `write_pptx`               | Generate PowerPoint presentations |
| `write_xlsx`               | Generate Excel spreadsheets       |
| `create_rich_report`       | Generate formatted reports        |
| `get_document_template`    | Get document template             |
| `render_document_template` | Render template with data         |

#### Git Operations

| Tool            | Description           |
| --------------- | --------------------- |
| `git_status`    | Get repository status |
| `git_diff`      | Show file differences |
| `git_branch`    | Manage branches       |
| `git_commit`    | Create commits        |
| `git_log`       | View commit history   |
| `git_push`      | Push to remote        |
| `git_pull`      | Pull from remote      |
| `git_stash`     | Stash changes         |
| `git_clone`     | Clone repository      |
| `git_init`      | Initialize repository |
| `git_create_pr` | Create pull request   |

#### Deployment

| Tool                      | Description             |
| ------------------------- | ----------------------- |
| `deploy_vercel`           | Deploy to Vercel        |
| `deploy_railway`          | Deploy to Railway       |
| `docker_build`            | Build Docker image      |
| `docker_push`             | Push Docker image       |
| `docker_compose`          | Run docker-compose      |
| `generate_dockerfile`     | Generate Dockerfile     |
| `check_deployment_health` | Check deployment status |

#### Development

| Tool               | Description             |
| ------------------ | ----------------------- |
| `run_build`        | Run build command       |
| `run_tests`        | Run test suite          |
| `run_typecheck`    | Run TypeScript check    |
| `run_lint`         | Run linter              |
| `start_dev_server` | Start dev server        |
| `check_dev_server` | Check dev server status |
| `npm_audit`        | Run npm audit           |

#### Browser Automation

| Tool                    | Description           |
| ----------------------- | --------------------- |
| `browser_session_start` | Start browser session |
| `browser_navigate`      | Navigate to URL       |
| `browser_click`         | Click element         |
| `browser_fill`          | Fill form field       |
| `browser_screenshot`    | Take screenshot       |
| `browser_get_content`   | Get page content      |
| `browser_wait_for`      | Wait for element      |
| `browser_session_end`   | End browser session   |

#### SSH Operations

| Tool             | Description            |
| ---------------- | ---------------------- |
| `ssh_execute`    | Execute remote command |
| `ssh_read_file`  | Read remote file       |
| `ssh_write_file` | Write remote file      |
| `ssh_list_files` | List remote directory  |

#### Communication

| Tool            | Description        |
| --------------- | ------------------ |
| `send_email`    | Send email         |
| `slack_message` | Send Slack message |

#### GitHub

| Tool                  | Description         |
| --------------------- | ------------------- |
| `github_create_issue` | Create GitHub issue |
| `github_create_pr`    | Create pull request |
| `github_api`          | Call GitHub API     |

#### Background/Tmux

| Tool          | Description          |
| ------------- | -------------------- |
| `tmux_start`  | Start tmux session   |
| `tmux_send`   | Send command to tmux |
| `tmux_output` | Get tmux output      |
| `tmux_stop`   | Stop tmux session    |
| `tmux_list`   | List tmux sessions   |

#### Multi-Agent

| Tool                  | Description               |
| --------------------- | ------------------------- |
| `spawn_agent`         | Spawn sub-agent           |
| `spawn_agent_team`    | Spawn agent team          |
| `delegate_to_agent`   | Delegate task to agent    |
| `list_agents`         | List available agents     |
| `form_swarm_team`     | Form agent swarm          |
| `run_swarm_consensus` | Run swarm consensus       |
| `negotiate_task`      | Negotiate task assignment |
| `broadcast_to_team`   | Broadcast to team         |

#### Memory

| Tool               | Description           |
| ------------------ | --------------------- |
| `search_memory`    | Search memories       |
| `store_memory`     | Store new memory      |
| `get_memory_stats` | Get memory statistics |

#### Research

| Tool              | Description               |
| ----------------- | ------------------------- |
| `deep_research`   | Multi-step research       |
| `query_consensus` | Get multi-model consensus |
| `query_synthesis` | Run synthesis pipeline    |

#### Image/Vision

| Tool                      | Description             |
| ------------------------- | ----------------------- |
| `generate_image`          | Generate AI image       |
| `analyze_image`           | Analyze image content   |
| `compare_images`          | Compare two images      |
| `extract_text_from_image` | OCR on image            |
| `vision_automate`         | Vision-based automation |

#### Document Processing

| Tool               | Description             |
| ------------------ | ----------------------- |
| `read_pdf`         | Extract PDF content     |
| `analyze_document` | Analyze document        |
| `convert_document` | Convert document format |

#### Audio/Video

| Tool                       | Description         |
| -------------------------- | ------------------- |
| `generate_speech`          | Text to speech      |
| `transcribe_audio`         | Speech to text      |
| `extract_audio_from_video` | Extract audio track |

#### Project Scaffolding

| Tool                       | Description              |
| -------------------------- | ------------------------ |
| `scaffold_project`         | Scaffold web project     |
| `scaffold_regional_map`    | Scaffold map project     |
| `scaffold_business_portal` | Scaffold business portal |
| `generate_schema`          | Generate DB schema       |

#### Events/Automation

| Tool                   | Description          |
| ---------------------- | -------------------- |
| `create_event_trigger` | Create event trigger |
| `list_event_triggers`  | List triggers        |
| `define_macro`         | Define macro         |
| `execute_macro`        | Execute macro        |
| `list_macros`          | List macros          |

#### MCP (Model Context Protocol)

| Tool                 | Description           |
| -------------------- | --------------------- |
| `connect_mcp_server` | Connect to MCP server |
| `list_mcp_servers`   | List MCP servers      |
| `list_mcp_tools`     | List MCP tools        |
| `call_mcp_tool`      | Call MCP tool         |

#### Self-Evolution

| Tool                     | Description           |
| ------------------------ | --------------------- |
| `self_review`            | Self-review code      |
| `self_verify`            | Verify operation      |
| `assess_task_confidence` | Assess confidence     |
| `get_predicted_tasks`    | Get predicted tasks   |
| `get_task_patterns`      | Analyze task patterns |
| `get_user_insights`      | Get user insights     |

#### Desktop Automation

| Tool             | Description            |
| ---------------- | ---------------------- |
| `desktop_action` | Execute desktop action |

#### Database

| Tool             | Description       |
| ---------------- | ----------------- |
| `database_query` | Execute SQL query |

#### Security

| Tool                | Description       |
| ------------------- | ----------------- |
| `security_analysis` | Security analysis |

#### Proactive Monitoring

| Tool                           | Description          |
| ------------------------------ | -------------------- |
| `configure_proactive_monitor`  | Configure monitor    |
| `get_proactive_monitor_status` | Get monitor status   |
| `get_proactive_alerts`         | Get proactive alerts |

---

## Exported Functions & Classes

### Memory Service (`server/services/memory/`)

```typescript
export class MemoryService {
  generateEmbedding(text: string): Promise<number[]>;
  createEpisodicMemory(memory: EpisodicMemory): Promise<number>;
  createSemanticMemory(memory: SemanticMemory): Promise<number>;
  createProceduralMemory(memory: ProceduralMemory): Promise<number>;
  searchEpisodicMemories(query: string, options?): Promise<SearchResult[]>;
  searchSemanticMemories(query: string, options?): Promise<SearchResult[]>;
  searchProceduralMemories(query: string, options?): Promise<SearchResult[]>;
  search(query: MemorySearchQuery): Promise<MemorySearchResult[]>;
  getStats(userId?: number): Promise<MemoryStats>;
}

export function getMemoryService(): MemoryService;
export function createSelfReflectionSystem(
  userId: number
): SelfReflectionSystem;
```

### Vector Store (`server/services/memory/vectorStore.ts`)

```typescript
export async function ensureUserCollection(userId: number): Promise<string>;
export async function upsertVector(
  userId: number,
  id: string,
  vector: number[],
  payload: MemoryPayload
): Promise<void>;
export async function searchVectors(
  userId: number,
  queryVector: number[],
  options?
): Promise<VectorSearchResult[]>;
export async function deleteVector(userId: number, id: string): Promise<void>;
export async function deleteByMemoryId(
  userId: number,
  memoryType: string,
  memoryId: number
): Promise<void>;
export async function getUserCollectionInfo(
  userId: number
): Promise<CollectionInfo>;
export async function deleteUserCollection(userId: number): Promise<void>;
export async function listAllCollections(): Promise<string[]>;
```

### JARVIS Orchestrator (`server/services/jarvis/orchestrator.ts`)

```typescript
export async function runOrchestrator(
  params: OrchestratorParams
): Promise<OrchestratorResult>;
export type ToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};
export type ToolResult = {
  toolCallId: string;
  content: string;
  isError?: boolean;
};
```

### Tool Executor (`server/services/jarvis/tools.ts`)

```typescript
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  context: ToolContext
): Promise<string>;
export function getToolDefinitions(): ToolDefinition[];
export function getToolCategories(): Record<string, string[]>;
```

### Multi-Agent (`server/services/multiAgent/`)

```typescript
export const agentManager: AgentManager;
export const swarmIntelligence: SwarmIntelligence;
export async function initiateNegotiation(
  task: string,
  agents: Agent[]
): Promise<NegotiationResult>;
export async function formAgentTeam(
  task: string,
  size: number
): Promise<FormedTeam>;
export async function runConsensus(
  team: FormedTeam,
  task: string
): Promise<SwarmDecision>;
```

### SSH Management (`server/ssh.ts`)

```typescript
export class SSHConnectionManager {
  connect(host: SSHHost): Promise<SSHConnection>;
  execute(hostId: number, command: string): Promise<CommandResult>;
  readFile(hostId: number, path: string): Promise<string>;
  writeFile(hostId: number, path: string, content: string): Promise<void>;
  listDirectory(hostId: number, path: string): Promise<DirectoryEntry[]>;
}
```

### Database (`server/db.ts`)

```typescript
export async function getDb(): Promise<Database>;
export async function createChat(data: InsertChat): Promise<Chat>;
export async function createMessage(data: InsertMessage): Promise<Message>;
export async function createAgentTask(
  data: InsertAgentTask
): Promise<AgentTask>;
export async function getUserAgentTasks(
  userId: number,
  limit: number
): Promise<AgentTask[]>;
export async function getAgentTask(
  taskId: number,
  userId: number
): Promise<AgentTask | null>;
// ... 50+ more database functions
```

### Redis Event Bus (`server/services/bus/`)

```typescript
export async function connectRedis(): Promise<boolean>;
export async function publishEvent(
  channel: string,
  event: BusEvent
): Promise<void>;
export async function subscribeToChannel(
  channel: string,
  handler: EventHandler
): Promise<void>;
export async function getCachedResult(
  key: string
): Promise<CachedResult | null>;
export async function setCachedResult(
  key: string,
  value: any,
  ttl: number
): Promise<void>;
```

### LLM (`server/_core/llm.ts`)

```typescript
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult>;
export type InvokeParams = {
  model: string;
  messages: Message[];
  tools?: Tool[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
};
```

### Consensus & Synthesis

```typescript
export async function generateConsensus(
  params: ConsensusParams
): Promise<ConsensusResult>;
export async function generateSynthesis(
  params: SynthesisParams
): Promise<SynthesisResult>;
```

---

## File Structure

```
rasputin/
├── client/src/
│   ├── pages/              # React pages
│   │   ├── Chat.tsx        # Main chat interface (2918 lines)
│   │   ├── Agent.tsx       # JARVIS agent interface
│   │   ├── Memory.tsx      # Memory viewer
│   │   ├── Infrastructure.tsx  # Infrastructure monitoring
│   │   ├── MultiAgent.tsx  # Multi-agent orchestration
│   │   ├── Codebase.tsx    # RAG codebase viewer
│   │   └── Events.tsx      # Event/webhook management
│   ├── components/         # Reusable components
│   │   ├── ui/             # shadcn/ui components (50+ files)
│   │   ├── JarvisStreamView.tsx
│   │   ├── VoiceConversation.tsx
│   │   ├── WorkspaceIDE.tsx
│   │   └── ...
│   ├── hooks/              # React hooks
│   │   ├── useJarvisStream.ts
│   │   ├── useWebSocket.ts
│   │   └── ...
│   └── lib/                # Utilities
│       ├── trpc.ts         # tRPC client
│       └── utils.ts        # General utilities
│
├── server/
│   ├── _core/              # Core server utilities
│   │   ├── index.ts        # Server entry point
│   │   ├── llm.ts          # LLM invocation
│   │   ├── auth.ts         # Authentication
│   │   ├── trpc.ts         # tRPC setup
│   │   └── ...
│   ├── routers.ts          # tRPC routers (2850 lines)
│   ├── db.ts               # Database functions
│   ├── ssh.ts              # SSH management
│   └── services/           # Service modules
│       ├── jarvis/         # JARVIS agent
│       │   ├── orchestrator.ts
│       │   ├── tools.ts    # 12,698 lines, 130+ tools
│       │   ├── memoryIntegration.ts
│       │   └── ...
│       ├── memory/         # Memory system
│       │   ├── memoryService.ts
│       │   ├── vectorStore.ts
│       │   └── selfReflection.ts
│       ├── multiAgent/     # Multi-agent
│       │   ├── agentManager.ts
│       │   ├── swarmIntelligence.ts
│       │   └── ...
│       ├── rag/            # RAG indexing
│       ├── events/         # Webhooks & cron
│       ├── infrastructure/ # Monitoring
│       ├── bus/            # Redis event bus
│       ├── localLLM/       # Ollama/vLLM
│       ├── mcp/            # MCP client
│       ├── sandbox/        # Code sandbox
│       ├── selfEvolution/  # Self-evolution
│       ├── vision/         # Vision automation
│       ├── voice/          # TTS/STT
│       ├── webApp/         # Project scaffolding
│       └── workspace/      # Workspace management
│
├── drizzle/
│   ├── schema.ts           # Database schema (2300+ lines)
│   └── relations.ts        # Table relations
│
├── shared/
│   ├── rasputin.ts         # Model definitions
│   ├── types.ts            # Shared types
│   └── const.ts            # Constants
│
└── deploy/
    └── docker-compose.yml  # Docker deployment
```

---

## Service Modules

### JARVIS Agent (`server/services/jarvis/`)

- **orchestrator.ts** - Main agent loop, tool execution
- **tools.ts** - 130+ tool implementations
- **memoryIntegration.ts** - Memory retrieval/storage
- **agentTeams.ts** - Multi-agent teams
- **deepResearch.ts** - Multi-step research
- **errorClassification.ts** - Error handling
- **failureMemory.ts** - Learning from failures
- **intelligentRouter.ts** - Model routing
- **predictiveTask.ts** - Task prediction
- **proactiveMonitor.ts** - Background monitoring
- **strategicPlanner.ts** - Task planning
- **taskClassifier.ts** - Task complexity analysis
- **toolValidation.ts** - Tool validation

### Memory System (`server/services/memory/`)

- **memoryService.ts** - CRUD for memories
- **vectorStore.ts** - Qdrant integration
- **selfReflection.ts** - Self-reflection system
- **warmMemory.ts** - Memory warming

### Multi-Agent (`server/services/multiAgent/`)

- **agentManager.ts** - Agent lifecycle
- **multiAgentOrchestrator.ts** - Orchestration
- **swarmIntelligence.ts** - Swarm consensus

### RAG (`server/services/rag/`)

- **embeddings.ts** - Embedding generation
- **indexer.ts** - Codebase indexing
- **search.ts** - Semantic search

### Events (`server/services/events/`)

- **webhookHandler.ts** - Incoming webhooks
- **eventExecutor.ts** - Event actions
- **cronScheduler.ts** - Cron jobs

### Infrastructure (`server/services/infrastructure/`)

- **collector.ts** - Metrics collection
- **alertEngine.ts** - Alert processing

### Self-Evolution (`server/services/selfEvolution/`)

- **toolGenerator.ts** - Dynamic tool generation
- **agentTypeGenerator.ts** - Agent type generation
- **skillAcquisition.ts** - Skill learning
- **introspection.ts** - Self-analysis

---

## Qdrant Collections

| Collection          | Purpose                             | Vector Count |
| ------------------- | ----------------------------------- | ------------ |
| `user_1_memories`   | User 1 episodic/semantic/procedural | 424          |
| `user_234_memories` | User 234 memories                   | —            |
| `user_225_memories` | User 225 memories                   | —            |
| `midjourney`        | Image embeddings                    | —            |

---

## Key Configuration Files

| File                 | Purpose                  |
| -------------------- | ------------------------ |
| `package.json`       | Dependencies, scripts    |
| `tsconfig.json`      | TypeScript configuration |
| `vite.config.ts`     | Vite build config        |
| `drizzle.config.ts`  | Database config          |
| `eslint.config.js`   | Linting rules            |
| `tailwind.config.ts` | Tailwind CSS config      |

---

## Build & Development Commands

```bash
pnpm dev          # Start dev server with hot reload
pnpm build        # Build client + server
pnpm start        # Start production server
pnpm check        # TypeScript type checking
pnpm lint         # Run ESLint
pnpm test         # Run Vitest tests
pnpm db:push      # Generate and run migrations
```

---

_This audit was generated automatically from the RASPUTIN codebase._
