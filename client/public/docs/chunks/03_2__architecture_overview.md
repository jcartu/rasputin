# 2. Architecture Overview

## 2.1 System Architecture Diagram

```mermaid
flowchart TB
    subgraph UserLayer["👤 User Interface Layer"]
        WebUI["Web UI<br/>(Next.js)"]
        CLI["CLI Interface"]
        VoiceUI["Voice Interface<br/>(Whisper + TTS)"]
        DesktopOverlay["Desktop Overlay<br/>(Electron)"]
    end

    subgraph ControlPlane["🎛️ Control Plane"]
        Gateway["API Gateway<br/>(FastAPI)"]
        Auth["Auth + Capability Tokens"]
        Orchestrator["Master Orchestrator<br/>(Session Manager)"]
    end

    subgraph SwarmLayer["🐝 Agent Swarm Layer"]
        Planner["Planner Agent<br/>(Task Decomposition)"]
        Coder["Coder Agent<br/>(Code Generation)"]
        Executor["Executor Agent<br/>(Action Execution)"]
        Verifier["Verifier Agent<br/>(Testing/Validation)"]
        Researcher["Researcher Agent<br/>(Web/Doc Search)"]
        Learner["Learner Agent<br/>(Pattern Extraction)"]
        Safety["Safety Agent<br/>(Policy Enforcement)"]
    end

    subgraph Infrastructure["🏗️ Core Infrastructure"]
        Redis[("Redis Streams<br/>+ KV Cache")]
        Qdrant[("Qdrant<br/>Vector Memory")]
        Postgres[("PostgreSQL<br/>Structured Data")]
        ObjectStore[("MinIO/S3<br/>Artifacts")]
    end

    subgraph LocalGPU["🎮 Local GPU Services (96GB)"]
        Embeddings["Embedding Server<br/>(BGE-M3, 4GB)"]
        VisionLM["Vision-Language<br/>(Qwen2-VL, 24GB)"]
        STT["Speech-to-Text<br/>(Whisper, 6GB)"]
        TTS["Text-to-Speech<br/>(XTTS, 4GB)"]
        CodeLM["Code Model<br/>(DeepSeek-Coder, 32GB)"]
        ImageGen["Image Gen<br/>(FLUX, 20GB)"]
    end

    subgraph FrontierAPIs["☁️ Frontier APIs"]
        Claude["Claude 4 Opus"]
        GPT["GPT-4.1"]
        Gemini["Gemini 2.5 Pro"]
        Perplexity["Perplexity Sonar"]
    end

    subgraph DesktopDaemon["🖥️ Desktop Daemon (Privileged)"]
        DaemonCore["gRPC Server<br/>(Rust)"]
        ScreenCapture["Screen Capture<br/>(1-30 FPS)"]
        InputInjection["Input Injection<br/>(Mouse/Keyboard)"]
        WindowMgr["Window Manager<br/>(X11/Wayland)"]
        FileOps["File Operations"]
        ProcessMgr["Process Manager"]
        BrowserCtrl["Browser Control<br/>(CDP/Playwright)"]
        A11yTree["Accessibility Tree<br/>(AT-SPI)"]
    end

    subgraph RasputinCore["⚡ Existing Rasputin (83+ Tools)"]
        WebSearch["Web Search"]
        CodeExec["Code Execution"]
        FileSystem["File System"]
        DocGen["Document Generation"]
        GitOps["Git Operations"]
        Docker["Docker Tools"]
        BrowserAuto["Browser Automation"]
        MultiAgent["Multi-Agent Tools"]
        Research["Research Tools"]
        Scaffolding["Project Scaffolding"]
    end

    UserLayer --> Gateway
    Gateway --> Auth
    Auth --> Orchestrator
    Orchestrator --> Redis

    SwarmLayer <--> Redis
    SwarmLayer <--> Qdrant
    SwarmLayer --> FrontierAPIs
    SwarmLayer --> LocalGPU

    Executor --> DesktopDaemon
    Executor --> RasputinCore

    DesktopDaemon --> LocalGPU

    Orchestrator --> ObjectStore
    Orchestrator --> Postgres
```

## 2.2 Data Flow Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant G as Gateway
    participant O as Orchestrator
    participant P as Planner
    participant R as Redis Streams
    participant C as Coder
    participant E as Executor
    participant V as Verifier
    participant D as Desktop Daemon
    participant Q as Qdrant
    participant F as Frontier APIs

    U->>G: Submit Task
    G->>O: Validate & Route
    O->>Q: Query Similar Episodes
    Q-->>O: Past Solutions
    O->>P: Plan Task
    P->>F: Reasoning (Claude/GPT)
    F-->>P: Task DAG
    P->>R: Publish Subtasks

    par Parallel Execution
        R->>C: Code Tasks
        C->>F: Generate Code
        F-->>C: Code
        C->>R: Code Ready
    and
        R->>E: Execute Tasks
        E->>D: System Actions
        D-->>E: Results
        E->>R: Execution Complete
    end

    R->>V: Verify Results
    V->>F: Validation Logic
    F-->>V: Pass/Fail
    V->>R: Verification Report

    alt Verification Failed
        R->>C: Retry with Feedback
    else Verification Passed
        R->>O: Task Complete
        O->>Q: Store Episode
        O->>U: Return Results
    end
```

## 2.3 Component Interaction Matrix

| Component    | Redis | Qdrant | Daemon | Frontier | Local GPU  | Rasputin     |
| ------------ | ----- | ------ | ------ | -------- | ---------- | ------------ |
| Orchestrator | R/W   | R      | -      | -        | -          | -            |
| Planner      | R/W   | R      | -      | R        | -          | -            |
| Coder        | R/W   | R/W    | -      | R        | R (CodeLM) | R (scaffold) |
| Executor     | R/W   | R      | R/W    | -        | R (Vision) | R/W (all)    |
| Verifier     | R/W   | R      | R      | R        | -          | R (tests)    |
| Researcher   | R/W   | R/W    | R      | R        | -          | R (search)   |
| Learner      | R     | R/W    | -      | R        | R (Embed)  | -            |
| Safety       | R/W   | R      | -      | R        | -          | -            |

---
