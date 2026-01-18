# JARVIS ULTIMATE v3 - The MANUS Killer
## Synthesized from GPT-5.2 Pro, Claude 4.5 Opus, Gemini 3.0 Pro, Grok 4
## Preserving and Extending 83+ Existing Rasputin Tools
---

# JARVIS v3: Ultimate Autonomous AI Operating System
## Complete Implementation Specification

---

# 1. Executive Summary

## 1.1 Mission Statement

JARVIS v3 transforms the existing Rasputin system from a capable AI assistant into the world's most powerful autonomous AI operating system. This specification details how to extend Rasputin's 83+ existing tools with:

1. **Desktop Daemon** - Full OS control rivaling MANUS (screen capture, input injection, window management, process control)
2. **Swarm Intelligence** - Multi-agent coordination with anti-thrash consensus protocols
3. **Episodic Memory** - Qdrant-powered learning that improves with every interaction
4. **Full-Stack Autonomy** - End-to-end web application development and deployment
5. **Hybrid Intelligence** - Frontier APIs for reasoning, local GPU for perception and speed

## 1.2 Key Differentiators vs. Competition

| Capability | ChatGPT | MANUS | OpenCode | JARVIS v3 |
|------------|---------|-------|----------|-----------|
| Frontier Reasoning | ✅ | ❌ | ✅ | ✅ Multi-model consensus |
| Desktop Control | ❌ | ✅ | ❌ | ✅ Privileged daemon |
| Code Generation | ✅ | ❌ | ✅ | ✅ With execution |
| Multi-Agent Swarm | ❌ | ❌ | ❌ | ✅ 7 specialized agents |
| Episodic Memory | ❌ | ❌ | ❌ | ✅ Qdrant learning |
| Local GPU Inference | ❌ | ❌ | ❌ | ✅ 96GB VRAM |
| Full Deployment | ❌ | ❌ | Partial | ✅ End-to-end |

## 1.3 Hardware Target Specifications

```yaml
CPU: Intel Xeon (56 cores, 112 threads)
RAM: 256GB DDR5
GPU: NVIDIA RTX Pro 6000 Blackwell (96GB VRAM)
Storage: NVMe SSD (recommended 2TB+)
Network: 10Gbps+ for API calls
Users: 1-5 concurrent (not simultaneous heavy tasks)
```

## 1.4 Core Principles

1. **EXTEND, DON'T REPLACE** - Rasputin's 83+ tools remain the foundation
2. **SPEED FIRST** - Frontier APIs for reasoning, local GPU for perception
3. **FAIL GRACEFULLY** - Every component has fallbacks
4. **LEARN CONTINUOUSLY** - Every interaction improves the system
5. **SECURE BY DEFAULT** - Capability-based security, sandboxing, audit trails

---

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

| Component | Redis | Qdrant | Daemon | Frontier | Local GPU | Rasputin |
|-----------|-------|--------|--------|----------|-----------|----------|
| Orchestrator | R/W | R | - | - | - | - |
| Planner | R/W | R | - | R | - | - |
| Coder | R/W | R/W | - | R | R (CodeLM) | R (scaffold) |
| Executor | R/W | R | R/W | - | R (Vision) | R/W (all) |
| Verifier | R/W | R | R | R | - | R (tests) |
| Researcher | R/W | R/W | R | R | - | R (search) |
| Learner | R | R/W | - | R | R (Embed) | - |
| Safety | R/W | R | - | R | - | - |

---

# 3. Existing Rasputin Integration Map

## 3.1 Tool Category Mapping

The existing 83+ Rasputin tools map to JARVIS v3 agents as follows:

```mermaid
graph LR
    subgraph RasputinTools["Existing Rasputin Tools"]
        T1["Web Search (1)"]
        T2["Code Execution (3-5)"]
        T3["File System (6-8)"]
        T4["Document Gen (9-10, 67-68, 82-83)"]
        T5["SSH Remote (14-17)"]
        T6["Git Operations (18-28, 51-52)"]
        T7["Docker (29-30)"]
        T8["Dev Tools (32-40)"]
        T9["Browser Auto (42-47)"]
        T10["Database (48)"]
        T11["Communication (49)"]
        T12["tmux Sessions (53-57)"]
        T13["Multi-Agent (58-59)"]
        T14["Security (61-63)"]
        T15["Vision (64-66)"]
        T16["Audio (70-72)"]
        T17["Research (73-75)"]
        T18["Scaffolding (76-81)"]
    end

    subgraph JARVISAgents["JARVIS v3 Agents"]
        Planner
        Coder
        Executor
        Verifier
        Researcher
        Learner
        Safety
    end

    T1 --> Researcher
    T2 --> Executor
    T3 --> Executor
    T4 --> Coder
    T5 --> Executor
    T6 --> Coder
    T7 --> Executor
    T8 --> Coder
    T9 --> Executor
    T10 --> Coder
    T11 --> Executor
    T12 --> Executor
    T13 --> Planner
    T14 --> Safety
    T15 --> Executor
    T16 --> Executor
    T17 --> Researcher
    T18 --> Coder
```

## 3.2 Extension Points

### 3.2.1 New Tool Wrappers

Each existing tool gets wrapped with JARVIS v3 metadata:

```typescript
// jarvis/tools/wrapper.ts
import { Tool, ToolResult } from '@rasputin/core';

interface JARVISToolMetadata {
  agentAffinity: ('planner' | 'coder' | 'executor' | 'verifier' | 'researcher' | 'learner' | 'safety')[];
  requiresLease: string[];  // Resources that need locking
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number;  // milliseconds
  canParallelize: boolean;
  qdrantCollections: string[];  // Collections to query/update
}

interface JARVISToolWrapper<T extends Tool> {
  tool: T;
  metadata: JARVISToolMetadata;
  
  // Pre-execution hooks
  beforeExecute(context: ExecutionContext): Promise<void>;
  
  // Post-execution hooks
  afterExecute(result: ToolResult, context: ExecutionContext): Promise<void>;
  
  // Learning hook
  extractLearning(result: ToolResult): Promise<LearningPayload | null>;
}

// Example: Wrapping scaffold_project
const scaffoldProjectWrapper: JARVISToolWrapper<typeof scaffold_project> = {
  tool: scaffold_project,
  metadata: {
    agentAffinity: ['coder'],
    requiresLease: ['filesystem:/workspaces'],
    riskLevel: 'medium',
    estimatedDuration: 30000,
    canParallelize: false,
    qdrantCollections: ['skills', 'code_snippets']
  },
  
  async beforeExecute(context) {
    // Query Qdrant for similar past scaffolds
    const similar = await context.qdrant.search('skills', {
      vector: await embed(context.task.description),
      filter: { domain: 'scaffolding' },
      limit: 3
    });
    context.enrichment = { similarProjects: similar };
  },
  
  async afterExecute(result, context) {
    // Store successful scaffold as skill
    if (result.success) {
      await context.qdrant.upsert('skills', {
        id: uuid(),
        vector: await embed(JSON.stringify(result)),
        payload: {
          type: 'scaffold',
          params: context.params,
          timestamp: Date.now()
        }
      });
    }
  },
  
  async extractLearning(result) {
    if (!result.success) return null;
    return {
      type: 'scaffold_pattern',
      pattern: result.generatedStructure,
      successMetrics: result.metrics
    };
  }
};
```

### 3.2.2 Tool Registry Extension

```typescript
// jarvis/tools/registry.ts
import { existingTools } from '@rasputin/tools';
import { JARVISToolWrapper } from './wrapper';

class JARVISToolRegistry {
  private tools: Map<string, JARVISToolWrapper<any>> = new Map();
  private byAgent: Map<string, Set<string>> = new Map();
  
  constructor() {
    // Initialize agent affinity maps
    const agents = ['planner', 'coder', 'executor', 'verifier', 'researcher', 'learner', 'safety'];
    agents.forEach(a => this.byAgent.set(a, new Set()));
  }
  
  register(name: string, wrapper: JARVISToolWrapper<any>) {
    this.tools.set(name, wrapper);
    wrapper.metadata.agentAffinity.forEach(agent => {
      this.byAgent.get(agent)!.add(name);
    });
  }
  
  getToolsForAgent(agent: string): JARVISToolWrapper<any>[] {
    const toolNames = this.byAgent.get(agent) || new Set();
    return Array.from(toolNames).map(name => this.tools.get(name)!);
  }
  
  async executeWithHooks(
    name: string,
    params: any,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const wrapper = this.tools.get(name);
    if (!wrapper) throw new Error(`Tool ${name} not found`);
    
    // Acquire leases
    for (const lease of wrapper.metadata.requiresLease) {
      await context.leaseManager.acquire(lease, context.sessionId);
    }
    
    try {
      await wrapper.beforeExecute(context);
      const result = await wrapper.tool.execute(params);
      await wrapper.afterExecute(result, context);
      
      // Extract learning asynchronously
      const learning = await wrapper.extractLearning(result);
      if (learning) {
        context.redis.xadd('jarvis.learning.v1', '*', learning);
      }
      
      return result;
    } finally {
      // Release leases
      for (const lease of wrapper.metadata.requiresLease) {
        await context.leaseManager.release(lease, context.sessionId);
      }
    }
  }
}

// Initialize with all existing Rasputin tools
export const toolRegistry = new JARVISToolRegistry();

// Register all 83+ existing tools with JARVIS metadata
Object.entries(existingTools).forEach(([name, tool]) => {
  toolRegistry.register(name, createDefaultWrapper(name, tool));
});
```

## 3.3 Backward Compatibility Layer

```typescript
// jarvis/compat/rasputin.ts

/**
 * Ensures all existing Rasputin functionality continues to work
 * while adding JARVIS v3 capabilities
 */
export class RasputinCompatLayer {
  private registry: JARVISToolRegistry;
  
  constructor(registry: JARVISToolRegistry) {
    this.registry = registry;
  }
  
  /**
   * Execute a tool exactly as Rasputin would
   * (no JARVIS hooks, no learning, no leases)
   */
  async executeLegacy(toolName: string, params: any): Promise<any> {
    const wrapper = this.registry.tools.get(toolName);
    if (!wrapper) throw new Error(`Tool ${toolName} not found`);
    return wrapper.tool.execute(params);
  }
  
  /**
   * Execute with full JARVIS v3 capabilities
   */
  async executeEnhanced(
    toolName: string,
    params: any,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.registry.executeWithHooks(toolName, params, context);
  }
  
  /**
   * Get tool metadata for planning
   */
  getToolMetadata(toolName: string): JARVISToolMetadata | null {
    return this.registry.tools.get(toolName)?.metadata || null;
  }
  
  /**
   * List all available tools with their capabilities
   */
  listTools(): ToolCatalog {
    return Array.from(this.registry.tools.entries()).map(([name, wrapper]) => ({
      name,
      description: wrapper.tool.description,
      parameters: wrapper.tool.parameters,
      metadata: wrapper.metadata
    }));
  }
}
```

---

# 4. Desktop Daemon Specification

## 4.1 Overview

The Desktop Daemon is the "MANUS-killer" - a privileged local service that provides complete OS control. It runs as a system service with elevated permissions and exposes a gRPC API for agents to control the desktop.

### 4.1.1 Design Principles

1. **Rust for Safety** - Memory-safe, zero-cost abstractions
2. **gRPC for Speed** - Low-latency, streaming support
3. **Capability-Based Security** - Fine-grained permission tokens
4. **Lease-Based Coordination** - Prevent multi-agent conflicts
5. **Full Audit Trail** - Every action logged

### 4.1.2 Architecture

```mermaid
graph TB
    subgraph DaemonProcess["Desktop Daemon Process (Rust)"]
        GRPC["gRPC Server<br/>:50051"]
        Auth["Auth Middleware"]
        Lease["Lease Manager"]
        Audit["Audit Logger"]
        
        subgraph Controllers["System Controllers"]
            Screen["Screen Controller"]
            Input["Input Controller"]
            Window["Window Controller"]
            File["File Controller"]
            Process["Process Controller"]
            Browser["Browser Controller"]
            A11y["Accessibility Controller"]
            Clipboard["Clipboard Controller"]
        end
    end
    
    subgraph SystemAPIs["System APIs"]
        X11["X11/XCB"]
        Wayland["Wayland"]
        Uinput["uinput"]
        ATSPI["AT-SPI2"]
        CDP["Chrome DevTools"]
        Pipewire["PipeWire"]
    end
    
    GRPC --> Auth
    Auth --> Lease
    Lease --> Controllers
    Controllers --> Audit
    
    Screen --> X11
    Screen --> Wayland
    Screen --> Pipewire
    Input --> Uinput
    Input --> X11
    Window --> X11
    Window --> Wayland
    A11y --> ATSPI
    Browser --> CDP
```

## 4.2 gRPC Protocol Definition

```protobuf
// jarvis/daemon/proto/daemon.proto
syntax = "proto3";

package jarvis.daemon.v1;

option go_package = "github.com/jarvis/daemon/gen/v1;daemonv1";

// ============================================================================
// COMMON TYPES
// ============================================================================

message Capability {
  string token = 1;           // JWT/PASETO signed by Control Plane
  repeated string scopes = 2; // Granted permissions
  int64 expires_at = 3;       // Unix timestamp
  string session_id = 4;      // Session identifier
  string user_id = 5;         // User identifier
}

message Empty {}

message Status {
  bool success = 1;
  string message = 2;
  string error_code = 3;
}

message Rect {
  int32 x = 1;
  int32 y = 2;
  int32 width = 3;
  int32 height = 4;
}

message Point {
  int32 x = 1;
  int32 y = 2;
}

// ============================================================================
// SCREEN CAPTURE
// ============================================================================

message Display {
  int32 id = 1;
  string name = 2;
  int32 width = 3;
  int32 height = 4;
  float scale = 5;
  bool primary = 6;
}

message ListDisplaysRequest {
  Capability cap = 1;
}

message ListDisplaysResponse {
  repeated Display displays = 1;
}

message ScreenshotRequest {
  Capability cap = 1;
  int32 display_id = 2;       // 0 = primary
  Rect region = 3;            // Optional, null = full screen
  string format = 4;          // "png", "jpeg", "webp"
  int32 quality = 5;          // 1-100 for jpeg/webp
  bool include_cursor = 6;
}

message Screenshot {
  bytes image_data = 1;
  int64 timestamp_ms = 2;
  Display display = 3;
  Rect captured_region = 4;
}

message ScreenStreamRequest {
  Capability cap = 1;
  int32 display_id = 2;
  int32 fps = 3;              // 1-30
  Rect region = 4;
  string format = 5;          // "jpeg" recommended
  int32 quality = 6;
  bool include_cursor = 7;
  bool delta_encoding = 8;    // Send only changed regions
}

message ScreenFrame {
  bytes data = 1;
  int64 timestamp_ms = 2;
  bool is_keyframe = 3;
  Rect dirty_region = 4;      // Changed region if delta_encoding
}

// ============================================================================
// INPUT INJECTION
// ============================================================================

message MouseMoveRequest {
  Capability cap = 1;
  int32 x = 2;
  int32 y = 3;
  int32 display_id = 4;
  bool relative = 5;          // true = relative movement
  int32 duration_ms = 6;      // 0 = instant, >0 = smooth movement
}

message MouseButtonRequest {
  Capability cap = 1;
  enum Button {
    LEFT = 0;
    RIGHT = 1;
    MIDDLE = 2;
    BACK = 3;
    FORWARD = 4;
  }
  Button button = 2;
  enum Action {
    PRESS = 0;
    RELEASE = 1;
    CLICK = 2;       // Press + Release
    DOUBLE_CLICK = 3;
  }
  Action action = 3;
  Point position = 4;         // Optional, null = current position
  int32 display_id = 5;
}

message MouseScrollRequest {
  Capability cap = 1;
  int32 delta_x = 2;          // Horizontal scroll
  int32 delta_y = 3;          // Vertical scroll
  Point position = 4;         // Optional
  int32 display_id = 5;
}

message KeyboardKeyRequest {
  Capability cap = 1;
  string key = 2;             // Key name: "a", "Enter", "F1", "Ctrl", etc.
  enum Action {
    PRESS = 0;
    RELEASE = 1;
    TAP = 2;         // Press + Release
  }
  Action action = 3;
  repeated string modifiers = 4; // "Ctrl", "Shift", "Alt", "Meta"
}

message KeyboardTypeRequest {
  Capability cap = 1;
  string text = 2;
  int32 delay_ms = 3;         // Delay between characters
}

message KeyboardShortcutRequest {
  Capability cap = 1;
  repeated string keys = 2;   // e.g., ["Ctrl", "Shift", "P"]
}

// ============================================================================
// WINDOW MANAGEMENT
// ============================================================================

message Window {
  string id = 1;              // Window handle/ID
  string title = 2;
  string app_name = 3;
  string process_name = 4;
  int32 pid = 5;
  Rect bounds = 6;
  bool focused = 7;
  bool minimized = 8;
  bool maximized = 9;
  int32 display_id = 10;
}

message ListWindowsRequest {
  Capability cap = 1;
  bool include_minimized = 2;
  bool include_hidden = 3;
  string filter_app = 4;      // Optional app name filter
}

message ListWindowsResponse {
  repeated Window windows = 1;
}

message FocusWindowRequest {
  Capability cap = 1;
  string window_id = 2;
}

message MoveWindowRequest {
  Capability cap = 1;
  string window_id = 2;
  Rect bounds = 3;
}

message WindowActionRequest {
  Capability cap = 1;
  string window_id = 2;
  enum Action {
    MINIMIZE = 0;
    MAXIMIZE = 1;
    RESTORE = 2;
    CLOSE = 3;
  }
  Action action = 3;
}

// ============================================================================
// ACCESSIBILITY TREE
// ============================================================================

message AccessibilityNode {
  string id = 1;
  string role = 2;            // "button", "textfield", "menu", etc.
  string name = 3;
  string description = 4;
  string value = 5;
  Rect bounds = 6;
  repeated string states = 7; // "focused", "enabled", "checked", etc.
  repeated string actions = 8; // Available actions
  repeated AccessibilityNode children = 9;
}

message GetAccessibilityTreeRequest {
  Capability cap = 1;
  string window_id = 2;       // Optional, null = focused window
  int32 max_depth = 3;        // 0 = unlimited
}

message GetAccessibilityTreeResponse {
  AccessibilityNode root = 1;
  string window_id = 2;
}

message FindAccessibilityNodeRequest {
  Capability cap = 1;
  string window_id = 2;
  string role = 3;            // Optional filter
  string name_contains = 4;   // Optional filter
  int32 limit = 5;
}

message FindAccessibilityNodeResponse {
  repeated AccessibilityNode nodes = 1;
}

message PerformAccessibilityActionRequest {
  Capability cap = 1;
  string node_id = 2;
  string action = 3;          // "click", "focus", "setValue", etc.
  string value = 4;           // For setValue
}

// ============================================================================
// FILE SYSTEM
// ============================================================================

message FileInfo {
  string path = 1;
  string name = 2;
  bool is_dir = 3;
  int64 size = 4;
  int64 modified_ms = 5;
  int64 created_ms = 6;
  string permissions = 7;     // e.g., "rwxr-xr-x"
}

message ListFilesRequest {
  Capability cap = 1;
  string path = 2;
  bool recursive = 3;
  int32 max_depth = 4;
  string pattern = 5;         // Glob pattern
}

message ListFilesResponse {
  repeated FileInfo files = 1;
}

message ReadFileRequest {
  Capability cap = 1;
  string path = 2;
  int64 offset = 3;
  int64 max_bytes = 4;        // 0 = all
}

message ReadFileResponse {
  bytes data = 1;
  bool truncated = 2;
  int64 total_size = 3;
}

message WriteFileRequest {
  Capability cap = 1;
  string path = 2;
  bytes data = 3;
  bool create_dirs = 4;
  bool atomic = 5;            // Write to temp, then rename
  string mode = 6;            // e.g., "0644"
  bool append = 7;
}

message DeleteFileRequest {
  Capability cap = 1;
  string path = 2;
  bool recursive = 3;
}

message CopyFileRequest {
  Capability cap = 1;
  string source = 2;
  string destination = 3;
  bool overwrite = 4;
}

message MoveFileRequest {
  Capability cap = 1;
  string source = 2;
  string destination = 3;
  bool overwrite = 4;
}

// ============================================================================
// PROCESS MANAGEMENT
// ============================================================================

message ProcessInfo {
  int32 pid = 1;
  int32 ppid = 2;
  string name = 3;
  string cmdline = 4;
  string user = 5;
  float cpu_percent = 6;
  int64 memory_bytes = 7;
  int64 started_ms = 8;
  string status = 9;          // "running", "sleeping", "zombie", etc.
}

message ListProcessesRequest {
  Capability cap = 1;
  string filter_name = 2;
  string filter_user = 3;
}

message ListProcessesResponse {
  repeated ProcessInfo processes = 1;
}

message StartProcessRequest {
  Capability cap = 1;
  string command = 2;
  repeated string args = 3;
  string working_dir = 4;
  map<string, string> env = 5;
  bool detached = 6;
}

message StartProcessResponse {
  int32 pid = 1;
}

message KillProcessRequest {
  Capability cap = 1;
  int32 pid = 2;
  string signal = 3;          // "SIGTERM", "SIGKILL", "SIGINT"
}

// ============================================================================
// SHELL EXECUTION
// ============================================================================

message ShellExecRequest {
  Capability cap = 1;
  string command = 2;
  string working_dir = 3;
  map<string, string> env = 4;
  int32 timeout_seconds = 5;
  bool stream_output = 6;
}

message ShellExecResponse {
  int32 exit_code = 1;
  bytes stdout = 2;
  bytes stderr = 3;
  int64 duration_ms = 4;
}

message ShellExecChunk {
  enum Stream {
    STDOUT = 0;
    STDERR = 1;
  }
  Stream stream = 1;
  bytes data = 2;
  int64 timestamp_ms = 3;
}

// ============================================================================
// CLIPBOARD
// ============================================================================

message GetClipboardRequest {
  Capability cap = 1;
}

message GetClipboardResponse {
  string text = 1;
  bytes image = 2;            // PNG if image content
  string mime_type = 3;
}

message SetClipboardRequest {
  Capability cap = 1;
  string text = 2;
  bytes image = 3;
}

// ============================================================================
// BROWSER AUTOMATION (CDP Integration)
// ============================================================================

message BrowserSession {
  string id = 1;
  string profile_id = 2;
  bool headless = 3;
  string user_agent = 4;
}

message BrowserOpenRequest {
  Capability cap = 1;
  string profile_id = 2;      // Isolated profile directory
  bool headless = 3;
  string user_agent = 4;
  repeated string args = 5;   // Additional browser args
}

message BrowserOpenResponse {
  BrowserSession session = 1;
}

message BrowserNavigateRequest {
  Capability cap = 1;
  string session_id = 2;
  string url = 3;
  int32 timeout_ms = 4;
}

message BrowserNavigateResponse {
  string final_url = 1;
  int32 status_code = 2;
}

message BrowserClickRequest {
  Capability cap = 1;
  string session_id = 2;
  string selector = 3;        // CSS or XPath
  int32 timeout_ms = 4;
}

message BrowserTypeRequest {
  Capability cap = 1;
  string session_id = 2;
  string selector = 3;
  string text = 4;
  int32 delay_ms = 5;
}

message BrowserEvalRequest {
  Capability cap = 1;
  string session_id = 2;
  string script = 3;          // JavaScript
}

message BrowserEvalResponse {
  string result_json = 1;
}

message BrowserScreenshotRequest {
  Capability cap = 1;
  string session_id = 2;
  bool full_page = 3;
  string format = 4;
  int32 quality = 5;
}

message BrowserGetContentRequest {
  Capability cap = 1;
  string session_id = 2;
  enum ContentType {
    HTML = 0;
    TEXT = 1;
  }
  ContentType content_type = 3;
}

message BrowserGetContentResponse {
  string content = 1;
}

message BrowserCloseRequest {
  Capability cap = 1;
  string session_id = 2;
}

// ============================================================================
// SERVICE DEFINITION
// ============================================================================

service DesktopDaemon {
  // Display & Screen
  rpc ListDisplays(ListDisplaysRequest) returns (ListDisplaysResponse);
  rpc Screenshot(ScreenshotRequest) returns (Screenshot);
  rpc ScreenStream(ScreenStreamRequest) returns (stream ScreenFrame);
  
  // Input
  rpc MouseMove(MouseMoveRequest) returns (Status);
  rpc MouseButton(MouseButtonRequest) returns (Status);
  rpc MouseScroll(MouseScrollRequest) returns (Status);
  rpc KeyboardKey(KeyboardKeyRequest) returns (Status);
  rpc KeyboardType(KeyboardTypeRequest) returns (Status);
  rpc KeyboardShortcut(KeyboardShortcutRequest) returns (Status);
  
  // Windows
  rpc ListWindows(ListWindowsRequest) returns (ListWindowsResponse);
  rpc FocusWindow(FocusWindowRequest) returns (Status);
  rpc MoveWindow(MoveWindowRequest) returns (Status);
  rpc WindowAction(WindowActionRequest) returns (Status);
  
  // Accessibility
  rpc GetAccessibilityTree(GetAccessibilityTreeRequest) returns (GetAccessibilityTreeResponse);
  rpc FindAccessibilityNode(FindAccessibilityNodeRequest) returns (FindAccessibilityNodeResponse);
  rpc PerformAccessibilityAction(PerformAccessibilityActionRequest) returns (Status);
  
  // File System
  rpc ListFiles(ListFilesRequest) returns (ListFilesResponse);
  rpc ReadFile(ReadFileRequest) returns (ReadFileResponse);
  rpc WriteFile(WriteFileRequest) returns (Status);
  rpc DeleteFile(DeleteFileRequest) returns (Status);
  rpc CopyFile(CopyFileRequest) returns (Status);
  rpc MoveFile(MoveFileRequest) returns (Status);
  
  // Processes
  rpc ListProcesses(ListProcessesRequest) returns (ListProcessesResponse);
  rpc StartProcess(StartProcessRequest) returns (StartProcessResponse);
  rpc KillProcess(KillProcessRequest) returns (Status);
  
  // Shell
  rpc ShellExec(ShellExecRequest) returns (ShellExecResponse);
  rpc ShellExecStream(ShellExecRequest) returns (stream ShellExecChunk);
  
  // Clipboard
  rpc GetClipboard(GetClipboardRequest) returns (GetClipboardResponse);
  rpc SetClipboard(SetClipboardRequest) returns (Status);
  
  // Browser
  rpc BrowserOpen(BrowserOpenRequest) returns (BrowserOpenResponse);
  rpc BrowserNavigate(BrowserNavigateRequest) returns (BrowserNavigateResponse);
  rpc BrowserClick(BrowserClickRequest) returns (Status);
  rpc BrowserType(BrowserTypeRequest) returns (Status);
  rpc BrowserEval(BrowserEvalRequest) returns (BrowserEvalResponse);
  rpc BrowserScreenshot(BrowserScreenshotRequest) returns (Screenshot);
  rpc BrowserGetContent(BrowserGetContentRequest) returns (BrowserGetContentResponse);
  rpc BrowserClose(BrowserCloseRequest) returns (Status);
}
```

## 4.3 Rust Implementation

### 4.3.1 Project Structure

```
jarvis-daemon/
├── Cargo.toml
├── build.rs                    # Proto compilation
├── proto/
│   └── daemon.proto
├── src/
│   ├── main.rs
│   ├── lib.rs
│   ├── config.rs
│   ├── auth/
│   │   ├── mod.rs
│   │   ├── capability.rs       # Capability token validation
│   │   └── middleware.rs       # gRPC auth interceptor
│   ├── lease/
│   │   ├── mod.rs
│   │   └── manager.rs          # Resource lease management
│   ├── audit/
│   │   ├── mod.rs
│   │   └── logger.rs           # Action audit logging
│   ├── controllers/
│   │   ├── mod.rs
│   │   ├── screen.rs           # Screen capture
│   │   ├── input.rs            # Mouse/keyboard injection
│   │   ├── window.rs           # Window management
│   │   ├── accessibility.rs    # AT-SPI integration
│   │   ├── file.rs             # File operations
│   │   ├── process.rs          # Process management
│   │   ├── shell.rs            # Shell execution
│   │   ├── clipboard.rs        # Clipboard access
│   │   └── browser.rs          # CDP browser control
│   ├── platform/
│   │   ├── mod.rs
│   │   ├── linux/
│   │   │   ├── mod.rs
│   │   │   ├── x11.rs
│   │   │   ├── wayland.rs
│   │   │   ├── uinput.rs
│   │   │   └── atspi.rs
│   │   └── windows/            # Future
│   │       └── mod.rs
│   └── service.rs              # gRPC service implementation
└── tests/
    └── integration_tests.rs
```

### 4.3.2 Core Implementation

```rust
// src/main.rs
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tonic::transport::Server;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod auth;
mod audit;
mod config;
mod controllers;
mod lease;
mod platform;
mod service;

use config::DaemonConfig;
use service::DesktopDaemonService;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_file(true)
        .with_line_number(true)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    // Load configuration
    let config = DaemonConfig::load()?;
    info!("Starting JARVIS Desktop Daemon v{}", env!("CARGO_PKG_VERSION"));
    info!("Binding to {}", config.bind_address);

    // Initialize components
    let auth_manager = Arc::new(auth::AuthManager::new(&config.auth)?);
    let lease_manager = Arc::new(RwLock::new(lease::LeaseManager::new()));
    let audit_logger = Arc::new(audit::AuditLogger::new(&config.audit)?);

    // Initialize platform-specific controllers
    let screen_controller = Arc::new(controllers::ScreenController::new(&config)?);
    let input_controller = Arc::new(controllers::InputController::new(&config)?);
    let window_controller = Arc::new(controllers::WindowController::new(&config)?);
    let a11y_controller = Arc::new(controllers::AccessibilityController::new(&config)?);
    let file_controller = Arc::new(controllers::FileController::new(&config)?);
    let process_controller = Arc::new(controllers::ProcessController::new(&config)?);
    let shell_controller = Arc::new(controllers::ShellController::new(&config)?);
    let clipboard_controller = Arc::new(controllers::ClipboardController::new(&config)?);
    let browser_controller = Arc::new(RwLock::new(controllers::BrowserController::new(&config)?));

    // Create service
    let service = DesktopDaemonService {
        auth_manager,
        lease_manager,
        audit_logger,
        screen: screen_controller,
        input: input_controller,
        window: window_controller,
        accessibility: a11y_controller,
        file: file_controller,
        process: process_controller,
        shell: shell_controller,
        clipboard: clipboard_controller,
        browser: browser_controller,
        config: Arc::new(config.clone()),
    };

    // Build server with auth interceptor
    let addr: SocketAddr = config.bind_address.parse()?;
    
    Server::builder()
        .add_service(
            daemon_proto::desktop_daemon_server::DesktopDaemonServer::with_interceptor(
                service,
                auth::middleware::check_auth,
            )
        )
        .serve(addr)
        .await?;

    Ok(())
}
```

```rust
// src/config.rs
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonConfig {
    pub bind_address: String,
    pub auth: AuthConfig,
    pub audit: AuditConfig,
    pub security: SecurityConfig,
    pub platform: PlatformConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub allowed_issuers: Vec<String>,
    pub token_expiry_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditConfig {
    pub log_path: PathBuf,
    pub max_size_mb: u64,
    pub retention_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub sandbox_mode: SandboxMode,
    pub allowed_paths: Vec<PathBuf>,
    pub blocked_paths: Vec<PathBuf>,
    pub max_file_size_mb: u64,
    pub rate_limit_per_second: u32,
    pub dangerous_commands: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SandboxMode {
    Strict,    // Only workspace directories
    Standard,  // Broader FS, blocks system dirs
    Admin,     // Full access (requires explicit approval)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    pub display_server: DisplayServer,
    pub browser_path: PathBuf,
    pub browser_profile_dir: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DisplayServer {
    X11,
    Wayland,
    Auto,
}

impl DaemonConfig {
    pub fn load() -> Result<Self, config::ConfigError> {
        let config_path = std::env::var("JARVIS_DAEMON_CONFIG")
            .unwrap_or_else(|_| "/etc/jarvis/daemon.toml".to_string());
        
        let settings = config::Config::builder()
            .add_source(config::File::with_name(&config_path).required(false))
            .add_source(config::Environment::with_prefix("JARVIS_DAEMON"))
            .build()?;
        
        settings.try_deserialize()
    }
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            bind_address: "127.0.0.1:50051".to_string(),
            auth: AuthConfig {
                jwt_secret: "change-me-in-production".to_string(),
                allowed_issuers: vec!["jarvis-control-plane".to_string()],
                token_expiry_seconds: 3600,
            },
            audit: AuditConfig {
                log_path: PathBuf::from("/var/log/jarvis/daemon-audit.log"),
                max_size_mb: 100,
                retention_days: 30,
            },
            security: SecurityConfig {
                sandbox_mode: SandboxMode::Standard,
                allowed_paths: vec![
                    PathBuf::from("/home"),
                    PathBuf::from("/tmp"),
                    PathBuf::from("/workspaces"),
                ],
                blocked_paths: vec![
                    PathBuf::from("/etc"),
                    PathBuf::from("/root"),
                    PathBuf::from("/sys"),
                    PathBuf::from("/proc"),
                ],
                max_file_size_mb: 100,
                rate_limit_per_second: 100,
                dangerous_commands: vec![
                    "rm -rf /".to_string(),
                    "mkfs".to_string(),
                    "dd if=/dev/zero".to_string(),
                ],
            },
            platform: PlatformConfig {
                display_server: DisplayServer::Auto,
                browser_path: PathBuf::from("/usr/bin/chromium"),
                browser_profile_dir: PathBuf::from("/var/lib/jarvis/browser-profiles"),
            },
        }
    }
}
```

```rust
// src/controllers/screen.rs
use crate::config::DaemonConfig;
use crate::platform::linux::{x11::X11Screen, wayland::WaylandScreen};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, warn};

pub struct ScreenController {
    backend: ScreenBackend,
}

enum ScreenBackend {
    X11(X11Screen),
    Wayland(WaylandScreen),
}

impl ScreenController {
    pub fn new(config: &DaemonConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let backend = match &config.platform.display_server {
            crate::config::DisplayServer::X11 => {
                ScreenBackend::X11(X11Screen::new()?)
            }
            crate::config::DisplayServer::Wayland => {
                ScreenBackend::Wayland(WaylandScreen::new()?)
            }
            crate::config::DisplayServer::Auto => {
                // Try Wayland first, fall back to X11
                if let Ok(wayland) = WaylandScreen::new() {
                    info!("Using Wayland display server");
                    ScreenBackend::Wayland(wayland)
                } else if let Ok(x11) = X11Screen::new() {
                    info!("Using X11 display server");
                    ScreenBackend::X11(x11)
                } else {
                    return Err("No display server available".into());
                }
            }
        };
        
        Ok(Self { backend })
    }
    
    pub fn list_displays(&self) -> Result<Vec<Display>, Box<dyn std::error::Error>> {
        match &self.backend {
            ScreenBackend::X11(x11) => x11.list_displays(),
            ScreenBackend::Wayland(wayland) => wayland.list_displays(),
        }
    }
    
    pub fn capture(
        &self,
        display_id: i32,
        region: Option<Rect>,
        format: ImageFormat,
        quality: u8,
        include_cursor: bool,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        match &self.backend {
            ScreenBackend::X11(x11) => {
                x11.capture(display_id, region, format, quality, include_cursor)
            }
            ScreenBackend::Wayland(wayland) => {
                wayland.capture(display_id, region, format, quality, include_cursor)
            }
        }
    }
    
    pub fn stream(
        &self,
        display_id: i32,
        fps: u32,
        region: Option<Rect>,
        format: ImageFormat,
        quality: u8,
        include_cursor: bool,
        delta_encoding: bool,
    ) -> mpsc::Receiver<ScreenFrame> {
        let (tx, rx) = mpsc::channel(fps as usize * 2);
        
        let backend = self.backend.clone();
        tokio::spawn(async move {
            let interval = std::time::Duration::from_millis(1000 / fps as u64);
            let mut last_frame: Option<Vec<u8>> = None;
            
            loop {
                let start = std::time::Instant::now();
                
                let frame_data = match &backend {
                    ScreenBackend::X11(x11) => {
                        x11.capture(display_id, region.clone(), format, quality, include_cursor)
                    }
                    ScreenBackend::Wayland(wayland) => {
                        wayland.capture(display_id, region.clone(), format, quality, include_cursor)
                    }
                };
                
                if let Ok(data) = frame_data {
                    let frame = if delta_encoding && last_frame.is_some() {
                        // Compute delta (simplified - real impl would use proper diff)
                        ScreenFrame {
                            data: data.clone(),
                            timestamp_ms: chrono::Utc::now().timestamp_millis(),
                            is_keyframe: false,
                            dirty_region: None, // Would compute actual dirty region
                        }
                    } else {
                        ScreenFrame {
                            data: data.clone(),
                            timestamp_ms: chrono::Utc::now().timestamp_millis(),
                            is_keyframe: true,
                            dirty_region: None,
                        }
                    };
                    
                    last_frame = Some(data);
                    
                    if tx.send(frame).await.is_err() {
                        break; // Receiver dropped
                    }
                }
                
                let elapsed = start.elapsed();
                if elapsed < interval {
                    tokio::time::sleep(interval - elapsed).await;
                }
            }
        });
        
        rx
    }
}

#[derive(Debug, Clone)]
pub struct Display {
    pub id: i32,
    pub name: String,
    pub width: i32,
    pub height: i32,
    pub scale: f32,
    pub primary: bool,
}

#[derive(Debug, Clone)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Copy)]
pub enum ImageFormat {
    Png,
    Jpeg,
    Webp,
}

#[derive(Debug, Clone)]
pub struct ScreenFrame {
    pub data: Vec<u8>,
    pub timestamp_ms: i64,
    pub is_keyframe: bool,
    pub dirty_region: Option<Rect>,
}
```

```rust
// src/controllers/input.rs
use crate::config::DaemonConfig;
use crate::platform::linux::uinput::UinputDevice;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;

pub struct InputController {
    device: Arc<Mutex<UinputDevice>>,
}

impl InputController {
    pub fn new(config: &DaemonConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let device = UinputDevice::new()?;
        info!("Input controller initialized with uinput");
        
        Ok(Self {
            device: Arc::new(Mutex::new(device)),
        })
    }
    
    pub async fn mouse_move(
        &self,
        x: i32,
        y: i32,
        relative: bool,
        duration_ms: u32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut device = self.device.lock().await;
        
        if duration_ms == 0 || relative {
            // Instant movement
            if relative {
                device.mouse_move_relative(x, y)?;
            } else {
                device.mouse_move_absolute(x, y)?;
            }
        } else {
            // Smooth movement
            let current = device.get_mouse_position()?;
            let steps = (duration_ms / 16).max(1) as i32; // ~60fps
            let dx = (x - current.0) as f32 / steps as f32;
            let dy = (y - current.1) as f32 / steps as f32;
            
            for i in 1..=steps {
                let target_x = current.0 + (dx * i as f32) as i32;
                let target_y = current.1 + (dy * i as f32) as i32;
                device.mouse_move_absolute(target_x, target_y)?;
                tokio::time::sleep(std::time::Duration::from_millis(16)).await;
            }
        }
        
        Ok(())
    }
    
    pub async fn mouse_button(
        &self,
        button: MouseButton,
        action: ButtonAction,
        position: Option<(i32, i32)>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut device = self.device.lock().await;
        
        // Move to position if specified
        if let Some((x, y)) = position {
            device.mouse_move_absolute(x, y)?;
        }
        
        match action {
            ButtonAction::Press => device.mouse_button_press(button)?,
            ButtonAction::Release => device.mouse_button_release(button)?,
            ButtonAction::Click => {
                device.mouse_button_press(button)?;
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                device.mouse_button_release(button)?;
            }
            ButtonAction::DoubleClick => {
                for _ in 0..2 {
                    device.mouse_button_press(button)?;
                    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                    device.mouse_button_release(button)?;
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                }
            }
        }
        
        Ok(())
    }
    
    pub async fn mouse_scroll(
        &self,
        delta_x: i32,
        delta_y: i32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut device = self.device.lock().await;
        device.mouse_scroll(delta_x, delta_y)?;
        Ok(())
    }
    
    pub async fn keyboard_key(
        &self,
        key: &str,
        action: KeyAction,
        modifiers: &[String],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut device = self.device.lock().await;
        
        // Press modifiers
        for modifier in modifiers {
            device.key_press(modifier)?;
        }
        
        match action {
            KeyAction::Press => device.key_press(key)?,
            KeyAction::Release => device.key_release(key)?,
            KeyAction::Tap => {
                device.key_press(key)?;
                tokio::time::sleep(std::time::Duration::from_millis(30)).await;
                device.key_release(key)?;
            }
        }
        
        // Release modifiers in reverse order
        for modifier in modifiers.iter().rev() {
            device.key_release(modifier)?;
        }
        
        Ok(())
    }
    
    pub async fn keyboard_type(
        &self,
        text: &str,
        delay_ms: u32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut device = self.device.lock().await;
        
        for ch in text.chars() {
            device.type_char(ch)?;
            if delay_ms > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms as u64)).await;
            }
        }
        
        Ok(())
    }
    
    pub async fn keyboard_shortcut(
        &self,
        keys: &[String],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut device = self.device.lock().await;
        
        // Press all keys
        for key in keys {
            device.key_press(key)?;
            tokio::time::sleep(std::time::Duration::from_millis(30)).await;
        }
        
        // Release all keys in reverse order
        for key in keys.iter().rev() {
            device.key_release(key)?;
            tokio::time::sleep(std::time::Duration::from_millis(30)).await;
        }
        
        Ok(())
    }
}

#[derive(Debug, Clone, Copy)]
pub enum MouseButton {
    Left,
    Right,
    Middle,
    Back,
    Forward,
}

#[derive(Debug, Clone, Copy)]
pub enum ButtonAction {
    Press,
    Release,
    Click,
    DoubleClick,
}

#[derive(Debug, Clone, Copy)]
pub enum KeyAction {
    Press,
    Release,
    Tap,
}
```

```rust
// src/controllers/accessibility.rs
use crate::config::DaemonConfig;
use atspi::{Connection, AccessibleExt};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;

pub struct AccessibilityController {
    connection: Arc<Mutex<Connection>>,
}

impl AccessibilityController {
    pub fn new(config: &DaemonConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let connection = Connection::new()?;
        info!("Accessibility controller initialized with AT-SPI");
        
        Ok(Self {
            connection: Arc::new(Mutex::new(connection)),
        })
    }
    
    pub async fn get_tree(
        &self,
        window_id: Option<&str>,
        max_depth: i32,
    ) -> Result<AccessibilityNode, Box<dyn std::error::Error>> {
        let conn = self.connection.lock().await;
        
        let root = if let Some(wid) = window_id {
            conn.get_accessible_by_id(wid)?
        } else {
            conn.get_focused_accessible()?
        };
        
        self.build_tree(&root, max_depth, 0)
    }
    
    fn build_tree(
        &self,
        accessible: &dyn AccessibleExt,
        max_depth: i32,
        current_depth: i32,
    ) -> Result<AccessibilityNode, Box<dyn std::error::Error>> {
        let bounds = accessible.get_extents()?;
        
        let children = if max_depth == 0 || current_depth < max_depth {
            accessible
                .get_children()?
                .iter()
                .filter_map(|child| {
                    self.build_tree(child, max_depth, current_depth + 1).ok()
                })
                .collect()
        } else {
            vec![]
        };
        
        Ok(AccessibilityNode {
            id: accessible.get_unique_id()?,
            role: accessible.get_role()?.to_string(),
            name: accessible.get_name()?,
            description: accessible.get_description().unwrap_or_default(),
            value: accessible.get_value().unwrap_or_default(),
            bounds: Rect {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
            },
            states: accessible.get_states()?,
            actions: accessible.get_actions()?,
            children,
        })
    }
    
    pub async fn find_nodes(
        &self,
        window_id: Option<&str>,
        role: Option<&str>,
        name_contains: Option<&str>,
        limit: i32,
    ) -> Result<Vec<AccessibilityNode>, Box<dyn std::error::Error>> {
        let tree = self.get_