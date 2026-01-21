import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { getDb } from "../../db";
import { jarvisEventLog } from "../../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { getSharedMemoryBus } from "./redisBus";
import type { EventType } from "./types";

interface EventLogEntry {
  eventId: string;
  userId: number;
  sessionId: string;
  taskId: number;
  seq: number;
  eventType: EventType;
  payload: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
  blobRefs?: string[];
  createdAt: Date;
}

function computeHash(
  prevHash: string | null,
  payload: Record<string, unknown>,
  timestamp: number
): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  const input = `${prevHash || ""}${canonical}${timestamp}`;
  return createHash("sha256").update(input).digest("hex");
}

export class EventLogger {
  private seqCounters: Map<string, number> = new Map();
  private lastHashes: Map<string, string> = new Map();

  private getSeqKey(taskId: number): string {
    return `task:${taskId}`;
  }

  async logEvent(
    taskId: number,
    eventType: EventType,
    payload: Record<string, unknown>,
    options: {
      userId: number;
      sessionId: string;
      blobRefs?: string[];
    }
  ): Promise<EventLogEntry> {
    const db = await getDb();
    const bus = getSharedMemoryBus();

    const seqKey = this.getSeqKey(taskId);
    const seq = (this.seqCounters.get(seqKey) || 0) + 1;
    this.seqCounters.set(seqKey, seq);

    const prevHash = this.lastHashes.get(seqKey) || null;
    const timestamp = Date.now();
    const hash = computeHash(prevHash, payload, timestamp);
    this.lastHashes.set(seqKey, hash);

    const eventId = nanoid();

    const entry: EventLogEntry = {
      eventId,
      userId: options.userId,
      sessionId: options.sessionId,
      taskId,
      seq,
      eventType,
      payload,
      prevHash,
      hash,
      blobRefs: options.blobRefs,
      createdAt: new Date(timestamp),
    };

    if (db) {
      try {
        await db.insert(jarvisEventLog).values({
          eventId: entry.eventId,
          userId: entry.userId,
          sessionId: entry.sessionId,
          taskId: entry.taskId,
          seq: entry.seq,
          jarvisEventType: entry.eventType,
          payload: entry.payload,
          prevHash: entry.prevHash,
          hash: entry.hash,
          blobRefs: entry.blobRefs,
        });
      } catch (err) {
        console.error("[EventLogger] Failed to persist event:", err);
      }
    }

    try {
      await bus.publishEvent(taskId.toString(), eventType, payload, {
        userId: options.userId.toString(),
        sessionId: options.sessionId,
        idempotencyKey: eventId,
      });
    } catch (err) {
      console.error("[EventLogger] Failed to publish to Redis:", err);
    }

    return entry;
  }

  async logTaskStart(
    taskId: number,
    goal: string,
    options: { userId: number; sessionId: string }
  ): Promise<EventLogEntry> {
    this.seqCounters.set(this.getSeqKey(taskId), 0);
    this.lastHashes.delete(this.getSeqKey(taskId));

    return this.logEvent(
      taskId,
      "TASK_START",
      { goal, startedAt: Date.now() },
      options
    );
  }

  async logTaskEnd(
    taskId: number,
    result: { success: boolean; summary?: string; error?: string },
    options: { userId: number; sessionId: string }
  ): Promise<EventLogEntry> {
    return this.logEvent(
      taskId,
      "TASK_END",
      { ...result, completedAt: Date.now() },
      options
    );
  }

  async logToolCall(
    taskId: number,
    toolName: string,
    input: Record<string, unknown>,
    output: unknown,
    options: { userId: number; sessionId: string; durationMs?: number }
  ): Promise<EventLogEntry> {
    return this.logEvent(
      taskId,
      "TOOL_CALL",
      {
        toolName,
        input,
        output,
        durationMs: options.durationMs,
      },
      options
    );
  }

  async logAction(
    taskId: number,
    actionType: string,
    args: Record<string, unknown>,
    result: { success: boolean; preStateHash?: string; postStateHash?: string },
    options: { userId: number; sessionId: string; durationMs?: number }
  ): Promise<EventLogEntry> {
    return this.logEvent(
      taskId,
      "ACTION",
      {
        actionType,
        args,
        ...result,
        durationMs: options.durationMs,
      },
      options
    );
  }

  async logObservation(
    taskId: number,
    observation: {
      stateHash: string;
      activeWindow?: string;
      elements?: unknown[];
    },
    options: { userId: number; sessionId: string; blobRefs?: string[] }
  ): Promise<EventLogEntry> {
    return this.logEvent(taskId, "OBSERVATION", observation, options);
  }

  async logError(
    taskId: number,
    error: { message: string; code?: string; stack?: string },
    options: { userId: number; sessionId: string }
  ): Promise<EventLogEntry> {
    return this.logEvent(taskId, "ERROR", error, options);
  }

  async getTaskEvents(
    taskId: number,
    limit: number = 100
  ): Promise<EventLogEntry[]> {
    const db = await getDb();
    if (!db) return [];

    const results = await db
      .select()
      .from(jarvisEventLog)
      .where(eq(jarvisEventLog.taskId, taskId))
      .orderBy(desc(jarvisEventLog.seq))
      .limit(limit);

    return results.map(r => ({
      eventId: r.eventId,
      userId: r.userId,
      sessionId: r.sessionId,
      taskId: r.taskId,
      seq: r.seq,
      eventType: r.jarvisEventType as EventType,
      payload: r.payload as Record<string, unknown>,
      prevHash: r.prevHash,
      hash: r.hash,
      blobRefs: r.blobRefs as string[] | undefined,
      createdAt: r.createdAt,
    }));
  }

  async verifyHashChain(taskId: number): Promise<{
    valid: boolean;
    brokenAt?: number;
  }> {
    const events = await this.getTaskEvents(taskId, 10000);
    if (events.length === 0) return { valid: true };

    const sorted = events.sort((a, b) => a.seq - b.seq);

    for (let i = 0; i < sorted.length; i++) {
      const event = sorted[i];
      const expectedPrevHash = i === 0 ? null : sorted[i - 1].hash;

      if (event.prevHash !== expectedPrevHash) {
        return { valid: false, brokenAt: event.seq };
      }

      const recomputedHash = computeHash(
        event.prevHash,
        event.payload,
        event.createdAt.getTime()
      );
      if (recomputedHash !== event.hash) {
        return { valid: false, brokenAt: event.seq };
      }
    }

    return { valid: true };
  }
}

let eventLoggerInstance: EventLogger | null = null;

export function getEventLogger(): EventLogger {
  if (!eventLoggerInstance) {
    eventLoggerInstance = new EventLogger();
  }
  return eventLoggerInstance;
}
