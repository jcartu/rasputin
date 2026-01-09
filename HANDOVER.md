# RASPUTIN - Complete Handover Document

**Project**: RASPUTIN - Multi-Model Consensus & Synthesis Engine  
**Path**: `/home/ubuntu/rasputin`  
**Latest Checkpoint**: `4bde2048`  
**Date**: January 5, 2026

---

## Executive Summary

RASPUTIN is an advanced AI research and automation platform that combines:

1. **Multi-model consensus** - Query 5+ frontier AI models simultaneously
2. **Deep synthesis** - Multi-stage research pipeline with web search integration
3. **Autonomous agent (JARVIS)** - Execute complex multi-step tasks
4. **System management** - Infrastructure monitoring, multi-agent orchestration, code understanding, event automation

---

## Current Features (Implemented & Working)

### 1. Research Mode

#### Consensus Mode

- Queries 5 frontier AI models in parallel: GPT-5, Claude Sonnet 4.5, Gemini 3 Flash, Grok 4.1, Sonar Pro
- Calculates agreement percentage across models
- Highlights disagreements and unique insights
- Real-time streaming with "flying logs" effect
- Model selection UI to choose which models to include
- Speed tiers: Fast/Normal/Max

#### Synthesis Mode

- 5-stage pipeline:
  1. Web Search - Find relevant sources
  2. Proposer Models - Get initial responses from 4 models
  3. Information Extraction - Extract key facts
  4. Gap Detection - Identify conflicts and missing info
  5. Meta-Synthesis - Generate comprehensive final report
- Produces research reports with citations
- Shows confidence assessments

### 2. JARVIS Agent Mode

#### Core Capabilities

- Claude Opus orchestrator plans and executes multi-step tasks
- 10 built-in tools:
  - `web_search` - Search the web
  - `browse_url` - Read webpage content
  - `execute_python` - Run Python code
  - `execute_javascript` - Run JavaScript code
  - `execute_shell` - Run shell commands
  - `read_file` - Read file contents
  - `write_file` - Write/create files
  - `generate_image` - Create images with AI
  - `calculator` - Perform calculations
  - `api_request` - Make HTTP requests

#### Task Management

- Real-time task viewer with expandable tool call details
- Status badges (Running, Done, Error)
- Task persistence in database
- Rate limiting per user

### 3. Voice Features

- Push-to-talk microphone button
- Whisper transcription
- Wake word detection ("Hey JARVIS")
- ElevenLabs streaming TTS

### 4. System Pages

#### Infrastructure (`/infrastructure`)

- SSH host management
- Health metric collection (CPU, memory, disk, network)
- Alert rules and incident tracking
- Self-healing remediation (planned)

#### Multi-Agent (`/multi-agent`)

- Agent creation and management
- 8 agent types: orchestrator, coordinator, specialist, worker, code, research, sysadmin, data, custom
- Task Runner UI with quick templates
- Real-time task execution results

#### Codebase (`/codebase`)

- Project indexing with semantic chunking
- Code search with embeddings
- Symbol extraction and relationships

#### Events (`/events`)

- Webhook endpoint creation
- Webhook testing UI with sample payloads
- Cron trigger management (UI exists, backend ready)

---

## Architecture

### Tech Stack

- **Frontend**: React 19 + Tailwind 4 + Vite
- **Backend**: Express 4 + tRPC 11
- **Database**: MySQL/TiDB (Drizzle ORM)
- **Auth**: Manus OAuth
- **AI**: OpenRouter (multi-model), ElevenLabs (TTS), Whisper (STT)

### Key Files

```
client/
  src/
    pages/
      Chat.tsx          # Main research interface
      Agent.tsx         # JARVIS agent interface
      Infrastructure.tsx
      MultiAgent.tsx
      Codebase.tsx
      Events.tsx
    components/
      TaskViewer.tsx    # Agent task progress display
      ToolOutputPreview.tsx # Tool result rendering

server/
  routers.ts            # All tRPC procedures
  services/
    orchestrator/       # JARVIS agent orchestration
    multiAgent/         # Multi-agent system
    infrastructure/     # SSH and monitoring
    rag/                # Code indexing
    events/             # Webhooks and cron
    memory/             # Memory system (partial)
    webApp/             # Web app scaffolding (partial)

drizzle/
  schema.ts             # Database schema (2300+ lines)
```

### Database Tables (Key)

- `users` - User accounts
- `chats`, `messages` - Chat history
- `agentTasks`, `agentToolCalls` - JARVIS task tracking
- `agents`, `interAgentMessages`, `agentSubtasks` - Multi-agent system
- `infrastructureHosts`, `healthMetrics`, `alertRules`, `incidents` - Infrastructure
- `codebaseProjects`, `codeChunks`, `codeSymbols` - Code understanding
- `webhookEndpoints`, `eventTriggers`, `eventCronJobs` - Events
- `episodicMemories`, `agentSkills`, `learningEvents` - Memory system
- `webAppProjects`, `appIterations`, `codeGenerationHistory` - Web app dev (new)

---

## Recent Bug Fixes (This Session)

1. **task_complete stuck on "Running"** - Fixed in TaskViewer.tsx by adding special handling for task_complete tool
2. **Images not displaying in tool output** - Fixed in ToolOutputPreview.tsx with enhanced URL extraction
3. **Multi-Agent database insert error** - Fixed in agentManager.ts using raw SQL to bypass Drizzle ORM issue with null values

---

## In-Progress Implementation

### Self-Improvement System (Partially Implemented)

Files created:

- `/server/services/memory/memorySystem.ts` - Long-term memory with vector embeddings
- `/server/services/memory/selfReflection.ts` - Post-task analysis and learning

Features:

- Episodic memory storage
- Skill learning and tracking
- Learning event recording
- Memory search by semantic similarity
- Memory consolidation (compress old memories)
- Self-reflection after task completion

### Web App Development System (Partially Implemented)

Files created:

- `/server/services/webApp/scaffolder.ts` - Project scaffolding for React, Next.js, Vue, Svelte, Express, FastAPI, Rails

Database tables created:

- `webAppProjects` - Track AI-generated web apps
- `appIterations` - Track changes and deployments
- `codeGenerationHistory` - Track code generation for analysis

---

## What Still Needs Implementation

### Self-Improvement (Remaining)

- [ ] Integration with JARVIS orchestrator (call reflection after each task)
- [ ] UI to view memories and skills
- [ ] Prompt optimization based on learnings
- [ ] Tool creation capability
- [ ] Performance tracking dashboard

### Web App Development (Remaining)

- [ ] Git integration tools (clone, commit, push)
- [ ] Deployment automation (Vercel, Railway, Docker)
- [ ] Browser preview with dev server management
- [ ] Iterative refinement UI
- [ ] Full project management UI
- [ ] Connect scaffolder to JARVIS tools

### Other Planned Features

- [ ] SSH credential storage UI
- [ ] Agent task history view
- [ ] Cron trigger creation UI
- [ ] Real-time notifications
- [ ] Cross-device sync

---

## Known Issues

1. **TypeScript errors in ssh.ts** - Missing schema exports (sshPermissions, sshAuditLog, pendingApprovals). These are stale LSP errors - `pnpm check` passes.

2. **Database migration issues** - Some tables already exist, causing `pnpm db:push` to fail. New tables were created manually via SQL.

---

## How to Continue Development

### Start the Dev Server

```bash
cd /home/ubuntu/rasputin
pnpm dev
```

### Run Tests

```bash
pnpm test
```

### Check TypeScript

```bash
pnpm check
```

### Push Database Changes

```bash
pnpm db:push
```

### Key URLs

- Dev Server: https://3000-ibmh7cqsp8ovkv7ttt8v4-6463ec18.us2.manus.computer
- Chat: `/chat`
- Agent: `/agent`
- System Pages: `/infrastructure`, `/multi-agent`, `/codebase`, `/events`

---

## Priority Next Steps

1. **Integrate self-reflection into JARVIS** - Call `reflectOnTask()` after each task completion in orchestrator
2. **Add Git tools to JARVIS** - `git_clone`, `git_commit`, `git_push` tools
3. **Add deployment tools** - `deploy_vercel`, `deploy_railway` tools
4. **Create Web App Builder UI** - New page at `/builder` to create and manage AI-generated apps
5. **Connect memory to task planning** - Use `getRelevantExperiences()` before planning tasks

---

## Environment Variables (Auto-Injected)

- `ANTHROPIC_API_KEY` - Claude API
- `OPENROUTER_API_KEY` - Multi-model routing
- `GEMINI_API_KEY` - Google Gemini
- `XAI_API_KEY` - Grok
- `SONAR_API_KEY` - Perplexity
- `ELEVENLABS_API_KEY` - Text-to-speech
- `DATABASE_URL` - MySQL/TiDB connection
- `JWT_SECRET` - Session signing

---

## Testing Checklist

Before deploying, verify:

- [ ] Consensus mode works with all 5 models
- [ ] Synthesis mode completes all 5 stages
- [ ] JARVIS can execute web search tasks
- [ ] JARVIS can execute Python code
- [ ] JARVIS can generate images
- [ ] task_complete shows "Done" status
- [ ] System dropdown shows all 4 pages
- [ ] Multi-Agent task runner works
- [ ] Webhook testing works
- [ ] All 99 tests pass (`pnpm test`)

---

## Contact & Resources

- **Project**: RASPUTIN MCP (R8mpDqvd8VJxMaa3LhGSeV)
- **Todo File**: `/home/ubuntu/rasputin/todo.md` (comprehensive task tracking)
- **Latest Checkpoint**: `4bde2048`

---

_Generated: January 5, 2026_
