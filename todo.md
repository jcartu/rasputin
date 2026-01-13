# RASPUTIN Project TODO

## Active Work Items

### Testing & Verification (High Priority)

- [x] Re-run stress tests 17, 19, 44 with 5-min timeout - ALL PASSED
- [x] Test deep_research optimization (90s timeout) - Test 33 PASSED (44s)
- [ ] PWA install prompt on iOS Safari (device testing needed)
- [x] Mobile responsive testing (375x812, 768x1024 verified)
- [x] Samsung Tri-Fold layout testing (1536x2152 verified)

### Computer Control / Self-Evolution (P0 - Critical) - COMPLETE

- [x] Activate self_propose_change, self_validate_change, self_apply_change tools - Working
- [x] Create first self-modification (add a new tool) - check_url_status created via self_generate_tool
- [x] Implement procedural memory extraction from successful tasks - 32 procedural memories stored
- [x] Test procedure replay on similar tasks - VERIFIED: findMatchingProcedure() in routers.ts/websocket.ts searches before each task, generateProcedureGuidance() injects when successRate >= 70%
- [x] True parallel agent execution (Promise.all refactor) - VERIFIED: Already implemented in multiAgentOrchestrator.ts with parallel, sequential, and mixed modes. Added parallelization to markMessagesRead and cancelOrchestration.

### Intelligent Self-Correction (P0) - COMPLETE

- [x] Error classification system (errorClassification.ts) - 8 error types: timeout, not_found, code_error, rate_limit, auth_error, network_error, validation_error, unknown
- [x] Dynamic fallback chains (fallbackPolicy.ts) - Policy-based retry decisions, tool alternatives, reliability ranking
- [x] Learning from failure patterns (failureMemory.ts) - Stores to episodic memory, tracks patterns, suggests mitigations
- [x] Strategy switching (strategySwitching.ts) - 6 strategies: default, decompose, verify_first, use_alternatives, reduce_scope, offline_mode

### Voice + Agent Integration - COMPLETE

- [x] Voice announcements for scheduled task results
- [x] Voice output for multi-agent team results
- [x] Full voice + JARVIS agent integration (regular JARVIS tasks emit voice announcements)
- [x] useVoiceAnnouncement hook with queue and localStorage preference

### Infrastructure (Pending Hardware)

- [ ] Integration test with actual Ollama server
- [ ] Full deployment to Rasputin hardware
- [ ] Docker/gVisor container isolation for workspaces

### Web App Development - Future Enhancements

- [x] Database schema generator (generate_schema tool - creates Drizzle ORM schemas from natural language)
- [ ] UI component library integration
- [ ] Docker containerization for deployments
- [ ] Test runner integration

### End-to-End Testing

- [ ] "Build me a todo app" full workflow
- [ ] "Build me a SaaS for fitness tracking"
- [x] Verify memory system learns over multiple tasks (code verified: createProcedureFromTask, findMatchingProcedure, generateProcedureGuidance all integrated)

---

## P1: Feature Parity with Manus (Week 2-3)

### Multi-Model Router - COMPLETE

- [x] Task classifier (code/research/analysis/creative) - taskClassifier.ts with 7 task types
- [x] Route to specialized models based on task type - routeTask() called in orchestrator.ts
- [x] Model performance tracking per task type - recordModelPerformance() tracks success/duration

### Deep Research Agent

- [x] Multi-source synthesis (deep_research optimized)
- [x] Citation tracking and credibility scoring (implemented)
- [x] Iterative research deepening (up to 3 iterations based on conflicts/gaps)
- [x] Cross-reference verification (sources cited multiple times get credibility boost)

### Async Task Queue - COMPLETE

- [x] Redis/PostgreSQL job queue - taskQueue.ts uses MySQL/TiDB with Drizzle ORM (asyncTaskQueue table)
- [x] Worker processes that survive sessions - TaskQueueService with startWorker/stopWorker, stale task recovery
- [x] Task status polling & webhooks - getTaskStatus(), webhook delivery with retry logic

### Document Engine

- [x] write_docx tool (Word documents)
- [x] write_pptx tool (PowerPoint)
- [x] write_xlsx tool (Excel)
- [ ] Template system for common formats

---

## P2: Beat Manus (Unique Advantages)

### Real Self-Evolution - COMPLETE

- [x] Generate new tools from natural language - self_generate_tool in selfEvolution/tools.ts
- [x] Create new agent types dynamically - agentTypeGenerator.ts with LLM-based analysis
- [x] Evolve prompts based on success metrics - analyzeSuccessPatterns() in performanceTracking.ts

### Predictive Task Initiation

- [ ] Anticipate user needs from patterns
- [ ] Proactive monitoring and alerting
- [ ] Smart suggestions based on context

### Swarm Intelligence

- [ ] Emergent behavior from agent interactions
- [ ] Agents that negotiate and collaborate
- [ ] Self-organizing team structures

---

## Recently Completed (Jan 13, 2026)

- [x] Migrate create_rich_report from manual SVG to Apache ECharts
  - Now supports: pie, donut, bar, line, area, scatter, gauge charts
  - Animated, interactive charts with tooltips
  - ECharts loaded via CDN (no bundling overhead)
- [x] Add PDF export for HTML reports (jarvis.exportReportPdf)
  - Uses Playwright to render HTML to PDF
  - Returns base64 PDF for client download
- [x] Add PDF export button in UI (ExportPanel)
  - Printer icon appears on hover for HTML report artifacts
- [x] Local SDXL image generation on Blackwell GPU (RTX PRO 6000)
- [x] Fix production image URLs with SERVER_BASE_URL + base64 fallback
- [x] Add MAX_TASK_DURATION_MS (5 min) hard limit to orchestrator
- [x] Optimize deepResearch with parallel searches and 90s timeout
- [x] Remove duplicate thinking display in streaming UI
- [x] Add file-type-specific icons (20+ types)
- [x] Test 33 (crypto regulations) - PASSED in ~44s per deep_research

---

## Completed Features (Archived)

<details>
<summary>Click to expand completed phases</summary>

### Core Platform (Phase 1-11) - COMPLETE

- Database schema, dark theme, API integrations
- OpenRouter, direct APIs (Anthropic, OpenAI, Google, xAI, Perplexity)
- Consensus mode (parallel model querying, agreement calculation)
- Synthesis mode (5-stage pipeline with meta-synthesis)
- WebSocket streaming, responsive UI, chat interface
- RASPUTIN logo, splash screen, animations

### JARVIS Agent Mode - COMPLETE

- Orchestrator with Claude Opus brain
- 20+ tools (web search, code execution, file ops, image gen)
- Task persistence to database
- Real-time tool execution display
- Rate limiting and usage tracking

### Voice Conversation Mode - COMPLETE

- Push-to-talk with Whisper STT
- ElevenLabs TTS (British male voice)
- Waveform visualization
- Wake word "Hey JARVIS"

### Infrastructure Systems (Module 1-4) - COMPLETE

- Infrastructure monitoring with self-healing
- Multi-agent orchestration system
- RAG pipeline for codebase understanding
- Webhook & event system with cron scheduling

### Self-Evolving Agent Phase 1 - COMPLETE

- SSH remote execution with approval workflow
- Skills archive (50+ skills learned)
- Self-modification logging

### Local LLM Integration - COMPLETE (pending hardware)

- Local LLM Router (Ollama/vLLM)
- Persistent memory system (episodic, semantic, procedural)
- Memory consolidation and importance decay
- Self-reflection system

### Authentication & UI - COMPLETE

- Google OAuth (only login method)
- User profile menu with avatar
- PWA installation support
- Chat renaming, export (Markdown/PDF)
- Auto-generated chat titles

</details>

---

## Metrics to Track

- [ ] Parallel agent tasks completing in <50% of sequential time
- [ ] Procedural memory count > 0 after 10 tasks
- [ ] At least 1 successful self-modification applied
- [ ] Task success rate > 90% on previously-failed patterns
- [ ] Memory recall accuracy > 80%
