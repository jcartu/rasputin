import Redis from "ioredis";
import { nanoid } from "nanoid";
import type {
  BusMessage,
  StreamEntry,
  LockResult,
  TaskState,
  EventType,
  ControlCommand,
} from "./types";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const STREAM_MAX_LEN = 10000;
const LOCK_DEFAULT_TTL_MS = 5000;

let redisClient: Redis | null = null;
let subscriberClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    redisClient.on("error", (err: Error) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redisClient.on("connect", () => {
      console.info("[Redis] Connected to", REDIS_URL);
    });
  }
  return redisClient;
}

export function getSubscriberClient(): Redis {
  if (!subscriberClient) {
    subscriberClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });
  }
  return subscriberClient;
}

export async function connectRedis(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.connect();
    await client.ping();
    return true;
  } catch (err) {
    console.error("[Redis] Failed to connect:", err);
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  if (subscriberClient) {
    await subscriberClient.quit();
    subscriberClient = null;
  }
}

function eventStreamKey(taskId: string): string {
  return `bus:${taskId}:events`;
}

function controlStreamKey(taskId: string): string {
  return `bus:${taskId}:control`;
}

function stateHashKey(taskId: string): string {
  return `state:${taskId}`;
}

function lockKey(resource: string): string {
  return `locks:${resource}`;
}

export class SharedMemoryBus {
  private redis: Redis;

  constructor() {
    this.redis = getRedisClient();
  }

  async publishEvent(
    taskId: string,
    type: EventType,
    payload: Record<string, unknown>,
    options: {
      userId: string;
      sessionId: string;
      idempotencyKey?: string;
    }
  ): Promise<string> {
    const messageId = nanoid();
    const message: BusMessage = {
      messageId,
      taskId,
      userId: options.userId,
      sessionId: options.sessionId,
      type,
      payload,
      timestamp: Date.now(),
      idempotencyKey: options.idempotencyKey,
    };

    const streamKey = eventStreamKey(taskId);
    await this.redis.xadd(
      streamKey,
      "MAXLEN",
      "~",
      STREAM_MAX_LEN.toString(),
      "*",
      "data",
      JSON.stringify(message)
    );

    return messageId;
  }

  async publishControl(
    taskId: string,
    command: ControlCommand,
    options: { userId: string; sessionId: string }
  ): Promise<string> {
    return this.publishEvent(
      taskId,
      "CONTROL_CMD",
      command as unknown as Record<string, unknown>,
      options
    );
  }

  async readEvents(
    taskId: string,
    startId: string = "0",
    count: number = 100
  ): Promise<StreamEntry[]> {
    const streamKey = eventStreamKey(taskId);
    const results = await this.redis.xrange(
      streamKey,
      startId === "0" ? "-" : `(${startId}`,
      "+",
      "COUNT",
      count.toString()
    );

    return results.map(([id, fields]: [string, string[]]) => {
      const dataIndex = fields.indexOf("data");
      const data = dataIndex >= 0 ? fields[dataIndex + 1] : "{}";
      return {
        id,
        message: JSON.parse(data) as BusMessage,
      };
    });
  }

  async *streamEvents(
    taskId: string,
    startId: string = "$",
    blockMs: number = 5000
  ): AsyncGenerator<StreamEntry> {
    const streamKey = eventStreamKey(taskId);
    let lastId = startId;

    while (true) {
      const results = (await this.redis.call(
        "XREAD",
        "BLOCK",
        blockMs.toString(),
        "COUNT",
        "10",
        "STREAMS",
        streamKey,
        lastId
      )) as [string, [string, string[]][]][] | null;

      if (!results) continue;

      for (const [, entries] of results) {
        for (const [id, fields] of entries) {
          const dataIndex = fields.indexOf("data");
          const data = dataIndex >= 0 ? fields[dataIndex + 1] : "{}";
          lastId = id;
          yield {
            id,
            message: JSON.parse(data) as BusMessage,
          };
        }
      }
    }
  }

  async tryLock(
    resource: string,
    owner: string,
    ttlMs: number = LOCK_DEFAULT_TTL_MS
  ): Promise<LockResult> {
    const key = lockKey(resource);
    const result = await this.redis.set(key, owner, "PX", ttlMs, "NX");

    if (result === "OK") {
      return { acquired: true, owner, ttlMs };
    }

    const currentOwner = await this.redis.get(key);
    const ttl = await this.redis.pttl(key);
    return { acquired: false, owner: currentOwner || undefined, ttlMs: ttl };
  }

  async renewLock(
    resource: string,
    owner: string,
    ttlMs: number = LOCK_DEFAULT_TTL_MS
  ): Promise<boolean> {
    const key = lockKey(resource);
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, key, owner, ttlMs);
    return result === 1;
  }

  async releaseLock(resource: string, owner: string): Promise<boolean> {
    const key = lockKey(resource);
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await this.redis.eval(script, 1, key, owner);
    return result === 1;
  }

  async getTaskState(taskId: string): Promise<TaskState | null> {
    const key = stateHashKey(taskId);
    const data = await this.redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;

    return {
      taskId: data.taskId,
      userId: data.userId,
      sessionId: data.sessionId,
      status: data.status as TaskState["status"],
      currentPhase: data.currentPhase || undefined,
      stateHash: data.stateHash || undefined,
      lastActionId: data.lastActionId || undefined,
      iterationCount: parseInt(data.iterationCount || "0", 10),
      updatedAt: parseInt(data.updatedAt || "0", 10),
    };
  }

  async setTaskState(state: TaskState): Promise<void> {
    const key = stateHashKey(state.taskId);
    await this.redis.hset(key, {
      taskId: state.taskId,
      userId: state.userId,
      sessionId: state.sessionId,
      status: state.status,
      currentPhase: state.currentPhase || "",
      stateHash: state.stateHash || "",
      lastActionId: state.lastActionId || "",
      iterationCount: state.iterationCount.toString(),
      updatedAt: Date.now().toString(),
    });
    await this.redis.expire(key, 86400);
  }

  async updateTaskState(
    taskId: string,
    updates: Partial<TaskState>
  ): Promise<void> {
    const key = stateHashKey(taskId);
    const fields: Record<string, string> = { updatedAt: Date.now().toString() };

    if (updates.status) fields.status = updates.status;
    if (updates.currentPhase !== undefined)
      fields.currentPhase = updates.currentPhase;
    if (updates.stateHash !== undefined) fields.stateHash = updates.stateHash;
    if (updates.lastActionId !== undefined)
      fields.lastActionId = updates.lastActionId;
    if (updates.iterationCount !== undefined)
      fields.iterationCount = updates.iterationCount.toString();

    await this.redis.hset(key, fields);
  }

  async incrementIteration(taskId: string): Promise<number> {
    const key = stateHashKey(taskId);
    const newCount = await this.redis.hincrby(key, "iterationCount", 1);
    await this.redis.hset(key, "updatedAt", Date.now().toString());
    return newCount;
  }

  async getStreamLength(taskId: string): Promise<number> {
    const key = eventStreamKey(taskId);
    return await this.redis.xlen(key);
  }

  async trimStream(taskId: string, maxLen: number): Promise<number> {
    const key = eventStreamKey(taskId);
    return await this.redis.xtrim(key, "MAXLEN", "~", maxLen);
  }

  async deleteTaskData(taskId: string): Promise<void> {
    const eventKey = eventStreamKey(taskId);
    const controlKey = controlStreamKey(taskId);
    const stateKey = stateHashKey(taskId);
    await this.redis.del(eventKey, controlKey, stateKey);
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }
}

let busInstance: SharedMemoryBus | null = null;

export function getSharedMemoryBus(): SharedMemoryBus {
  if (!busInstance) {
    busInstance = new SharedMemoryBus();
  }
  return busInstance;
}
