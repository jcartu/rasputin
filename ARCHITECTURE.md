# RASPUTIN Architecture Diagrams

This document contains Mermaid diagrams illustrating the architecture and components of the RASPUTIN multi-model AI consensus and synthesis engine with autonomous agent capabilities (JARVIS).

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React 19 Frontend]
        WS[WebSocket Client]
    end

    subgraph "API Gateway"
        TRPC[tRPC Server]
        EXPRESS[Express 4]
        AUTH[Manus OAuth]
    end

    subgraph "Core Services"
        CONSENSUS[Consensus Engine]
        SYNTHESIS[Synthesis Pipeline]
        JARVIS[JARVIS Agent]
        MULTIAGENT[Multi-Agent Orchestrator]
    end

    subgraph "AI Providers"
        OPENAI[OpenAI GPT-5.x]
        ANTHROPIC[Anthropic Claude 4.5]
        GOOGLE[Google Gemini 3]
        XAI[xAI Grok 4]
        PERPLEXITY[Perplexity Sonar]
        CEREBRAS[Cerebras Llama]
    end

    subgraph "Infrastructure Layer"
        SSH_MGR[SSH Manager]
        INFRA[Infrastructure Monitor]
        HEALTH[Health Collector]
        ALERTS[Alert Engine]
    end

    subgraph "Data Layer"
        DB[(MySQL/TiDB)]
        DRIZZLE[Drizzle ORM]
        MEMORY[Memory Service]
        RAG[RAG Indexer]
    end

    subgraph "External Services"
        SEARXNG[SearXNG Search]
        ELEVENLABS[ElevenLabs TTS]
        WEBHOOKS[Webhook Endpoints]
    end

    UI --> TRPC
    WS --> EXPRESS
    TRPC --> EXPRESS
    EXPRESS --> AUTH

    TRPC --> CONSENSUS
    TRPC --> SYNTHESIS
    TRPC --> JARVIS
    TRPC --> MULTIAGENT
    TRPC --> INFRA

    CONSENSUS --> OPENAI
    CONSENSUS --> ANTHROPIC
    CONSENSUS --> GOOGLE
    CONSENSUS --> XAI
    CONSENSUS --> PERPLEXITY
    CONSENSUS --> CEREBRAS

    SYNTHESIS --> ANTHROPIC
    SYNTHESIS --> PERPLEXITY

    JARVIS --> ANTHROPIC
    JARVIS --> CEREBRAS
    JARVIS --> GOOGLE
    JARVIS --> XAI
    JARVIS --> SSH_MGR

    INFRA --> SSH_MGR
    INFRA --> HEALTH
    HEALTH --> ALERTS

    CONSENSUS --> DRIZZLE
    SYNTHESIS --> DRIZZLE
    JARVIS --> DRIZZLE
    DRIZZLE --> DB

    JARVIS --> MEMORY
    JARVIS --> RAG

    JARVIS --> SEARXNG
    JARVIS --> ELEVENLABS

    SSH_MGR --> WEBHOOKS
```

---

## 2. Frontend Component Architecture

```mermaid
graph TB
    subgraph "App Shell"
        APP[App.tsx]
        ROUTER[Wouter Router]
        THEME[ThemeProvider]
        TOOLTIP[TooltipProvider]
    end

    subgraph "Pages"
        CHAT[Chat Page]
        AGENT[Agent Page - JARVIS]
        INFRA_PAGE[Infrastructure Page]
        MULTIAGENT_PAGE[Multi-Agent Page]
        CODEBASE[Codebase Page - RAG]
        EVENTS[Events Page]
        LOGIN[Login Page]
    end

    subgraph "Shared Components"
        UI_LIB[shadcn/ui Library]
        SIDEBAR[Sidebar]
        CHAT_INPUT[Chat Input]
        MSG_LIST[Message List]
        MODEL_CARD[Model Response Card]
        TOOL_CALL[Tool Call Display]
    end

    subgraph "State Management"
        REACT_QUERY[React Query]
        TRPC_CLIENT[tRPC Client]
        WS_HOOKS[WebSocket Hooks]
    end

    subgraph "Contexts"
        AUTH_CTX[Auth Context]
        THEME_CTX[Theme Context]
        CHAT_CTX[Chat Context]
    end

    APP --> ROUTER
    APP --> THEME
    APP --> TOOLTIP

    ROUTER --> CHAT
    ROUTER --> AGENT
    ROUTER --> INFRA_PAGE
    ROUTER --> MULTIAGENT_PAGE
    ROUTER --> CODEBASE
    ROUTER --> EVENTS
    ROUTER --> LOGIN

    CHAT --> SIDEBAR
    CHAT --> CHAT_INPUT
    CHAT --> MSG_LIST
    MSG_LIST --> MODEL_CARD

    AGENT --> CHAT_INPUT
    AGENT --> MSG_LIST
    MSG_LIST --> TOOL_CALL

    CHAT --> REACT_QUERY
    AGENT --> REACT_QUERY
    REACT_QUERY --> TRPC_CLIENT

    CHAT --> WS_HOOKS

    CHAT --> AUTH_CTX
    CHAT --> CHAT_CTX
    APP --> THEME_CTX
```

---

## 3. Backend tRPC API Architecture

```mermaid
graph TB
    subgraph "Router Structure"
        APP_ROUTER[appRouter]
    end

    subgraph "Auth Router"
        AUTH_ME[auth.me]
        AUTH_LOGOUT[auth.logout]
    end

    subgraph "Chats Router"
        CHATS_LIST[chats.list]
        CHATS_GET[chats.get]
        CHATS_CREATE[chats.create]
        CHATS_UPDATE[chats.update]
        CHATS_DELETE[chats.delete]
        CHATS_SEARCH[chats.search]
        CHATS_EXPORT[chats.exportMarkdown]
    end

    subgraph "Query Router"
        QUERY_SUBMIT[query.submit]
        QUERY_MODELS[query.getModelResponses]
        QUERY_STAGES[query.getPipelineStages]
    end

    subgraph "JARVIS Router"
        JARVIS_LIST[jarvis.listTasks]
        JARVIS_GET[jarvis.getTask]
        JARVIS_EXEC[jarvis.executeTask]
        JARVIS_MSGS[jarvis.getTaskMessages]
        JARVIS_USAGE[jarvis.getUsageStats]
    end

    subgraph "SSH Router"
        SSH_HOSTS[ssh.listHosts]
        SSH_CREATE[ssh.createHost]
        SSH_TEST[ssh.testConnection]
        SSH_EXEC[ssh.executeCommand]
        SSH_READ[ssh.readFile]
        SSH_WRITE[ssh.writeFile]
        SSH_PERMS[ssh.getPermissions]
        SSH_AUDIT[ssh.getAuditLog]
    end

    subgraph "Infrastructure Router"
        INFRA_HOSTS[infrastructure.listHosts]
        INFRA_ADD[infrastructure.addHost]
        INFRA_METRICS[infrastructure.getMetrics]
        INFRA_INCIDENTS[infrastructure.getIncidents]
        INFRA_ALERTS[infrastructure.getAlertRules]
    end

    subgraph "Multi-Agent Router"
        AGENTS_LIST[agents.list]
        AGENTS_CREATE[agents.create]
        AGENTS_RUN[agents.runTask]
        AGENTS_MSGS[agents.getMessages]
    end

    subgraph "Other Routers"
        MODELS[models.list / getForTier]
        WORKSPACE[workspace.*]
        SCHEDULE[schedule.*]
        VOICE[voice.*]
        RAG_ROUTER[rag.*]
        EVENTS_ROUTER[events.*]
    end

    APP_ROUTER --> AUTH_ME
    APP_ROUTER --> AUTH_LOGOUT
    APP_ROUTER --> CHATS_LIST
    APP_ROUTER --> CHATS_GET
    APP_ROUTER --> CHATS_CREATE
    APP_ROUTER --> QUERY_SUBMIT
    APP_ROUTER --> JARVIS_LIST
    APP_ROUTER --> JARVIS_EXEC
    APP_ROUTER --> SSH_HOSTS
    APP_ROUTER --> SSH_EXEC
    APP_ROUTER --> INFRA_HOSTS
    APP_ROUTER --> INFRA_METRICS
    APP_ROUTER --> AGENTS_LIST
    APP_ROUTER --> AGENTS_RUN
    APP_ROUTER --> MODELS
    APP_ROUTER --> WORKSPACE
    APP_ROUTER --> RAG_ROUTER
```

---

## 4. Database Schema Relationships

```mermaid
erDiagram
    users ||--o{ chats : "owns"
    users ||--o{ agentTasks : "owns"
    users ||--o{ sshHosts : "owns"
    users ||--o{ infrastructureHosts : "owns"
    users ||--o{ workspaces : "owns"
    users ||--o{ scheduledTasks : "owns"

    chats ||--o{ messages : "contains"
    messages ||--o{ modelResponses : "has"
    messages ||--o{ synthesisPipelineStages : "has"

    agentTasks ||--o{ agentMessages : "contains"
    agentTasks ||--o{ agentToolCalls : "has"
    agentTasks ||--o{ agentFiles : "creates"

    sshHosts ||--o| sshCredentials : "has"
    sshHosts ||--o| sshPermissions : "has"
    sshHosts ||--o{ sshAuditLog : "logs"
    sshHosts ||--o{ pendingApprovals : "has"

    infrastructureHosts ||--o{ healthMetrics : "collects"
    infrastructureHosts ||--o{ incidents : "triggers"
    infrastructureHosts }o--o| sshHosts : "links"

    incidents ||--o{ incidentActions : "has"
    alertRules ||--o{ incidents : "triggers"
    remediations ||--o{ incidentActions : "executes"

    workspaces ||--o{ workspaceFiles : "contains"
    workspaces ||--o{ workspaceCommits : "tracks"
    workspaces ||--o{ workspaceProcesses : "runs"

    agents ||--o{ interAgentMessages : "sends"
    agents ||--o{ agentSubtasks : "creates"

    codebaseProjects ||--o{ codeChunks : "indexes"
    codebaseProjects ||--o{ codeSymbols : "extracts"

    episodicMemories ||--o| memoryEmbeddings : "has"
    semanticMemories ||--o| memoryEmbeddings : "has"
    proceduralMemories ||--o| memoryEmbeddings : "has"

    scheduledTasks ||--o{ scheduledTaskRuns : "executes"

    users {
        int id PK
        varchar openId UK
        text name
        varchar email
        enum role
        timestamp createdAt
    }

    chats {
        int id PK
        int userId FK
        varchar title
        enum mode
        enum speedTier
        json selectedModels
        int messageCount
    }

    messages {
        int id PK
        int chatId FK
        enum role
        text content
        int agreementPercentage
        int latencyMs
    }

    agentTasks {
        int id PK
        int userId FK
        varchar title
        text query
        enum status
        text result
        int iterationCount
    }

    sshHosts {
        int id PK
        int userId FK
        varchar name
        varchar hostname
        int port
        varchar username
        enum authType
        enum status
    }

    infrastructureHosts {
        int id PK
        int userId FK
        varchar name
        varchar hostname
        enum hostType
        enum status
        int sshHostId FK
    }

    healthMetrics {
        int id PK
        int hostId FK
        decimal cpuUsagePercent
        int memoryUsedMb
        decimal diskUsagePercent
        timestamp collectedAt
    }
```

---

## 5. JARVIS Agent Orchestration Flow

```mermaid
flowchart TB
    subgraph "User Interface"
        USER_INPUT[User Task Input]
        TASK_VIEW[Task Progress View]
    end

    subgraph "Task Management"
        CREATE_TASK[Create Agent Task]
        CHECK_RATE[Check Rate Limit]
        UPDATE_STATUS[Update Task Status]
    end

    subgraph "Orchestrator Loop"
        INIT[Initialize Messages]
        CALL_LLM[Call LLM Provider]
        PROCESS_RESPONSE[Process Response]
        CHECK_TOOLS{Tool Calls?}
        CHECK_COMPLETE{Task Complete?}
        MAX_ITER{Max Iterations?}
    end

    subgraph "Tool Execution"
        TOOL_LOG[Log Tool Call to DB]
        EXEC_TOOL[Execute Tool]
        TOOL_RESULT[Return Result]
    end

    subgraph "LLM Providers - Fallback Chain"
        ANTHROPIC[Anthropic Claude]
        CEREBRAS[Cerebras Llama]
        GEMINI[Google Gemini]
        GROK[xAI Grok]
    end

    subgraph "Available Tools"
        WEB_SEARCH[web_search]
        SEARXNG[searxng_search]
        BROWSE[browse_url]
        PYTHON[execute_python]
        JS[execute_javascript]
        SHELL[execute_shell]
        READ_FILE[read_file]
        WRITE_FILE[write_file]
        HTTP[http_request]
        IMAGE[generate_image]
        SSH_EXEC[ssh_execute]
        SSH_READ[ssh_read_file]
        SSH_WRITE[ssh_write_file]
        TASK_COMPLETE[task_complete]
    end

    subgraph "Callbacks"
        ON_THINKING[onThinking]
        ON_TOOL_CALL[onToolCall]
        ON_TOOL_RESULT[onToolResult]
        ON_COMPLETE[onComplete]
        ON_ERROR[onError]
    end

    USER_INPUT --> CREATE_TASK
    CREATE_TASK --> CHECK_RATE
    CHECK_RATE -->|Allowed| INIT
    CHECK_RATE -->|Exceeded| ON_ERROR

    INIT --> CALL_LLM
    CALL_LLM --> ANTHROPIC
    ANTHROPIC -->|Fail| CEREBRAS
    CEREBRAS -->|Fail| GEMINI
    GEMINI -->|Fail| GROK
    GROK -->|Fail| ON_ERROR

    ANTHROPIC --> PROCESS_RESPONSE
    CEREBRAS --> PROCESS_RESPONSE
    GEMINI --> PROCESS_RESPONSE
    GROK --> PROCESS_RESPONSE

    PROCESS_RESPONSE --> ON_THINKING
    PROCESS_RESPONSE --> CHECK_TOOLS

    CHECK_TOOLS -->|Yes| TOOL_LOG
    TOOL_LOG --> EXEC_TOOL
    EXEC_TOOL --> WEB_SEARCH
    EXEC_TOOL --> BROWSE
    EXEC_TOOL --> PYTHON
    EXEC_TOOL --> SHELL
    EXEC_TOOL --> SSH_EXEC
    EXEC_TOOL --> TASK_COMPLETE

    WEB_SEARCH --> TOOL_RESULT
    BROWSE --> TOOL_RESULT
    PYTHON --> TOOL_RESULT
    SHELL --> TOOL_RESULT
    SSH_EXEC --> TOOL_RESULT

    TOOL_RESULT --> ON_TOOL_RESULT
    ON_TOOL_RESULT --> CHECK_COMPLETE

    TASK_COMPLETE --> ON_COMPLETE
    ON_COMPLETE --> UPDATE_STATUS
    UPDATE_STATUS --> TASK_VIEW

    CHECK_TOOLS -->|No| CHECK_COMPLETE
    CHECK_COMPLETE -->|No| MAX_ITER
    MAX_ITER -->|No| CALL_LLM
    MAX_ITER -->|Yes| ON_ERROR
    CHECK_COMPLETE -->|Yes| ON_COMPLETE
```

---

## 6. Infrastructure Monitoring System

```mermaid
flowchart TB
    subgraph "Host Registration"
        ADD_HOST[Add SSH Host]
        LINK_INFRA[Link to Infrastructure]
        STORE_CREDS[Store Encrypted Credentials]
        SET_PERMS[Set Permissions]
    end

    subgraph "Health Collection"
        SCHEDULER[Collection Scheduler]
        SSH_CONNECT[SSH Connect]
        COLLECT_CPU[Collect CPU Metrics]
        COLLECT_MEM[Collect Memory Metrics]
        COLLECT_DISK[Collect Disk Metrics]
        COLLECT_NET[Collect Network Metrics]
        COLLECT_GPU[Collect GPU Metrics]
        STORE_METRICS[Store in healthMetrics]
    end

    subgraph "Alert Engine"
        RULES_DB[(Alert Rules)]
        EVAL_METRICS[Evaluate Metrics]
        CHECK_THRESHOLDS{Threshold Exceeded?}
        CHECK_DURATION{Duration Met?}
        CREATE_INCIDENT[Create Incident]
        NOTIFY[Notify Owner]
    end

    subgraph "Self-Healing"
        REMEDIATION_DB[(Remediations)]
        CHECK_AUTO{Auto-Remediate?}
        NEEDS_APPROVAL{Needs Approval?}
        CREATE_APPROVAL[Create Pending Approval]
        EXEC_REMEDIATION[Execute Remediation]
        LOG_ACTION[Log Incident Action]
    end

    subgraph "Incident Management"
        INCIDENT_DB[(Incidents)]
        ACKNOWLEDGE[Acknowledge]
        INVESTIGATE[Investigate]
        RESOLVE[Resolve]
        CLOSE[Close]
    end

    subgraph "SSH Manager"
        SSH_POOL[Connection Pool]
        EXEC_CMD[Execute Command]
        READ_FILE[Read File]
        WRITE_FILE[Write File]
        AUDIT_LOG[Audit Log]
    end

    ADD_HOST --> STORE_CREDS
    ADD_HOST --> SET_PERMS
    ADD_HOST --> LINK_INFRA

    SCHEDULER --> SSH_CONNECT
    SSH_CONNECT --> SSH_POOL
    SSH_POOL --> COLLECT_CPU
    SSH_POOL --> COLLECT_MEM
    SSH_POOL --> COLLECT_DISK
    SSH_POOL --> COLLECT_NET
    SSH_POOL --> COLLECT_GPU

    COLLECT_CPU --> STORE_METRICS
    COLLECT_MEM --> STORE_METRICS
    COLLECT_DISK --> STORE_METRICS

    STORE_METRICS --> EVAL_METRICS
    EVAL_METRICS --> RULES_DB
    RULES_DB --> CHECK_THRESHOLDS

    CHECK_THRESHOLDS -->|Yes| CHECK_DURATION
    CHECK_DURATION -->|Yes| CREATE_INCIDENT
    CREATE_INCIDENT --> INCIDENT_DB
    CREATE_INCIDENT --> NOTIFY
    CREATE_INCIDENT --> CHECK_AUTO

    CHECK_AUTO -->|Yes| NEEDS_APPROVAL
    NEEDS_APPROVAL -->|Yes| CREATE_APPROVAL
    NEEDS_APPROVAL -->|No| EXEC_REMEDIATION

    CREATE_APPROVAL --> EXEC_REMEDIATION
    EXEC_REMEDIATION --> SSH_POOL
    EXEC_REMEDIATION --> LOG_ACTION
    LOG_ACTION --> INCIDENT_DB

    INCIDENT_DB --> ACKNOWLEDGE
    ACKNOWLEDGE --> INVESTIGATE
    INVESTIGATE --> RESOLVE
    RESOLVE --> CLOSE
```

---

## 7. Consensus & Synthesis Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant tRPC
    participant SearchPreStep
    participant ModelRouter
    participant Model1 as GPT-5
    participant Model2 as Claude
    participant Model3 as Gemini
    participant Model4 as Grok
    participant Synthesizer
    participant DB

    User->>Frontend: Submit Query
    Frontend->>tRPC: query.submit(query, mode, tier)

    alt Consensus Mode
        tRPC->>DB: Create user message
        tRPC->>SearchPreStep: Check if search needed
        SearchPreStep->>SearchPreStep: Analyze query keywords

        opt Search Required
            SearchPreStep->>SearchPreStep: Call Perplexity/SearXNG
            SearchPreStep-->>tRPC: Search context
        end

        tRPC->>ModelRouter: Get models for tier
        ModelRouter-->>tRPC: [Model1, Model2, Model3, Model4]

        par Parallel Model Queries
            tRPC->>Model1: Query with context
            tRPC->>Model2: Query with context
            tRPC->>Model3: Query with context
            tRPC->>Model4: Query with context
        end

        Model1-->>tRPC: Response 1
        Model2-->>tRPC: Response 2
        Model3-->>tRPC: Response 3
        Model4-->>tRPC: Response 4

        tRPC->>Synthesizer: Synthesize consensus
        Note over Synthesizer: Analyze agreement<br/>Identify conflicts<br/>Generate summary
        Synthesizer-->>tRPC: Consensus + Agreement %

        tRPC->>DB: Store message + model responses
        tRPC-->>Frontend: ConsensusResult
        Frontend-->>User: Display consensus

    else Synthesis Mode
        tRPC->>DB: Create user message

        Note over tRPC: Stage 1: Web Search
        tRPC->>SearchPreStep: Deep web search
        SearchPreStep-->>tRPC: Search results

        Note over tRPC: Stage 2: Parallel Proposers
        par
            tRPC->>Model1: Generate proposal
            tRPC->>Model2: Generate proposal
        end
        Model1-->>tRPC: Proposal 1
        Model2-->>tRPC: Proposal 2

        Note over tRPC: Stage 3: Information Extraction
        tRPC->>Synthesizer: Extract key info
        Synthesizer-->>tRPC: Extracted facts

        Note over tRPC: Stage 4: Gap Detection
        tRPC->>Synthesizer: Detect gaps
        Synthesizer-->>tRPC: Identified gaps

        Note over tRPC: Stage 5: Meta-Synthesis
        tRPC->>Synthesizer: Final synthesis
        Synthesizer-->>tRPC: Deep synthesis

        tRPC->>DB: Store stages + result
        tRPC-->>Frontend: SynthesisResult
        Frontend-->>User: Display synthesis
    end
```

---

## 8. Multi-Agent System Architecture

```mermaid
flowchart TB
    subgraph "Agent Types"
        ORCHESTRATOR[Orchestrator Agent]
        COORDINATOR[Coordinator Agent]
        CODE_AGENT[Code Specialist]
        RESEARCH_AGENT[Research Specialist]
        SYSADMIN_AGENT[SysAdmin Specialist]
        DATA_AGENT[Data Specialist]
        WORKER[Worker Agent]
    end

    subgraph "Agent Lifecycle"
        CREATE[Create Agent]
        ASSIGN_GOAL[Assign Goal]
        THINKING[Thinking State]
        EXECUTING[Executing State]
        WAITING[Waiting State]
        COMPLETED[Completed State]
        FAILED[Failed State]
    end

    subgraph "Task Delegation"
        PARENT_TASK[Parent Task]
        DECOMPOSE[Decompose Task]
        SUBTASK_1[Subtask 1]
        SUBTASK_2[Subtask 2]
        SUBTASK_3[Subtask 3]
        AGGREGATE[Aggregate Results]
    end

    subgraph "Inter-Agent Communication"
        MSG_QUEUE[Message Queue]
        TASK_MSG[Task Message]
        RESULT_MSG[Result Message]
        QUERY_MSG[Query Message]
        STATUS_MSG[Status Message]
    end

    subgraph "Agent Capabilities"
        CAN_BROWSE[canBrowse]
        CAN_CODE[canCode]
        CAN_SSH[canSSH]
        CAN_SEARCH[canSearch]
        CAN_IMAGE[canGenerateImages]
    end

    ORCHESTRATOR --> COORDINATOR
    COORDINATOR --> CODE_AGENT
    COORDINATOR --> RESEARCH_AGENT
    COORDINATOR --> SYSADMIN_AGENT
    COORDINATOR --> DATA_AGENT

    CREATE --> ASSIGN_GOAL
    ASSIGN_GOAL --> THINKING
    THINKING --> EXECUTING
    EXECUTING --> WAITING
    WAITING --> THINKING
    EXECUTING --> COMPLETED
    EXECUTING --> FAILED

    PARENT_TASK --> DECOMPOSE
    DECOMPOSE --> SUBTASK_1
    DECOMPOSE --> SUBTASK_2
    DECOMPOSE --> SUBTASK_3
    SUBTASK_1 --> AGGREGATE
    SUBTASK_2 --> AGGREGATE
    SUBTASK_3 --> AGGREGATE

    ORCHESTRATOR -->|sends| MSG_QUEUE
    MSG_QUEUE -->|delivers| COORDINATOR
    COORDINATOR -->|sends| MSG_QUEUE
    MSG_QUEUE -->|delivers| CODE_AGENT
    CODE_AGENT -->|sends| MSG_QUEUE
    MSG_QUEUE -->|delivers| COORDINATOR

    CODE_AGENT --> CAN_CODE
    CODE_AGENT --> CAN_BROWSE
    RESEARCH_AGENT --> CAN_SEARCH
    RESEARCH_AGENT --> CAN_BROWSE
    SYSADMIN_AGENT --> CAN_SSH
    SYSADMIN_AGENT --> CAN_CODE
```

---

## 9. Memory & Learning System

```mermaid
flowchart TB
    subgraph "Memory Types"
        EPISODIC[Episodic Memory<br/>What happened]
        SEMANTIC[Semantic Memory<br/>What is known]
        PROCEDURAL[Procedural Memory<br/>How to do things]
    end

    subgraph "Memory Operations"
        STORE[Store Memory]
        RETRIEVE[Retrieve Memory]
        UPDATE[Update Memory]
        FORGET[Decay/Forget]
    end

    subgraph "Embedding System"
        EMBED_TEXT[Embed Source Text]
        VECTOR_STORE[(Vector Store)]
        SIMILARITY[Similarity Search]
    end

    subgraph "Learning Pipeline"
        TASK_COMPLETE[Task Completed]
        EXTRACT_LESSONS[Extract Lessons]
        CREATE_SKILL[Create/Update Skill]
        STORE_TRAINING[Store Training Data]
    end

    subgraph "Memory Access"
        QUERY_CONTEXT[Query Context]
        RANK_MEMORIES[Rank by Relevance]
        INJECT_CONTEXT[Inject into Prompt]
        LOG_ACCESS[Log Access]
    end

    subgraph "Skill Library"
        AGENT_SKILLS[(Agent Skills)]
        TRIGGER_MATCH[Match Triggers]
        APPLY_SKILL[Apply Skill]
        UPDATE_CONFIDENCE[Update Confidence]
    end

    TASK_COMPLETE --> EXTRACT_LESSONS
    EXTRACT_LESSONS --> EPISODIC
    EXTRACT_LESSONS --> SEMANTIC
    EXTRACT_LESSONS --> CREATE_SKILL

    EPISODIC --> STORE
    SEMANTIC --> STORE
    PROCEDURAL --> STORE

    STORE --> EMBED_TEXT
    EMBED_TEXT --> VECTOR_STORE

    QUERY_CONTEXT --> SIMILARITY
    SIMILARITY --> VECTOR_STORE
    VECTOR_STORE --> RANK_MEMORIES
    RANK_MEMORIES --> INJECT_CONTEXT
    INJECT_CONTEXT --> LOG_ACCESS

    CREATE_SKILL --> AGENT_SKILLS
    AGENT_SKILLS --> TRIGGER_MATCH
    TRIGGER_MATCH --> APPLY_SKILL
    APPLY_SKILL --> UPDATE_CONFIDENCE
```

---

## 10. Event & Webhook System

```mermaid
flowchart TB
    subgraph "Event Sources"
        WEBHOOK_IN[Incoming Webhook]
        CRON_TRIGGER[Cron Schedule]
        MANUAL_TRIGGER[Manual Trigger]
    end

    subgraph "Webhook Handler"
        ENDPOINT[Webhook Endpoint]
        VALIDATE[Validate Payload]
        MATCH_TRIGGER[Match Trigger Conditions]
    end

    subgraph "Trigger Conditions"
        ALWAYS[Always]
        JSON_MATCH[JSON Match]
        REGEX[Regex Pattern]
        EXPRESSION[Custom Expression]
    end

    subgraph "Cron Scheduler"
        CRON_DB[(Cron Triggers)]
        PARSE_CRON[Parse Expression]
        SCHEDULE_NEXT[Schedule Next Run]
        CHECK_DUE[Check Due Tasks]
    end

    subgraph "Event Executor"
        CREATE_JARVIS[Create JARVIS Task]
        INJECT_PAYLOAD[Inject Event Payload]
        EXECUTE[Execute Task]
        STORE_RESULT[Store Result]
    end

    subgraph "Actions"
        JARVIS_ACTION[Run JARVIS Task]
        WEBHOOK_OUT[Call External Webhook]
        EMAIL[Send Email]
        NOTIFY[Send Notification]
    end

    WEBHOOK_IN --> ENDPOINT
    ENDPOINT --> VALIDATE
    VALIDATE --> MATCH_TRIGGER

    MATCH_TRIGGER --> ALWAYS
    MATCH_TRIGGER --> JSON_MATCH
    MATCH_TRIGGER --> REGEX
    MATCH_TRIGGER --> EXPRESSION

    CRON_TRIGGER --> CRON_DB
    CRON_DB --> PARSE_CRON
    PARSE_CRON --> SCHEDULE_NEXT
    CHECK_DUE --> CREATE_JARVIS

    ALWAYS --> CREATE_JARVIS
    JSON_MATCH --> CREATE_JARVIS
    REGEX --> CREATE_JARVIS
    EXPRESSION --> CREATE_JARVIS

    MANUAL_TRIGGER --> CREATE_JARVIS

    CREATE_JARVIS --> INJECT_PAYLOAD
    INJECT_PAYLOAD --> EXECUTE
    EXECUTE --> JARVIS_ACTION
    EXECUTE --> WEBHOOK_OUT
    EXECUTE --> NOTIFY

    JARVIS_ACTION --> STORE_RESULT
```

---

## 11. RAG Pipeline for Codebase Understanding

```mermaid
flowchart TB
    subgraph "Project Indexing"
        ADD_PROJECT[Add Codebase Project]
        SCAN_FILES[Scan Files]
        FILTER_PATTERNS[Apply Include/Exclude]
        PARSE_CODE[Parse Source Code]
    end

    subgraph "Code Processing"
        CHUNK_CODE[Chunk Code Files]
        EXTRACT_SYMBOLS[Extract Symbols]
        EXTRACT_IMPORTS[Extract Imports]
        DETECT_LANG[Detect Language]
    end

    subgraph "Embedding Generation"
        EMBED_CHUNKS[Embed Code Chunks]
        EMBED_SYMBOLS[Embed Symbols]
        STORE_VECTORS[(Vector Store)]
    end

    subgraph "Symbol Extraction"
        FUNCTIONS[Functions]
        CLASSES[Classes]
        VARIABLES[Variables]
        INTERFACES[Interfaces/Types]
    end

    subgraph "Search Query"
        USER_QUERY[User Search Query]
        EMBED_QUERY[Embed Query]
        VECTOR_SEARCH[Vector Similarity Search]
        RERANK[Re-rank Results]
    end

    subgraph "Results"
        CODE_CHUNKS[Relevant Code Chunks]
        SYMBOL_MATCHES[Symbol Matches]
        FILE_CONTEXT[File Context]
        RETURN_RESULTS[Return to JARVIS/User]
    end

    ADD_PROJECT --> SCAN_FILES
    SCAN_FILES --> FILTER_PATTERNS
    FILTER_PATTERNS --> PARSE_CODE

    PARSE_CODE --> CHUNK_CODE
    PARSE_CODE --> EXTRACT_SYMBOLS
    PARSE_CODE --> EXTRACT_IMPORTS
    PARSE_CODE --> DETECT_LANG

    EXTRACT_SYMBOLS --> FUNCTIONS
    EXTRACT_SYMBOLS --> CLASSES
    EXTRACT_SYMBOLS --> VARIABLES
    EXTRACT_SYMBOLS --> INTERFACES

    CHUNK_CODE --> EMBED_CHUNKS
    FUNCTIONS --> EMBED_SYMBOLS
    CLASSES --> EMBED_SYMBOLS

    EMBED_CHUNKS --> STORE_VECTORS
    EMBED_SYMBOLS --> STORE_VECTORS

    USER_QUERY --> EMBED_QUERY
    EMBED_QUERY --> VECTOR_SEARCH
    VECTOR_SEARCH --> STORE_VECTORS
    STORE_VECTORS --> RERANK

    RERANK --> CODE_CHUNKS
    RERANK --> SYMBOL_MATCHES
    CODE_CHUNKS --> FILE_CONTEXT
    SYMBOL_MATCHES --> FILE_CONTEXT
    FILE_CONTEXT --> RETURN_RESULTS
```

---

## Summary

RASPUTIN is a comprehensive AI orchestration platform with the following key components:

| Component                  | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| **Consensus Engine**       | Queries multiple frontier AI models in parallel, synthesizes agreement |
| **Synthesis Pipeline**     | 5-stage deep research with web search, proposals, gap detection        |
| **JARVIS Agent**           | Autonomous task executor with 15+ tools and multi-provider fallback    |
| **Multi-Agent System**     | Hierarchical agent coordination with specialized roles                 |
| **Infrastructure Monitor** | SSH-based health collection with alerting and auto-remediation         |
| **Memory System**          | Episodic, semantic, and procedural memory with embeddings              |
| **RAG Pipeline**           | Codebase indexing and semantic search for code understanding           |
| **Event System**           | Webhooks and cron triggers for automated task execution                |

The system is built on:

- **Frontend**: React 19 + Tailwind 4 + Vite
- **Backend**: Express 4 + tRPC 11 + TypeScript
- **Database**: MySQL/TiDB with Drizzle ORM
- **Auth**: Manus OAuth
