import { nanoid } from "nanoid";
import type {
  ActionRequest,
  ActionResponse,
  ActionBatch,
  ActionBatchResponse,
  Action,
} from "./actionDSL";
import { validateActionRequest, validateBatchRequest } from "./actionDSL";
import { executeActionRequest, executeActionBatch } from "./executor";
import {
  SharedMemoryBus,
  getSharedMemoryBus,
  connectRedis,
  disconnectRedis,
} from "../bus/redisBus";

interface DaemonConfig {
  maxConcurrentActions: number;
  defaultTimeoutMs: number;
  screenshotOnError: boolean;
}

const DEFAULT_CONFIG: DaemonConfig = {
  maxConcurrentActions: 1,
  defaultTimeoutMs: 10000,
  screenshotOnError: true,
};

class DesktopDaemon {
  private config: DaemonConfig;
  private bus: SharedMemoryBus | null = null;
  private activeActions: Map<string, Promise<ActionResponse>> = new Map();
  private isRunning = false;

  constructor(config: Partial<DaemonConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      const connected = await connectRedis();
      if (connected) {
        this.bus = getSharedMemoryBus();
      }
      this.isRunning = true;
      console.info("[DesktopDaemon] Started");
    } catch (error) {
      console.error("[DesktopDaemon] Failed to start:", error);
      this.bus = null;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    await disconnectRedis();
    this.bus = null;
    console.info("[DesktopDaemon] Stopped");
  }

  async executeAction(
    action: Action,
    context: { taskId: number; userId: number; sessionId: string }
  ): Promise<ActionResponse> {
    const request: ActionRequest = {
      actionId: nanoid(),
      taskId: context.taskId,
      userId: context.userId,
      sessionId: context.sessionId,
      action,
      capturePreState: false,
      capturePostState: true,
      timeoutMs: this.config.defaultTimeoutMs,
    };

    return this.executeRequest(request);
  }

  async executeRequest(request: ActionRequest): Promise<ActionResponse> {
    const validated = validateActionRequest(request);

    if (this.activeActions.size >= this.config.maxConcurrentActions) {
      return {
        actionId: validated.actionId,
        success: false,
        error: "Max concurrent actions exceeded",
        durationMs: 0,
      };
    }

    const promise = executeActionRequest(validated);
    this.activeActions.set(validated.actionId, promise);

    try {
      const result = await promise;

      if (this.bus) {
        await this.bus.publishEvent(
          String(validated.taskId),
          "ACTION_RESULT",
          {
            actionId: validated.actionId,
            taskId: validated.taskId,
            success: result.success,
            error: result.error,
          },
          {
            userId: String(validated.userId),
            sessionId: validated.sessionId,
          }
        );
      }

      return result;
    } finally {
      this.activeActions.delete(validated.actionId);
    }
  }

  async executeBatch(batch: ActionBatch): Promise<ActionBatchResponse> {
    const validated = validateBatchRequest(batch);

    if (this.bus) {
      await this.bus.publishEvent(
        String(validated.taskId),
        "ACTION_PROPOSED",
        {
          batchId: validated.batchId,
          taskId: validated.taskId,
          actionCount: validated.actions.length,
        },
        {
          userId: String(validated.userId),
          sessionId: validated.sessionId,
        }
      );
    }

    const result = await executeActionBatch(validated);

    if (this.bus) {
      await this.bus.publishEvent(
        String(validated.taskId),
        "ACTION_RESULT",
        {
          batchId: validated.batchId,
          taskId: validated.taskId,
          success: result.success,
          actionsCompleted: result.actionsCompleted,
          actionsFailed: result.actionsFailed,
        },
        {
          userId: String(validated.userId),
          sessionId: validated.sessionId,
        }
      );
    }

    return result;
  }

  getStatus(): {
    running: boolean;
    activeActions: number;
    busConnected: boolean;
  } {
    return {
      running: this.isRunning,
      activeActions: this.activeActions.size,
      busConnected: this.bus !== null,
    };
  }
}

let daemonInstance: DesktopDaemon | null = null;

export function getDesktopDaemon(): DesktopDaemon {
  if (!daemonInstance) {
    daemonInstance = new DesktopDaemon();
  }
  return daemonInstance;
}

export async function initDesktopDaemon(): Promise<DesktopDaemon> {
  const daemon = getDesktopDaemon();
  await daemon.start();
  return daemon;
}

export { DesktopDaemon };
