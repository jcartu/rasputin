# JARVIS LangGraph Rebuild with Manus Frontend

## TL;DR

> **Quick Summary**: Rebuild JARVIS orchestration layer on LangGraph.js StateGraph, wrapping existing 80+ tools while emitting real-time WebSocket events to the existing Manus.tsx frontend. Include multi-agent swarm capabilities from day one.
>
> **Deliverables**:
>
> - LangGraph-based orchestrator at `/server/services/jarvis-langgraph/`
> - Updated Manus.tsx frontend connecting to new backend
> - Database-backed checkpointing for session persistence
> - Multi-agent routing (supervisor → coder/executor/researcher)
> - tRPC procedures for new JARVIS API
>
> **Estimated Effort**: Large (~40 hours)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 2 → Task 6 → Task 7 → Task 11 → Task 14

---

## Context

### Original Request

Build JARVIS properly from scratch on LangGraph, making the frontend look and feel exactly like the Manus interface. Use the Sisyphus Protocol blueprint patterns and OpenManus reference implementation.

### Interview Summary

**Key Discussions**:

- **Coexistence**: New implementation at `/server/services/jarvis-langgraph/` alongside existing JARVIS
- **Frontend**: Update existing Manus.tsx (already well-structured) to connect to new backend
- **Multi-agent**: Include swarm capabilities from day one (supervisor → coder/executor/researcher pattern)
- **Tests**: Write tests after implementation is working
- **LLM Providers**: Support multiple (Anthropic, OpenRouter, Cerebras, Gemini, Grok)
- **Checkpointing**: Memory for dev, Database for production

**Research Findings**:

- OpenManus manus_graph.py provides complete StateGraph architecture to port
- Manus.tsx expects 9 WebSocket event types (`manus:*`)
- Existing JARVIS has 80+ tools with retry/fallback patterns to preserve
- Sisyphus Protocol adds supervisor/multi-agent routing layer

### Metis Review

**Identified Gaps** (addressed):

- Event emission must happen at every state transition (added to guardrails)
- Checkpointing strategy needed for crash recovery (added DB checkpointer task)
- Tool wrapping must preserve error handling patterns (added to acceptance criteria)
- Multi-agent state management complexity (added dedicated task)

---

## Work Objectives

### Core Objective

Create a production-ready LangGraph-based JARVIS orchestrator that coexists with the current implementation, emits real-time WebSocket events, supports multi-agent execution, and persists state across restarts.

### Concrete Deliverables

- `server/services/jarvis-langgraph/state.ts` - TypeScript state definitions
- `server/services/jarvis-langgraph/graph.ts` - Main StateGraph implementation
- `server/services/jarvis-langgraph/nodes/*.ts` - All graph nodes (router, planner, executor, supervisor, tools, check)
- `server/services/jarvis-langgraph/tools.ts` - LangGraph tool wrappers for existing tools
- `server/services/jarvis-langgraph/events.ts` - WebSocket event emission
- `server/services/jarvis-langgraph/checkpointer.ts` - Database-backed checkpointing
- `server/services/jarvis-langgraph/multiAgent.ts` - Multi-agent coordination
- `server/websocket/manusHandler.ts` - Socket.io handler for LangGraph
- Updated `client/src/pages/Manus.tsx` - Connect to new backend
- Updated `server/routers.ts` - tRPC procedures for new JARVIS

### Definition of Done

- [ ] `pnpm build` passes with no TypeScript errors
- [ ] Socket.io events emit correctly for all state transitions
- [ ] Simple task (e.g., "What time is it?") completes through chat mode
- [ ] Complex task (e.g., "Search web and summarize") completes through agent mode
- [ ] Session survives server restart via DB checkpointing
- [ ] Multi-agent routing works (supervisor delegates to coder/executor)
- [ ] All existing Manus.tsx functionality works with new backend

### Must Have

- StateGraph with router, planner, executor, tools, check_completion nodes
- All 80+ existing tools accessible via ToolNode
- WebSocket events: thinking, tool_start, tool_end, screenshot, terminal, file, iteration, complete, error
- Database checkpointing for session persistence
- Multi-agent supervisor routing
- Iteration limit enforcement (MAX_ITERATIONS = 15)

### Must NOT Have (Guardrails)

- DO NOT break existing JARVIS at `/server/services/jarvis/` - must continue working
- DO NOT duplicate tool implementations - wrap existing `executeTool()` function
- DO NOT create new UI components - use existing Manus.tsx patterns
- DO NOT skip event emission at any state transition
- DO NOT hardcode API keys - use existing environment variable pattern
- DO NOT exceed context limits - preserve existing context trimming logic
- AVOID over-abstracting - start minimal, add complexity as needed

---

## Verification Strategy (MANDATORY)

### Test Decision

- **Infrastructure exists**: YES (vitest)
- **User wants tests**: YES (tests-after)
- **Framework**: vitest
- **QA approach**: Implementation first, then tests for critical paths

### Automated Verification

Each TODO includes verification via:

- **API/Backend changes**: curl commands + vitest tests
- **WebSocket changes**: Socket.io test client
- **Frontend changes**: Playwright browser automation

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - Start Immediately):
├── Task 1: State definitions (state.ts)
├── Task 2: Tool wrappers (tools.ts)
├── Task 3: Event emission (events.ts)
└── Task 4: Install @langchain/langgraph dependencies

Wave 2 (Core Graph - After Wave 1):
├── Task 5: Router node (nodes/router.ts)
├── Task 6: Planner node (nodes/planner.ts)
├── Task 7: Executor node (nodes/executor.ts)
├── Task 8: Tools node integration (nodes/tools.ts)
└── Task 9: Check completion node (nodes/check.ts)

Wave 3 (Integration - After Wave 2):
├── Task 10: Main graph assembly (graph.ts)
├── Task 11: Database checkpointer (checkpointer.ts)
├── Task 12: Multi-agent supervisor (multiAgent.ts)
└── Task 13: WebSocket handler (websocket/manusHandler.ts)

Wave 4 (Frontend & API - After Wave 3):
├── Task 14: tRPC procedures (routers.ts)
├── Task 15: Update Manus.tsx
└── Task 16: Integration tests

Critical Path: Task 1 → Task 2 → Task 6 → Task 7 → Task 10 → Task 14 → Task 16
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

| Task | Depends On     | Blocks            | Can Parallelize With |
| ---- | -------------- | ----------------- | -------------------- |
| 1    | None           | 5, 6, 7, 8, 9, 10 | 2, 3, 4              |
| 2    | None           | 8, 10             | 1, 3, 4              |
| 3    | None           | 10, 13            | 1, 2, 4              |
| 4    | None           | 5, 6, 7, 8, 9, 10 | 1, 2, 3              |
| 5    | 1, 4           | 10                | 6, 7, 8, 9           |
| 6    | 1, 4           | 10                | 5, 7, 8, 9           |
| 7    | 1, 4           | 10                | 5, 6, 8, 9           |
| 8    | 1, 2, 4        | 10                | 5, 6, 7, 9           |
| 9    | 1, 4           | 10                | 5, 6, 7, 8           |
| 10   | 5, 6, 7, 8, 9  | 11, 12, 13, 14    | None                 |
| 11   | 10             | 14                | 12, 13               |
| 12   | 10             | 14                | 11, 13               |
| 13   | 3, 10          | 14, 15            | 11, 12               |
| 14   | 10, 11, 12, 13 | 15, 16            | None                 |
| 15   | 13, 14         | 16                | None                 |
| 16   | 14, 15         | None              | None                 |

### Agent Dispatch Summary

| Wave | Tasks          | Recommended Dispatch                      |
| ---- | -------------- | ----------------------------------------- |
| 1    | 1, 2, 3, 4     | 4 parallel agents (quick category)        |
| 2    | 5, 6, 7, 8, 9  | 5 parallel agents (visual-engineering)    |
| 3    | 10, 11, 12, 13 | 4 parallel agents (ultrabrain for 10, 12) |
| 4    | 14, 15, 16     | Sequential (dependencies)                 |

---

## TODOs

### Wave 1: Foundation

- [ ] 1. Create State Definitions

  **What to do**:
  - Create `/server/services/jarvis-langgraph/state.ts`
  - Define `JarvisState` TypedDict with Annotation reducers
  - Include: messages, tasks, current_task_id, browser_state, files, workspace_path, step_count, max_steps, is_complete, final_answer, mode, routed_to, agent_type
  - Port Task and TaskStatus types from OpenManus
  - Add multi-agent fields: supervisor_decision, agent_outputs, negotiation_state

  **Must NOT do**:
  - Import from existing JARVIS orchestrator (clean slate)
  - Over-complicate state - start minimal

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file creation with clear structure, no complex logic
  - **Skills**: [`git-master`]
    - `git-master`: For atomic commit after creation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 8, 9, 10
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/OpenManus/langgraph_agent/state/agent_state.py:1-80` - TypedDict state structure, Task class, merge_tasks reducer pattern

  **API/Type References**:
  - `@langchain/langgraph` - Annotation, messagesStateReducer types
  - `/home/josh/rasputin/server/services/jarvis/v3/types.ts` - Existing V3 types to reference (ToolCategory, ExecutionContext)

  **Documentation References**:
  - LangGraph.js state annotation docs: https://langchain-ai.github.io/langgraphjs/concepts/low_level/#state

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors in state.ts

  # Verify file exists and exports types:
  bun -e "import { JarvisState } from './server/services/jarvis-langgraph/state'; console.log(typeof JarvisState)"
  # Assert: Outputs type info without errors
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add state definitions with multi-agent support`
  - Files: `server/services/jarvis-langgraph/state.ts`
  - Pre-commit: `pnpm check`

---

- [ ] 2. Create Tool Wrappers for LangGraph

  **What to do**:
  - Create `/server/services/jarvis-langgraph/tools.ts`
  - Import existing `executeTool` and `getAvailableTools` from `../jarvis/tools`
  - Create LangGraph-compatible tool wrappers using `@langchain/core/tools`
  - Preserve the existing retry/fallback patterns
  - Export `createJarvisTools()` that returns array of LangGraph tools
  - Include tool result formatting for message history

  **Must NOT do**:
  - Re-implement tool logic - wrap existing executors
  - Skip error handling - preserve retry patterns
  - Change tool signatures - maintain compatibility

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Requires understanding both LangGraph tool interface AND existing tool system
  - **Skills**: [`git-master`]
    - `git-master`: For atomic commit

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Task 8, 10
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/server/services/jarvis/tools.ts:191-200` - ToolResult interface and withRetryAndFallback pattern
  - `/home/josh/rasputin/OpenManus/langgraph_agent/tools/browser_tool.py:1-50` - LangGraph tool definition pattern with Pydantic

  **API/Type References**:
  - `@langchain/core/tools` - DynamicStructuredTool, tool decorator
  - `/home/josh/rasputin/server/services/jarvis/tools.ts:getAvailableTools` - Existing tool definitions
  - `/home/josh/rasputin/server/services/jarvis/tools.ts:executeTool` - Existing tool executor

  **Documentation References**:
  - LangGraph.js tools: https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling/

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors

  # Verify tool wrapping works:
  bun -e "
    import { createJarvisTools } from './server/services/jarvis-langgraph/tools';
    const tools = createJarvisTools();
    console.log('Tool count:', tools.length);
    console.log('Has web_search:', tools.some(t => t.name === 'web_search'));
  "
  # Assert: Tool count >= 80, Has web_search: true
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add LangGraph tool wrappers for 80+ existing tools`
  - Files: `server/services/jarvis-langgraph/tools.ts`
  - Pre-commit: `pnpm check`

---

- [ ] 3. Create Event Emission System

  **What to do**:
  - Create `/server/services/jarvis-langgraph/events.ts`
  - Define `ManusEventEmitter` class that wraps Socket.io
  - Implement all 9 event types matching Manus.tsx expectations:
    - `emitThinking(sessionId, content)`
    - `emitToolStart(sessionId, toolName, input)`
    - `emitToolEnd(sessionId, output, isError)`
    - `emitScreenshot(sessionId, screenshot, url)`
    - `emitTerminal(sessionId, output, isError)`
    - `emitFile(sessionId, operation, path)`
    - `emitIteration(sessionId, iteration, maxIterations)`
    - `emitComplete(sessionId, success, summary)`
    - `emitError(sessionId, error)`
  - Include timestamp in all events
  - Export singleton pattern for global access

  **Must NOT do**:
  - Change event names - must match `manus:*` exactly
  - Skip any of the 9 event types
  - Emit without sessionId validation

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward event wrapper, clear interface from Manus.tsx
  - **Skills**: [`git-master`]
    - `git-master`: For atomic commit

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Tasks 10, 13
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/client/src/pages/Manus.tsx:117-307` - All socket.on handlers showing exact event shapes expected
  - `/home/josh/rasputin/server/services/jarvis/tools.ts:176-189` - Existing SynthesisProgressEmitter pattern

  **API/Type References**:
  - `socket.io` - Server type for emission
  - Event payload shapes (from Manus.tsx):
    - thinking: `{ sessionId, content, timestamp }`
    - tool_start: `{ sessionId, toolName, input, timestamp }`
    - tool_end: `{ sessionId, output, isError, timestamp }`
    - screenshot: `{ sessionId, screenshot, url, timestamp }`
    - terminal: `{ sessionId, output, isError, timestamp }`
    - file: `{ sessionId, operation, path, timestamp }`
    - iteration: `{ sessionId, iteration, maxIterations }`
    - complete: `{ sessionId, success, summary, timestamp }`
    - error: `{ sessionId, error, timestamp }`

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors

  # Verify all event methods exist:
  bun -e "
    import { ManusEventEmitter } from './server/services/jarvis-langgraph/events';
    const methods = ['emitThinking', 'emitToolStart', 'emitToolEnd', 'emitScreenshot', 'emitTerminal', 'emitFile', 'emitIteration', 'emitComplete', 'emitError'];
    const emitter = new ManusEventEmitter();
    const missing = methods.filter(m => typeof emitter[m] !== 'function');
    console.log('Missing methods:', missing.length === 0 ? 'none' : missing);
  "
  # Assert: Missing methods: none
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add WebSocket event emission system`
  - Files: `server/services/jarvis-langgraph/events.ts`
  - Pre-commit: `pnpm check`

---

- [ ] 4. Install LangGraph Dependencies

  **What to do**:
  - Add `@langchain/langgraph` to dependencies
  - Add `@langchain/core` to dependencies
  - Add `@langchain/anthropic` to dependencies (primary provider)
  - Add `@langchain/openai` to dependencies (OpenRouter compatibility)
  - Verify installation with import test
  - Update any peer dependency conflicts

  **Must NOT do**:
  - Change existing package versions unnecessarily
  - Add Python dependencies (we're TypeScript-only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple package installation
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Tasks 5, 6, 7, 8, 9, 10
  - **Blocked By**: None (can start immediately)

  **References**:

  **Documentation References**:
  - https://www.npmjs.com/package/@langchain/langgraph
  - https://langchain-ai.github.io/langgraphjs/

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm add @langchain/langgraph @langchain/core @langchain/anthropic @langchain/openai
  # Assert: Exit code 0

  # Verify imports work:
  bun -e "
    import { StateGraph, END, START } from '@langchain/langgraph';
    import { ToolNode } from '@langchain/langgraph/prebuilt';
    import { ChatAnthropic } from '@langchain/anthropic';
    console.log('Imports successful');
  "
  # Assert: Outputs "Imports successful"
  ```

  **Commit**: YES
  - Message: `chore(deps): add @langchain/langgraph and related packages`
  - Files: `package.json`, `pnpm-lock.yaml`
  - Pre-commit: `pnpm check`

---

### Wave 2: Core Graph Nodes

- [ ] 5. Create Router Node

  **What to do**:
  - Create `/server/services/jarvis-langgraph/nodes/router.ts`
  - Implement `routerNode` function that classifies input as "chat" or "agent"
  - Port quick-classify patterns from OpenManus (regex-based)
  - Add LLM fallback classification using fast model (Claude Haiku)
  - Emit `mode_selected` event
  - Return `{ routed_to: "chat" | "agent" }` state update

  **Must NOT do**:
  - Make expensive LLM calls for obvious classifications
  - Skip event emission

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Requires porting Python patterns to TypeScript, understanding LLM routing
  - **Skills**: [`git-master`]
    - `git-master`: For atomic commit

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 9)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 1, 4

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/OpenManus/langgraph_agent/agents/manus_graph.py:204-278` - Router node implementation with quick_classify and LLM fallback
  - `/home/josh/rasputin/server/services/jarvis/intelligentRouter.ts` - Existing routing logic

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors

  # Verify classification:
  bun -e "
    import { quickClassify } from './server/services/jarvis-langgraph/nodes/router';
    console.log('chat:', quickClassify('What is the weather?'));
    console.log('agent:', quickClassify('Create a website for me'));
  "
  # Assert: chat: "chat", agent: "agent"
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add router node with chat/agent classification`
  - Files: `server/services/jarvis-langgraph/nodes/router.ts`
  - Pre-commit: `pnpm check`

---

- [ ] 6. Create Planner Node

  **What to do**:
  - Create `/server/services/jarvis-langgraph/nodes/planner.ts`
  - Implement `plannerNode` that breaks task into subtasks
  - Use Claude to analyze task and generate numbered task list
  - Parse response into Task[] array with status tracking
  - Emit `status: planning` event
  - Update state with `tasks` array

  **Must NOT do**:
  - Over-plan simple tasks
  - Skip task status initialization

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: LLM prompt engineering for task decomposition
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8, 9)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 1, 4

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/OpenManus/langgraph_agent/agents/manus_graph.py:300-350` - Planner node implementation
  - `/home/josh/rasputin/server/services/jarvis/strategicPlanner.ts` - Existing planning logic

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add planner node for task decomposition`
  - Files: `server/services/jarvis-langgraph/nodes/planner.ts`
  - Pre-commit: `pnpm check`

---

- [ ] 7. Create Executor Node

  **What to do**:
  - Create `/server/services/jarvis-langgraph/nodes/executor.ts`
  - Implement `executorNode` that executes current task with tools
  - Use Claude with bound tools for execution
  - Handle tool calls and track tool_calls in response
  - Emit `thinking` events for streaming thought content
  - Return state with new messages and tool calls

  **Must NOT do**:
  - Execute tools directly - let ToolNode handle that
  - Skip thinking emission

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Core execution logic with LLM + tools
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8, 9)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 1, 4

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/OpenManus/langgraph_agent/agents/manus_graph.py:352-420` - Executor node implementation
  - `/home/josh/rasputin/server/services/jarvis/orchestrator.ts:1-100` - Existing execution patterns

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add executor node for tool-calling LLM`
  - Files: `server/services/jarvis-langgraph/nodes/executor.ts`
  - Pre-commit: `pnpm check`

---

- [ ] 8. Create Tools Node Integration

  **What to do**:
  - Create `/server/services/jarvis-langgraph/nodes/tools.ts`
  - Wrap LangGraph's ToolNode with event emission
  - Emit `tool_start` before execution, `tool_end` after
  - Handle tool-specific events (screenshot, terminal, file)
  - Format tool results for message history

  **Must NOT do**:
  - Skip event emission for any tool execution

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: ToolNode integration with custom event handling
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7, 9)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 1, 2, 4

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/OpenManus/langgraph_agent/agents/manus_graph.py:167` - ToolNode(self.tools) usage
  - `/home/josh/rasputin/server/services/jarvis/tools.ts` - Tool execution patterns

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add tools node with event emission`
  - Files: `server/services/jarvis-langgraph/nodes/tools.ts`
  - Pre-commit: `pnpm check`

---

- [ ] 9. Create Check Completion Node

  **What to do**:
  - Create `/server/services/jarvis-langgraph/nodes/check.ts`
  - Implement `checkCompletionNode` that evaluates if task is done
  - Check: step_count < max_steps, all subtasks completed, explicit completion signal
  - Return `{ is_complete: boolean }` state update
  - Emit `iteration` event with current/max counts

  **Must NOT do**:
  - Allow infinite loops - enforce MAX_ITERATIONS = 15
  - Skip iteration emission

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple completion checking logic
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7, 8)
  - **Blocks**: Task 10
  - **Blocked By**: Tasks 1, 4

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/OpenManus/langgraph_agent/agents/manus_graph.py:420-450` - Check completion logic
  - `/home/josh/rasputin/server/services/jarvis/orchestrator.ts` - MAX_ITERATIONS constant

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add check completion node with iteration limit`
  - Files: `server/services/jarvis-langgraph/nodes/check.ts`
  - Pre-commit: `pnpm check`

---

### Wave 3: Integration Layer

- [ ] 10. Assemble Main Graph

  **What to do**:
  - Create `/server/services/jarvis-langgraph/graph.ts`
  - Import all nodes from `./nodes/*`
  - Create StateGraph with JarvisState
  - Add nodes: router, chat_response, planner, executor, tools, check_completion
  - Add edges following OpenManus pattern:
    - START → router
    - router →(conditional)→ chat_response | planner
    - chat_response → END
    - planner → executor
    - executor →(conditional)→ tools | check_completion
    - tools → executor
    - check_completion →(conditional)→ executor | END
  - Compile graph with checkpointer
  - Export `createJarvisGraph()` factory function

  **Must NOT do**:
  - Hardcode checkpointer - accept as parameter
  - Skip conditional edge functions

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex graph assembly requiring understanding of all node interactions
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (critical path)
  - **Blocks**: Tasks 11, 12, 13, 14
  - **Blocked By**: Tasks 5, 6, 7, 8, 9

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/OpenManus/langgraph_agent/agents/manus_graph.py:160-202` - Complete \_build_graph implementation

  **API/Type References**:
  - `@langchain/langgraph` - StateGraph, END, START, addConditionalEdges

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors

  # Verify graph compiles:
  bun -e "
    import { createJarvisGraph } from './server/services/jarvis-langgraph/graph';
    const graph = createJarvisGraph();
    console.log('Graph compiled:', graph !== null);
  "
  # Assert: Graph compiled: true
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): assemble main StateGraph with all nodes`
  - Files: `server/services/jarvis-langgraph/graph.ts`
  - Pre-commit: `pnpm check`

---

- [ ] 11. Create Database Checkpointer

  **What to do**:
  - Create `/server/services/jarvis-langgraph/checkpointer.ts`
  - Implement `DrizzleCheckpointer` class extending BaseCheckpointSaver
  - Use existing Drizzle DB connection
  - Create new table `jarvisLanggraphCheckpoints` if needed (or reuse existing)
  - Implement: getTuple, putTuple, list methods
  - Support thread_id based checkpointing for session isolation
  - Export factory function for production use

  **Must NOT do**:
  - Break existing database tables
  - Skip error handling for DB operations

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Database integration with LangGraph checkpointer interface
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 12, 13)
  - **Blocks**: Task 14
  - **Blocked By**: Task 10

  **References**:

  **Pattern References**:
  - `@langchain/langgraph` - BaseCheckpointSaver interface
  - `/home/josh/rasputin/drizzle/schema.ts` - Existing schema patterns

  **Documentation References**:
  - LangGraph checkpointing: https://langchain-ai.github.io/langgraphjs/concepts/persistence/

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors

  # Verify checkpointer interface:
  bun -e "
    import { DrizzleCheckpointer } from './server/services/jarvis-langgraph/checkpointer';
    const cp = new DrizzleCheckpointer();
    console.log('Has getTuple:', typeof cp.getTuple === 'function');
    console.log('Has putTuple:', typeof cp.putTuple === 'function');
  "
  # Assert: Has getTuple: true, Has putTuple: true
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add database-backed checkpointer`
  - Files: `server/services/jarvis-langgraph/checkpointer.ts`, `drizzle/schema.ts` (if modified)
  - Pre-commit: `pnpm check`

---

- [ ] 12. Create Multi-Agent Supervisor

  **What to do**:
  - Create `/server/services/jarvis-langgraph/multiAgent.ts`
  - Implement `supervisorNode` that routes to specialized agents
  - Define agent types: coder, executor, researcher (from Sisyphus Protocol)
  - Implement agent selection logic based on task type
  - Add negotiation state for agent coordination
  - Integrate with existing v3/swarmIntelligence patterns where applicable

  **Must NOT do**:
  - Over-complicate agent selection
  - Skip fallback to single-agent mode

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex multi-agent coordination logic
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 13)
  - **Blocks**: Task 14
  - **Blocked By**: Task 10

  **References**:

  **Pattern References**:
  - Sisyphus Protocol blueprint - supervisor, coder, executor, researcher nodes
  - `/home/josh/rasputin/server/services/jarvis/v3/swarmOrchestrator.ts` - Existing swarm patterns
  - `/home/josh/rasputin/server/services/multiAgent/swarmIntelligence.ts` - Existing negotiation logic

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add multi-agent supervisor with coder/executor/researcher`
  - Files: `server/services/jarvis-langgraph/multiAgent.ts`
  - Pre-commit: `pnpm check`

---

- [ ] 13. Create WebSocket Handler

  **What to do**:
  - Create `/server/websocket/manusHandler.ts`
  - Implement Socket.io handler for `manus:start` and `manus:cancel` events
  - Instantiate JarvisGraph with appropriate checkpointer
  - Stream graph execution with event emission
  - Handle cancellation via graph interrupt
  - Pass session context (userId, sessionId) through execution

  **Must NOT do**:
  - Block event loop - use async streaming
  - Skip authentication validation

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: WebSocket + LangGraph streaming integration
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 12)
  - **Blocks**: Tasks 14, 15
  - **Blocked By**: Tasks 3, 10

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/client/src/pages/Manus.tsx:336-373` - Client-side start/cancel emission
  - `/home/josh/rasputin/OpenManus/langgraph_agent/server/main.py` - WebSocket endpoint pattern

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add WebSocket handler for manus events`
  - Files: `server/websocket/manusHandler.ts`
  - Pre-commit: `pnpm check`

---

### Wave 4: Frontend & API

- [ ] 14. Add tRPC Procedures

  **What to do**:
  - Update `/server/routers.ts` to add jarvisLanggraph router
  - Add procedures:
    - `jarvisLanggraph.getSessions` - List user's sessions
    - `jarvisLanggraph.getSession` - Get session details with steps
    - `jarvisLanggraph.cancelSession` - Cancel running session
  - Wire up to existing authentication
  - Keep existing JARVIS procedures intact

  **Must NOT do**:
  - Break existing JARVIS tRPC procedures
  - Skip authentication checks

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: tRPC router modification with existing pattern conformance
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Wave 3)
  - **Blocks**: Tasks 15, 16
  - **Blocked By**: Tasks 10, 11, 12, 13

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/server/routers.ts` - Existing tRPC router patterns
  - `/home/josh/rasputin/AGENTS.md:Adding a new tRPC endpoint` - Guidelines

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm check
  # Assert: No TypeScript errors

  pnpm build
  # Assert: Build succeeds
  ```

  **Commit**: YES
  - Message: `feat(jarvis-langgraph): add tRPC procedures for session management`
  - Files: `server/routers.ts`
  - Pre-commit: `pnpm check`

---

- [ ] 15. Update Manus.tsx Frontend

  **What to do**:
  - Update `/client/src/pages/Manus.tsx` to work with new backend
  - Changes needed:
    - Ensure WebSocket event handlers match new emission format (should already match)
    - Add toggle or auto-detect for new vs old JARVIS backend
    - Update any API calls to use new tRPC procedures if needed
  - Verify all existing functionality still works

  **Must NOT do**:
  - Break existing Manus.tsx functionality
  - Change visual design
  - Remove old JARVIS compatibility (coexistence)

  **Recommended Agent Profile**:
  - **Category**: `frontend-ui-ux`
    - Reason: React frontend modifications
  - **Skills**: [`frontend-ui-ux`, `git-master`, `playwright`]
    - `frontend-ui-ux`: React best practices
    - `playwright`: For verification testing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 14)
  - **Blocks**: Task 16
  - **Blocked By**: Tasks 13, 14

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/client/src/pages/Manus.tsx` - Current implementation
  - `/home/josh/rasputin/AGENTS.md:React Patterns` - Component guidelines

  **Acceptance Criteria**:

  **Playwright browser verification:**

  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: http://localhost:5173/manus
  2. Wait for: page to load fully
  3. Assert: Tabs visible (Browser, Terminal, Files, Code)
  4. Assert: Input textarea visible
  5. Screenshot: .sisyphus/evidence/task-15-manus-ui.png
  ```

  **Commit**: YES
  - Message: `feat(manus): update frontend for LangGraph backend compatibility`
  - Files: `client/src/pages/Manus.tsx`
  - Pre-commit: `pnpm check`

---

- [ ] 16. Integration Tests & Verification

  **What to do**:
  - Create `/server/services/jarvis-langgraph/__tests__/integration.test.ts`
  - Test scenarios:
    - Chat mode: Simple question gets direct response
    - Agent mode: Multi-step task with tool usage
    - Cancellation: Running task can be cancelled
    - Checkpointing: Session survives mock restart
  - Verify WebSocket events are emitted correctly
  - End-to-end test with real LLM call (skip in CI)

  **Must NOT do**:
  - Skip error case testing
  - Leave flaky tests

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Integration testing with async/WebSocket patterns
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final (after all else)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 14, 15

  **References**:

  **Pattern References**:
  - `/home/josh/rasputin/server/*.test.ts` - Existing test patterns
  - `/home/josh/rasputin/AGENTS.md:Testing` - Test guidelines

  **Acceptance Criteria**:

  ```bash
  # Agent runs:
  pnpm test server/services/jarvis-langgraph/__tests__/integration.test.ts
  # Assert: All tests pass
  ```

  **Commit**: YES
  - Message: `test(jarvis-langgraph): add integration tests for graph execution`
  - Files: `server/services/jarvis-langgraph/__tests__/integration.test.ts`
  - Pre-commit: `pnpm test`

---

## Commit Strategy

| After Task | Message                                         | Files               | Verification |
| ---------- | ----------------------------------------------- | ------------------- | ------------ |
| 1          | `feat(jarvis-langgraph): add state definitions` | state.ts            | pnpm check   |
| 2          | `feat(jarvis-langgraph): add tool wrappers`     | tools.ts            | pnpm check   |
| 3          | `feat(jarvis-langgraph): add event emission`    | events.ts           | pnpm check   |
| 4          | `chore(deps): add @langchain/langgraph`         | package.json        | pnpm check   |
| 5          | `feat(jarvis-langgraph): add router node`       | nodes/router.ts     | pnpm check   |
| 6          | `feat(jarvis-langgraph): add planner node`      | nodes/planner.ts    | pnpm check   |
| 7          | `feat(jarvis-langgraph): add executor node`     | nodes/executor.ts   | pnpm check   |
| 8          | `feat(jarvis-langgraph): add tools node`        | nodes/tools.ts      | pnpm check   |
| 9          | `feat(jarvis-langgraph): add check node`        | nodes/check.ts      | pnpm check   |
| 10         | `feat(jarvis-langgraph): assemble graph`        | graph.ts            | pnpm check   |
| 11         | `feat(jarvis-langgraph): add checkpointer`      | checkpointer.ts     | pnpm check   |
| 12         | `feat(jarvis-langgraph): add multi-agent`       | multiAgent.ts       | pnpm check   |
| 13         | `feat(jarvis-langgraph): add websocket handler` | manusHandler.ts     | pnpm check   |
| 14         | `feat(jarvis-langgraph): add tRPC procedures`   | routers.ts          | pnpm build   |
| 15         | `feat(manus): update frontend`                  | Manus.tsx           | pnpm check   |
| 16         | `test(jarvis-langgraph): add integration tests` | integration.test.ts | pnpm test    |

---

## Success Criteria

### Verification Commands

```bash
# Build passes
pnpm build  # Expected: Exit 0, no errors

# Type check passes
pnpm check  # Expected: Exit 0

# Tests pass
pnpm test server/services/jarvis-langgraph/  # Expected: All green

# Dev server starts
pnpm dev  # Expected: Server running on port 3000
```

### Final Checklist

- [ ] All "Must Have" present (StateGraph, 80+ tools, WebSocket events, checkpointing, multi-agent)
- [ ] All "Must NOT Have" absent (no broken existing JARVIS, no duplicate tools, no missing events)
- [ ] All tests pass
- [ ] Simple chat query works: "What is 2+2?"
- [ ] Complex agent task works: "Search the web for latest AI news"
- [ ] Session persists across server restart
- [ ] Multi-agent routing works for coding tasks
