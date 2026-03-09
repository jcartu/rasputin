# Draft: JARVIS v3 Deployment Plan

## Requirements (confirmed)

### Target Environment

- **OS**: Arch Linux (kernel 6.18.3)
- **Docker**: 29.2.0 + Compose 5.0.2
- **GPU**: NVIDIA RTX PRO 6000 (98GB VRAM)
- **Python**: 3.14.2
- **Rust/Cargo**: 1.93.0
- **Storage**: 3.4TB free, 251GB RAM
- **Existing services**: rasputin-qdrant (6333), rasputin-redis (6379), rasputin-mysql (3306)

### Deployment Location

- `/opt/jarvis-v3/` directory

## User Decisions (CONFIRMED)

### Q1: Service Reuse - HYBRID

- **REUSE**: Existing Qdrant (6333) and Redis (6379)
- **NEW**: Deploy fresh Postgres for JARVIS v3 relational data

### Q2: Rust Daemon - BUILD FROM SCRATCH

- Build Moltbot daemon fresh in Rust following spec exactly
- Do NOT use existing `jarvis-daemon` from rasputin

### Q3: Cognitive Core - REPLACE WITH LANGGRAPH

- Full migration to Python/LangGraph
- Replacing TypeScript orchestrator entirely
- Fresh implementation at `/opt/jarvis-v3/`

### Q4: Priority Order - INFRASTRUCTURE FIRST

1. Docker stack + model server
2. LangGraph brain
3. Moltbot daemon

## Components to Build

### PART 1: Infrastructure (Wave 1)

- Directory structure at `/opt/jarvis-v3/`
- Docker compose with: Postgres (new), connect to existing Qdrant/Redis
- Model server (Python FastAPI) - GPU enabled

### PART 2: LangGraph Brain (Wave 2)

- LangGraph StateGraph with supervisor/coder/executor nodes
- FastAPI WebSocket server for chat interface
- Checkpointing and memory integration

### PART 3: Moltbot Daemon (Wave 3)

- Fresh Rust gRPC daemon for desktop automation
- Following spec exactly (not existing jarvis-daemon)

### PART 4: Life Stream + Oracle (Wave 4 - if time permits)

- Ingestion server (browser events → Qdrant)
- Oracle engine (proactive scheduler)

## Scope Boundaries

### INCLUDE

- Fresh deployment at `/opt/jarvis-v3/`
- Docker infrastructure with Postgres
- LangGraph-based cognitive core (Python)
- Moltbot Rust daemon (fresh build)
- Connection to existing Qdrant/Redis

### EXCLUDE

- Modifying existing rasputin TypeScript code
- WireGuard mobile setup (optional, defer)
- Migration of existing JARVIS data

## Technical Architecture

```
/opt/jarvis-v3/
├── docker-compose.yml      # Postgres + model-server
├── brain/                  # LangGraph cognitive core
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── src/
│   │   ├── graph.py        # StateGraph definition
│   │   ├── server.py       # FastAPI + WebSocket
│   │   ├── nodes/          # supervisor, coder, executor
│   │   └── tools/          # Tool definitions
│   └── tests/
├── model-server/           # GPU inference server
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
├── moltbot/                # Rust desktop daemon
│   ├── Cargo.toml
│   ├── build.rs
│   ├── proto/
│   │   └── moltbot.proto
│   └── src/
│       └── main.rs
└── ingestion/              # Life Stream (later)
    └── ...
```

## Service Ports (planned)

- Postgres: 5432 (new container)
- Model Server: 8080 (new)
- LangGraph Brain: 8000 (WebSocket)
- Moltbot gRPC: 50051
- Moltbot HTTP: 50052
- Qdrant: 6333 (existing)
- Redis: 6379 (existing)

---

_Draft updated with user decisions. Ready for plan generation._
