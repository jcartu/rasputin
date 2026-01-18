import type { LeaseManager } from "./types";
import { getSharedMemoryBus } from "../../bus/redisBus";

const DEFAULT_LEASE_TTL_MS = 30000;

export class RedisLeaseManager implements LeaseManager {
  private leasePrefix: string;

  constructor(prefix: string = "jarvis:lease") {
    this.leasePrefix = prefix;
  }

  private resourceKey(resource: string): string {
    return `${this.leasePrefix}:${resource}`;
  }

  async acquire(
    resource: string,
    sessionId: string,
    ttlMs: number = DEFAULT_LEASE_TTL_MS
  ): Promise<boolean> {
    const bus = getSharedMemoryBus();
    const result = await bus.tryLock(
      this.resourceKey(resource),
      sessionId,
      ttlMs
    );
    return result.acquired;
  }

  async release(resource: string, sessionId: string): Promise<void> {
    const bus = getSharedMemoryBus();
    await bus.releaseLock(this.resourceKey(resource), sessionId);
  }

  async isHeld(resource: string): Promise<boolean> {
    const bus = getSharedMemoryBus();
    const result = await bus.tryLock(
      this.resourceKey(resource),
      "__probe__",
      1
    );
    if (result.acquired) {
      await bus.releaseLock(this.resourceKey(resource), "__probe__");
      return false;
    }
    return true;
  }

  async extend(
    resource: string,
    sessionId: string,
    ttlMs: number
  ): Promise<boolean> {
    const bus = getSharedMemoryBus();
    return bus.renewLock(this.resourceKey(resource), sessionId, ttlMs);
  }
}

let globalLeaseManager: RedisLeaseManager | null = null;

export function getGlobalLeaseManager(): LeaseManager {
  if (!globalLeaseManager) {
    globalLeaseManager = new RedisLeaseManager();
  }
  return globalLeaseManager;
}

export function resetGlobalLeaseManager(): void {
  globalLeaseManager = null;
}

export function createNoOpLeaseManager(): LeaseManager {
  return {
    acquire: async () => true,
    release: async () => {},
    isHeld: async () => false,
    extend: async () => true,
  };
}
