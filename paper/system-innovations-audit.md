# RASPUTIN System Innovations Audit
## Beyond the Cartu Method Paper (Pre-Compaction Rescue + 5-Layer Memory)

*Audit date: 2026-03-07*
*Auditor: Subagent, from source code review of proxy_v11.py, hybrid_brain.py, session-boot.py, memory_engine.py, fact_extractor.py, ai_council.py, swarm_protocol.py, bm25_search.py, auto_rag.py, competitive_intel_scan.py, and cron configurations.*

---

## 1. Session-Affinity Load Balancer with Provider Cascade

**Description:** Cartu Proxy implements a session-affinity load balancer that distributes LLM requests across free providers (OpenCode Zen, OAuth, Gemini) while maintaining cache coherence per session.

**How it works (technical):**
- Each session is fingerprinted via `x-session-id` header or MD5 hash of the first 200 chars of the system prompt
- Sessions are assigned to a provider (Zen → OAuth → Gemini priority order) and stick to it for 4 hours (TTL)
- Circuit breaker: 3 consecutive failures → 2-minute cooldown before retry
- OAuth utilization tracking: skips OAuth when >70% of 5h window or >60% of 7d window used (parsed from Anthropic's `anthropic-ratelimit-unified-*` headers)
- On failure, cascades: assigned provider → next available → next → paid Anthropic Direct
- Max 500 tracked sessions with LRU eviction

**Why it's novel:**
- Most proxy solutions do simple round-robin or random. Session affinity for *cache coherence* (Anthropic's prompt caching is session-bound) is a cost-optimization insight nobody publishes about.
- The cascade with circuit breaking and utilization-based provider skipping is more sophisticated than typical API gateway patterns applied to LLMs.

**Paper potential:** Strong section addition — "Zero-Cost Inference via Multi-Provider Session-Affinity Routing"

**Key metrics:** Running Opus 4.6 at effectively $0/day by cascading through free tiers.

---

## 2. Zen Re-Migration Protocol

**Description:** Sessions that got stuck on OAuth (because Zen was temporarily down) are periodically probed to migrate back to Zen, the preferred free provider.

**How it works (technical):**
- Every 5 minutes (`ZEN_REMIGRATE_INTERVAL = 300`), sessions assigned to OAuth check if Zen is available again
- If Zen passes `_is_provider_available()` check (key exists, not quota-exceeded, circuit breaker clear), the session is silently reassigned
- Zen quota parsing: extracts retry times from error messages ("Retry in 5 days", "Retry in 15hr 51min") to precisely track when Zen becomes available again

**Why it's novel:**
- Self-healing provider affinity — the system actively seeks the cheapest path, not just failing over. This is the opposite of most failover systems which "fail over and forget."

**Paper potential:** Subsection of the routing paper. Novel enough to mention but not standalone.

---

## 3. Quality Gate with Best-of-N Sampling for Cheap Models

**Description:** When using MiniMax (a cheap frontier model at $0.15/$1.20 per Mtok), the proxy fires 5 concurrent requests, scores each response on quality dimensions, and picks the best one. If all 5 fail quality threshold, it auto-escalates to Opus.

**How it works (technical):**
- `BEST_OF_N = 5` concurrent requests via `asyncio.gather` with 30s timeout
- 9-dimension quality scoring (0-1 scale):
  - Bold formatting present (weight 2)
  - Emoji present (weight 1)
  - No XML hallucinations (weight 6 — auto-fail if present: score → 0.1)
  - No markdown tables (weight 2)
  - No CJK character leakage (weight 2)
  - No code blocks in non-code context (weight 1)
  - Reasonable length (weight 1)
  - No ### headers (weight 1)
  - No corporate speak phrases (weight 1)
- Quality threshold: 0.5. Best candidate wins; if all < 0.5, escalate to Opus
- Special handling: exact-response prompts (HEARTBEAT_OK, NO_REPLY) bypass quality gate entirely — the proxy *forges* the correct response if MiniMax fails to produce it

**Why it's novel:**
- Best-of-N sampling is known in RL/RLHF but applying it at the *proxy routing layer* for production quality control of cheap models is novel
- The multi-dimensional scoring rubric tuned to a specific agent's formatting requirements is practical and publishable
- The "response forging" for known-exact prompts is a clever optimization that prevents unnecessary escalation costs

**Paper potential:** Strong standalone section or even separate short paper — "Quality-Gated Multi-Sample Routing for Cost-Optimized LLM Agents"

**Key metrics:** Tracks pass_rate, escalation count, per-attempt scores. Available via `/quality` endpoint.

---

## 4. Proxy-Level Safety Layer (Command Blocklist + Response Sanitization)

**Description:** The proxy intercepts tool_use blocks in model responses and blocks dangerous commands before they reach the agent runtime.

**How it works (technical):**
- 14 dangerous command patterns (rm -rf, dd, mkfs, fork bombs, curl|sh, pm2 delete critical services, shutdown/reboot, etc.)
- Protected files list (openclaw.json, .credentials.json, /etc/shadow, SSH keys)
- Secret pattern scrubbing: 7 regex patterns strip API keys from responses (sk-api-, sk-or-, sk-ant-, ghp_, etc.)
- MiniMax-specific: strips XML hallucination patterns (`<minimax:tool_call>`, `<invoke>`, etc.) and CJK character leakage
- Blocked commands are replaced with user-visible warning text blocks, and stop_reason changes from "tool_use" to "end_turn"

**Why it's novel:**
- Safety at the proxy layer (between model and runtime) is an underexplored design point. Most safety is either at the prompt level (system prompts) or runtime level (sandboxing). Proxy-level interception catches model-generated dangerous commands regardless of which model or provider generated them.
- The combination of command blocklist + file protection + secret scrubbing + hallucination cleanup in one proxy layer is a comprehensive defense-in-depth approach.

**Paper potential:** Section addition — "Defense-in-Depth: Proxy-Layer Safety for Autonomous Agents"

---

## 5. Hybrid Brain: Vector + Graph + BM25 + Neural Reranking (4-Signal Search)

**Description:** The Second Brain search system combines four retrieval signals for memory recall: dense vector search (Qdrant), knowledge graph traversal (FalkorDB), BM25 sparse keyword matching, and neural reranking (bge-reranker-v2-m3).

**How it works (technical):**
- **Dense search:** Qdrant with nomic-embed-text embeddings (96K+ vectors, 768d)
- **Graph search:** FalkorDB (Redis-based) with entity nodes (Person, Organization, Project) linked to Memory nodes via MENTIONED_IN edges. Fast regex-based entity extraction on commit (known entities dictionary + capitalized multi-word pattern matching)
- **BM25:** Client-side BM25 scorer with IDF + length-normalized TF. Custom implementation (no external deps)
- **Reciprocal Rank Fusion:** Merges dense + BM25 rankings using RRF (k=60, standard from the RRF paper)
- **Neural reranking:** bge-reranker-v2-m3 on GPU, checked dynamically per-request (avoids startup race conditions). Falls back gracefully if unavailable.
- **Inline deduplication on commit:** cosine > 0.92 + text word overlap > 0.5 → update existing instead of creating new

**Why it's novel:**
- The paper already covers the 5-layer architecture conceptually. This is the *implementation detail* that shows it's not just theoretical — it's a working hybrid retrieval system with 4 signal types fused via RRF.
- The inline dedup on commit (cosine + text overlap dual check) prevents memory bloat without a separate dedup job.

**Paper potential:** Strengthen existing Section 2 with implementation details. The 4-signal fusion with RRF could be a subsection.

---

## 6. CEO Desk Pattern: Session Architecture with Context Budget Management

**Description:** The main Telegram session serves as an orchestration-only "command center" — all execution work is delegated to sub-agents. Strict context budget management with escalating thresholds.

**How it works (technical):**
- Main session rules (from AGENTS.md, enforced by system prompt):
  - Max 4 tool calls before surfacing to user
  - No large outputs (>30 lines) in main session
  - Sub-agent model routing: Qwen ($0) by default, Opus only for genuinely complex tasks
- Context thresholds (200K window, 20K reserved):
  - 50%: Proactive warning
  - 70%: Strong recommendation to save state + /new
  - 80%: Hard stop — refuse new work
  - 90%: Emergency — only responds with "please /new"
- `working-context.md` persistence: a scratchpad file that survives session compaction/restart
- Mandatory context footer on every response: `📚 Context: XXK/200K (XX%)`

**Why it's novel:**
- The "CEO desk" metaphor for session management is a publishable organizational pattern. Most agent systems don't formalize the boundary between orchestration and execution.
- The escalating context thresholds with behavioral changes at each level (warn → recommend → refuse → emergency) is a practical solution to context window degradation that nobody has formalized.

**Paper potential:** Strong section — "The CEO Desk Pattern: Hierarchical Session Management for Long-Running Agents." Could be a separate short paper.

---

## 7. Session Boot: Automatic Context Reconstruction

**Description:** On every new session start, `session-boot.py` automatically builds a BOOT.md file that reconstructs the agent's awareness of current state.

**How it works (technical):**
- Aggregates 6 sources:
  1. `working-context.md` — scratchpad from last session (most important, first 3000 chars)
  2. Recent memory logs — today's and yesterday's daily logs (2000 chars each)
  3. Session digests — last 3 days of session summaries
  4. Second Brain activity — semantic search for "recent activity decisions tasks today" (top 5 results)
  5. Active cron errors — queries gateway API for failing cron jobs
  6. Pending tasks — extracts from MEMORY.md's "Pending" section
- Output capped at 16K chars (~4K tokens) to fit context budget
- Written to workspace/BOOT.md, which is auto-loaded by OpenClaw

**Why it's novel:**
- Most agent systems either start fresh or rely on full conversation history. This is a *curated reconstruction* of the agent's working memory from multiple persistent stores — analogous to a human reviewing their notes before starting work.
- The multi-source aggregation (scratchpad + logs + digests + vector search + system health + task list) is more comprehensive than typical "session summary" approaches.

**Paper potential:** Section addition — "Session Boot: Multi-Source Context Reconstruction for Stateful Agents." Directly complements the memory architecture section.

---

## 8. Autonomous Cron Swarm Architecture

**Description:** 35+ autonomous cron agents running on scheduled intervals, each with specialized roles and model routing. Four named "swarm agents" (SCOUT, LIBRARIAN, SENTINEL, VANGUARD) run alongside domain-specific agents.

**How it works (technical):**
- Cron agents identified from system:
  - **swarm-scout** (every 6h): Proactive exploration/research
  - **swarm-librarian** (every 4h): Knowledge organization
  - **swarm-sentinel** (every 30m): System health monitoring
  - **swarm-vanguard** (daily 4am): Forward-looking planning
  - Plus 30+ specialized crons: Casino Daily Numbers, War SITREP, AI Research Scanner, Competitive Intel, Memory Consolidation, Graph Deepening, Email Reply Monitor, YouTube Daily Intel, Grok X Social Intel, etc.
- Model routing: Almost all use `cartu-proxy/qwen3.5-122b-a10b` ($0 local), with only 3 using Claude Opus (War SITREP Opus Analysis, Gumball Group Iran Watch, AI Research Scanner)
- Each runs in `isolated` target — separate from main session
- Swarm Protocol (`swarm_protocol.py`): Redis-based peer-to-peer communication blackboard with task handover, shadow agent spawning (different IP/User-Agent profiles), and message lineage tracking

**Why it's novel:**
- Using cron-scheduled AI agents as a *standing army* of autonomous workers is a design pattern that hasn't been well-documented. Most agent frameworks focus on reactive (user-triggered) execution.
- The swarm protocol with Redis blackboard, task handover, and shadow agents is a sophisticated multi-agent communication system.
- The 97%+ free model routing (Qwen for routine, Opus only for 3 critical tasks) demonstrates practical cost optimization.

**Paper potential:** Strong standalone section or separate paper — "Autonomous Cron Swarms: Proactive Agent Architectures." The swarm protocol with shadow agents is particularly novel.

---

## 9. AI Council: Multi-Model Consensus Engine

**Description:** A system that queries multiple LLMs simultaneously and synthesizes their responses, with a "fractal mode" that spawns specialized sub-agents.

**How it works (technical):**
- Model registry with 4 tiers: Frontier (Opus — weight 3.0), Strong (weight 2.0), Fast (weight 1.0), Local (weight 0.5)
- Three modes:
  - **Synthesis:** Fast single-model response
  - **Council:** Full multi-model debate — all models respond, tier-weighted scoring
  - **Fractal (v2):** Spawns 4 specialized sub-agents (Research, Counter-argument, Feasibility, Creative), each gets 200s to research independently, then Opus synthesizes
- Streaming events via JSONL for real-time progress tracking

**Why it's novel:**
- Multi-model consensus is known, but the tier-weighted voting + fractal sub-agent spawning for research is a distinctive approach. The fractal mode essentially uses models as specialized researchers before synthesis.

**Paper potential:** Subsection or appendix. Interesting but not core to the Cartu Method thesis.

---

## 10. Auto Fact Extraction Pipeline

**Description:** A 3-pass pipeline that automatically mines session transcripts for personal knowledge about the user, running every 4 hours.

**How it works (technical):**
- Pass 1 (Extract): Scans session JSONL files for user messages, sends batches to local Qwen for structured fact extraction
- Pass 2 (Verify): Cross-references extracted facts against existing knowledge (dedup via hash)
- Pass 3 (Filter): Stores in both `memory/facts.jsonl` (flat file) and Qdrant (vector searchable)
- State tracking: `fact_extractor_state.json` records last run time and processed lines to avoid re-processing
- Uses cartu-proxy with Qwen ($0 cost) for all LLM calls

**Why it's novel:**
- Automatic personal knowledge extraction from conversation transcripts, running as a background job, is a form of *continuous learning* that most agent systems don't implement.
- The 3-pass pipeline (extract → verify → filter) with dedup is more robust than naive extraction.

**Paper potential:** Section addition — directly strengthens the memory architecture section. "Continuous Knowledge Extraction from Agent-User Interactions."

---

## 11. Source-Tiered Memory Recall (Auto-RAG)

**Description:** Memory search results are scored differently based on their source — "gold" sources (conversations, ChatGPT, Perplexity) get boosted, while bulk email gets penalized.

**How it works (technical):**
- Source boost factors: conversation 1.35x, ChatGPT 1.30x, Perplexity 1.25x, email/gmail 0.70x
- Important contacts exception: emails from known contacts (family, business partners) get tier 2 (no penalty)
- Intelligent trigger detection: regex-based analysis of user messages to decide if memory lookup is even needed — proper nouns, personal keywords, explicit triggers
- Skip list for common words that aren't real proper nouns (200+ words)

**Why it's novel:**
- Source-quality-aware retrieval is an underexplored dimension in RAG systems. Most treat all documents equally. The insight that a conversation where the user explicitly stated a preference is more valuable than a bulk email is practical wisdom.

**Paper potential:** Subsection of memory architecture. Strengthens the existing paper.

---

## 12. Anthropic-to-OpenAI Full Protocol Translation (Bidirectional)

**Description:** The proxy translates between Anthropic Messages API and OpenAI Chat Completions API formats in both directions, including full tool calling support, streaming, and thinking blocks.

**How it works (technical):**
- Forward translation (Anthropic → OpenAI):
  - System prompt, message content blocks, tool schemas, tool_use/tool_result history
  - tool_choice mapping (Anthropic "any" → OpenAI "required")
  - Thinking blocks stripped
  - Two modes: `include_tools=True` (full translation for Qwen) and `include_tools=False` (text-summary for Cerebras compaction)
- Reverse translation (OpenAI → Anthropic):
  - Both sync and streaming paths
  - Tool call delta accumulation in streaming (OpenAI sends incremental argument chunks → accumulated → emitted as complete Anthropic tool_use blocks)
  - finish_reason mapping (tool_calls → tool_use, length → max_tokens)
  - GLM-4.7 reasoning model fallback: if content empty but reasoning present, uses reasoning as fallback
- SSE conversion: `json_to_sse_stream()` converts complete JSON responses into Anthropic-compatible SSE event streams

**Why it's novel:**
- While individual API translations exist, this is a *production-grade bidirectional translation layer* that handles edge cases (streaming tool call accumulation, reasoning model fallbacks, thinking block handling) that most implementations get wrong.
- The response model name prefixing (`prefix_response_model`) to prevent OpenClaw from bypassing the proxy is a subtle but critical operational detail.

**Paper potential:** Not novel enough for the academic paper, but valuable as an appendix or technical reference.

---

## 13. Second Brain Enrichment Pipeline

**Description:** Background pipeline that enriches 96K+ memory vectors with importance scores and summaries, processing 500 chunks per run at $0 cost.

**How it works (technical):**
- Batches 10 chunks per LLM call for importance scoring (1-10 scale) + 1-line summary
- Importance guide baked into prompt: 8-10 for personal/business/health, 5-7 for technical/project, 1-4 for casual/spam
- Runs via cron at night, 2000 chunks/night across 4 runs
- Uses local Qwen ($0) exclusively
- Estimated timeline: ~7 weeks to process full 96K corpus

**Why it's novel:**
- Retroactive enrichment of an existing vector store with LLM-generated metadata is a practical pattern. The batching strategy (10 chunks/call) optimizes for local model throughput.

**Paper potential:** Subsection of memory architecture.

---

## 14. Observational Memory (OM) — Local Keyword Matching Layer

**Description:** A sub-millisecond memory recall layer that uses pure keyword matching against compressed observation blocks — no embeddings, no API calls.

**How it works (technical):**
- Observations stored in `memory/om_observations.md` as date-grouped text blocks
- Query words extracted via regex, scored by keyword overlap against each block
- Threshold: ≥2 matching keywords (or ≥1 if query has ≤3 words)
- Freshness check: observations older than 72h still used but noted as stale
- Returns top 5 matching blocks

**Why it's novel:**
- This is a *zero-latency* memory layer that complements the vector search. In practice, it provides instant context for frequent topics without waiting for embedding + search. It's essentially a personal "grep" layer.

**Paper potential:** Strengthens the memory architecture as a 6th layer (or sub-layer of the existing architecture).

---

## Summary: Paper Impact Assessment

### Strongest Additions to Current Paper:
1. **Quality Gate with Best-of-N** (#3) — Novel, quantifiable, publishable as its own section
2. **CEO Desk Pattern** (#6) — Novel organizational pattern, formalizable
3. **Session Boot** (#7) — Directly complements memory architecture
4. **Autonomous Cron Swarms** (#8) — Novel architecture pattern
5. **Auto Fact Extraction** (#10) — Strengthens memory section

### Strong Subsections:
6. **Session-Affinity LB** (#1) — Novel cost optimization
7. **Proxy-Level Safety** (#4) — Defense-in-depth angle
8. **Source-Tiered Recall** (#11) — Practical RAG improvement
9. **Observational Memory** (#14) — Adds to memory layers

### Separate Paper Potential:
- **"Zero-Cost Frontier AI: Multi-Provider Routing for Autonomous Agents"** — combining #1, #2, #3 (proxy innovations)
- **"Autonomous Cron Swarms"** (#8) — standalone architecture paper
- **"The CEO Desk: Hierarchical Session Management"** (#6) — could be a workshop paper

### Not Novel Enough for Paper:
- Protocol translation (#12) — engineering, not research
- Basic enrichment pipeline (#13) — standard pattern
- AI Council (#9) — interesting but not core
