/**
 * JARVIS v3 Tool Wrapper
 * Wraps existing tools with lifecycle hooks for the enhanced agent swarm system
 */

import type {
  JARVISToolMetadata,
  ToolResult,
  ExecutionContext,
  ToolExecutionEvent,
  AgentType,
} from "./types";
import {
  extractLearningFromExecution,
  type ToolExecutionRecord,
} from "./learningExtractor";
import { getGlobalMemoryClient } from "./memoryIntegration";

export interface ToolExecutionHooks {
  beforeExecute?: (
    toolName: string,
    params: Record<string, unknown>,
    context: ExecutionContext
  ) => Promise<void>;
  afterExecute?: (
    toolName: string,
    result: ToolResult,
    context: ExecutionContext
  ) => Promise<void>;
  onError?: (
    toolName: string,
    error: Error,
    context: ExecutionContext
  ) => Promise<void>;
}

export interface WrappedTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  metadata: JARVISToolMetadata;
  execute: (
    params: Record<string, unknown>,
    context: ExecutionContext
  ) => Promise<ToolResult>;
}

export type OriginalToolExecutor = (
  params: Record<string, unknown>
) => Promise<string>;

/**
 * Wraps an existing RASPUTIN tool with JARVIS v3 lifecycle hooks
 */
export class JARVISToolWrapper {
  private hooks: ToolExecutionHooks = {};
  private eventEmitter?: (event: ToolExecutionEvent) => void;

  constructor(
    private toolName: string,
    private originalExecutor: OriginalToolExecutor,
    private metadata: JARVISToolMetadata
  ) {}

  /**
   * Set lifecycle hooks for this tool
   */
  setHooks(hooks: ToolExecutionHooks): void {
    this.hooks = hooks;
  }

  /**
   * Set event emitter for streaming tool execution events
   */
  setEventEmitter(emitter: (event: ToolExecutionEvent) => void): void {
    this.eventEmitter = emitter;
  }

  /**
   * Check if an agent is authorized to use this tool
   */
  isAuthorizedFor(agentType: AgentType): boolean {
    return this.metadata.agentAffinity.includes(agentType);
  }

  /**
   * Get the risk level of this tool
   */
  getRiskLevel(): JARVISToolMetadata["riskLevel"] {
    return this.metadata.riskLevel;
  }

  /**
   * Check if this tool requires human approval
   */
  requiresApproval(): boolean {
    return this.metadata.requiresApproval;
  }

  /**
   * Get resources that need to be leased before execution
   */
  getRequiredLeases(): string[] {
    return this.metadata.requiresLease;
  }

  /**
   * Get Qdrant collections this tool may interact with
   */
  getQdrantCollections(): string[] {
    return this.metadata.qdrantCollections;
  }

  /**
   * Execute the tool with full lifecycle hooks
   */
  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    // Emit start event
    this.emitEvent({
      eventType: "start",
      toolName: this.toolName,
      sessionId: context.sessionId,
      taskId: context.taskId,
      timestamp: startTime,
      data: { params },
    });

    try {
      // Acquire leases if required
      await this.acquireLeases(context);

      // Run beforeExecute hook
      if (this.hooks.beforeExecute) {
        await this.hooks.beforeExecute(this.toolName, params, context);
      }

      // Execute the original tool
      const output = await this.executeWithTimeout(params, context);
      const durationMs = Date.now() - startTime;

      const result: ToolResult = {
        success: !output.startsWith("Error:"),
        output,
        durationMs,
      };

      // Run afterExecute hook
      if (this.hooks.afterExecute) {
        await this.hooks.afterExecute(this.toolName, result, context);
      }

      // Emit complete event
      this.emitEvent({
        eventType: "complete",
        toolName: this.toolName,
        sessionId: context.sessionId,
        taskId: context.taskId,
        timestamp: Date.now(),
        data: { success: result.success, durationMs },
      });

      // Extract learning if successful
      if (result.success) {
        await this.extractAndStoreLearning(params, result, context);
      }

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Run onError hook
      if (this.hooks.onError) {
        await this.hooks.onError(
          this.toolName,
          error instanceof Error ? error : new Error(errorMessage),
          context
        );
      }

      // Emit error event
      this.emitEvent({
        eventType: "error",
        toolName: this.toolName,
        sessionId: context.sessionId,
        taskId: context.taskId,
        timestamp: Date.now(),
        data: { error: errorMessage, durationMs },
      });

      return {
        success: false,
        output: `Error: ${errorMessage}`,
        error: errorMessage,
        durationMs,
      };
    } finally {
      // Always release leases
      await this.releaseLeases(context);
    }
  }

  /**
   * Execute with timeout handling
   */
  private async executeWithTimeout(
    params: Record<string, unknown>,
    _context: ExecutionContext
  ): Promise<string> {
    const timeoutMs = this.metadata.timeoutMs;

    return Promise.race([
      this.originalExecutor(params),
      new Promise<string>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Acquire all required leases before execution
   */
  private async acquireLeases(context: ExecutionContext): Promise<void> {
    for (const resource of this.metadata.requiresLease) {
      const acquired = await context.leaseManager.acquire(
        resource,
        context.sessionId,
        this.metadata.timeoutMs + 5000 // Add buffer for lease TTL
      );
      if (!acquired) {
        throw new Error(`Failed to acquire lease for resource: ${resource}`);
      }
    }
  }

  /**
   * Release all leases after execution
   */
  private async releaseLeases(context: ExecutionContext): Promise<void> {
    for (const resource of this.metadata.requiresLease) {
      try {
        await context.leaseManager.release(resource, context.sessionId);
      } catch (error) {
        // Log but don't throw - cleanup should be best-effort
        console.error(
          `Failed to release lease for ${resource}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  private async extractAndStoreLearning(
    params: Record<string, unknown>,
    result: ToolResult,
    context: ExecutionContext
  ): Promise<void> {
    if (this.metadata.qdrantCollections.length === 0) {
      return;
    }

    try {
      const record: ToolExecutionRecord = {
        toolName: this.toolName,
        category: this.metadata.category,
        params,
        result,
        context,
      };

      const learning = extractLearningFromExecution(record);
      const memoryClient = await getGlobalMemoryClient(context.userId);
      await memoryClient.storeLearning(learning);
    } catch (error) {
      console.error(
        `[V3] Failed to extract/store learning for ${this.toolName}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  private emitEvent(event: ToolExecutionEvent): void {
    if (this.eventEmitter) {
      this.eventEmitter(event);
    }
  }

  /**
   * Get tool metadata
   */
  getMetadata(): JARVISToolMetadata {
    return this.metadata;
  }

  /**
   * Get tool name
   */
  getName(): string {
    return this.toolName;
  }
}

/**
 * Factory function to wrap an existing tool
 */
export function wrapTool(
  toolName: string,
  executor: OriginalToolExecutor,
  metadata: JARVISToolMetadata
): JARVISToolWrapper {
  return new JARVISToolWrapper(toolName, executor, metadata);
}

/**
 * Create a no-op execution context for testing
 */
export function createTestContext(
  overrides: Partial<ExecutionContext> = {}
): ExecutionContext {
  return {
    sessionId: "test-session",
    userId: 1,
    taskId: 1,
    params: {},
    startTime: Date.now(),
    leaseManager: {
      acquire: async () => true,
      release: async () => {},
      isHeld: async () => false,
      extend: async () => true,
    },
    qdrant: {
      search: async () => [],
      upsert: async () => {},
      delete: async () => {},
    },
    redis: {
      xadd: async () => "0-0",
      xread: async () => [],
      get: async () => null,
      set: async () => {},
      publish: async () => 0,
    },
    ...overrides,
  };
}
