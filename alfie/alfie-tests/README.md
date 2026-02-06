# ALFIE E2E Test Suite

**Comprehensive test suite proving ALFIE's superiority over MANUS with 100+ tests across 9 categories.**

## Test Categories & Counts

| Category                 | Tests | What MANUS Cannot Do                                 |
| ------------------------ | ----- | ---------------------------------------------------- |
| **AI Capabilities**      | 20    | Multi-model consensus, prompt chains, fine-tuning    |
| **Real-time Features**   | 15    | <100ms WebSocket, live GPU stats, tool visibility    |
| **Integrations**         | 20    | GitHub, Slack, Gmail, Calendar, Notion, Terminal     |
| **Advanced UI**          | 15    | Voice I/O, universal search, 6 themes, accessibility |
| **Data & Visualization** | 10    | Charts, diff viewer, screenshot annotation           |
| **Platform**             | 10    | CLI, browser extension, desktop app, webhooks        |
| **Enterprise**           | 10    | JWT/OAuth, RBAC, PostgreSQL, Redis, backups          |
| **Stress Tests**         | 10    | 1000 messages, 50 WebSockets, 10K files              |
| **MANUS-Killer**         | 10    | 100+ msg context, 5-user collab, session branching   |

**Total: 110+ tests**

## Quick Start

```bash
cd alfie-tests

npm install

npx playwright install --with-deps

npm test
```

## Run Specific Test Categories

```bash
npm run test:ai

npm run test:realtime

npm run test:integrations

npm run test:ui-tests

npm run test:dataviz

npm run test:platform

npm run test:enterprise

npm run test:stress

npm run test:manus-killer
```

## Run Options

```bash
npm run test:ui

npm run test:headed

npm run test:debug

npm run test:chromium

npm run test:parallel

npm run test:ci
```

## Test Report

```bash
npm run report
```

Reports are generated in `reports/`:

- `reports/html/` - Interactive HTML report
- `reports/results.json` - JSON results
- `reports/junit.xml` - JUnit format for CI

## MANUS Comparison

### What ALFIE Does That MANUS Cannot:

1. **Multi-Model AI**
   - Query 5 models simultaneously
   - Consensus detection
   - Contradiction identification
   - Model switching mid-conversation with context preservation

2. **438K+ Memory Second Brain**
   - Semantic search across all memories
   - Context injection mid-conversation
   - Multi-vector-DB RAG pipeline
   - <1s search latency

3. **Real-Time Features**
   - <100ms WebSocket latency
   - Live GPU monitoring
   - Tool execution visibility (ReAct phases)
   - 50+ concurrent connections

4. **Code Sandbox**
   - Python/JS/Bash execution
   - Resource limits (CPU, memory, disk)
   - Network isolation
   - Package installation

5. **Collaborative Editing**
   - 5-user real-time collaboration
   - CRDT conflict resolution
   - Cursor presence
   - Version history

6. **Session Management**
   - 100+ message context preservation
   - Session branching and merging
   - Export to JSON/Markdown/PDF
   - Version control

7. **Integrations**
   - GitHub: Issues, PRs, Workflows
   - Slack: Messages, threads, reactions
   - Gmail: Read, compose with AI, send
   - Calendar: AI scheduling
   - Notion: Pages, databases
   - Terminal: Session persistence

8. **Enterprise Features**
   - JWT/OAuth/RBAC
   - PostgreSQL CRUD
   - Redis caching
   - Point-in-time backup/restore
   - OpenTelemetry observability

## Performance Benchmarks

| Metric                 | Threshold | ALFIE  |
| ---------------------- | --------- | ------ |
| Page Load              | <3s       | Passes |
| API Response           | <500ms    | Passes |
| WebSocket Latency      | <100ms    | Passes |
| Search (438K memories) | <1s       | Passes |
| File Operations        | <2s       | Passes |
| Code Execution         | <10s      | Passes |
| Model Response         | <30s      | Passes |

## Test Infrastructure

### Fixtures

- `api` - API helper with typed responses
- `ws` - WebSocket helper with latency measurement
- `perf` - Performance metrics collection
- `testData` - Test data generator
- `testSession` - Auto-cleanup test sessions
- `authenticatedPage` - Pre-authenticated browser context

### Utilities

- `test-data-generator.ts` - Mock sessions, conversations, files, memories
- `websocket-helper.ts` - WebSocket connection management
- `api-helper.ts` - Typed API request/response handling
- `performance-helper.ts` - Performance measurement and benchmarking

### Configuration

- Parallelized execution
- Multi-browser (Chrome, Firefox, Safari)
- Mobile viewports (iPhone, Pixel)
- Screenshot/video on failure
- HTML + JSON + JUnit reporting

## CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd alfie-tests
          npm ci
          npx playwright install --with-deps

      - name: Run tests
        run: |
          cd alfie-tests
          npm run test:ci

      - name: Upload report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: alfie-tests/reports/
```

## Environment Variables

| Variable             | Default               | Description           |
| -------------------- | --------------------- | --------------------- |
| `ALFIE_UI_URL`       | http://localhost:3000 | ALFIE UI URL          |
| `ALFIE_API_URL`      | http://localhost:3001 | ALFIE Backend URL     |
| `TEST_USER_EMAIL`    | test@alfie.dev        | Test user email       |
| `TEST_USER_PASSWORD` | test-password         | Test user password    |
| `CI`                 | -                     | Set in CI for retries |

## Directory Structure

```
alfie-tests/
├── playwright.config.ts
├── package.json
├── tsconfig.json
├── README.md
├── fixtures/
│   ├── global.setup.ts
│   ├── global.teardown.ts
│   └── test-fixtures.ts
├── utils/
│   ├── api-helper.ts
│   ├── websocket-helper.ts
│   ├── performance-helper.ts
│   └── test-data-generator.ts
├── tests/
│   ├── ai/
│   │   ├── multi-model.spec.ts
│   │   ├── second-brain.spec.ts
│   │   └── code-sandbox.spec.ts
│   ├── realtime/
│   │   └── websocket.spec.ts
│   ├── integrations/
│   │   ├── github.spec.ts
│   │   ├── email.spec.ts
│   │   ├── slack.spec.ts
│   │   ├── calendar.spec.ts
│   │   └── terminal-notion.spec.ts
│   ├── ui/
│   │   ├── voice.spec.ts
│   │   └── themes-export.spec.ts
│   ├── dataviz/
│   │   └── charts.spec.ts
│   ├── platform/
│   │   └── cli-extension.spec.ts
│   ├── enterprise/
│   │   └── auth-db.spec.ts
│   ├── stress/
│   │   └── load.spec.ts
│   └── manus-killer/
│       └── superiority.spec.ts
├── data/
│   ├── sessions/
│   ├── conversations/
│   ├── files/
│   └── memories/
└── reports/
    ├── html/
    ├── results.json
    └── junit.xml
```

## Writing New Tests

```typescript
import { test, expect } from '../../fixtures/test-fixtures';

test.describe('My Feature', () => {
  test('should do something', async ({ api, ws, testSession }) => {
    const response = await api.post('/api/endpoint', { data: 'test' });

    expect(response.status).toBe(200);
    expect(response.latency).toBeLessThan(500);
  });
});
```

## Maintenance

### Adding New Tests

1. Identify category (ai, realtime, integrations, etc.)
2. Create or modify spec file in appropriate directory
3. Use fixtures for common operations
4. Follow naming convention: `feature-name.spec.ts`

### Updating Thresholds

Edit `fixtures/test-fixtures.ts`:

```typescript
export const PERFORMANCE_THRESHOLDS = {
  pageLoad: 3000,
  apiResponse: 500,
  wsLatency: 100,
  // ...
};
```

## License

MIT
