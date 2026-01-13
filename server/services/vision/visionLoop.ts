import { nanoid } from "nanoid";
import {
  analyzeScreenshot,
  type VLMRequest,
  type VLMResponse,
} from "./vlmClient";
import { formatAction } from "./actionFormatter";
import { getDesktopDaemon } from "../desktop/daemon";
import { getDb } from "../../db";
import { visionActionSessions } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getSharedMemoryBus, connectRedis } from "../bus/redisBus";
import * as crypto from "crypto";

const MAX_ITERATIONS = 50;
const MAX_REPEAT_STATE = 3;
const SCREENSHOT_SIMILARITY_THRESHOLD = 0.95;

export interface VisionLoopConfig {
  taskId: number;
  userId: number;
  sessionId: string;
  goal: string;
  maxIterations?: number;
  screenshotIntervalMs?: number;
  onProgress?: (update: VisionLoopProgress) => void;
}

export interface VisionLoopProgress {
  iteration: number;
  phase: "screenshot" | "analyzing" | "formatting" | "executing" | "verifying";
  vlmResponse?: VLMResponse;
  actionTaken?: string;
  error?: string;
  isComplete: boolean;
}

export interface VisionLoopResult {
  success: boolean;
  iterations: number;
  finalState?: string;
  error?: string;
  actionHistory: string[];
}

function hashScreenshot(screenshotPath: string): string {
  return crypto
    .createHash("md5")
    .update(screenshotPath + Date.now())
    .digest("hex");
}

async function createSession(config: VisionLoopConfig): Promise<string> {
  const sessionId = `vas-${nanoid()}`;
  const db = await getDb();

  if (db) {
    await db.insert(visionActionSessions).values({
      sessionId,
      taskId: config.taskId,
      userId: config.userId,
      goal: config.goal,
      status: "running",
      currentPhase: "screenshot",
      iterationCount: 0,
      actionCount: 0,
      vlmCallCount: 0,
      repeatStateCount: 0,
      recoveryAttempts: 0,
    });
  }

  return sessionId;
}

async function updateSession(
  sessionId: string,
  updates: Partial<{
    status: "running" | "paused" | "completed" | "failed" | "cancelled";
    currentPhase: string;
    stateHash: string;
    iterationCount: number;
    actionCount: number;
    vlmCallCount: number;
    repeatStateCount: number;
    lastObservation: unknown;
    recoveryAttempts: number;
    result: string;
    errorMessage: string;
  }>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const updateData: Record<string, unknown> = {};
  if (updates.status) updateData.status = updates.status;
  if (updates.currentPhase) updateData.currentPhase = updates.currentPhase;
  if (updates.stateHash) updateData.stateHash = updates.stateHash;
  if (updates.iterationCount !== undefined)
    updateData.iterationCount = updates.iterationCount;
  if (updates.actionCount !== undefined)
    updateData.actionCount = updates.actionCount;
  if (updates.vlmCallCount !== undefined)
    updateData.vlmCallCount = updates.vlmCallCount;
  if (updates.repeatStateCount !== undefined)
    updateData.repeatStateCount = updates.repeatStateCount;
  if (updates.lastObservation !== undefined)
    updateData.lastObservation = updates.lastObservation;
  if (updates.recoveryAttempts !== undefined)
    updateData.recoveryAttempts = updates.recoveryAttempts;
  if (updates.result) updateData.result = updates.result;
  if (updates.errorMessage) updateData.errorMessage = updates.errorMessage;
  if (updates.status === "completed" || updates.status === "failed") {
    updateData.completedAt = new Date();
  }

  await db
    .update(visionActionSessions)
    .set(updateData)
    .where(eq(visionActionSessions.sessionId, sessionId));
}

export async function runVisionLoop(
  config: VisionLoopConfig
): Promise<VisionLoopResult> {
  const maxIterations = config.maxIterations || MAX_ITERATIONS;
  const actionHistory: string[] = [];
  let repeatStateCount = 0;
  let lastStateHash = "";

  const vasSessionId = await createSession(config);
  const daemon = getDesktopDaemon();
  await daemon.start();

  await connectRedis();
  const bus = getSharedMemoryBus();

  const report = (update: VisionLoopProgress) => {
    config.onProgress?.(update);
    bus.publishEvent(
      String(config.taskId),
      "STATE_UPDATE",
      { visionLoop: update },
      { userId: String(config.userId), sessionId: config.sessionId }
    );
  };

  try {
    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      report({
        iteration,
        phase: "screenshot",
        isComplete: false,
      });

      await updateSession(vasSessionId, {
        currentPhase: "screenshot",
        iterationCount: iteration,
      });

      const screenshotResult = await daemon.executeAction(
        { type: "SCREENSHOT", format: "png", quality: 90 },
        {
          taskId: config.taskId,
          userId: config.userId,
          sessionId: config.sessionId,
        }
      );

      if (!screenshotResult.success || !screenshotResult.postStateRef) {
        throw new Error(`Screenshot failed: ${screenshotResult.error}`);
      }

      const currentStateHash = hashScreenshot(screenshotResult.postStateRef);

      if (currentStateHash === lastStateHash) {
        repeatStateCount++;
        if (repeatStateCount >= MAX_REPEAT_STATE) {
          await updateSession(vasSessionId, {
            status: "failed",
            errorMessage: "Screen state unchanged after multiple actions",
            repeatStateCount,
          });
          return {
            success: false,
            iterations: iteration,
            error: "Screen state unchanged - possible stuck state",
            actionHistory,
          };
        }
      } else {
        repeatStateCount = 0;
        lastStateHash = currentStateHash;
      }

      report({
        iteration,
        phase: "analyzing",
        isComplete: false,
      });

      await updateSession(vasSessionId, {
        currentPhase: "analyzing",
        stateHash: currentStateHash,
        repeatStateCount,
      });

      const vlmRequest: VLMRequest = {
        screenshot: screenshotResult.postStateRef,
        goal: config.goal,
        previousActions: actionHistory.slice(-10),
        errorContext:
          repeatStateCount > 0
            ? `Action may not have worked (${repeatStateCount} unchanged states)`
            : undefined,
      };

      const vlmResponse = await analyzeScreenshot(vlmRequest);

      await updateSession(vasSessionId, {
        vlmCallCount: iteration,
        lastObservation: vlmResponse,
      });

      report({
        iteration,
        phase: "analyzing",
        vlmResponse,
        isComplete: vlmResponse.isComplete,
      });

      if (vlmResponse.isComplete) {
        await updateSession(vasSessionId, {
          status: "completed",
          result: vlmResponse.completionReason || "Goal achieved",
        });
        return {
          success: true,
          iterations: iteration,
          finalState: vlmResponse.completionReason,
          actionHistory,
        };
      }

      if (!vlmResponse.action) {
        continue;
      }

      report({
        iteration,
        phase: "formatting",
        vlmResponse,
        isComplete: false,
      });

      await updateSession(vasSessionId, { currentPhase: "formatting" });

      const action = await formatAction(vlmResponse.action);

      report({
        iteration,
        phase: "executing",
        vlmResponse,
        actionTaken: JSON.stringify(action),
        isComplete: false,
      });

      await updateSession(vasSessionId, { currentPhase: "executing" });

      const actionResult = await daemon.executeAction(action, {
        taskId: config.taskId,
        userId: config.userId,
        sessionId: config.sessionId,
      });

      if (actionResult.success) {
        actionHistory.push(vlmResponse.action);
        await updateSession(vasSessionId, {
          actionCount: actionHistory.length,
        });
      } else {
        actionHistory.push(
          `[FAILED] ${vlmResponse.action}: ${actionResult.error}`
        );
      }

      report({
        iteration,
        phase: "verifying",
        vlmResponse,
        actionTaken: JSON.stringify(action),
        error: actionResult.success ? undefined : actionResult.error,
        isComplete: false,
      });

      if (config.screenshotIntervalMs) {
        await new Promise(r => setTimeout(r, config.screenshotIntervalMs));
      } else {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    await updateSession(vasSessionId, {
      status: "failed",
      errorMessage: "Max iterations reached",
    });

    return {
      success: false,
      iterations: maxIterations,
      error: "Max iterations reached without completing goal",
      actionHistory,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await updateSession(vasSessionId, {
      status: "failed",
      errorMessage,
    });
    return {
      success: false,
      iterations: 0,
      error: errorMessage,
      actionHistory,
    };
  }
}

export async function pauseVisionLoop(sessionId: string): Promise<void> {
  await updateSession(sessionId, { status: "paused" });
}

export async function cancelVisionLoop(sessionId: string): Promise<void> {
  await updateSession(sessionId, { status: "cancelled" });
}
