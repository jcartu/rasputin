# ALFIE E2E Test Suite - Ready for Execution

**Status**: READY  
**Date**: 2026-02-06  
**Total Test Cases**: 302 unique tests  
**Total Test Runs**: 1,629 (across all browser configurations)

## Environment Setup

- [x] npm dependencies installed
- [x] Playwright browsers installed (Chromium, Firefox, WebKit)
- [x] TypeScript compilation verified (0 errors)
- [x] Test fixtures present and configured
- [x] baseURL configured: `http://localhost:3000`

## Test Categories & Counts

| Category               | Spec Files | Tests   | Description                                                  |
| ---------------------- | ---------- | ------- | ------------------------------------------------------------ |
| **AI Capabilities**    | 3          | 51      | Multi-model queries, Second Brain, Code Sandbox              |
| **Real-time Features** | 1          | 14      | WebSocket, streaming, GPU monitoring                         |
| **Integrations**       | 5          | 63      | GitHub, Slack, Email, Calendar, Terminal, Notion, Jupyter    |
| **UI/UX**              | 2          | 40      | Voice I/O, themes, search, accessibility, keyboard shortcuts |
| **Data Visualization** | 1          | 23      | Charts, diff viewer, screenshots, annotations                |
| **Platform**           | 1          | 38      | CLI, browser extension, desktop app, webhooks                |
| **Enterprise**         | 1          | 35      | Auth (JWT/OAuth/RBAC), PostgreSQL, Redis, backups            |
| **Stress Tests**       | 1          | 14      | High volume, concurrent connections, load testing            |
| **MANUS-Killer**       | 1          | 24      | 100+ msg context, collaboration, session branching           |
| **Total**              | **16**     | **302** |                                                              |

## Detailed Breakdown by File

### AI Capabilities (51 tests)

| File                            | Tests | Features                                                       |
| ------------------------------- | ----- | -------------------------------------------------------------- |
| `tests/ai/multi-model.spec.ts`  | 17    | Multi-model queries, consensus, model switching, prompt chains |
| `tests/ai/second-brain.spec.ts` | 18    | Memory search, semantic search, RAG pipeline                   |
| `tests/ai/code-sandbox.spec.ts` | 16    | Python/JS/Bash execution, security sandbox, resource limits    |

### Real-time Features (14 tests)

| File                               | Tests | Features                                                          |
| ---------------------------------- | ----- | ----------------------------------------------------------------- |
| `tests/realtime/websocket.spec.ts` | 14    | <100ms latency, GPU stats, tool visibility, collaborative editing |

### Integrations (63 tests)

| File                                         | Tests | Features                                           |
| -------------------------------------------- | ----- | -------------------------------------------------- |
| `tests/integrations/github.spec.ts`          | 12    | Issues, PRs, workflows, AI code review             |
| `tests/integrations/email.spec.ts`           | 10    | Read, compose, AI assistance, thread summarization |
| `tests/integrations/slack.spec.ts`           | 9     | Messages, reactions, bot interactions              |
| `tests/integrations/calendar.spec.ts`        | 11    | Scheduling, AI time finding, meeting prep          |
| `tests/integrations/terminal-notion.spec.ts` | 21    | Terminal sessions, Notion pages/databases, Jupyter |

### UI/UX (40 tests)

| File                             | Tests | Features                                                   |
| -------------------------------- | ----- | ---------------------------------------------------------- |
| `tests/ui/voice.spec.ts`         | 18    | Speech-to-text, text-to-speech, universal search           |
| `tests/ui/themes-export.spec.ts` | 22    | 6 themes, session export, mobile responsive, accessibility |

### Data Visualization (23 tests)

| File                           | Tests | Features                                                |
| ------------------------------ | ----- | ------------------------------------------------------- |
| `tests/dataviz/charts.spec.ts` | 23    | Line/bar/pie charts, diff viewer, screenshot annotation |

### Platform (38 tests)

| File                                   | Tests | Features                                                               |
| -------------------------------------- | ----- | ---------------------------------------------------------------------- |
| `tests/platform/cli-extension.spec.ts` | 38    | CLI commands, browser extension, desktop app, webhooks, API playground |

### Enterprise (35 tests)

| File                               | Tests | Features                                                                     |
| ---------------------------------- | ----- | ---------------------------------------------------------------------------- |
| `tests/enterprise/auth-db.spec.ts` | 35    | JWT/OAuth, RBAC, PostgreSQL CRUD, Redis cache, backup/restore, observability |

### Stress Tests (14 tests)

| File                        | Tests | Features                                                    |
| --------------------------- | ----- | ----------------------------------------------------------- |
| `tests/stress/load.spec.ts` | 14    | 1000 messages, 50 WebSockets, 10K files, concurrent queries |

### MANUS-Killer (24 tests)

| File                                     | Tests | Features                                                              |
| ---------------------------------------- | ----- | --------------------------------------------------------------------- |
| `tests/manus-killer/superiority.spec.ts` | 24    | Context preservation, 5-tool parallel execution, 5-user collaboration |

## Browser Configurations

Tests run across multiple browser configurations:

| Project       | Browser         | Viewport  | Notes                    |
| ------------- | --------------- | --------- | ------------------------ |
| chromium      | Desktop Chrome  | 1920x1080 | Primary test environment |
| firefox       | Desktop Firefox | Default   | Cross-browser coverage   |
| webkit        | Desktop Safari  | Default   | WebKit coverage          |
| mobile-chrome | Pixel 5         | Mobile    | Mobile Chrome            |
| mobile-safari | iPhone 12       | Mobile    | Mobile Safari            |
| api           | N/A             | N/A       | API-only tests           |
| stress        | Desktop Chrome  | Default   | Extended timeout (5 min) |
| performance   | Desktop Chrome  | Default   | Performance benchmarks   |

## Test Fixtures Available

- `api` - API helper with typed responses and latency tracking
- `ws` - WebSocket helper with latency measurement
- `perf` - Performance metrics collection
- `testData` - Test data generator
- `testSession` - Auto-cleanup test sessions
- `authenticatedPage` - Pre-authenticated browser context

## Performance Thresholds

| Metric                 | Threshold  |
| ---------------------- | ---------- |
| Page Load              | < 3,000ms  |
| API Response           | < 500ms    |
| WebSocket Latency      | < 100ms    |
| Search (438K memories) | < 1,000ms  |
| File Operations        | < 2,000ms  |
| Code Execution         | < 10,000ms |
| Model Response         | < 30,000ms |

## Prerequisites for Running

1. **ALFIE UI** must be running at `http://localhost:3000`
2. **ALFIE Backend** must be running at `http://localhost:3001`
3. System dependencies for Playwright browsers (run `sudo npx playwright install-deps` if needed)

## Run Commands

```bash
# Run all tests
npm test

# Run specific category
npm run test:ai
npm run test:realtime
npm run test:integrations
npm run test:ui-tests
npm run test:dataviz
npm run test:platform
npm run test:enterprise
npm run test:stress
npm run test:manus-killer

# Run with UI
npm run test:ui

# Run specific browser
npm run test:chromium
npm run test:firefox
npm run test:webkit

# Run in CI mode
npm run test:ci
```

## Notes

- Tests are designed to gracefully skip when services are unavailable
- WebSocket tests skip if connection fails
- Stress tests have extended timeouts (up to 5 minutes)
- All tests use proper cleanup via fixtures
