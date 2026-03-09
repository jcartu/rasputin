# ALFIE → Manus-Level Upgrade with Multi-Tenant Architecture

## TL;DR

> **Quick Summary**: Transform ALFIE from a single-user chat app into a multi-tenant AI agent platform matching Manus AI features. Includes autonomous agent loop, browser automation, code sandbox, and 5 platform integrations.
> 
> **Deliverables**:
> - Multi-tenant auth with PostgreSQL user model and RBAC enforcement
> - BullMQ-powered agent execution with ReAct loop
> - browser_use Python microservice for browser automation
> - Docker sandbox for code execution
> - 5 MCP integrations (GitHub, Google Drive, Notion, Slack, Gmail)
> - Command palette, scheduled tasks, share/replay, presentations, data viz, image gen
> 
> **Estimated Effort**: XL (8-12 weeks)
> **Parallel Execution**: YES - 3-4 waves per phase after Phase 0
> **Critical Path**: Phase 0 → Phase 1 → Phase 2 → Phase 3 → (Phase 4 || Phase 5)

---

## Context

### Original Request
Upgrade ALFIE to match and exceed Manus AI features with MULTI-TENANT architecture. Design decisions finalized: BullMQ for agent jobs, browser_use Python library, Docker sandbox, 5 integrations.

### Interview Summary
**Key Discussions**:
- **browser_use Integration**: Python microservice via HTTP - best isolation for Python library in Node.js app
- **Auth Migration**: Incremental approach - add user_id columns first, gradually enforce middleware
- **Service Strategy**: REBUILD FROM SCRATCH - treat existing 56-agent services as reference only
- **Test Strategy**: TDD for core agent logic - tests first for agent state machine, tool execution
- **Agent Progress UI**: Main chat area with collapsible thinking/progress sections
- **Docker**: Full VPS deployment, Docker available
- **Phase 5**: Full implementation of all polish features

**Research Findings**:
- Auth infrastructure (jwtService, authMiddleware, rbacService) is COMPLETE but NOT enforced
- User model uses in-memory Map (429 lines) - needs PostgreSQL migration
- chatHistory.js already uses PostgreSQL via `pg` package - follow same patterns
- OpenManus ReAct loop: `think()` → `act()` cycle in ToolCallAgent
- RightPanel has 12 tabs - use existing tabs or main area only

### Metis Review
**Identified Gaps** (addressed in plan):
- Migration rollback strategy: Added backup/restore steps in Phase 0
- Agent execution limits: Set max_iterations=30, timeout=30min, memory=512MB
- Cross-tenant isolation: RLS policies, user_id from JWT only
- WebSocket disconnect handling: Queue messages for reconnect
- Docker sandbox security: Non-root, network isolation, resource limits

---

## Work Objectives

### Core Objective
Transform ALFIE into a production-ready multi-tenant AI agent platform with autonomous task execution, browser automation, code sandbox, and platform integrations.

### Concrete Deliverables
- PostgreSQL-backed user model with RBAC
- Auth enforcement on all routes and WebSocket
- BullMQ job queue with Redis
- Agent state machine (IDLE→THINKING→ACTING→OBSERVING→COMPLETED)
- Tool registry with 8+ tools
- browser_use Python microservice
- Docker code execution sandbox
- 5 MCP integrations (GitHub, Drive, Notion, Slack, Gmail)
- Command palette (⌘K)
- Scheduled task system
- Share/replay functionality
- Presentation generator
- Data visualization
- ComfyUI image generation
- Onboarding experience

### Definition of Done
- [ ] `curl -X GET /api/agent/status` returns agent state without auth → 401
- [ ] User A cannot access User B's conversations or agent tasks
- [ ] Agent completes "search Google and summarize results" task end-to-end
- [ ] Docker sandbox executes Python code safely within resource limits
- [ ] All 5 integrations OAuth flow works and can perform basic operations
- [ ] All 151 existing conversations preserved and accessible
- [ ] E2E tests pass

### Must Have
- Multi-tenant data isolation (user_id on all tables, RLS policies)
- Agent execution with progress streaming
- Browser automation capability
- Code sandbox with security isolation
- At least basic integration for each platform

### Must NOT Have (Guardrails)
- **Migration**: Must NOT delete in-memory userMap until PostgreSQL verified 24hrs
- **Agent**: Must NOT allow recursive agent spawning (agent spawning agents)
- **Agent**: Must NOT execute without active WebSocket (prevents orphaned tasks)
- **Docker**: Must NOT mount host filesystem under any circumstance
- **Docker**: Must NOT allow docker socket access (escape vector)
- **Multi-tenant**: Must NOT pass user_id from client (derive from JWT only)
- **Multi-tenant**: Must NOT allow SQL with user_id in query string params
- **Integrations**: Must NOT log raw tokens, credentials, or API keys
- **Zustand**: Must NOT use object selectors `(s) => ({ a: s.a, b: s.b })`
- **RightPanel**: Must NOT add new tabs beyond existing 12

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO - needs setup
- **User wants tests**: TDD for core agent logic
- **Framework**: Vitest (Node.js), Playwright (E2E)

### TDD Enabled for Phases 1-3

Each TODO follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

**Test Setup Task** (in Phase 1):
```bash
cd alfie-backend && npm install -D vitest @vitest/coverage-v8
```

---

## Execution Strategy

### Parallel Execution Waves

```
PHASE 0 (BLOCKING - Sequential):
└── All Phase 0 tasks must complete before Phase 1

PHASE 1 Wave 1:
├── Task 1.1: Test infrastructure setup
├── Task 1.2: BullMQ setup
└── Task 1.3: Agent DB schema

PHASE 1 Wave 2 (after Wave 1):
├── Task 1.4: Agent state machine
├── Task 1.5: Job workers
└── Task 1.6: WebSocket progress relay

PHASE 2 Wave 1:
├── Task 2.1: Tool base class
├── Task 2.2: Tool registry
└── Task 2.3: Agent prompts

PHASE 2 Wave 2:
├── Task 2.4: ReAct executor
├── Task 2.5: Agent routes
└── Task 2.6: Agent UI components

PHASE 3 (Parallel Tools):
├── Task 3.1: Docker sandbox
├── Task 3.2: browser_use microservice
├── Task 3.3: Browser tool (Node client)
├── Task 3.4: File operations tool
├── Task 3.5: Web search tool
└── Tasks 3.6-3.10: MCP integrations (5 parallel)

PHASE 4 + 5 (Can overlap after Phase 3):
├── Phase 4: Platform features (command palette, scheduled tasks, skills, projects)
└── Phase 5: Polish (share/replay, presentations, data viz, image gen, onboarding)
```

---

## PHASE 0: Multi-Tenant Foundation

> **BLOCKING PHASE**: Nothing else starts until Phase 0 is verified stable (24hr soak minimum).

### TODO 0.1: Backup Existing Data

**What to do**:
- Create full PostgreSQL backup of conversations and messages tables
- Export backup to `/home/josh/rasputin/alfie/backups/pre-migration-{timestamp}.sql`
- Verify backup is restorable

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: []

**References**:
- `alfie-backend/src/services/chatHistory.js:7-36` - PostgreSQL connection config

**Acceptance Criteria**:
```bash
BACKUP_FILE="/home/josh/rasputin/alfie/backups/pre-migration-$(date +%Y%m%d-%H%M%S).sql"
mkdir -p /home/josh/rasputin/alfie/backups
PGPASSWORD=jarvis_vault_2026_secure pg_dump -h localhost -U jarvis -d jarvis_vault \
  -t conversations -t messages > "$BACKUP_FILE"
ls -la "$BACKUP_FILE"
# Assert: File exists and size > 0
```

**Commit**: `chore(db): create pre-migration backup script`

---

### TODO 0.2: Create Users Table in PostgreSQL

**What to do**:
- Create migration for users table with: id (UUID), email, username, password_hash, roles (JSONB), permissions (JSONB), is_active, is_verified, created_at, updated_at, last_login_at, metadata (JSONB), oauth (JSONB)
- Create indexes on email, username
- Add updated_at trigger

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: []

**References**:
- `alfie-backend/src/db/schema.sql:9-23` - Existing schema pattern
- `alfie-backend/src/models/User.js:36-49` - Full user schema to match

**Acceptance Criteria**:
```bash
PGPASSWORD=jarvis_vault_2026_secure psql -h localhost -U jarvis -d jarvis_vault -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'users' ORDER BY ordinal_position;"
# Assert: Returns all required columns
```

**Commit**: `feat(db): add users table migration with RBAC columns`

---

### TODO 0.3: Create PostgreSQL User Service

**What to do**:
- Create `alfie-backend/src/services/userService.js` using pg Pool
- Implement all methods from models/User.js with PostgreSQL
- Use same function signatures for compatibility

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []

**References**:
- `alfie-backend/src/services/chatHistory.js:23-36` - PostgreSQL Pool pattern
- `alfie-backend/src/models/User.js:74-131` - createUser to port

**Acceptance Criteria**:
```bash
# Test creates user in PostgreSQL, finds by email, deletes
cd /home/josh/rasputin/alfie/alfie-backend && node -e "
import { createUser, findByEmail, deleteUser } from './src/services/userService.js';
const user = await createUser({email:'test@ex.com',username:'test',password:'Pass123!',roles:['user']});
console.log('Created:', user.id);
const found = await findByEmail('test@ex.com');
console.log('Found:', found?.email);
await deleteUser(user.id);
"
```

**Commit**: `feat(auth): implement PostgreSQL-backed user service`

---

### TODO 0.4: Add user_id Column to Conversations Table

**What to do**:
- Add user_id column to conversations table with foreign key to users
- Create index on user_id
- Update chatHistory.js to include user_id in all queries

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: []

**References**:
- `alfie-backend/src/services/chatHistory.js:62-88` - listConversations to modify

**Acceptance Criteria**:
```bash
PGPASSWORD=jarvis_vault_2026_secure psql -h localhost -U jarvis -d jarvis_vault -c "
SELECT column_name FROM information_schema.columns WHERE table_name='conversations' AND column_name='user_id';"
# Assert: Returns user_id
```

**Commit**: `feat(db): add user_id to conversations for multi-tenancy`

---

### TODO 0.5: Update Auth Routes to Use PostgreSQL User Service

**What to do**:
- Update auth.js, authMiddleware.js, jwtService.js to import userService instead of User model
- Test all auth endpoints work with PostgreSQL backend

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []

**References**:
- `alfie-backend/src/routes/auth.js:2-8` - Current imports
- `alfie-backend/src/middleware/authMiddleware.js:5-6` - User import

**Acceptance Criteria**:
```bash
# Register, login, and access /me endpoint
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"pg-test@ex.com","username":"pgtest","password":"TestPass123!"}' | jq '.user.id'
# Assert: Returns UUID
```

**Commit**: `refactor(auth): switch auth routes to PostgreSQL user service`

---

### TODO 0.6: Enforce Auth Middleware on All Routes

**What to do**:
- Apply `authenticate()` middleware to all API routes in index.js
- Create route groups: public (health, auth) vs protected (everything else)
- Add user_id filtering to conversation queries

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []

**References**:
- `alfie-backend/src/index.js:342-398` - Route registration
- `alfie-backend/src/middleware/authMiddleware.js:28-143` - authenticate()

**Acceptance Criteria**:
```bash
# Protected route without auth returns 401
curl -s http://localhost:3001/api/conversations | jq '.error'
# Assert: "Unauthorized"
```

**Commit**: `feat(auth): enforce authentication middleware on all protected routes`

---

### TODO 0.7: Add WebSocket Authentication

**What to do**:
- Require JWT token in WebSocket connection: `ws://host/ws?token=JWT`
- Validate using authenticateWs from authMiddleware
- Reject connections without valid token

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: []

**References**:
- `alfie-backend/src/services/websocket.js:28-35` - Current token check
- `alfie-backend/src/middleware/authMiddleware.js:249-281` - authenticateWs

**Acceptance Criteria**:
```bash
# WebSocket without token should fail
timeout 2 wscat -c "ws://localhost:3001/ws" 2>&1 || echo "Rejected"
# Assert: Connection rejected
```

**Commit**: `feat(auth): enforce JWT authentication on WebSocket connections`

---

### TODO 0.8: Create Login/Register UI

**What to do**:
- Create login/register pages in alfie-ui
- Create authStore.ts Zustand store for auth state
- Add AuthGuard component to protect routes
- Redirect unauthenticated users to login

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: [`frontend-ui-ux`]

**References**:
- `alfie-ui/src/lib/store.ts:1-10` - Zustand store pattern
- `alfie-ui/src/lib/websocket.ts` - WebSocket to update with token

**Acceptance Criteria**:
```
# Via Playwright:
1. Navigate to http://localhost:3000/login
2. Fill email, password fields
3. Submit login
4. Assert: Redirected to main page
5. Assert: Token persisted (survives refresh)
```

**Commit**: `feat(ui): add login/register pages with auth store`

---

### TODO 0.9: Phase 0 Validation Soak (24hr)

**What to do**:
- Monitor for 24 hours after Phase 0 deployment
- Verify all 151 conversations accessible
- Check for memory leaks, connection pool issues

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: []

**Acceptance Criteria**:
```bash
# Verify conversation count unchanged
PGPASSWORD=jarvis_vault_2026_secure psql -h localhost -U jarvis -d jarvis_vault -c "SELECT COUNT(*) FROM conversations;"
# Assert: Same as pre-migration
```

**Commit**: NO (monitoring task)

---

## PHASE 1: Agent Foundation

> **Prerequisite**: Phase 0 complete with 24hr soak passed.

### TODO 1.1: Setup Test Infrastructure

**What to do**:
- Install vitest in alfie-backend
- Create vitest.config.js and test directory
- Add test scripts to package.json

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: []

**Acceptance Criteria**:
```bash
cd /home/josh/rasputin/alfie/alfie-backend && npm test -- --run
# Assert: Tests run successfully
```

**Commit**: `chore(test): setup vitest with coverage for backend`

---

### TODO 1.2: Install and Configure BullMQ

**What to do**:
- Install bullmq and ioredis
- Create queueService.js with agent-tasks queue
- Add queue health check endpoint

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: []

**References**:
- BullMQ docs: https://docs.bullmq.io/

**Acceptance Criteria**:
```bash
curl -s http://localhost:3001/api/health | jq '.queue'
# Assert: {"status":"connected"}
```

**Commit**: `feat(agent): setup BullMQ queue infrastructure`

---

### TODO 1.3: Create Agent Database Schema

**What to do**:
- Create agent_tasks table: id, user_id, status, task_type, input, output, error, progress, current_step, max_steps, timestamps
- Create agent_steps table: id, task_id, step_number, type, tool_name, tool_input, tool_output, tokens_used, duration_ms
- Create status enum: pending, running, thinking, acting, observing, completed, failed, cancelled

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: []

**Acceptance Criteria**:
```bash
PGPASSWORD=jarvis_vault_2026_secure psql -h localhost -U jarvis -d jarvis_vault -c "
SELECT table_name FROM information_schema.tables WHERE table_name IN ('agent_tasks','agent_steps');"
# Assert: Returns both tables
```

**Commit**: `feat(db): create agent_tasks and agent_steps tables`

---

### TODO 1.4: Implement Agent State Machine

**What to do**:
- Create agentStateMachine.js with state transitions
- Add guards: max_iterations (30), timeout (30 min), cancellation
- Persist state changes to DB
- Emit events for transitions

**Recommended Agent Profile**:
- **Category**: `ultrabrain`
- **Skills**: []

**References**:
- OpenManus `app/agent/toolcall.py:39-129` - think() logic

**Acceptance Criteria**:
```bash
npm test -- --run src/__tests__/agentStateMachine.test.js
# Assert: All state transition tests pass
```

**Commit**: `feat(agent): implement agent state machine with guards`

---

### TODO 1.5: Create BullMQ Worker Process

**What to do**:
- Create agentWorker.js as separate process
- Integrate with agentStateMachine
- Add job.updateProgress() for real-time updates
- Handle timeouts and graceful shutdown

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []

**References**:
- BullMQ Worker docs: https://docs.bullmq.io/guide/workers

**Acceptance Criteria**:
```bash
# Start worker, queue job, verify completion
node src/workers/agentWorker.js &
# Queue test job and verify it completes
```

**Commit**: `feat(agent): create BullMQ worker for agent task execution`

---

### TODO 1.6: Implement WebSocket Progress Relay

**What to do**:
- Add BullMQ job event listeners in websocket.js
- Relay progress to connected clients by user_id
- Messages: agent:started, agent:thinking, agent:acting, agent:progress, agent:completed, agent:failed

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []

**References**:
- `alfie-backend/src/services/websocket.js:107-195` - Message handling

**Acceptance Criteria**:
```bash
# Connect WebSocket and verify agent progress messages received
```

**Commit**: `feat(agent): add WebSocket relay for agent progress events`

---

## PHASE 2: Core Agent

### TODO 2.1: Create Tool Base Class

**What to do**:
- Create BaseTool.js with: name, description, parameters (JSON Schema), execute(input, context)
- Add input validation, timeout handling, result truncation

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: []

**References**:
- OpenManus `app/tool/base.py` - Tool base class

**Commit**: `feat(agent): create BaseTool class with validation and timeout`

---

### TODO 2.2: Implement Tool Registry

**What to do**:
- Create ToolRegistry.js with: registerTool(), getTool(), listTools(), getToolsForLLM()
- Support tool categories (built-in, user, mcp)

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: []

**Commit**: `feat(agent): implement tool registry with LLM format export`

---

### TODO 2.3: Create Agent System Prompts

**What to do**:
- Create systemPrompt.js and nextStepPrompt.js
- Design ReAct format: thought, action, observation
- Include tool usage instructions and safety guardrails

**Recommended Agent Profile**:
- **Category**: `writing`
- **Skills**: []

**References**:
- OpenManus `app/prompt/manus.py` - Prompt patterns

**Commit**: `feat(agent): create ReAct system and next-step prompts`

---

### TODO 2.4: Implement ReAct Executor

**What to do**:
- Create ReActExecutor.js with think() → act() → observe() loop
- Use Claude API with tool_use for function calling
- Track iterations, enforce limits (max 30)
- Emit events for each step

**Recommended Agent Profile**:
- **Category**: `ultrabrain`
- **Skills**: []

**References**:
- OpenManus `app/agent/toolcall.py:39-164` - ReAct implementation
- `alfie-backend/src/services/llmService.js` - Claude API

**Commit**: `feat(agent): implement ReAct executor with think-act-observe loop`

---

### TODO 2.5: Create Agent API Routes

**What to do**:
- Create routes/agent.js with: POST /run, GET /:id, POST /:id/cancel, GET /history
- Integrate with BullMQ, add rate limiting (10 concurrent/user)

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: []

**Acceptance Criteria**:
```bash
curl -s -X POST http://localhost:3001/api/agent/run \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"task":"What is 2+2?"}' | jq '.taskId'
# Assert: Returns UUID
```

**Commit**: `feat(agent): create agent API routes for task management`

---

### TODO 2.6: Create Agent UI Components

**What to do**:
- Create agentStore.ts Zustand store
- Create AgentThinking.tsx, AgentToolCall.tsx, AgentProgress.tsx
- Update MessageBubble to render agent steps inline
- Add "Run as Agent" button to chat input

**Recommended Agent Profile**:
- **Category**: `visual-engineering`
- **Skills**: [`frontend-ui-ux`]

**References**:
- `alfie-ui/src/lib/store.ts:88-127` - Message interfaces
- `alfie-ui/src/components/chat/MessageBubble.tsx` - Message rendering

**Commit**: `feat(ui): create agent progress and tool call display components`

---

## PHASE 3: Agent Tools

> Tools can be developed in parallel.

### TODO 3.1: Docker Code Sandbox Tool

**What to do**:
- Create CodeSandboxTool.js
- Build Docker image with Python, Node.js
- Set limits: 512MB RAM, 1 CPU, 60s timeout, no network
- Capture stdout/stderr, cleanup orphaned containers

**Guardrails**:
- Must NOT mount host filesystem
- Must NOT allow docker socket access
- Must run as non-root

**Recommended Agent Profile**:
- **Category**: `deep`
- **Skills**: []

**Commit**: `feat(agent): implement Docker code sandbox with security isolation`

---

### TODO 3.2: browser_use Python Microservice

**What to do**:
- Create browser-service/ Python directory with FastAPI
- Endpoints: /navigate, /click, /type, /screenshot, /extract
- Add JWT auth, connection pooling, Dockerfile

**Recommended Agent Profile**:
- **Category**: `deep`
- **Skills**: []

**References**:
- OpenManus `app/tool/browser_use_tool.py`
- browser_use: https://github.com/browser-use/browser-use

**Commit**: `feat(agent): create browser_use Python microservice`

---

### TODO 3.3: Browser Automation Tool (Node.js Client)

**What to do**:
- Create BrowserTool.js as client for browser_use microservice
- Actions: navigate, click, type, screenshot, extract, scroll, wait
- Handle CAPTCHA, 2FA, blocked scenarios

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []

**Commit**: `feat(agent): implement browser automation tool client`

---

### TODO 3.4: File Operations Tool

**What to do**:
- Create FileOperationsTool.js
- Operations: read_file, write_file, list_directory, search_files
- Restrict to user workspace, add path traversal protection

**Recommended Agent Profile**:
- **Category**: `unspecified-low`
- **Skills**: []

**Commit**: `feat(agent): implement file operations tool with workspace isolation`

---

### TODO 3.5: Web Search Tool

**What to do**:
- Create WebSearchTool.js using Perplexity
- Return query, results, citations
- Add caching (5 min TTL), rate limiting

**Recommended Agent Profile**:
- **Category**: `quick`
- **Skills**: []

**References**:
- `alfie-backend/src/services/perplexityService.js`

**Commit**: `feat(agent): implement web search tool with Perplexity`

---

### TODO 3.6-3.10: MCP Integrations (GitHub, Drive, Notion, Slack, Gmail)

**What to do** (for each):
- Rebuild tool from scratch (GitHubTool.js, GoogleDriveTool.js, NotionTool.js, SlackTool.js, GmailTool.js)
- Use existing integration OAuth flows for token management
- Implement core operations per platform

**Recommended Agent Profile**:
- **Category**: `unspecified-high`
- **Skills**: []

**Commits**: One per integration

---

## PHASE 4: Platform Features

### TODO 4.1: Command Palette (⌘K)
- Create CommandPalette.tsx with cmdk library
- Commands: new chat, search, run agent, settings, switch model, toggle theme

**Commit**: `feat(ui): implement command palette with cmdk`

### TODO 4.2: Scheduled Tasks System
- Create schedulerService.js with cron scheduling
- DB table: scheduled_tasks
- Limits: max 10 per user, min 5 min interval

**Commit**: `feat(agent): implement scheduled tasks with cron expressions`

### TODO 4.3: Skills/Reusable Workflows
- Create skillsService.js
- DB table: skills
- Allow saving agent sequences as reusable skills

**Commit**: `feat(agent): implement skills system for reusable workflows`

### TODO 4.4: Projects/Workspaces
- Create projectsService.js
- Projects group conversations, files, agent tasks

**Commit**: `feat: implement projects/workspaces for organizing work`

---

## PHASE 5: Polish

### TODO 5.1: Share & Replay
- Enhance shareService.js for conversations and agent executions
- Replay view with step-by-step timestamps
- Privacy controls: public, link-only, private

**Commit**: `feat: enhance share system with replay and privacy controls`

### TODO 5.2: Presentation Generator
- Create presentationService.js with reveal.js
- Agent tool: generate_presentation
- Export: HTML, PDF, PPTX

**Commit**: `feat: implement presentation generator with export`

### TODO 5.3: Data Visualization
- Create DataVizTool.js
- Chart types: bar, line, pie, scatter, heatmap
- Use ECharts, return as PNG or HTML

**Commit**: `feat(agent): implement data visualization tool`

### TODO 5.4: ComfyUI Image Generation
- Create ImageGenTool.js
- Connect to local ComfyUI
- Agent tool: generate_image(prompt, style, size)

**Commit**: `feat(agent): implement ComfyUI image generation tool`

### TODO 5.5: Onboarding Experience
- Create OnboardingWizard.tsx
- Steps: welcome, integrations, first task, explore
- Interactive tutorial with react-joyride

**Commit**: `feat(ui): implement interactive onboarding wizard`

---

## Success Criteria

### Final Checklist
- [ ] Auth enforced: `curl /api/conversations` without token → 401
- [ ] Multi-tenant isolation: User A cannot see User B data
- [ ] Agent executes: "search Google and summarize" completes end-to-end
- [ ] Sandbox security: Cannot access host network or filesystem
- [ ] All 5 integrations OAuth flows work
- [ ] All 151 existing conversations preserved
- [ ] E2E tests pass
