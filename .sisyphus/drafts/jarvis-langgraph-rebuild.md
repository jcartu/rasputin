# Draft: JARVIS LangGraph Rebuild with Manus Frontend

## Requirements (confirmed)

- Rebuild JARVIS on LangGraph.js (TypeScript, not Python)
- Match Manus frontend UI exactly
- Preserve all 80+ existing JARVIS tools
- Use existing tRPC/Express backend integration
- Real-time WebSocket events via Socket.io
- Include multi-agent swarm capabilities from day one
- Coexist alongside existing JARVIS at /server/services/jarvis-langgraph/

## Technical Decisions

- **Architecture**: Option A - Pure TypeScript LangGraph (not Python bridge)
- **Framework**: @langchain/langgraph StateGraph pattern
- **Real-time**: Socket.io WebSocket for event streaming
- **State persistence**: Memory for dev, Database for production (MemorySaver + custom DB checkpointer)
- **LLM Providers**: Multiple providers (Anthropic, OpenRouter, Cerebras, Gemini, Grok)
- **Coexistence**: New implementation at /server/services/jarvis-langgraph/, existing JARVIS untouched
- **Frontend**: Update existing Manus.tsx to connect to new backend
- **Test Strategy**: Tests after implementation

## Research Findings

### Manus.tsx WebSocket Events (from source):

- `manus:thinking` - Streaming thought content
- `manus:tool_start` - Tool execution started (toolName, input)
- `manus:tool_end` - Tool execution ended (output, isError)
- `manus:screenshot` - Browser screenshot (base64, url)
- `manus:terminal` - Terminal output (output, isError)
- `manus:file` - File operation (operation, path)
- `manus:iteration` - Iteration progress (iteration, maxIterations)
- `manus:complete` - Task complete (success, summary)
- `manus:error` - Task error (error message)
- Input: `manus:start` - Start task (task, sessionId, userId, maxIterations)
- Input: `manus:cancel` - Cancel task (sessionId)

### OpenManus LangGraph Architecture (from manus_graph.py):

- StateGraph with nodes: router, chat_response, planner, executor, tools, check_completion
- Conditional edges: router → chat/agent, executor → tools/check
- Task state with TypedDict: messages, tasks, current_task_id, browser, files, workspace_path, step_count, max_steps, is_complete
- Event emission via on_event callback pattern
- Checkpointing with MemorySaver

### Existing JARVIS Tools Interface (from tools.ts):

- Tools return `{ success: boolean, output: string, fallbackUsed?: string, attempts?: number }`
- Uses withRetryAndFallback pattern for resilience
- 80+ tools including: web*search, browse_url, http_request, execute_python, execute_javascript, run_shell, read_file, write_file, git*_, ssh\__, database_query, generate_image, screenshot, playwright_browse, spawn_agent_team, delegate_to_agent, query_consensus, query_synthesis, search_memory, store_memory

### Sisyphus Protocol Blueprint Architecture:

- LangGraph nodes: supervisor, coder, executor, researcher (multi-agent)
- Conditional routing based on next_step
- Oracle Engine for proactive task initiation
- Qdrant vectorization for context lake

## Scope Boundaries

- INCLUDE: Core LangGraph orchestration, all existing tools, Manus UI updates, multi-agent swarm, database checkpointing
- EXCLUDE: Python bridge, new UI components (use existing Manus.tsx), Moltbot/desktop daemon (defer), Oracle proactive engine (defer)

## Guardrails (from Metis analysis)

- DO NOT break existing JARVIS functionality - it must continue working
- DO NOT duplicate tool implementations - wrap existing tools
- DO NOT over-engineer - start with core graph, add complexity incrementally
- DO NOT skip event emission - every state change must emit WebSocket events
- DO NOT forget checkpointing - must survive restarts
- PRESERVE iteration limits (MAX_ITERATIONS = 15)
- PRESERVE error classification and retry logic patterns
