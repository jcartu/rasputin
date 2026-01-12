# AGENTS.md - Development Guide for RASPUTIN

This document provides essential information for AI coding agents working in the RASPUTIN codebase.

## Project Overview

**RASPUTIN** is a multi-model AI consensus and synthesis engine with autonomous agent capabilities (JARVIS). Built with React 19, Express 4, tRPC 11, and TypeScript.

**Stack**: React 19 + Tailwind 4 + Vite | Express + tRPC | MySQL/TiDB (Drizzle ORM) | Manus OAuth

## Build/Lint/Test Commands

### Development

```bash
pnpm dev              # Start dev server with hot reload
pnpm build            # Build client (Vite) and server (esbuild)
pnpm start            # Start production server
```

### Code Quality

```bash
pnpm check            # TypeScript type checking (no emit)
pnpm lint             # Run ESLint on all files
pnpm lint:fix         # Auto-fix ESLint issues
pnpm format           # Format code with Prettier
```

### Testing

```bash
pnpm test             # Run all tests with Vitest
vitest run server/auth.logout.test.ts          # Run single test file
vitest run -t "creates user on first login"    # Run single test by name
```

### Database

```bash
pnpm db:push          # Generate and run Drizzle migrations
```

## Project Structure

```
rasputin/
├── client/src/              # React frontend
│   ├── pages/               # Page components (Chat, Agent, Infrastructure, etc.)
│   ├── components/          # Reusable components
│   │   └── ui/              # shadcn/ui components (auto-generated, avoid editing)
│   ├── hooks/               # Custom React hooks
│   ├── contexts/            # React contexts
│   └── _core/               # Core utilities
├── server/                  # Express + tRPC backend
│   ├── routers.ts           # Main tRPC router (all API endpoints)
│   ├── db.ts                # Drizzle database helpers
│   ├── ssh.ts               # SSH management
│   ├── services/            # Business logic
│   │   ├── jarvis/          # JARVIS agent orchestration
│   │   ├── multiAgent/      # Multi-agent system
│   │   ├── infrastructure/  # SSH monitoring
│   │   ├── rag/             # Code indexing
│   │   ├── events/          # Webhooks & cron
│   │   ├── memory/          # Memory & learning
│   │   └── webApp/          # Web app scaffolding
│   └── _core/               # Core backend utilities
├── shared/                  # Shared types and constants
│   └── rasputin.ts          # Model definitions and configs
└── drizzle/                 # Database schema and migrations
    └── schema.ts            # Complete database schema (2300+ lines)
```

## Code Style Guidelines

### Imports

- Use absolute imports with path aliases:
  - `@/*` → `client/src/*`
  - `@shared/*` → `shared/*`
- Import order: external packages → absolute imports → relative imports
- Group imports by category (React, UI, utils, types)

Example:

```typescript
import { z } from "zod";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { User } from "@shared/types";
```

### Formatting (Prettier)

- **Semicolons**: Required
- **Quotes**: Double quotes
- **Print width**: 80 characters
- **Tab width**: 2 spaces (no tabs)
- **Trailing commas**: ES5 style
- **Arrow parens**: Avoid when possible (`x => x` not `(x) => x`)

### TypeScript

- **Strict mode**: Enabled
- **Module**: ESNext
- **No explicit `any`**: Warn (use sparingly)
- **Unused vars**: Error (prefix with `_` if intentionally unused: `_param`)
- Always define return types for exported functions
- Use type imports: `import type { Foo } from "./types"`

### Naming Conventions

- **Files**: camelCase for utilities, PascalCase for components
- **Components**: PascalCase (`UserProfile.tsx`)
- **Functions**: camelCase (`getUserById`)
- **Constants**: UPPER_SNAKE_CASE (`FRONTIER_MODELS`)
- **Types/Interfaces**: PascalCase (`type User = {}`)
- **Database tables**: camelCase (`infrastructureHosts`)

### React Patterns

- Use functional components with hooks
- No `React.FC` type (use implicit children)
- Prefer named exports over default for utilities
- Use default exports for pages/routes
- Destructure props in function signature
- Use `useQuery` for data fetching (React Query)
- Use `trpc` for API calls (tRPC)

Example component:

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export function TaskList({ userId }: { userId: number }) {
  const [filter, setFilter] = useState("all");
  const { data: tasks } = trpc.tasks.list.useQuery({ userId, filter });

  return (
    <div className="space-y-4">
      {tasks?.map(task => (
        <div key={task.id}>{task.title}</div>
      ))}
    </div>
  );
}
```

### Error Handling

- Use try-catch for async operations
- Log errors with `console.error()` (allowed in server code)
- Return structured errors: `{ success: false, error: string }`
- Use Zod for input validation in tRPC procedures
- Throw `TRPCError` for API errors with proper codes

Example:

```typescript
import { TRPCError } from "@trpc/server";

try {
  const result = await dangerousOperation();
  return { success: true, data: result };
} catch (error) {
  console.error("Operation failed:", error);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to complete operation",
  });
}
```

### Database Patterns

- Use Drizzle ORM for type-safe queries
- Prefer `db.select()` over raw SQL
- Use transactions for multi-step operations
- Use prepared statements for repeated queries

Example:

```typescript
import { db } from "./db";
import { users, chats } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
```

### ESLint Rules (Key)

- No `console.log` (use `console.info/warn/error`)
- Prefer `const` over `let`
- No `var` declarations
- Use `===` instead of `==`
- No unused imports
- React hooks rules enforced

## Special Considerations

### shadcn/ui Components

- Located in `client/src/components/ui/`
- **Do not manually edit** - regenerated by shadcn CLI
- Customize via Tailwind classes in parent components

### Database Migrations

- Schema defined in `drizzle/schema.ts`
- Run `pnpm db:push` after schema changes
- May encounter conflicts with existing tables

### Testing

- Test files: `*.test.ts` or `*.spec.ts`
- Located alongside source files in `server/`
- Use Vitest framework
- Mock external APIs in tests

### Known Issues

- Some TypeScript errors in `ssh.ts` are stale LSP errors (build passes)
- Database migrations may fail if tables exist (use manual SQL)

## Common Tasks

### Adding a new tRPC endpoint

1. Define Zod schema in `server/routers.ts`
2. Add procedure to appropriate router
3. Use `publicProcedure` or `protectedProcedure`
4. Call from client with `trpc.router.procedure.useQuery/useMutation()`

### Adding a new page

1. Create component in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Create corresponding tRPC router if needed

### Adding a JARVIS tool

1. Define tool schema in `server/services/jarvis/tools.ts`
2. Implement tool executor function
3. Add to available tools list

## Environment Variables

Required (auto-injected in Manus):

- `ANTHROPIC_API_KEY` - Claude API
- `OPENROUTER_API_KEY` - Multi-model routing
- `DATABASE_URL` - MySQL/TiDB connection
- `JWT_SECRET` - Session signing

Optional:

- `GEMINI_API_KEY`, `XAI_API_KEY`, `SONAR_API_KEY` - Additional models
- `ELEVENLABS_API_KEY` - Text-to-speech

## Resources

- **Handover Doc**: `/home/josh/rasputin/HANDOVER.md` - Comprehensive project overview
- **Todo**: `/home/josh/rasputin/todo.md` - Detailed task tracking
- **Package Manager**: pnpm (v10.4.1+)

## Known Failure Patterns & Anti-Patterns

These patterns have caused issues in production. **AVOID THEM.**

### JARVIS Task Looping

**Problem**: JARVIS can get stuck in infinite loops generating reports or iterating without progress.

**Root Cause**: No hard enforcement of `MAX_ITERATIONS` constant; orchestrator relies on soft limit.

**Prevention**:

- The orchestrator enforces `MAX_ITERATIONS = 15` as a hard limit (see `orchestrator.ts`)
- Always include exit conditions in multi-step tasks
- Monitor iteration count and force `task_complete` when approaching limit
- Use the `onIteration` callback to track progress

### Missing tRPC Procedures

**Problem**: Client calling procedures that don't exist in the router (e.g., `jarvis.getActiveTask`).

**Prevention**:

- Before adding client-side tRPC calls, verify the procedure exists in `server/routers.ts`
- Use TypeScript - the tRPC client will error if procedure doesn't exist
- Test API endpoints before deploying UI that depends on them

### LLM Format Fallback Latency

**Problem**: `json_schema` format fails with 400, silently falls back to `json_object`, adding latency.

**Prevention**:

- Use `json_object` format directly for OpenRouter calls when strict schema isn't required
- Log format fallbacks for visibility
- Monitor LLM call latency in production

### Sandbox Path Consistency

**Problem**: Files written to wrong directories (e.g., `/tmp/bitcoin_report/` vs `/tmp/jarvis-workspace/`).

**Prevention**:

- Always use the `JARVIS_WORKSPACE` constant from `tools.ts`
- Validate paths before file operations
- Use `path.join(JARVIS_WORKSPACE, ...)` for all sandbox file operations

### Duration Calculation Bugs

**Problem**: Tool durations showing incorrect values (e.g., 45,375 seconds).

**Root Cause**: Using `Date.now()` instead of stored `durationMs` field.

**Prevention**:

- Always use the `durationMs` field stored in database records
- Don't recalculate durations from timestamps in the UI
- Verify duration display matches expected ranges (tools rarely exceed 60 seconds)

### Cron Scheduler Spam

**Problem**: System status checks running too frequently, cluttering logs.

**Prevention**:

- Set reasonable cron intervals (minimum 5 minutes for non-critical tasks)
- Deduplicate cron jobs by checking if a similar task is already running
- Use rate limiting for automated tasks

### WebSocket Connection Churn

**Problem**: Frequent client disconnects/reconnects causing state loss and duplicate messages.

**Prevention**:

- Implement client-side reconnection with exponential backoff
- Use message deduplication based on message IDs
- Maintain server-side session state that survives reconnects

## Performance Guidelines

### JARVIS Task Optimization

1. **Iteration Budget**: Default is 15 iterations. Complex tasks should be broken into subtasks.
2. **Token Budget**: Default is 500,000 tokens. Monitor `tokenEstimate` in execution context.
3. **Parallel Tool Execution**: Tools in `PARALLELIZABLE_TOOLS` set run concurrently.
4. **Early Exit**: Use `task_complete` as soon as the task is done - don't iterate unnecessarily.

### Database Query Performance

1. Use indexes for frequently queried columns
2. Limit result sets with `.limit()`
3. Use `db.select()` with specific columns instead of `SELECT *`
4. Cache expensive queries where appropriate

### Frontend Performance

1. Use React Query's `staleTime` to prevent unnecessary refetches
2. Implement pagination for long lists
3. Debounce search inputs
4. Use `useMemo` and `useCallback` for expensive computations

## JARVIS-Specific Rules

### Tool Execution

- **Max identical calls per approach**: 2 (defined in `MAX_IDENTICAL_CALLS_PER_APPROACH`)
- **Consecutive failures before pivot**: 3 (triggers approach change)
- **Backoff delay**: Exponential, base 500ms, max 10s

### Memory Management

- Always call `search_memory` before starting complex tasks
- Store important learnings with `store_memory` after task completion
- Self-reflection triggers after tasks with >2 iterations or failures

### Error Recovery

- Use `TOOL_ALTERNATIVES` map for automatic fallback suggestions
- Classified errors include: `transient`, `permanent`, `resource`, `auth`, `rate_limit`
- Retryable errors should wait `retryAfterMs` before retry
