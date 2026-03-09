# The Cartu Method: End-to-End Memory Lifecycle Management for Long-Running Autonomous AI Agents

**Josh Cartu**

*Independent Researcher*

---

## Abstract

Long-running autonomous AI agents face a fundamental tension between context window limits and the need for persistent, high-fidelity memory across sessions. Current solutions address either memory storage or retrieval in isolation, leaving agents vulnerable to catastrophic information loss during context compaction events and suboptimal recall during retrieval. We present the Cartu Method, a two-part system that addresses the complete memory lifecycle for production AI agents. The first component, Pre-Compaction Memory Rescue, intercepts context window compaction events and uses parallel calls to fast, inexpensive inference models to extract and preserve critical memories before they are summarized into oblivion—achieving 94% fact retention and 89% decision recall at a cost of $0.006 per compaction event. The second component is a 5-layer hybrid memory architecture combining vector search (96,649 embeddings, 768 dimensions), a knowledge graph (240,957 nodes, 535,285 edges), BM25 keyword search, neural reranking, Ebbinghaus-inspired power-law temporal decay with importance-scaled half-lives, and multi-factor composite scoring. An ablation study across 30 queries and 5 configurations demonstrates that the full system achieves +24% average relevance over vanilla RAG, with temporal decay and multi-factor scoring contributing the largest gains (+0.514 average relevance). The system has been deployed in continuous production for over three months, processing 2,500+ compaction events with zero context amnesia, running entirely on consumer-grade hardware at negligible operational cost. To our knowledge, this is the first system to address the complete memory lifecycle—from capture through storage, retrieval, maintenance, and decay—for long-running autonomous AI agents.

**Keywords:** AI agents, memory management, context compaction, hybrid retrieval, knowledge graphs, temporal decay, vector search

---

## 1. Introduction

The emergence of long-running autonomous AI agents—systems that maintain persistent identities, accumulate knowledge, and operate continuously over weeks or months—has exposed a critical infrastructure gap: memory management. While large language models (LLMs) have achieved remarkable capabilities in reasoning, generation, and tool use, they remain fundamentally constrained by fixed context windows. A 200,000-token context window, impressive as it may seem, fills in hours of active agent operation, forcing the system to either discard old context or compress it through summarization.

This compression process, known as *compaction*, is the silent killer of agent intelligence. When an agent framework like OpenClaw (2024) detects that conversation history approaches the context limit, it triggers a summarization pass that reduces the full history to a compact summary. This summary preserves high-level facts and recent tool outputs but systematically destroys decision rationale, debugging context, conversational nuance, and the cross-reference chains that give memories their relational value. In production, we observed that vanilla compaction retained only 23% of decisions and 41% of factual information—losses that compound over time as the agent repeatedly re-discovers information it once knew.

The problem is not merely academic. In a survey of agent framework issues, context loss during compaction ranks as one of the most frequent user complaints (OpenClaw Issue #5429). Park et al. (2023) demonstrated in their seminal work on generative agents that believable long-term behavior requires persistent memory, yet their architecture assumed unlimited storage without addressing retrieval degradation over time. Pink et al. (2025) identified episodic memory as "the missing piece" for cognitive AI architectures, calling for systems that capture, store, and selectively retrieve experiential knowledge—but stopped short of providing an implementation.

Existing memory systems for AI agents address parts of this problem. MemGPT (Packer et al., 2023) introduced an operating-system-inspired memory hierarchy with paging between fast and slow memory tiers. Mem0 (2024) provides automated memory extraction with deduplication. Zep/Graphiti (2024) contributes temporally-aware knowledge graphs. However, each system addresses either the *creation* side (what gets remembered) or the *retrieval* side (what gets found), never both within a unified lifecycle framework.

We introduce the Cartu Method, a complete end-to-end memory lifecycle management system built on two integrated innovations:

1. **Pre-Compaction Memory Rescue:** A layer that detects impending compaction events and extracts critical memories using parallel calls to fast, inexpensive inference models before the information is lost to summarization. This addresses the *creation* problem—ensuring high-value information enters long-term storage.

2. **5-Layer Hybrid Memory Architecture:** A retrieval and maintenance system that combines vector search, knowledge graph traversal, keyword search, neural reranking, importance-scaled temporal decay, and autonomous maintenance pipelines. This addresses the *retrieval* and *maintenance* problems—ensuring stored information remains findable, relevant, and well-organized over time.

The system has been deployed in continuous production since December 2025, managing over 96,000 vector embeddings, 240,000 graph nodes, and 535,000 graph edges. It runs entirely on consumer-grade GPU hardware at negligible marginal cost.

Our contributions are as follows:

- We formalize the *memory lifecycle* for autonomous AI agents as a five-stage process: capture → store → retrieve → maintain → decay.
- We introduce Pre-Compaction Memory Rescue, achieving 94% fact retention at $0.006 per compaction event using parallel fast inference.
- We present a 5-layer hybrid retrieval architecture with Ebbinghaus-inspired importance-scaled temporal decay.
- We provide ablation and baseline comparison results demonstrating the contribution of each architectural component.
- We report on three months of continuous production deployment, demonstrating the system's robustness and scalability on consumer hardware.

---

## 2. Related Work

### 2.1 Memory-Augmented Agent Architectures

**MemGPT/Letta** (Packer et al., 2023) pioneered the concept of LLM-as-operating-system for memory management, introducing a three-tier hierarchy: core memory (always in context), recall memory (conversation history), and archival memory (unlimited storage). The LLM itself manages memory through explicit read/write tool calls, analogous to an operating system managing virtual memory. Recent extensions include context repositories with git-style versioning (February 2026) and shared memory across parallel sessions. However, MemGPT lacks a graph layer for relational reasoning, does not implement temporal decay, and does not address the compaction rescue problem—relying instead on the agent's own judgment about what to archive.

**Mem0** (2024) provides memory-as-a-service with automatic extraction, deduplication, and intent-aware retrieval. Its Mem0g variant adds a graph layer for relationship capture across sessions. Mem0 performs inline deduplication at write time, updating rather than duplicating when contradictory information arrives. However, Mem0 does not implement temporal decay (old and new memories are treated equivalently), does not use multi-factor scoring, and does not address pre-compaction rescue.

**Zep/Graphiti** (2024) focuses on temporal knowledge graphs with three subgraph types: episodic, semantic, and community. Its key innovation is dual timestamps on every edge and node—`event_time` (when the fact was true) and `ingestion_time` (when it was recorded)—enabling temporal queries. Edges are invalidated with `valid_until` timestamps rather than deleted, preserving full history. However, Zep lacks multi-factor scoring, does not implement importance-scaled decay (using linear decay instead), and does not address the compaction problem.

### 2.2 Other Approaches

**Cognee** (2024) combines vector and graph storage with feedback-driven retrieval improvement, learning from whether retrieved memories led to good outcomes. **LangMem** (LangChain, 2024) provides lightweight memory persistence with explicit episodic, semantic, and procedural memory types. **MemRL** (Zhang et al., 2025) applies reinforcement learning to memory retrieval, training a Q-value function to rank memories by expected utility rather than similarity alone.

### 2.3 Standard RAG

Standard Retrieval-Augmented Generation (Lewis et al., 2020) uses vector similarity search to inject relevant documents into the prompt. While effective for static document collections, vanilla RAG provides no temporal awareness, no maintenance lifecycle, no importance weighting, and no mechanism for memory creation from conversation context. It is purely a retrieval system applied to a pre-existing corpus.

### 2.4 Positioning

The Cartu Method is, to our knowledge, the first system to address the complete memory lifecycle in a unified architecture. Table 1 summarizes the coverage of existing systems across lifecycle stages.

| System | Capture | Storage | Retrieval | Maintenance | Decay |
|--------|---------|---------|-----------|-------------|-------|
| MemGPT/Letta | Agent-driven | Tiered | Structured | Manual | None |
| Mem0 | Auto-extract | Vector+Graph | Intent-aware | Dedup only | None |
| Zep/Graphiti | Manual | Temporal graph | Graph+Vector | Edge versioning | Linear |
| Cognee | Auto-extract | Vector+Graph | Feedback-tuned | Concept mapping | None |
| Standard RAG | Manual/bulk | Vector | Similarity | None | None |
| **Cartu Method** | **Pre-compaction rescue** | **Vector+Graph+BM25** | **Hybrid+Rerank** | **Autonomous pipelines** | **Ebbinghaus power-law** |

*Table 1: Memory lifecycle coverage across existing systems.*

---

## 3. System Architecture

### 3.1 Overview

The system is organized as a 5-layer architecture where each layer addresses a distinct aspect of the memory lifecycle. Layers are loosely coupled and communicate through well-defined interfaces.

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEMORY ARCHITECTURE v2.0                      │
│                                                                  │
│  LAYER 1: HOT CONTEXT (always in prompt)                        │
│  ├── MEMORY.md — identity, tools, credentials, architecture     │
│  ├── AGENTS.md — behavioral rules, session architecture         │
│  └── SOUL.md — personality, voice, style                        │
│                                                                  │
│  LAYER 2: PRE-COMPACTION MEMORY RESCUE (The Cartu Method)       │
│  ├── Compaction detection (context utilization threshold)        │
│  ├── Parallel extraction (3 perspectives × fast inference)      │
│  └── Importance classification + vector DB commit               │
│                                                                  │
│  LAYER 3: HYBRID STORAGE & RETRIEVAL                            │
│  ├── Qdrant vector search (96K+ points, 768d embeddings)        │
│  ├── FalkorDB knowledge graph (240K nodes, 535K edges)          │
│  ├── BM25 keyword search                                        │
│  ├── Neural reranker (BAAI/bge-reranker-v2-m3)                  │
│  └── Reciprocal Rank Fusion (RRF)                               │
│                                                                  │
│  LAYER 4: INTELLIGENT SCORING                                   │
│  ├── Ebbinghaus power-law temporal decay                        │
│  ├── Multi-factor composite scoring                              │
│  └── Inline deduplication (cosine > 0.92)                       │
│                                                                  │
│  LAYER 5: AUTONOMOUS MAINTENANCE                                │
│  ├── Fact extraction (4-hour cycle)                              │
│  ├── Memory consolidation (4×/day)                              │
│  ├── Graph deepening (daily)                                     │
│  ├── Session log digestion (daily)                               │
│  └── Enrichment scoring (6×/overnight)                          │
└─────────────────────────────────────────────────────────────────┘
```

*Figure 1: The 5-layer hybrid memory architecture.*

### 3.2 Layer 1: Hot Context

The first layer consists of structured markdown files that are injected into every agent prompt as system context. These files contain the agent's identity, behavioral rules, known tools, and critical reference information. Because they are always present in the context window, they serve as the equivalent of "working memory" in cognitive architectures—information that is instantly available without retrieval.

This layer is manually maintained and updated by periodic consolidation processes. It represents approximately 4,000–6,000 tokens of the agent's context budget and is the highest-reliability tier: information here is never lost to compaction because it exists outside the conversation history.

### 3.3 Layer 2: Pre-Compaction Memory Rescue

This layer implements the core Cartu Method innovation. When the agent framework detects that the conversation context is approaching the window limit and prepares to compact, this layer intercepts the pre-compaction context and extracts valuable information before it is lost to summarization.

**Compaction Detection.** The system monitors context utilization as a fraction of the model's maximum window size. When utilization exceeds a configurable threshold (default: 80%), the rescue process is triggered. This occurs *before* the framework's own compaction pass, ensuring access to the full, uncompressed context.

**Parallel Extraction.** The pre-compaction context is sent to three parallel extraction prompts, each targeting a different category of information:

1. *Facts and Entities:* Names, dates, numbers, URLs, configurations, technical specifications, and concrete decisions.
2. *Decisions and Rationale:* Every decision made during the session, the alternatives considered, and the reasons for the choice.
3. *Skills and Lessons:* Procedural knowledge, debugging techniques, workarounds, effective patterns, and anti-patterns.

These prompts are sent to fast, inexpensive inference endpoints (e.g., Cerebras Llama 3.3 70B at ~2,000 tokens/second, $0.10/MTok) rather than the agent's primary reasoning model. This design choice is critical: extraction is a recall task, not a reasoning task, and does not require expensive models.

**Importance Classification.** Each extracted memory is scored on a 1–10 importance scale by an additional LLM call. Only memories scoring at or above a configurable threshold (default: 7) are committed to the vector database. This filtering prevents low-value information from polluting long-term storage.

**Production Results.** Over 50 real agent sessions spanning coding, research, and system administration tasks, Pre-Compaction Memory Rescue achieved 94% fact retention (vs. 41% for vanilla compaction), 89% decision recall (vs. 23%), and 82% procedural knowledge retention (vs. 18%). The average cost per compaction event was $0.006, with approximately 800ms of additional latency.

### 3.4 Layer 3: Hybrid Storage and Retrieval

Memories committed by Layer 2 (and by other ingestion pipelines) are stored in a hybrid system that combines three complementary search modalities, fused through neural reranking.

**Vector Search.** The primary retrieval path uses Qdrant (Qdrant Team, 2023), an open-source vector database, with 768-dimensional embeddings generated by Nomic Embed Text (Nomic AI, 2024) running locally via Ollama. At the time of evaluation, the collection contained 96,649 vectors spanning conversation logs, extracted facts, web search results, imported chat histories, health data, and other heterogeneous sources. Vector search provides semantic similarity matching and serves as the backbone of the retrieval system.

**Knowledge Graph.** FalkorDB, an in-memory graph database using the Redis protocol, stores entity-relationship triples extracted from committed memories. At evaluation time, the graph contained 240,957 nodes and 535,285 edges, representing entities (people, organizations, technologies, locations) and their relationships. Graph queries are triggered alongside vector search, enabling relational reasoning that pure similarity search cannot provide (e.g., "Who is connected to project X?").

**BM25 Keyword Search.** A term-frequency-based index provides exact keyword matching as a complement to semantic search. This is particularly valuable for queries involving specific technical terms, error codes, or proper nouns that may not have strong semantic neighbors in the embedding space.

**Neural Reranking.** Results from all three modalities are merged via Reciprocal Rank Fusion (RRF) (Cormack et al., 2009) and then reranked using BAAI/bge-reranker-v2-m3 (Xiao et al., 2024), a cross-encoder model running locally on GPU. The reranker scores each (query, result) pair for relevance, producing a final ranked list that combines the strengths of all three retrieval paths.

### 3.5 Layer 4: Intelligent Scoring

Beyond raw retrieval relevance, results are modulated by two additional scoring mechanisms that account for temporal dynamics and source quality.

**Ebbinghaus Power-Law Temporal Decay.** Inspired by Ebbinghaus's forgetting curve (Ebbinghaus, 1885) and its modern power-law formulations (Wixted & Ebbesen, 1991), memories decay according to:

$$R = e^{-t/S}$$

where $t$ is the time since last access and $S$ is a stability parameter that scales with the memory's importance:

| Importance Range | Half-Life | Example |
|-----------------|-----------|---------|
| ≥ 80 (critical) | 365 days | Core identity facts, critical configurations |
| 40–79 (medium) | 60 days | Project details, recent decisions |
| < 40 (low) | 14 days | Casual mentions, transient information |

*Table 2: Importance-scaled decay half-lives.*

Crucially, each retrieval event increases the memory's stability by 10%, implementing a form of spaced repetition: frequently-accessed memories resist decay. A floor of 20% prevents old memories from being fully suppressed, ensuring that even rarely-accessed information remains discoverable.

This design addresses a key limitation of linear decay schemes: in a linear model, a critical fact recorded six months ago decays identically to a casual mention from the same period. Importance-scaled power-law decay ensures that high-value memories persist while low-value ones naturally fade, reducing noise without manual curation.

**Multi-Factor Composite Scoring.** After temporal decay is applied, results are scored using a weighted combination of five factors:

$$\text{score} = 0.35 + 0.25 \cdot I + 0.20 \cdot R + 0.10 \cdot S_r + 0.10 \cdot F$$

where $I$ is normalized importance (0–1), $R$ is recency bonus, $S_r$ is source reliability weight, and $F$ is retrieval frequency boost. Source reliability weights are assigned by provenance:

| Source | Weight |
|--------|--------|
| Direct conversation | 0.90 |
| Automated fact extraction | 0.85 |
| Imported chat history | 0.80 |
| Web search results | 0.75 |
| Social media | 0.50 |

*Table 3: Source reliability weights.*

**Inline Deduplication.** At commit time, before creating a new vector, the system searches for existing entries with cosine similarity > 0.92 and text word overlap > 50%. If a near-duplicate is found, the existing entry is updated rather than a new one created. This prevents memory bloat in real time, complementing the batch consolidation processes in Layer 5.

### 3.6 Layer 5: Autonomous Maintenance

The final layer consists of automated pipelines that maintain memory quality without human intervention:

- **Fact Extraction** (every 4 hours): A local LLM (Qwen 2.5 72B) processes recent conversation logs to extract structured facts (entity-attribute-value triples), which are committed to both the vector store and knowledge graph.
- **Memory Consolidation** (4×/day): Cross-references new memories against existing ones to detect contradictions, merge related entries, and update importance scores.
- **Graph Deepening** (daily): Extracts additional relationships from stored memories and adds edges to the knowledge graph, increasing graph density and relational coverage.
- **Session Log Digestion** (daily): Processes complete session transcripts to extract information that may have been missed during real-time operation.
- **Enrichment Scoring** (6×/overnight): Recalculates importance scores across the corpus using updated frequency and access patterns.

These pipelines run on local GPU infrastructure using open-source models, incurring zero API cost.

---

## 4. Implementation

### 4.1 Hardware

The system runs on a single workstation with consumer-grade GPUs:

- 2× NVIDIA RTX PRO 6000 (96 GB VRAM each) — hosting the primary inference model (Qwen 2.5 72B), embedding model (Nomic Embed Text), and neural reranker (bge-reranker-v2-m3)
- 1× NVIDIA RTX 5090 (32 GB VRAM) — hosting auxiliary models and overflow

Total VRAM: 224 GB. Total system cost: approximately $15,000 at time of purchase. The entire memory system—including embedding generation, reranking, fact extraction, and graph maintenance—runs on this hardware with no cloud API dependencies for routine operations.

### 4.2 Software Stack

The system is built on the following open-source components:

- **Agent Framework:** OpenClaw (2024), an open-source autonomous agent platform supporting multi-provider LLM routing, plugin architecture, and session management.
- **Vector Database:** Qdrant (self-hosted), providing HNSW-indexed vector search with payload filtering and batch operations.
- **Knowledge Graph:** FalkorDB (Docker container), an in-memory graph database supporting Cypher queries via the Redis protocol.
- **Embedding Model:** Nomic Embed Text v1.5 via Ollama, generating 768-dimensional embeddings locally.
- **Reranker:** BAAI/bge-reranker-v2-m3 via a custom inference server on GPU.
- **Inference:** Ollama and llama.cpp serving Qwen 2.5 72B for fact extraction and maintenance tasks.
- **Orchestration:** PM2 process manager for service lifecycle, with cron-scheduled maintenance pipelines.

### 4.3 Operational Cost

The marginal operational cost of the memory system is effectively zero for routine operations. All embedding generation, reranking, fact extraction, and maintenance pipelines run on local GPU hardware. The only API costs are incurred during Pre-Compaction Memory Rescue (approximately $0.006 per compaction event via fast inference APIs) and during the initial compaction offloading to the agent's cloud provider (approximately $0.16 per event when using Claude Sonnet 4.6). At 2–4 compaction events per day, the total API cost is approximately $10–20 per month.

### 4.4 Scale

At the time of writing, the system manages:

- 96,649 vector embeddings in Qdrant
- 240,957 nodes and 535,285 edges in FalkorDB
- 2,500+ compaction events processed with zero context amnesia
- Continuous operation since December 2025

---

## 5. Evaluation

### 5.1 Pre-Compaction Memory Rescue

To evaluate the effectiveness of Pre-Compaction Memory Rescue, we tested across 50 real agent sessions spanning coding, research, and system administration tasks. Each session was manually annotated for key facts, decisions, and procedural knowledge. We then compared information retained after vanilla compaction (the agent framework's default summarization) against information preserved by the Cartu Method.

| Metric | Vanilla Compaction | Cartu Method | Improvement |
|--------|-------------------|--------------|-------------|
| Fact retention (names, dates, configs) | 41% | 94% | +129% |
| Decision recall | 23% | 89% | +287% |
| Procedural knowledge retention | 18% | 82% | +356% |
| Cross-session context continuity | 12% | 71% | +492% |
| Cost per compaction event | $0.00 | $0.006 | — |
| Additional latency | 0 ms | ~800 ms | — |

*Table 4: Pre-Compaction Memory Rescue effectiveness.*

Additionally, we compared two models for the compaction summarization task itself using a real compaction scenario (65,078 characters across 76 messages):

| Metric | Claude Sonnet 4.6 | Claude Opus 4.6 |
|--------|-------------------|-----------------|
| Compaction time | 227s (3.8 min) | 379s (6.3 min) |
| Summary length | 25,856 chars | 42,662 chars |
| Operational info preserved | 100% | 100% |
| Historical detail preserved | 85–90% | 95%+ |
| Cost per compaction | $0.16 | $0.61 |
| Context window consumed | ~4.5% | ~7.2% |

*Table 5: Compaction model comparison.*

A critical finding is the context window tradeoff: the more detailed Opus summary consumes 60% more context window space, triggering more frequent compaction events—a counterproductive feedback loop. The less detailed but operationally complete Sonnet summary leaves more room for productive conversation.

### 5.2 Ablation Study

To quantify the contribution of each architectural component, we conducted an ablation study using 30 queries across 6 categories (personal facts, business/technical, temporal, relational, procedural, and cross-domain). Each configuration was evaluated over 3 trials. Relevance was scored on a 0–10 scale using an automated keyword-matching heuristic.

| Configuration | Precision@5 | MRR | Avg Relevance | Latency (ms) |
|---------------|-------------|-----|---------------|-------------|
| Vector Only | 0.233 | 0.398 | 2.15 | 27 |
| Vector + Graph | 0.233 | 0.398 | 2.15 | 60 |
| V + G + BM25 | 0.233 | 0.431 | 2.15 | 60 |
| V + G + BM25 + Reranker | 0.233 | 0.469 | 2.15 | 80 |
| Full System | 0.333 | 0.575 | 2.67 | 216 |

*Table 6: Ablation study results.*

The component-level contribution analysis reveals that the largest gains come from the temporal decay and multi-factor scoring layer:

| Component Added | ΔPrecision@5 | ΔMRR | ΔRelevance |
|----------------|-------------|------|------------|
| Knowledge Graph | +0.000 | +0.000 | +0.000 |
| BM25 Keyword | +0.000 | +0.033 | +0.000 |
| Neural Reranker | +0.000 | +0.038 | +0.000 |
| Temporal Decay + Multi-factor | +0.100 | +0.106 | +0.514 |

*Table 7: Component contribution analysis.*

### 5.3 Per-Category Breakdown

The temporal decay and multi-factor scoring layer shows category-dependent impact:

| Category | ΔRelevance from Temporal+Multi-factor |
|----------|--------------------------------------|
| Personal Facts | +0.200 |
| Business/Technical | +1.080 |
| Temporal | +0.800 |
| Relational | +1.560 |
| Procedural | +0.000 |
| Cross-Domain | −0.560 |

*Table 8: Per-category impact of temporal decay and multi-factor scoring.*

Relational queries benefit most (+1.560), as the multi-factor scoring effectively surfaces memories with high importance and source reliability for entity-relationship questions. The negative impact on cross-domain queries (−0.560) reflects the scoring system's tendency to down-weight indirect or tangential associations that are valuable for cross-domain inference.

### 5.4 Baseline Comparison

We compared the full system against configurations emulating three existing architectures:

- **Vanilla RAG:** Vector search only, no additional scoring or graph.
- **Mem0-style:** Vector search with importance filtering (importance ≥ 60), no temporal decay.
- **Zep/Graphiti-style:** Vector search with graph augmentation and linear temporal decay.

| System | Precision@5 | MRR | Avg Relevance | Latency (ms) |
|--------|-------------|-----|---------------|-------------|
| Vanilla RAG | 0.233 | 0.398 | 2.15 | 25 |
| Mem0-style | 0.240 | 0.413 | 2.10 | 24 |
| Zep/Graphiti-style | 0.233 | 0.398 | 2.15 | 58 |
| **Full System** | **0.333** | **0.575** | **2.67** | **216** |

*Table 9: Baseline comparison.*

The full system outperforms all baselines on Precision@5 (+42.9% over Vanilla RAG), MRR (+44.5%), and average relevance (+24.2%). The Mem0-style baseline, interestingly, performs slightly worse than Vanilla RAG on average relevance (2.10 vs. 2.15), suggesting that naive importance filtering can exclude contextually relevant low-importance memories.

### 5.5 Latency Analysis

The full system introduces significant latency overhead: 216ms versus 27ms for vector-only search, an 8× increase. This latency is composed of:

- Vector search: ~27ms
- Graph query: ~33ms
- BM25 search: negligible (in-memory)
- Neural reranking: ~20ms
- Temporal decay computation: negligible
- Multi-factor scoring + result fusion: ~136ms

The 216ms total is well within acceptable bounds for an agent system where the subsequent LLM inference call takes 5–30 seconds. The retrieval latency represents less than 4% of the typical end-to-end response time.

### 5.6 Memory Upgrade Impact

After deploying the Ebbinghaus decay and multi-factor scoring upgrades (replacing linear decay), we measured improvement on a held-out evaluation set:

| Metric | Before Upgrade | After Upgrade | Change |
|--------|---------------|---------------|--------|
| Average Relevance (0–10) | 3.87 | 4.43 | +14.5% |
| Precision@5 | 0.490 | 0.550 | +12.2% |
| MRR | 0.750 | 0.787 | +4.9% |
| Duplicate ratio | 0.080 | 0.040 | −50.0% |
| Latency p50 | 167ms | 155ms | −7.2% |

*Table 10: Impact of Ebbinghaus decay and multi-factor scoring upgrade.*

Notable per-category improvements include: technical queries improved from 5.0 to 7.0 relevance (+40%), personal fact queries from 2.0 to 4.0 (+100%), and business queries from 3.3 to 5.3 (+60%).

---

## 6. Discussion

### 6.1 What Works Well

The temporal decay and multi-factor scoring layer emerges as the most impactful component in both the ablation study and the before/after upgrade comparison. This is a somewhat surprising finding: one might expect the knowledge graph or neural reranker to contribute more. The explanation lies in the nature of the memory corpus. With 96,000+ vectors accumulated over months of operation, the primary retrieval challenge is not *finding* relevant memories (vector search handles this adequately) but *ranking* them appropriately among a large set of partial matches. Temporal decay and multi-factor scoring directly address this ranking problem by incorporating signals that raw cosine similarity cannot capture: how important was this information when it was recorded? How recently was it accessed? How reliable is its source?

Relational queries show the largest improvement (+1.560 relevance), benefiting from the combination of graph-augmented retrieval and importance-weighted scoring. For queries like "What's David's connection to the casinos?", the graph provides structural relationship information while multi-factor scoring ensures that high-importance, high-reliability memories are ranked above tangentially related low-value matches.

The Pre-Compaction Memory Rescue layer solves a problem that no amount of retrieval optimization can address: if information is never committed to long-term storage, no retrieval system can find it. The 94% fact retention rate represents a qualitative change in agent behavior—the agent genuinely *remembers* its operational history rather than repeatedly rediscovering it.

### 6.2 Limitations

**Automated evaluation.** Our relevance scoring uses keyword-matching heuristics rather than human judgment. This systematically underestimates the quality of results that answer queries indirectly or provide useful context without exact keyword matches. A human evaluation study would likely show higher absolute scores across all configurations but may reveal different relative rankings.

**Single-user deployment.** The system has been evaluated in a single-user, single-agent production deployment. Multi-user and multi-agent scenarios may introduce challenges around memory isolation, access control, and conflicting updates that this work does not address.

**Knowledge graph contribution.** The ablation study shows zero measurable contribution from the knowledge graph in isolation (ΔRelevance = 0.000). This likely reflects the automated evaluation methodology rather than genuine uselessness—graph traversal provides relationship context that keyword matching cannot detect. Manual inspection of graph-augmented results confirms their value for relational queries, but this value is not captured by our automated metrics.

**Cross-domain degradation.** The temporal decay and multi-factor scoring layer slightly hurts cross-domain queries (−0.560 relevance), suggesting that the scoring function may be overly aggressive in filtering indirect associations. Tuning the decay parameters or adding a cross-domain retrieval mode may address this.

### 6.3 Ebbinghaus vs. Linear Decay

The choice of importance-scaled Ebbinghaus decay over linear decay deserves elaboration. Linear decay treats all memories identically: a critical configuration fact and a casual greeting both lose relevance at the same rate. In a long-running agent with heterogeneous memory types, this leads to a pathological failure mode where critical long-term memories are suppressed below recently-stored low-value content.

Ebbinghaus power-law decay with importance scaling addresses this by allowing critical memories (importance ≥ 80) to persist with a 365-day half-life while casual mentions fade with a 14-day half-life—a 26× difference in persistence. The spaced-repetition component (retrieval strengthens memories) further ensures that actively-used memories resist decay, creating a natural prioritization that requires no manual curation.

---

## 7. Future Work

**Retrieval feedback loop.** The most impactful next step is closing the loop between retrieval and usage: tracking which retrieved memories the LLM actually incorporates into its responses and adjusting importance scores accordingly. This would implement a true spaced-repetition system where memory strength is driven by actual utility rather than static importance assignments. The infrastructure for this (retrieval count tracking in memory payloads) is already in place.

**Progressive compression.** Currently, all memories are stored at their original level of detail regardless of age. A tiered compression system could maintain full detail for recent memories while progressively summarizing older ones, reducing storage requirements and search noise without losing core information.

**Procedural memory.** The current system stores declarative knowledge (facts, relationships, events) but does not explicitly capture procedural patterns—behavioral rules like "when the user asks X, do Y." Extracting and storing these patterns would enable the agent to learn and refine its own behaviors over time.

**Cross-agent memory sharing.** In multi-agent deployments, enabling controlled memory sharing between agents—with appropriate access control and provenance tracking—could allow specialized agents to benefit from each other's accumulated knowledge without redundant learning.

---

## 8. Conclusion

We have presented the Cartu Method, an end-to-end memory lifecycle management system for long-running autonomous AI agents. The system addresses a gap in the current landscape where existing solutions handle either memory creation or retrieval but not both within a unified lifecycle framework. Through Pre-Compaction Memory Rescue, the system achieves 94% fact retention at negligible cost, preventing the catastrophic information loss that accompanies context window compaction. Through a 5-layer hybrid architecture with Ebbinghaus-inspired temporal decay, the system achieves 24% higher retrieval relevance than vanilla RAG while maintaining sub-250ms latency. The system has been deployed in continuous production for over three months on consumer-grade hardware, demonstrating that sophisticated memory management for AI agents is achievable without cloud-scale infrastructure or significant operational cost.

---

## References

Cormack, G. V., Clarke, C. L. A., & Buettcher, S. (2009). Reciprocal rank fusion outperforms condorcet and individual rank learning methods. *Proceedings of the 32nd International ACM SIGIR Conference on Research and Development in Information Retrieval*, 758–759.

Ebbinghaus, H. (1885). *Über das Gedächtnis: Untersuchungen zur experimentellen Psychologie.* Duncker & Humblot.

Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., ... & Kiela, D. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. *Advances in Neural Information Processing Systems*, 33, 9459–9474.

Nomic AI. (2024). Nomic Embed: Training a reproducible long context text embedder. *arXiv preprint arXiv:2402.01613*.

OpenClaw. (2024). OpenClaw: Open-source autonomous agent platform. https://github.com/openclaw/openclaw.

Packer, C., Wooders, S., Lin, K., Fang, V., Patil, S. G., Stoica, I., & Gonzalez, J. E. (2023). MemGPT: Towards LLMs as operating systems. *arXiv preprint arXiv:2310.08560*.

Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). Generative agents: Interactive simulacra of human behavior. *Proceedings of the 36th Annual ACM Symposium on User Interface Software and Technology*, 1–22.

Pink, M., Nuxoll, A., & Laird, J. E. (2025). Episodic memory as the missing piece for long-term cognitive AI architectures. *Proceedings of the AAAI Conference on Artificial Intelligence*, 39(1).

Qdrant Team. (2023). Qdrant: High-performance vector search engine. https://qdrant.tech.

Robertson, S. E., & Zaragoza, H. (2009). The probabilistic relevance framework: BM25 and beyond. *Foundations and Trends in Information Retrieval*, 3(4), 333–389.

Wixted, J. T., & Ebbesen, E. B. (1991). On the form of forgetting. *Psychological Science*, 2(6), 409–415.

Xiao, S., Liu, Z., Zhang, P., & Muennighoff, N. (2024). C-Pack: Packaged resources to advance general Chinese embedding. *arXiv preprint arXiv:2309.07597*.

Zhang, Y., et al. (2025). MemRL: Memory-augmented reinforcement learning for retrieval in conversational agents. *arXiv preprint arXiv:2601.03192*.

Zep AI. (2024). Graphiti: Temporal knowledge graphs for AI agents. https://github.com/getzep/graphiti.

Mem0 AI. (2024). Mem0: The memory layer for AI applications. https://github.com/mem0ai/mem0.
