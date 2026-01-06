# Oh-My-OpenCode Analysis for RASPUTIN

## What It Is

Oh-my-opencode is a plugin/harness for OpenCode (a terminal-based AI coding assistant similar to Claude Code) that adds:

- Multi-agent orchestration
- Specialized agents for different tasks
- Background parallel execution
- LSP/AST tools for code manipulation
- Claude Code compatibility layer

## Key Architecture Components

### 1. Sisyphus (Main Orchestrator Agent)

- Uses Claude Opus 4.5 High
- Coordinates all other agents
- Has "Todo Continuation Enforcer" - forces agent to keep working until task is done
- Has "Comment Checker" - prevents AI from adding excessive comments

### 2. Specialized Sub-Agents (Teammates)

- **Oracle**: Design, debugging (GPT 5.2 Medium)
- **Frontend UI/UX Engineer**: Frontend development (Gemini 3 Pro)
- **Librarian**: Official docs, open source implementations, codebase exploration (Claude Sonnet 4.5)
- **Explore**: Blazing fast codebase exploration via Contextual Grep (Grok Code)

### 3. Background Agents

- Run in parallel like a team
- Multiple agents working simultaneously on different aspects
- "Background Task Completed" notifications

### 4. Tools & MCPs

- **Exa**: Web Search
- **Context7**: Official Documentation
- **Grep.app**: GitHub Code Search
- Full LSP support
- AST-Grep for code manipulation

### 5. Key Features

- **ultrawork/ulw magic word**: Just include this in prompt and all features activate
- **Todo Continuation Enforcer**: Keeps working until task is actually done
- **Comment Checker**: Code should be indistinguishable from human-written
- **Hooks**: PreToolUse, PostToolUse, UserPromptSubmit, Stop

## How It Differs From RASPUTIN Currently

| Feature            | Oh-My-OpenCode                | RASPUTIN Current         |
| ------------------ | ----------------------------- | ------------------------ |
| Purpose            | Code generation               | Research/consensus       |
| Interface          | Terminal CLI                  | Web chat UI              |
| Orchestration      | Sisyphus manages agents       | Sequential model queries |
| Background work    | Yes, parallel agents          | No                       |
| Persistence        | Todo enforcer continues       | Single response          |
| Specialized agents | Yes (Oracle, Librarian, etc.) | No, all models same role |
| Web search         | Exa MCP                       | Perplexity pre-step      |

## Critical Details from Features Section

### How Agents Work Together (from screenshot)

1. **Gemini 3 Pro** writes the frontend as a background task
2. **Claude Opus 4.5** handles the backend simultaneously
3. **GPT 5.2** gets called for debugging help when stuck
4. When frontend reports done, verify and ship

### Key Workflow Pattern

- "Need to look something up? It scours official docs, your entire codebase history, and public GitHub implementations"
- "OhMyOpenCode aggressively leverages multiple agents to lighten the context load"
- **"Your agent is now the dev team lead. You're the AI Manager."**

### The Real Magic: Async Agents

- Agents run in **background** while others work
- Interactive Terminal with Tmux integration
- Multiple agents working on different parts simultaneously

## Key Insight: RASPUTIN IS DIFFERENT

Oh-my-opencode is for **coding tasks** in a terminal. RASPUTIN is for **research/consensus** in a web UI.

The concepts that transfer well:

1. **Specialized agents** - Different models for different purposes
2. **Background parallel execution** - Already doing this with consensus
3. **Todo enforcement** - Could add "keep researching until complete"
4. **Web search integration** - Already have Perplexity pre-step

The concepts that DON'T transfer:

1. LSP/AST tools - Not relevant for research
2. Terminal hooks - We have a web UI
3. Claude Code compatibility - Not applicable
4. File editing tools - Not relevant

## Recommendation for RASPUTIN

Instead of copying oh-my-opencode's architecture, we should:

### Option 1: Enhanced Pipeline (Simpler)

Keep current UI, add:

- **Fact-checker agent** (Oracle equivalent) - Validates claims after consensus
- **Source verifier agent** (Librarian equivalent) - Checks citations
- **Completion enforcer** - Ensures thorough answers
- Show progress: "Researching → Consensus → Fact-checking → Done"

### Option 2: Full Orchestration (Complex)

Add Sisyphus-style orchestrator that:

- Analyzes query type
- Decides which agents to invoke
- Runs them in parallel
- Synthesizes final answer
- Validates completeness

### My Recommendation: Option 1

Why:

1. RASPUTIN already has parallel model execution (consensus)
2. Adding fact-checking + source verification is the real value
3. Keeps the simple chat UI users expect
4. Doesn't over-engineer for a research tool

What to add:

1. **Oracle agent** - After consensus, fact-checks the result
2. **Librarian agent** - Verifies sources are real and accurate
3. **Completion check** - Ensures answer is thorough
4. **Progress indicators** - Show which stage is running
