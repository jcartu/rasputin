# JARVIS v3 Deployment Plan

## TL;DR

> **Quick Summary**: Deploy a fresh JARVIS v3 system to `/opt/jarvis-v3/` with LangGraph cognitive core (Python), GPU model server, and Moltbot Rust daemon for desktop automation.
>
> **Deliverables**:
>
> - Docker compose stack with Postgres + Model Server (GPU)
> - LangGraph brain with supervisor/coder/executor nodes + WebSocket API
> - Moltbot Rust gRPC daemon for desktop automation
> - Connection to existing Qdrant (6333) and Redis (6379)
>
> **Estimated Effort**: Large (3-5 days)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 2 → Task 4 → Task 6 → Task 8

---

## Context

### Original Request

Deploy "JARVIS v3" based on the Sisyphus Protocol specification to `/opt/jarvis-v3/` on Arch Linux with RTX PRO 6000 (98GB VRAM).

### Interview Summary

**Key Discussions**:

- Service Reuse: HYBRID - Reuse existing Qdrant (6333) and Redis (6379), add NEW Postgres
- Rust Daemon: BUILD FROM SCRATCH - Fresh Moltbot daemon, not using existing jarvis-daemon
- Cognitive Core: REPLACE WITH LANGGRAPH - Full Python migration, replacing TypeScript orchestrator
- Priority: INFRASTRUCTURE FIRST - Docker stack → LangGraph Brain → Moltbot

**Research Findings**:

- LangGraph uses StateGraph with add_node, add_edge, add_conditional_edges
- create_react_agent and create_supervisor from langgraph.prebuilt
- Checkpointing via InMemorySaver (dev) or PostgresSaver (prod)
- FastAPI WebSocket can stream LangGraph outputs via graph.stream()
- Existing rasputin has comprehensive Docker patterns in deploy/docker-compose.yml

### Metis Review

**Identified Gaps** (addressed):

- LLM Provider: Default to Anthropic API via environment variable, configurable
- Authentication: JWT-based auth between services (same pattern as existing daemon)
- GPU Memory: Allocate via NVIDIA Container Toolkit, verify with nvidia-smi
- Acceptance Criteria: Added concrete verification commands for each task

---

## Work Objectives

### Core Objective

Deploy a production-ready JARVIS v3 system with LangGraph cognitive core, GPU-accelerated model server, and Moltbot desktop automation daemon.

### Concrete Deliverables

- `/opt/jarvis-v3/docker-compose.yml` - Infrastructure stack
- `/opt/jarvis-v3/brain/` - LangGraph Python service with WebSocket API
- `/opt/jarvis-v3/model-server/` - GPU-enabled FastAPI inference server
- `/opt/jarvis-v3/moltbot/` - Rust gRPC desktop daemon

### Definition of Done

- [ ] `docker compose up -d` starts all services without errors
- [ ] WebSocket at `ws://localhost:8000/ws` accepts connections and responds to messages
- [ ] Model server at `http://localhost:8080/health` returns 200 with GPU info
- [ ] Moltbot gRPC at `localhost:50051` responds to health check
- [ ] LangGraph brain executes supervisor → coder → executor flow

### Must Have

- Docker compose with Postgres, Model Server, Brain services
- LangGraph StateGraph with at least 3 nodes (supervisor, coder, executor)
- WebSocket API for chat interface
- Moltbot with screenshot and keyboard/mouse control
- Connection to existing Qdrant and Redis

### Must NOT Have (Guardrails)

- NO modifications to existing rasputin codebase
- NO copying from existing jarvis-daemon (fresh Moltbot build)
- NO Life Stream/Oracle in this phase (defer to later)
- NO complex tool library initially (start with 5-10 core tools)
- NO authentication complexity (use simple JWT for MVP)

---

## Verification Strategy (MANDATORY)

### Test Decision

- **Infrastructure exists**: NO (fresh deployment)
- **User wants tests**: Manual verification via commands
- **Framework**: None initially (integration tests later)

### Automated Verification (used for all tasks)

**For Docker services:**

```bash
docker compose ps --format json | jq '.[].State'
# Assert: All states are "running"
```

**For GPU verification:**

```bash
docker exec jarvis-model-server nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv
# Assert: Shows RTX PRO 6000 with memory info
```

**For WebSocket:**

```bash
# Using websocat or curl
echo '{"type":"ping"}' | websocat ws://localhost:8000/ws
# Assert: Returns pong response
```

**For gRPC:**

```bash
grpcurl -plaintext localhost:50051 list
# Assert: Shows moltbot.v1.Moltbot service
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Create directory structure + docker-compose.yml
├── Task 2: Create model-server Dockerfile + main.py
└── Task 3: Create Moltbot Cargo.toml + proto/moltbot.proto

Wave 2 (After Wave 1):
├── Task 4: Create LangGraph brain structure + pyproject.toml
├── Task 5: Implement model-server GPU endpoints
└── Task 6: Implement Moltbot main.rs skeleton

Wave 3 (After Wave 2):
├── Task 7: Implement LangGraph StateGraph + nodes
├── Task 8: Implement LangGraph WebSocket server
└── Task 9: Implement Moltbot gRPC service methods

Wave 4 (After Wave 3):
├── Task 10: Integration testing + docker compose up
└── Task 11: End-to-end verification

Critical Path: Task 1 → Task 4 → Task 7 → Task 8 → Task 10
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks  | Can Parallelize With |
| ---- | ---------- | ------- | -------------------- |
| 1    | None       | 4, 5, 6 | 2, 3                 |
| 2    | None       | 5       | 1, 3                 |
| 3    | None       | 6       | 1, 2                 |
| 4    | 1          | 7, 8    | 5, 6                 |
| 5    | 2          | 10      | 4, 6                 |
| 6    | 3          | 9       | 4, 5                 |
| 7    | 4          | 10      | 8, 9                 |
| 8    | 4          | 10      | 7, 9                 |
| 9    | 6          | 10      | 7, 8                 |
| 10   | 5, 7, 8, 9 | 11      | None                 |
| 11   | 10         | None    | None                 |

### Agent Dispatch Summary

| Wave | Tasks   | Recommended Agents                              |
| ---- | ------- | ----------------------------------------------- |
| 1    | 1, 2, 3 | 3 parallel agents (quick category)              |
| 2    | 4, 5, 6 | 3 parallel agents (visual-engineering for Rust) |
| 3    | 7, 8, 9 | 3 parallel agents (ultrabrain for LangGraph)    |
| 4    | 10, 11  | Sequential (integration)                        |

---

## TODOs

### Wave 1: Foundation

- [ ] 1. Create directory structure and docker-compose.yml

  **What to do**:
  - Create `/opt/jarvis-v3/` directory structure with all subdirectories
  - Create `docker-compose.yml` with:
    - `postgres` service (port 5432, volume for data)
    - `model-server` service (GPU enabled, port 8080)
    - `brain` service (port 8000)
    - Network configuration connecting to existing qdrant/redis
  - Create `.env.example` with required environment variables

  **Must NOT do**:
  - Do NOT start containers yet (just create files)
  - Do NOT include moltbot in docker-compose (runs native)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File creation task with known patterns
  - **Skills**: [`git-master`]
    - `git-master`: May need to initialize git repo
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not a UI task
    - `playwright`: No browser automation needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5, 6
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `deploy/docker-compose.yml:1-184` - Existing Docker Compose patterns (GPU reservations, networks, volumes)
  - `deploy/docker-compose.yml:54-76` - Ollama GPU configuration pattern

  **External References**:
  - Docker Compose GPU: https://docs.docker.com/compose/gpu-support/
  - NVIDIA Container Toolkit: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html

  **WHY Each Reference Matters**:
  - `deploy/docker-compose.yml` shows the exact GPU reservation syntax used in this project
  - NVIDIA docs ensure Arch Linux compatibility

  **Acceptance Criteria**:

  **Automated Verification:**

  ```bash
  # Agent runs:
  ls -la /opt/jarvis-v3/
  # Assert: Shows directories: brain/, model-server/, moltbot/

  cat /opt/jarvis-v3/docker-compose.yml | grep -c "services:"
  # Assert: Output is "1" (file exists and has services section)

  cat /opt/jarvis-v3/docker-compose.yml | grep -E "postgres|model-server|brain" | wc -l
  # Assert: Output >= 3 (all three services defined)
  ```

  **Evidence to Capture:**
  - [ ] Terminal output showing directory structure
  - [ ] docker-compose.yml content validation

  **Commit**: YES
  - Message: `feat(jarvis-v3): add infrastructure foundation with docker-compose`
  - Files: `/opt/jarvis-v3/docker-compose.yml`, `/opt/jarvis-v3/.env.example`
  - Pre-commit: `docker compose config` (validates syntax)

---

- [ ] 2. Create model-server Dockerfile and main.py

  **What to do**:
  - Create `/opt/jarvis-v3/model-server/Dockerfile` with:
    - Base image: `nvidia/cuda:12.4-runtime-ubuntu22.04`
    - Python 3.11+ installation
    - FastAPI + uvicorn + sentence-transformers
  - Create `/opt/jarvis-v3/model-server/requirements.txt`
  - Create `/opt/jarvis-v3/model-server/main.py` with:
    - `/health` endpoint returning GPU status
    - `/embed` endpoint for text embeddings
    - `/generate` endpoint placeholder (for future LLM)

  **Must NOT do**:
  - Do NOT implement full LLM inference yet (placeholder only)
  - Do NOT include large model weights in image

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard Python FastAPI service creation
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `deploy/Dockerfile:1-69` - Multi-stage build pattern
  - `server/services/jarvis/v3/perceptionAdapter.ts:1-50` - Embedding interface pattern

  **External References**:
  - NVIDIA CUDA Docker: https://hub.docker.com/r/nvidia/cuda
  - sentence-transformers: https://www.sbert.net/docs/quickstart.html

  **WHY Each Reference Matters**:
  - `deploy/Dockerfile` shows multi-stage build best practices for this project
  - sentence-transformers docs show embedding API patterns

  **Acceptance Criteria**:

  **Automated Verification:**

  ```bash
  # Agent runs:
  cat /opt/jarvis-v3/model-server/Dockerfile | grep -c "nvidia/cuda"
  # Assert: Output >= 1 (uses NVIDIA base image)

  cat /opt/jarvis-v3/model-server/main.py | grep -E "@app\.(get|post)" | wc -l
  # Assert: Output >= 2 (has at least 2 endpoints)

  python3 -m py_compile /opt/jarvis-v3/model-server/main.py
  # Assert: Exit code 0 (valid Python syntax)
  ```

  **Evidence to Capture:**
  - [ ] Dockerfile content
  - [ ] main.py syntax validation

  **Commit**: YES
  - Message: `feat(jarvis-v3): add model-server with GPU support`
  - Files: `/opt/jarvis-v3/model-server/*`
  - Pre-commit: `python3 -m py_compile main.py`

---

- [ ] 3. Create Moltbot Cargo.toml and proto definition

  **What to do**:
  - Create `/opt/jarvis-v3/moltbot/Cargo.toml` with:
    - tokio, tonic, prost for async gRPC
    - x11rb for X11 screen capture (Arch Linux)
    - image for screenshot encoding
  - Create `/opt/jarvis-v3/moltbot/build.rs` for proto compilation
  - Create `/opt/jarvis-v3/moltbot/proto/moltbot.proto` with:
    - Screenshot RPC
    - MouseMove, MouseClick RPCs
    - KeyboardType, KeyboardPress RPCs
    - ListWindows, FocusWindow RPCs

  **Must NOT do**:
  - Do NOT copy from existing `daemon/proto/daemon.proto` (fresh design)
  - Do NOT implement service methods yet (just proto)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Rust project setup requires careful dependency management
  - **Skills**: []
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - `git-master`: Simple file creation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `daemon/Cargo.toml:1-64` - Reference for Rust dependencies (DO NOT COPY, just reference versions)
  - `daemon/proto/daemon.proto:1-286` - Reference for proto structure (DO NOT COPY)

  **External References**:
  - tonic gRPC: https://github.com/hyperium/tonic
  - x11rb crate: https://docs.rs/x11rb/latest/x11rb/

  **WHY Each Reference Matters**:
  - `daemon/Cargo.toml` shows compatible crate versions for this environment
  - `daemon/proto/daemon.proto` shows expected RPC patterns (for inspiration, not copying)

  **Acceptance Criteria**:

  **Automated Verification:**

  ```bash
  # Agent runs:
  cat /opt/jarvis-v3/moltbot/Cargo.toml | grep -c "tonic"
  # Assert: Output >= 1 (has tonic dependency)

  cat /opt/jarvis-v3/moltbot/proto/moltbot.proto | grep -c "rpc"
  # Assert: Output >= 5 (has at least 5 RPC definitions)

  cat /opt/jarvis-v3/moltbot/proto/moltbot.proto | grep "service Moltbot"
  # Assert: Shows service definition line
  ```

  **Evidence to Capture:**
  - [ ] Cargo.toml content
  - [ ] moltbot.proto service definitions

  **Commit**: YES
  - Message: `feat(jarvis-v3): add moltbot rust project structure`
  - Files: `/opt/jarvis-v3/moltbot/*`
  - Pre-commit: `cd /opt/jarvis-v3/moltbot && cargo check` (may fail without full impl, that's ok)

---

### Wave 2: Service Scaffolding

- [ ] 4. Create LangGraph brain structure and pyproject.toml

  **What to do**:
  - Create `/opt/jarvis-v3/brain/pyproject.toml` with:
    - langgraph >= 0.2.0
    - langchain-anthropic (for Claude)
    - langchain-core
    - fastapi, uvicorn, websockets
    - psycopg2-binary (for Postgres checkpointing)
    - qdrant-client, redis
  - Create `/opt/jarvis-v3/brain/Dockerfile`
  - Create directory structure:
    - `src/graph.py` (empty, for StateGraph)
    - `src/server.py` (empty, for FastAPI)
    - `src/nodes/` directory
    - `src/tools/` directory

  **Must NOT do**:
  - Do NOT implement graph logic yet (just structure)
  - Do NOT add too many tools (max 10 placeholders)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Python project scaffolding
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - LangGraph pyproject example from Context7 research

  **External References**:
  - LangGraph: https://langchain-ai.github.io/langgraph/
  - langgraph-supervisor: https://github.com/langchain-ai/langgraph-supervisor-py

  **WHY Each Reference Matters**:
  - LangGraph docs show correct dependency versions
  - langgraph-supervisor shows multi-agent patterns

  **Acceptance Criteria**:

  **Automated Verification:**

  ```bash
  # Agent runs:
  cat /opt/jarvis-v3/brain/pyproject.toml | grep -c "langgraph"
  # Assert: Output >= 1

  ls /opt/jarvis-v3/brain/src/nodes/
  # Assert: Directory exists

  ls /opt/jarvis-v3/brain/src/tools/
  # Assert: Directory exists
  ```

  **Evidence to Capture:**
  - [ ] pyproject.toml content
  - [ ] Directory structure listing

  **Commit**: YES
  - Message: `feat(jarvis-v3): add langgraph brain project structure`
  - Files: `/opt/jarvis-v3/brain/*`
  - Pre-commit: None (structure only)

---

- [ ] 5. Implement model-server GPU endpoints

  **What to do**:
  - Update `/opt/jarvis-v3/model-server/main.py`:
    - Implement `/health` to return GPU info via torch.cuda
    - Implement `/embed` to generate embeddings using sentence-transformers
    - Add proper error handling and logging
  - Test locally (if possible) or via docker build

  **Must NOT do**:
  - Do NOT implement full text generation (use placeholder)
  - Do NOT load models larger than 1GB initially

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: GPU + ML code requires careful implementation
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Task 10
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `server/services/jarvis/v3/perceptionAdapter.ts:100-200` - Embedding interface patterns

  **External References**:
  - sentence-transformers usage: https://www.sbert.net/docs/usage/semantic_textual_similarity.html
  - FastAPI async patterns: https://fastapi.tiangolo.com/async/

  **WHY Each Reference Matters**:
  - perceptionAdapter shows expected embedding interface
  - FastAPI docs show async best practices for ML endpoints

  **Acceptance Criteria**:

  **Automated Verification:**

  ```bash
  # Agent runs (after docker build):
  docker build -t jarvis-model-server /opt/jarvis-v3/model-server/
  # Assert: Exit code 0

  # If GPU available:
  docker run --rm --gpus all jarvis-model-server python -c "import torch; print(torch.cuda.is_available())"
  # Assert: Output is "True"
  ```

  **Evidence to Capture:**
  - [ ] Docker build output
  - [ ] GPU detection test result

  **Commit**: YES
  - Message: `feat(jarvis-v3): implement model-server GPU endpoints`
  - Files: `/opt/jarvis-v3/model-server/main.py`
  - Pre-commit: `docker build`

---

- [ ] 6. Implement Moltbot main.rs skeleton

  **What to do**:
  - Create `/opt/jarvis-v3/moltbot/src/main.rs` with:
    - Tonic gRPC server setup
    - Service trait implementation (empty methods returning unimplemented)
    - Configuration loading
    - Logging setup (tracing)
  - Ensure `cargo build` succeeds

  **Must NOT do**:
  - Do NOT implement actual screen capture yet
  - Do NOT implement X11 interactions yet

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Rust gRPC requires careful trait implementation
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: Simple implementation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 9
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `daemon/src/main.rs:1-91` - Tonic server setup pattern (for reference, not copying)
  - `daemon/src/service.rs` - Service implementation pattern

  **External References**:
  - Tonic tutorial: https://github.com/hyperium/tonic/blob/master/examples/helloworld-tutorial.md

  **WHY Each Reference Matters**:
  - `daemon/src/main.rs` shows how to structure a Tonic server in this project's style
  - Tonic tutorial shows basic gRPC patterns

  **Acceptance Criteria**:

  **Automated Verification:**

  ```bash
  # Agent runs:
  cd /opt/jarvis-v3/moltbot && cargo build 2>&1 | tail -5
  # Assert: Shows "Finished" or "Compiling" (no errors)

  cd /opt/jarvis-v3/moltbot && cargo check 2>&1 | grep -c "error"
  # Assert: Output is "0"
  ```

  **Evidence to Capture:**
  - [ ] cargo build output
  - [ ] main.rs content

  **Commit**: YES
  - Message: `feat(jarvis-v3): implement moltbot grpc skeleton`
  - Files: `/opt/jarvis-v3/moltbot/src/*`
  - Pre-commit: `cargo check`

---

### Wave 3: Core Implementation

- [ ] 7. Implement LangGraph StateGraph and nodes

  **What to do**:
  - Implement `/opt/jarvis-v3/brain/src/graph.py`:
    - Define State TypedDict with messages, current_agent, task_status
    - Create StateGraph with nodes: supervisor, coder, executor
    - Add conditional edges based on supervisor decisions
    - Compile with PostgresSaver checkpointer
  - Implement `/opt/jarvis-v3/brain/src/nodes/supervisor.py`:
    - Analyze task and route to appropriate agent
  - Implement `/opt/jarvis-v3/brain/src/nodes/coder.py`:
    - Code generation node
  - Implement `/opt/jarvis-v3/brain/src/nodes/executor.py`:
    - Code execution node (sandbox)

  **Must NOT do**:
  - Do NOT implement complex tool calling yet
  - Do NOT add more than 3 agent nodes initially

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: LangGraph requires understanding of graph theory and LLM orchestration
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9)
  - **Blocks**: Task 10
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - LangGraph StateGraph examples from Context7 research (see Context section)
  - `server/services/jarvis/v3/swarmOrchestrator.ts:117-216` - Multi-agent coordination patterns

  **External References**:
  - LangGraph StateGraph: https://langchain-ai.github.io/langgraph/concepts/low_level/
  - langgraph-supervisor: https://github.com/langchain-ai/langgraph-supervisor-py

  **WHY Each Reference Matters**:
  - Context7 examples show exact StateGraph syntax
  - swarmOrchestrator shows agent coordination patterns to replicate

  **Code Pattern** (from research):

  ```python
  from langgraph.graph import StateGraph, END
  from langgraph.checkpoint.postgres import PostgresSaver
  from typing import TypedDict, List, Literal

  class State(TypedDict):
      messages: List[dict]
      current_agent: str
      task_status: Literal["pending", "in_progress", "complete"]

  def supervisor_node(state: State) -> dict:
      # Analyze and route
      return {"current_agent": "coder", "task_status": "in_progress"}

  def route_to_agent(state: State) -> str:
      if state["task_status"] == "complete":
          return END
      return state["current_agent"]

  builder = StateGraph(State)
  builder.add_node("supervisor", supervisor_node)
  builder.add_node("coder", coder_node)
  builder.add_node("executor", executor_node)
  builder.set_entry_point("supervisor")
  builder.add_conditional_edges("supervisor", route_to_agent)
  builder.add_edge("coder", "supervisor")
  builder.add_edge("executor", "supervisor")

  checkpointer = PostgresSaver.from_conn_string(DATABASE_URL)
  graph = builder.compile(checkpointer=checkpointer)
  ```

  **Acceptance Criteria**:

  **Automated Verification:**

  ```bash
  # Agent runs:
  cd /opt/jarvis-v3/brain && python -c "from src.graph import graph; print(type(graph))"
  # Assert: Shows CompiledGraph or similar

  ls /opt/jarvis-v3/brain/src/nodes/*.py | wc -l
  # Assert: Output >= 3 (supervisor, coder, executor)
  ```

  **Evidence to Capture:**
  - [ ] graph.py content
  - [ ] Node files listing

  **Commit**: YES
  - Message: `feat(jarvis-v3): implement langgraph stategraph with supervisor/coder/executor`
  - Files: `/opt/jarvis-v3/brain/src/graph.py`, `/opt/jarvis-v3/brain/src/nodes/*`
  - Pre-commit: `python -c "from src.graph import graph"`

---

- [ ] 8. Implement LangGraph WebSocket server

  **What to do**:
  - Implement `/opt/jarvis-v3/brain/src/server.py`:
    - FastAPI app with WebSocket endpoint at `/ws`
    - Stream LangGraph execution via graph.stream()
    - Handle connection lifecycle (connect, disconnect, errors)
    - JSON message protocol: {type, content, thread_id}
  - Add `/health` HTTP endpoint
  - Add `/threads` endpoint to list active threads

  **Must NOT do**:
  - Do NOT implement authentication yet (add later)
  - Do NOT add complex message validation

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: WebSocket + async streaming requires careful implementation
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 9)
  - **Blocks**: Task 10
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - LangGraph streaming examples from Context7 research
  - FastAPI WebSocket patterns from grep.app search

  **External References**:
  - FastAPI WebSockets: https://fastapi.tiangolo.com/advanced/websockets/
  - LangGraph streaming: https://langchain-ai.github.io/langgraph/how-tos/streaming-tokens/

  **WHY Each Reference Matters**:
  - FastAPI docs show WebSocket lifecycle management
  - LangGraph streaming shows how to emit chunks

  **Code Pattern**:

  ```python
  from fastapi import FastAPI, WebSocket, WebSocketDisconnect
  from src.graph import graph
  import json

  app = FastAPI()

  @app.websocket("/ws")
  async def websocket_endpoint(websocket: WebSocket):
      await websocket.accept()
      try:
          while True:
              data = await websocket.receive_text()
              message = json.loads(data)

              config = {"configurable": {"thread_id": message.get("thread_id", "default")}}

              async for chunk in graph.astream(
                  {"messages": [{"role": "user", "content": message["content"]}]},
                  config=config,
                  stream_mode="updates"
              ):
                  await websocket.send_json({"type": "update", "data": chunk})

              await websocket.send_json({"type": "done"})
      except WebSocketDisconnect:
          pass
  ```

  **Acceptance Criteria**:

  **Automated Verification:**

  ```bash
  # Agent runs:
  cd /opt/jarvis-v3/brain && python -c "from src.server import app; print(app.routes)"
  # Assert: Shows WebSocket route

  grep -c "websocket" /opt/jarvis-v3/brain/src/server.py
  # Assert: Output >= 1
  ```

  **Evidence to Capture:**
  - [ ] server.py content
  - [ ] Route definitions

  **Commit**: YES
  - Message: `feat(jarvis-v3): implement websocket server for langgraph streaming`
  - Files: `/opt/jarvis-v3/brain/src/server.py`
  - Pre-commit: `python -c "from src.server import app"`

---

- [ ] 9. Implement Moltbot gRPC service methods

  **What to do**:
  - Implement Screenshot RPC using x11rb:
    - Capture full screen or region
    - Encode as PNG/JPEG
    - Return bytes via gRPC
  - Implement MouseMove, MouseClick using x11rb:
    - XTest extension for synthetic input
  - Implement KeyboardType, KeyboardPress:
    - XTest extension for key events
  - Implement ListWindows, FocusWindow:
    - Query X11 window tree

  **Must NOT do**:
  - Do NOT implement Wayland support yet (X11 only for MVP)
  - Do NOT implement file operations (focus on desktop automation)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: X11 + Rust requires system programming expertise
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 7, 8)
  - **Blocks**: Task 10
  - **Blocked By**: Task 6

  **References**:

  **Pattern References**:
  - `daemon/src/controllers/` - Controller patterns (for reference only)
  - `daemon/proto/daemon.proto:50-93` - RPC patterns (for reference only)

  **External References**:
  - x11rb examples: https://github.com/psychon/x11rb/tree/main/examples
  - X11 XTest: https://www.x.org/releases/X11R7.7/doc/xextproto/xtest.html

  **WHY Each Reference Matters**:
  - x11rb examples show screenshot and input injection patterns
  - XTest docs explain synthetic input API

  **Acceptance Criteria**:

  **Automated Verification:**

  ```bash
  # Agent runs:
  cd /opt/jarvis-v3/moltbot && cargo build --release 2>&1 | tail -3
  # Assert: Shows "Finished release"

  # Run and test (requires X11 display):
  # ./target/release/moltbot &
  # grpcurl -plaintext localhost:50051 moltbot.v1.Moltbot/Screenshot
  # Assert: Returns screenshot data
  ```

  **Evidence to Capture:**
  - [ ] cargo build output
  - [ ] Service implementation files

  **Commit**: YES
  - Message: `feat(jarvis-v3): implement moltbot desktop automation rpcs`
  - Files: `/opt/jarvis-v3/moltbot/src/*`
  - Pre-commit: `cargo build --release`

---

### Wave 4: Integration

- [ ] 10. Integration testing with docker compose up

  **What to do**:
  - Start all services: `docker compose up -d`
  - Verify Postgres is healthy
  - Verify model-server responds on port 8080
  - Verify brain WebSocket accepts connections on port 8000
  - Test end-to-end: Send message via WebSocket, get response
  - Fix any networking/configuration issues

  **Must NOT do**:
  - Do NOT modify code significantly (bug fixes only)
  - Do NOT add new features during integration

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Testing and debugging
  - **Skills**: [`dev-browser`]
    - `dev-browser`: May need to test WebSocket in browser
  - **Skills Evaluated but Omitted**:
    - `git-master`: Focus on testing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 5, 7, 8, 9

  **References**:

  **Pattern References**:
  - `deploy/docker-compose.yml:1-184` - Docker compose patterns

  **Acceptance Criteria**:

  **Automated Verification:**

  ```bash
  # Agent runs:
  cd /opt/jarvis-v3 && docker compose up -d
  sleep 10
  docker compose ps --format json | jq '.[].State' | grep -c "running"
  # Assert: Output >= 3 (postgres, model-server, brain all running)

  curl -s http://localhost:8080/health | jq '.gpu'
  # Assert: Shows GPU info

  curl -s http://localhost:8000/health
  # Assert: Returns 200
  ```

  **Evidence to Capture:**
  - [ ] docker compose ps output
  - [ ] Health endpoint responses

  **Commit**: YES (if fixes needed)
  - Message: `fix(jarvis-v3): integration fixes for docker compose stack`
  - Files: Any fixed files
  - Pre-commit: `docker compose up -d && docker compose ps`

---

- [ ] 11. End-to-end verification and documentation

  **What to do**:
  - Verify complete flow:
    1. Connect to WebSocket at ws://localhost:8000/ws
    2. Send: {"type": "message", "content": "Hello JARVIS", "thread_id": "test-1"}
    3. Receive streaming updates
    4. Verify response is coherent
  - Start Moltbot daemon: `./moltbot/target/release/moltbot`
  - Test Moltbot: `grpcurl -plaintext localhost:50051 moltbot.v1.Moltbot/Screenshot`
  - Create `/opt/jarvis-v3/README.md` with:
    - Quick start guide
    - Service ports
    - Environment variables
    - Troubleshooting

  **Must NOT do**:
  - Do NOT add new features
  - Do NOT change architecture

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Documentation and verification
  - **Skills**: [`dev-browser`]
    - `dev-browser`: WebSocket testing
  - **Skills Evaluated but Omitted**:
    - `git-master`: Final commit

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final
  - **Blocks**: None
  - **Blocked By**: Task 10

  **References**:

  **Pattern References**:
  - `AGENTS.md:1-200` - Documentation style

  **Acceptance Criteria**:

  **Automated Verification:**

  ```bash
  # Agent runs WebSocket test:
  echo '{"type":"message","content":"Hello JARVIS","thread_id":"test"}' | \
    websocat ws://localhost:8000/ws | head -5
  # Assert: Receives JSON responses with type "update"

  # Moltbot test:
  grpcurl -plaintext localhost:50051 list
  # Assert: Shows moltbot.v1.Moltbot

  # README exists:
  cat /opt/jarvis-v3/README.md | head -10
  # Assert: Shows title and content
  ```

  **Evidence to Capture:**
  - [ ] WebSocket response samples
  - [ ] Moltbot gRPC test output
  - [ ] README.md content

  **Commit**: YES
  - Message: `docs(jarvis-v3): add readme and finalize deployment`
  - Files: `/opt/jarvis-v3/README.md`
  - Pre-commit: None

---

## Commit Strategy

| After Task | Message                                                  | Files                            | Verification          |
| ---------- | -------------------------------------------------------- | -------------------------------- | --------------------- |
| 1          | `feat(jarvis-v3): add infrastructure foundation`         | docker-compose.yml, .env.example | docker compose config |
| 2          | `feat(jarvis-v3): add model-server with GPU support`     | model-server/\*                  | python -m py_compile  |
| 3          | `feat(jarvis-v3): add moltbot rust project structure`    | moltbot/\*                       | cargo check           |
| 4          | `feat(jarvis-v3): add langgraph brain project structure` | brain/\*                         | ls -la                |
| 5          | `feat(jarvis-v3): implement model-server GPU endpoints`  | model-server/main.py             | docker build          |
| 6          | `feat(jarvis-v3): implement moltbot grpc skeleton`       | moltbot/src/\*                   | cargo build           |
| 7          | `feat(jarvis-v3): implement langgraph stategraph`        | brain/src/graph.py, nodes/\*     | python import         |
| 8          | `feat(jarvis-v3): implement websocket server`            | brain/src/server.py              | python import         |
| 9          | `feat(jarvis-v3): implement moltbot desktop rpcs`        | moltbot/src/\*                   | cargo build --release |
| 10         | `fix(jarvis-v3): integration fixes`                      | varies                           | docker compose up     |
| 11         | `docs(jarvis-v3): add readme and finalize`               | README.md                        | cat README.md         |

---

## Success Criteria

### Verification Commands

```bash
# Infrastructure running
cd /opt/jarvis-v3 && docker compose ps
# Expected: All services "running"

# Model server GPU
curl http://localhost:8080/health
# Expected: {"status": "ok", "gpu": "NVIDIA RTX PRO 6000", ...}

# Brain WebSocket
websocat ws://localhost:8000/ws
# Expected: Accepts connection, responds to messages

# Moltbot gRPC
grpcurl -plaintext localhost:50051 list
# Expected: moltbot.v1.Moltbot

# End-to-end test
echo '{"type":"message","content":"What is 2+2?","thread_id":"test"}' | websocat ws://localhost:8000/ws
# Expected: Streaming response with answer
```

### Final Checklist

- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] docker compose up -d works
- [ ] WebSocket accepts connections
- [ ] Model server has GPU access
- [ ] Moltbot gRPC responds
- [ ] README.md exists
