# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**RASPUTIN** is a multi-model AI consensus and synthesis engine with autonomous agent capabilities (JARVIS). It queries multiple frontier AI models in parallel, synthesizes consensus responses, and executes autonomous tasks.

**Stack**: React 19 + Tailwind 4 + Vite | Express 4 + tRPC 11 | MySQL/TiDB (Drizzle ORM) | Manus OAuth

## Commands

```bash
# Development
pnpm dev              # Start dev server with hot reload (tsx watch)
pnpm build            # Build client (Vite) and server (esbuild)
pnpm start            # Start production server

# Code Quality
pnpm check            # TypeScript type checking (no emit)
pnpm lint             # Run ESLint
pnpm lint:fix         # Auto-fix ESLint issues
pnpm format           # Format with Prettier

# Testing
pnpm test                                      # Run all tests with Vitest
vitest run server/auth.logout.test.ts          # Run single test file
vitest run -t "creates user on first login"    # Run single test by name

# Database
pnpm db:push          # Generate and run Drizzle migrations
```

## Architecture

### Directory Structure

```
client/src/           # React frontend
  pages/              # Page components (Chat, Agent, Infrastructure, etc.)
  components/         # Reusable components
    ui/               # shadcn/ui components (auto-generated, avoid editing)
  hooks/              # Custom React hooks
  contexts/           # React contexts

server/               # Express + tRPC backend
  routers.ts          # Main tRPC router (all API endpoints)
  db.ts               # Drizzle database helpers
  ssh.ts              # SSH management
  services/           # Business logic
    jarvis/           # JARVIS agent orchestration
      orchestrator.ts # Main agent loop with tool execution
      tools.ts        # Tool definitions and executors
    multiAgent/       # Multi-agent system
    infrastructure/   # SSH monitoring
    events/           # Webhooks & cron
    memory/           # Memory & learning system

shared/               # Shared types and constants
  rasputin.ts         # Model definitions and configs

drizzle/
  schema.ts           # Database schema (73k+ lines)
```

### Key Architectural Patterns

- **Consensus Engine**: Queries 5+ frontier AI models in parallel, calculates agreement percentage
- **Synthesis Pipeline**: 5-stage deep research (web search, proposals, extraction, gap detection, meta-synthesis)
- **JARVIS Agent**: Autonomous task executor with Claude as orchestrator, 15+ tools, multi-provider fallback chain (Anthropic -> Cerebras -> Gemini -> Grok)
- **Multi-Agent System**: Hierarchical agent coordination with specialized roles (orchestrator, coordinator, specialist, worker)
- **Infrastructure Monitor**: SSH-based health collection with alerting and auto-remediation

### Import Aliases

```typescript
@/*        -> client/src/*
@shared/*  -> shared/*
```

## Code Style

### Formatting (Prettier)
- Semicolons required
- Double quotes
- 80 char print width
- 2 space indentation
- Trailing commas (ES5 style)
- Arrow parens avoided when possible

### TypeScript
- Strict mode enabled
- Use type imports: `import type { Foo } from "./types"`
- Prefix unused vars with underscore: `_param`

### React
- Functional components with hooks only
- No `React.FC` type
- Use `trpc.router.procedure.useQuery/useMutation()` for API calls

### Database (Drizzle)
```typescript
import { db } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
```

## Adding New Features

### New tRPC endpoint
1. Define Zod schema in `server/routers.ts`
2. Add procedure using `publicProcedure` or `protectedProcedure`
3. Call from client with `trpc.router.procedure.useQuery/useMutation()`

### New JARVIS tool
1. Define tool schema in `server/services/jarvis/tools.ts`
2. Implement tool executor function
3. Add to available tools list

### New page
1. Create component in `client/src/pages/`
2. Add route in `client/src/App.tsx`

## Known Issues

- Some TypeScript errors in `ssh.ts` are stale LSP errors (build passes)
- Database migrations may fail if tables exist (use manual SQL if needed)

## Environment Variables

Required:
- `ANTHROPIC_API_KEY` - Claude API
- `OPENROUTER_API_KEY` - Multi-model routing
- `DATABASE_URL` - MySQL/TiDB connection
- `JWT_SECRET` - Session signing

Optional:
- `GEMINI_API_KEY`, `XAI_API_KEY`, `SONAR_API_KEY` - Additional models
- `ELEVENLABS_API_KEY` - Text-to-speech
