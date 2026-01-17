import type {
  JARVISToolMetadata,
  ToolResult,
  ExecutionContext,
  AgentType,
  ToolExecutionEvent,
  ToolDefinition,
} from "./types";
import {
  JARVISToolWrapper,
  wrapTool,
  type ToolExecutionHooks,
  type OriginalToolExecutor,
} from "./toolWrapper";

interface RegisteredTool {
  wrapper: JARVISToolWrapper;
  definition: ToolDefinition;
}

interface LeaseRecord {
  resource: string;
  sessionId: string;
  expiresAt: number;
}

interface RegistryStats {
  totalTools: number;
  toolsByCategory: Record<string, number>;
  toolsByRiskLevel: Record<string, number>;
  toolsByAgent: Record<AgentType, number>;
  activeLeases: number;
}

export class JARVISToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private leases: Map<string, LeaseRecord> = new Map();
  private globalHooks: ToolExecutionHooks = {};
  private eventListeners: Set<(event: ToolExecutionEvent) => void> = new Set();

  register(
    definition: ToolDefinition,
    executor: OriginalToolExecutor,
    metadata: Partial<JARVISToolMetadata>
  ): void {
    const fullMetadata: JARVISToolMetadata = {
      agentAffinity: metadata.agentAffinity || ["executor"],
      requiresLease: metadata.requiresLease || [],
      riskLevel: metadata.riskLevel || "low",
      estimatedDurationMs: metadata.estimatedDurationMs || 5000,
      canParallelize: metadata.canParallelize ?? true,
      qdrantCollections: metadata.qdrantCollections || [],
      category: metadata.category || definition.category || "system",
      requiresApproval: metadata.requiresApproval || false,
      maxRetries: metadata.maxRetries || 2,
      timeoutMs: metadata.timeoutMs || 60000,
      fallbackTools: metadata.fallbackTools,
    };

    const wrapper = wrapTool(definition.name, executor, fullMetadata);

    wrapper.setHooks(this.globalHooks);
    wrapper.setEventEmitter(this.emitEvent.bind(this));

    this.tools.set(definition.name, { wrapper, definition });
  }

  registerBatch(
    tools: Array<{
      definition: ToolDefinition;
      executor: OriginalToolExecutor;
      metadata: Partial<JARVISToolMetadata>;
    }>
  ): void {
    for (const tool of tools) {
      this.register(tool.definition, tool.executor, tool.metadata);
    }
  }

  get(toolName: string): RegisteredTool | undefined {
    return this.tools.get(toolName);
  }

  has(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  getToolsForAgent(agentType: AgentType): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(tool =>
      tool.wrapper.isAuthorizedFor(agentType)
    );
  }

  getToolsByCategory(
    category: JARVISToolMetadata["category"]
  ): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(
      tool => tool.wrapper.getMetadata().category === category
    );
  }

  getToolsByRiskLevel(
    riskLevel: JARVISToolMetadata["riskLevel"]
  ): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(
      tool => tool.wrapper.getRiskLevel() === riskLevel
    );
  }

  getToolsRequiringApproval(): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(tool =>
      tool.wrapper.requiresApproval()
    );
  }

  async execute(
    toolName: string,
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        output: `Error: Tool '${toolName}' not found in registry`,
        error: `Tool '${toolName}' not found`,
      };
    }

    const contextWithLeaseManager: ExecutionContext = {
      ...context,
      leaseManager: this.createLeaseManager(),
    };

    return tool.wrapper.execute(params, contextWithLeaseManager);
  }

  async executeWithRetry(
    toolName: string,
    params: Record<string, unknown>,
    context: ExecutionContext,
    maxRetries?: number
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        output: `Error: Tool '${toolName}' not found in registry`,
        error: `Tool '${toolName}' not found`,
      };
    }

    const retries = maxRetries ?? tool.wrapper.getMetadata().maxRetries;
    let lastResult: ToolResult | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const result = await this.execute(toolName, params, context);
      lastResult = result;

      if (result.success) {
        return result;
      }

      if (attempt < retries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await this.sleep(backoffMs);
      }
    }

    return lastResult!;
  }

  async executeWithFallback(
    toolName: string,
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult & { fallbackUsed?: string }> {
    const result = await this.execute(toolName, params, context);

    if (result.success) {
      return result;
    }

    const tool = this.tools.get(toolName);
    const fallbacks = tool?.wrapper.getMetadata().fallbackTools || [];

    for (const fallbackName of fallbacks) {
      if (!this.has(fallbackName)) {
        continue;
      }

      const fallbackResult = await this.execute(fallbackName, params, context);
      if (fallbackResult.success) {
        return { ...fallbackResult, fallbackUsed: fallbackName };
      }
    }

    return result;
  }

  setGlobalHooks(hooks: ToolExecutionHooks): void {
    this.globalHooks = hooks;
    Array.from(this.tools.values()).forEach(tool => {
      tool.wrapper.setHooks(hooks);
    });
  }

  addEventListener(listener: (event: ToolExecutionEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emitEvent(event: ToolExecutionEvent): void {
    Array.from(this.eventListeners).forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error("Event listener error:", error);
      }
    });
  }

  private createLeaseManager(): ExecutionContext["leaseManager"] {
    return {
      acquire: async (
        resource: string,
        sessionId: string,
        ttlMs = 60000
      ): Promise<boolean> => {
        const existing = this.leases.get(resource);

        if (existing && existing.expiresAt > Date.now()) {
          if (existing.sessionId === sessionId) {
            existing.expiresAt = Date.now() + ttlMs;
            return true;
          }
          return false;
        }

        this.leases.set(resource, {
          resource,
          sessionId,
          expiresAt: Date.now() + ttlMs,
        });
        return true;
      },

      release: async (resource: string, sessionId: string): Promise<void> => {
        const existing = this.leases.get(resource);
        if (existing && existing.sessionId === sessionId) {
          this.leases.delete(resource);
        }
      },

      isHeld: async (resource: string): Promise<boolean> => {
        const existing = this.leases.get(resource);
        return existing !== undefined && existing.expiresAt > Date.now();
      },

      extend: async (
        resource: string,
        sessionId: string,
        ttlMs: number
      ): Promise<boolean> => {
        const existing = this.leases.get(resource);
        if (existing && existing.sessionId === sessionId) {
          existing.expiresAt = Date.now() + ttlMs;
          return true;
        }
        return false;
      },
    };
  }

  getStats(): RegistryStats {
    const toolsByCategory: Record<string, number> = {};
    const toolsByRiskLevel: Record<string, number> = {};
    const toolsByAgent: Record<AgentType, number> = {
      planner: 0,
      coder: 0,
      executor: 0,
      verifier: 0,
      researcher: 0,
      learner: 0,
      safety: 0,
    };

    Array.from(this.tools.values()).forEach(tool => {
      const metadata = tool.wrapper.getMetadata();

      toolsByCategory[metadata.category] =
        (toolsByCategory[metadata.category] || 0) + 1;

      toolsByRiskLevel[metadata.riskLevel] =
        (toolsByRiskLevel[metadata.riskLevel] || 0) + 1;

      metadata.agentAffinity.forEach(agent => {
        toolsByAgent[agent]++;
      });
    });

    const now = Date.now();
    const activeLeases = Array.from(this.leases.values()).filter(
      lease => lease.expiresAt > now
    ).length;

    return {
      totalTools: this.tools.size,
      toolsByCategory,
      toolsByRiskLevel,
      toolsByAgent,
      activeLeases,
    };
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  getToolDefinitionsForAgent(agentType: AgentType): ToolDefinition[] {
    return this.getToolsForAgent(agentType).map(t => t.definition);
  }

  cleanupExpiredLeases(): number {
    const now = Date.now();
    const expiredResources = Array.from(this.leases.entries())
      .filter(([_, lease]) => lease.expiresAt <= now)
      .map(([resource]) => resource);

    expiredResources.forEach(resource => this.leases.delete(resource));
    return expiredResources.length;
  }

  clear(): void {
    this.tools.clear();
    this.leases.clear();
    this.eventListeners.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

let globalRegistry: JARVISToolRegistry | null = null;

export function getGlobalRegistry(): JARVISToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new JARVISToolRegistry();
  }
  return globalRegistry;
}

export function resetGlobalRegistry(): void {
  if (globalRegistry) {
    globalRegistry.clear();
  }
  globalRegistry = null;
}
