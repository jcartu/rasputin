# Legacy Innovations Audit: Jarvis/Rasputin Codebase
## For the Cartu Method Paper

*Audited: 2026-03-07 | Source: `/home/josh/rasputin/` codebase + workspace files*

---

## Executive Summary

The Jarvis/Rasputin codebase contains **11 distinct innovations** that predate and influenced the current OpenClaw-based system. Several are genuinely publishable — particularly the self-evolution pipeline, the predictive task engine, and the multi-layered quality assurance system. The codebase demonstrates a **complete autonomous agent lifecycle** built from scratch before commercial alternatives existed.

---

## Innovation 1: Predictive Task Engine with Behavioral Pattern Mining

**Files:** `server/services/jarvis/predictiveTask.ts`, `server/services/jarvis/proactiveMonitor.ts`

### What It Does
Analyzes 30 days of user task history to mine temporal patterns, predicts what the user will ask next, and can **auto-trigger tasks** before the user requests them. Includes time-of-day awareness, day-of-week patterns, and frequency-based confidence scoring.

### Technical Implementation
- Normalizes task prompts → extracts action-verb patterns → tracks intervals between recurring tasks
- Confidence scoring: `min(0.95, (count/total)*2 + frequency*0.5)` with time-relevance and frequency bonuses
- Proactive Monitor service runs on configurable intervals with quiet hours (22:00-07:00)
- Auto-trigger threshold at 0.90 confidence, notification threshold at 0.60
- Checks for running tasks and recent failures before auto-triggering (avoids cascading failures)
- Max 5 auto-triggers per day per user (safety cap)

### Novelty Assessment: ⭐⭐⭐⭐ HIGH
This is **anticipatory agent behavior** — the agent learns your routine and acts before you ask. Most agent frameworks are purely reactive. The combination of behavioral mining + confidence-gated autonomous execution + safety limits (quiet hours, daily caps, failure memory checks) is novel.

### Paper Potential: **Strong section addition**
"Predictive Task Anticipation" — fits perfectly in a section on proactive vs. reactive agent architectures. The confidence-gated auto-execution with safety rails is a genuine contribution.

---

## Innovation 2: Post-Task Self-Reflection & Automatic Skill Acquisition

**Files:** `server/services/memory/selfReflection.ts`, `server/services/selfEvolution/skillAcquisition.ts`, `server/services/jarvis/v3/learningExtractor.ts`

### What It Does
After every task execution, the system performs structured self-reflection using an LLM to analyze what worked, what failed, and what to learn. Automatically extracts new "skills" (procedural memories) and stores them for future use. The learning extractor captures patterns from every tool execution — file types used, domains accessed, error patterns encountered.

### Technical Implementation
- **SelfReflectionSystem**: Generates JSON-structured reflections via LLM with strict schema validation (whatWorked, whatFailed, lessonsLearned, suggestedImprovements, newSkills)
- Failures get higher importance scores than successes (`0.8 vs 0.6`) — the system intentionally learns more from mistakes
- **LearningExtractor**: Extracts category-specific patterns from every tool call (file types, domains, SSH hosts, git commit types, database query types, Docker images)
- Creates episodic, semantic, AND procedural memories from single executions
- **SkillAcquisitionEngine**: Detects capability gaps when queries fail, proposes new skills with trigger patterns, test cases, and implementation steps
- `performSelfImprovement()` — periodic self-improvement cycle that consolidates memories and generates improvement suggestions

### Novelty Assessment: ⭐⭐⭐⭐⭐ VERY HIGH
Three-layer learning (reflection → extraction → skill acquisition) running automatically after every task is rare in production systems. The combination of LLM-powered reflection with structured skill storage and capability gap detection is genuinely novel.

### Paper Potential: **Major section or standalone contribution**
"Continuous Self-Improvement Through Structured Reflection" — the automatic skill acquisition loop from failure → gap detection → skill proposal → storage is publishable on its own.

---

## Innovation 3: Quality Assurance with Regression Detection

**Files:** `server/services/jarvis/qualityAssurance.ts`

### What It Does
A multi-dimensional quality gate that validates task output before marking it complete. Checks output size against complexity expectations, verifies file deliverables, detects quality **regressions** by comparing against historical performance on similar tasks, and generates escalation strategies when quality fails.

### Technical Implementation
- Five quality dimensions: size, completeness, regression, consistency, depth
- **Regression detection**: Extracts keywords from current task, finds similar past tasks in DB, compares output size and iteration count. Flags if current output is <20% of average for similar tasks (critical) or <50% (warning)
- **Deliverable verification**: Regex patterns detect when tasks request files/documents, validates they were actually created and aren't empty
- **Consistency checking**: Verifies multi-part tasks have all parts addressed, matches requested deliverable types against output
- **Escalation strategy**: After quality failure, determines if model should be escalated, which tools must be used, and generates specific improvement prompts
- File type size expectations (e.g., `.md` minimum 500 bytes, `.docx` minimum 1000 bytes)

### Novelty Assessment: ⭐⭐⭐⭐ HIGH
Regression detection against historical task performance is genuinely novel. Most agent QA is single-pass validation. This system says "you used to produce 2000-char outputs for similar tasks, why is this one 200 chars?"

### Paper Potential: **Strong section addition**
"Quality Regression Detection in Autonomous Agents" — the historical comparison approach is a real contribution.

---

## Innovation 4: Intelligent Multi-Tier Model Router

**Files:** `server/services/jarvis/modelRouter.ts`, `server/services/jarvis/intelligentRouter.ts`, `server/services/jarvis/taskClassifier.ts`

### What It Does
Two-layer routing system: (1) task classification by pattern matching → model selection, (2) intelligent content-aware routing that detects refusal-prone queries and routes them to uncensored local models. Performance tracking feeds back into routing decisions.

### Technical Implementation
- **ModelRouter**: Classifies tasks into types, tracks per-model performance (success rate, duration, tokens) per task type, ranks models by composite score: `successRate*0.6 + speed*0.3 + experience*0.1`
- **IntelligentRouter**: Pattern-based detection for complex reasoning, code tasks, simple tasks, refusal triggers, image requests. Routes refused content to local uncensored models (dolphin-3.0-mistral, flux-uncensored)
- Special handling for vision-action loops: smart model for "decide" phase, fast model for "emit action" phase
- Provider awareness: anthropic, openai, cerebras, local-dolphin, local-llama, local-flux

### Novelty Assessment: ⭐⭐⭐⭐ HIGH
The **refusal-aware routing** (detecting queries that frontier models will refuse, pre-routing to uncensored local models) is novel and practical. The feedback loop from performance tracking into future routing decisions is also strong.

### Paper Potential: **Section addition**
"Censorship-Aware Model Routing" — the refusal detection + local model fallback pattern is practically useful and publishable.

---

## Innovation 5: Warm Memory Consolidation Pipeline

**Files:** `server/services/memory/warmMemory.ts`, `server/services/memory/memorySystem.ts`

### What It Does
Periodically consolidates episodic memories into semantic knowledge (subject-predicate-object triples) using **local LLM inference** (vLLM/Ollama). Extracts structured facts from unstructured task memories at zero API cost.

### Technical Implementation
- Batch processes recent episodic memories (batches of 10)
- Uses local LLama/Qwen to extract knowledge triples: `{subject, predicate, object, confidence, category}`
- Categories: system_info, user_info, domain_knowledge, api_info, file_structure, configuration, relationship, definition
- Falls back gracefully: vLLM → Ollama → skip
- `getWarmContext()`: retrieves high-confidence semantic facts ranked by confidence for injection into prompts
- Runs as periodic consolidation job across all users

### Novelty Assessment: ⭐⭐⭐ MODERATE-HIGH
Memory consolidation from episodic to semantic is inspired by cognitive science (memory consolidation during sleep). Using local LLMs for $0 cost is the practical innovation. The structured triple extraction is solid.

### Paper Potential: **Section addition**
"Cognitive-Inspired Memory Consolidation" — the episodic → semantic pipeline mirrors human memory consolidation. Good for the memory architecture section.

---

## Innovation 6: Self-Modification Pipeline with Safety Rails

**Files:** `server/services/selfEvolution/selfModification.ts`, `server/services/selfEvolution/capabilityRegistry.ts`, `server/services/selfEvolution/skillAcquisition.ts`

### What It Does
The agent can propose, validate, and apply modifications to **its own source code** — but only within whitelisted paths and with forbidden pattern blocking. Includes modification specs, test plans, rollback plans, and an audit log.

### Technical Implementation
- **Whitelisted paths**: Only `tools.ts`, `selfEvolution/`, and `orchestrator.ts` can be modified
- **Forbidden patterns**: Blocks `process.exit`, `exec`, `eval`, `Function()`, `rm -rf`, `DROP TABLE`, etc.
- Each modification gets: unique ID, type classification, description, rationale, change list, auto-generated test plan, auto-generated rollback plan
- Validation step checks all changes are in allowed paths and contain no forbidden patterns
- Modifications go through: draft → validated → applied → rolled back (if tests fail)
- Full audit trail in database (`selfModificationLog`)

### Novelty Assessment: ⭐⭐⭐⭐ HIGH
Self-modifying agents with safety constraints is a hot research topic. Having a production implementation with whitelisted paths, forbidden patterns, test plans, and rollback capability is valuable.

### Paper Potential: **Strong section addition**
"Constrained Self-Modification in Production Agents" — the safety rails approach (whitelist + blacklist + rollback) is directly relevant to AI safety discussions.

---

## Innovation 7: Multi-Agent Coordinator with Role-Based Specialization

**Files:** `server/services/jarvis/v3/agentCoordinator.ts`, `server/services/jarvis/agentTeams.ts`, `opt/jarvis-v3/brain/src/graph.py`

### What It Does
Task analysis engine that classifies incoming tasks and routes them to specialized agent roles (planner, coder, executor, verifier, researcher, learner, safety). Includes a LangGraph-based supervisor pattern and complexity estimation.

### Technical Implementation
- **Agent types**: planner, coder, executor, verifier, researcher, learner, safety — each with defined tool sets and descriptions
- **Task pattern matching**: Regex-based classification maps task keywords to agent pairs with weights
- **Complexity estimation**: simple/moderate/complex based on multi-agent requirements
- **LangGraph implementation**: Python-based state graph with supervisor → coder/executor routing, conditional edges, typed state with task status tracking
- Special-case detection: weather queries, image generation, calculations → direct routing bypasses planner

### Novelty Assessment: ⭐⭐⭐ MODERATE
Multi-agent with role specialization is well-studied (AutoGen, CrewAI). The specific combination of pattern-based routing + LangGraph supervisor + 7 specialized roles with safety agent is a solid implementation but not groundbreaking.

### Paper Potential: **Background/related work section**
Good for establishing the evolution from role-based agents to the current architecture.

---

## Innovation 8: Deep Research with Source Credibility Scoring & Conflict Detection

**Files:** `server/services/jarvis/deepResearch.ts`

### What It Does
Automated research pipeline that scores source credibility by domain, generates citations with confidence levels, and **automatically detects conflicting claims** across sources.

### Technical Implementation
- **Credibility scoring**: 35+ domain-specific scores (arxiv.org: 0.95, nature.com: 0.98, wikipedia.org: 0.70, default: 0.50)
- **Citation extraction**: Word overlap between synthesis sentences and source snippets, confidence = average credibility of matching sources
- **Conflict detection**: Scans citations for contradictory keyword pairs (increase/decrease, positive/negative, true/false, better/worse)
- **Recursive deepening**: `shouldDeepen()` function decides whether to do another research pass based on conflicts found and unanswered questions
- **Follow-up query generation**: Extracts capitalized proper nouns from synthesis for follow-up searches

### Novelty Assessment: ⭐⭐⭐ MODERATE-HIGH
The conflict detection across sources is nice. Domain-based credibility scoring is practical but not novel. The recursive deepening based on conflict count is a good heuristic.

### Paper Potential: **Section addition**
"Automated Source Credibility Assessment and Conflict Resolution" — fits in a research agent section.

---

## Innovation 9: Error Classification & Failure Memory with Mitigation Suggestions

**Files:** `server/services/jarvis/errorClassification.ts`, `server/services/jarvis/failureMemory.ts`, `server/services/jarvis/autoEvolution.ts`

### What It Does
Classifies errors into categories (timeout, permission, not_found, rate_limit, auth, memory), creates failure signatures, tracks patterns, and suggests mitigations. The auto-evolution system detects capability gaps from failures and proposes new skills.

### Technical Implementation
- **Error signatures**: Combination of tool name + error class for pattern matching
- **Failure patterns**: Tracked per-signature with occurrence counts, last occurrence, tools to avoid, and preferred alternatives
- **Default alternatives**: When a tool fails, suggests fallback tools (e.g., web_search fails → try http_request)
- **Mitigation suggestions**: Error-class-specific advice (timeout → increase timeout or chunk, rate_limit → implement backoff)
- **Auto-evolution**: After each failed task, checks if it represents a capability gap, proposes new skills, records evolution suggestions with priority levels
- Stores failure episodic memories with lessons learned

### Novelty Assessment: ⭐⭐⭐⭐ HIGH
The closed-loop from failure → classification → pattern detection → capability gap → skill proposal → evolution is a complete self-healing cycle. Most agents just retry or give up.

### Paper Potential: **Strong section addition**
"Self-Healing Through Failure Pattern Analysis" — the complete cycle is a genuine contribution.

---

## Innovation 10: Strategy Switching During Task Execution

**Files:** `server/services/jarvis/strategySwitching.ts`

### What It Does
Dynamically switches execution strategy mid-task based on progress signals. If the current approach is stalling (too many iterations, declining progress), the system can switch strategies (e.g., from "detailed" to "pragmatic" or from "exploratory" to "focused").

### Technical Implementation
- **StrategyState**: Tracks current strategy, iteration count, progress signals, strategy history
- Strategy types with different tool preferences and stopping criteria
- `shouldForceComplete()`: Detects when to abandon current approach
- `updateStrategy()`: Evaluates progress and triggers strategy switches
- `generateStrategyPrompt()`: Creates strategy-specific system prompt additions

### Novelty Assessment: ⭐⭐⭐ MODERATE-HIGH
Most agents use fixed strategies. Dynamic strategy switching based on runtime progress signals is less common in literature.

### Paper Potential: **Section addition**
"Adaptive Strategy Selection During Task Execution" — good for agent architecture section.

---

## Innovation 11: Redis-Based Distributed Lease Manager for Multi-Agent Coordination

**Files:** `server/services/jarvis/v3/leaseManager.ts`

### What It Does
Distributed resource locking using Redis for coordinating multiple concurrent agent sessions. Prevents two agents from modifying the same file or running conflicting commands simultaneously.

### Technical Implementation
- Redis-based distributed locks with TTL (default 30s)
- Lease operations: acquire, release, extend, isHeld
- Probe mechanism (`__probe__` session) to check if resource is held without acquiring
- No-op fallback for single-agent mode
- Global singleton pattern with reset capability

### Novelty Assessment: ⭐⭐ MODERATE
Distributed locking is well-established. The application to multi-agent coordination is practical but not novel.

### Paper Potential: **Brief mention** in infrastructure section.

---

## Summary: Paper Impact Assessment

### Must Include (High Novelty + High Paper Value)
1. **Predictive Task Anticipation** (Innovation 1) — proactive agent behavior
2. **Self-Reflection & Skill Acquisition Loop** (Innovation 2) — continuous learning
3. **Quality Regression Detection** (Innovation 3) — historical performance comparison
4. **Self-Modification with Safety Rails** (Innovation 6) — constrained self-improvement
5. **Self-Healing Failure Loop** (Innovation 9) — failure → learning → evolution

### Should Include (Moderate-High Novelty)
6. **Censorship-Aware Model Routing** (Innovation 4) — practical routing innovation
7. **Cognitive Memory Consolidation** (Innovation 5) — episodic → semantic pipeline
8. **Deep Research Conflict Detection** (Innovation 8) — automated source validation
9. **Adaptive Strategy Switching** (Innovation 10) — runtime strategy changes

### Background/Mention
10. **Multi-Agent Role Coordination** (Innovation 7) — established pattern, good for evolution narrative
11. **Distributed Lease Management** (Innovation 11) — infrastructure detail

### Key Narrative for Paper
The Jarvis/Rasputin system demonstrates a **complete agent evolution arc**:
1. Start with reactive task execution
2. Add self-reflection to learn from outcomes
3. Build failure memory to avoid repeating mistakes
4. Implement quality gates to catch regressions
5. Enable self-modification to improve autonomously
6. Add predictive behavior to anticipate needs
7. Evolve from single-model to intelligent multi-model routing

This arc — from reactive to predictive, from static to self-improving — is the core narrative of the Cartu Method. The legacy codebase proves these ideas were implemented and tested in production before being refined into the current system.

### Current Status
All innovations evolved into the current OpenClaw-based architecture:
- Predictive task → OpenClaw cron heartbeats
- Self-reflection → Memory commit pipeline
- Quality assurance → Sub-agent monitoring
- Model routing → Cartu Proxy (8889)
- Memory consolidation → 5-layer Qdrant system
- Self-modification → Skill system + AGENTS.md
- Failure memory → Error handling in orchestration

The legacy system was the R&D lab; the current system is the production refinement.
