import type {
  JARVISToolMetadata,
  ExecutionContext,
  AgentType,
  ToolDefinition,
  ToolParameter,
} from "./types";
import { JARVISToolRegistry, getGlobalRegistry } from "./toolRegistry";
import { getToolMetadataOrDefault } from "./toolMetadata";
import { getAvailableTools, executeTool as legacyExecuteTool } from "../tools";
import { getGlobalLeaseManager, createNoOpLeaseManager } from "./leaseManager";
import { getGlobalQdrantClient, createNoOpQdrantClient } from "./qdrantClient";

type LegacyToolExecutor = (
  name: string,
  input: Record<string, unknown>
) => Promise<string>;

interface CompatLayerConfig {
  enableLearning: boolean;
  enableLeases: boolean;
  enableEvents: boolean;
  defaultAgent: AgentType;
}

const DEFAULT_CONFIG: CompatLayerConfig = {
  enableLearning: true,
  enableLeases: true,
  enableEvents: true,
  defaultAgent: "executor",
};

export class RasputinCompatLayer {
  private registry: JARVISToolRegistry;
  private config: CompatLayerConfig;
  private legacyExecutor: LegacyToolExecutor | null = null;
  private initialized = false;

  constructor(config: Partial<CompatLayerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registry = getGlobalRegistry();
  }

  async initialize(legacyExecutor?: LegacyToolExecutor): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.legacyExecutor = legacyExecutor || this.createDefaultExecutor();

    const legacyTools = getAvailableTools();

    for (const tool of legacyTools) {
      const metadata = getToolMetadataOrDefault(tool.name, "system");

      const parameters: Record<string, ToolParameter> = {};
      for (const [key, val] of Object.entries(tool.parameters)) {
        parameters[key] = {
          type: val.type,
          description: val.description,
          required: val.required ?? false,
        };
      }

      const definition: ToolDefinition = {
        name: tool.name,
        description: tool.description,
        parameters,
        category: metadata.category,
      };

      const executor = this.createWrappedExecutor(tool.name);

      this.registry.register(definition, executor, metadata);
    }

    this.initialized = true;
  }

  private createDefaultExecutor(): LegacyToolExecutor {
    return async (name: string, input: Record<string, unknown>) => {
      return legacyExecuteTool(name, input);
    };
  }

  private createWrappedExecutor(
    toolName: string
  ): (params: Record<string, unknown>) => Promise<string> {
    return async (params: Record<string, unknown>) => {
      if (!this.legacyExecutor) {
        throw new Error("CompatLayer not initialized");
      }
      return this.legacyExecutor(toolName, params);
    };
  }

  createExecuteToolFn(context: Partial<ExecutionContext>): LegacyToolExecutor {
    const fullContext = this.buildContext(context);

    return async (
      name: string,
      input: Record<string, unknown>
    ): Promise<string> => {
      const result = await this.registry.execute(name, input, fullContext);
      return result.output;
    };
  }

  createExecuteToolFnForAgent(
    agentType: AgentType,
    context: Partial<ExecutionContext>
  ): LegacyToolExecutor {
    const fullContext = this.buildContext(context);
    const allowedTools = new Set(
      this.registry.getToolsForAgent(agentType).map(t => t.definition.name)
    );

    return async (
      name: string,
      input: Record<string, unknown>
    ): Promise<string> => {
      if (!allowedTools.has(name)) {
        return `Error: Agent '${agentType}' is not authorized to use tool '${name}'`;
      }
      const result = await this.registry.execute(name, input, fullContext);
      return result.output;
    };
  }

  private buildContext(partial: Partial<ExecutionContext>): ExecutionContext {
    const userId = partial.userId || 0;
    return {
      sessionId: partial.sessionId || `compat-${Date.now()}`,
      userId,
      taskId: partial.taskId || 0,
      params: partial.params || {},
      startTime: partial.startTime || Date.now(),
      leaseManager: partial.leaseManager || this.createLeaseManager(),
      qdrant: partial.qdrant || this.createQdrantClient(userId),
      redis: partial.redis || this.createNoOpRedis(),
      enrichment: partial.enrichment,
    };
  }

  private createLeaseManager(): ExecutionContext["leaseManager"] {
    if (!this.config.enableLeases) {
      return createNoOpLeaseManager();
    }
    return getGlobalLeaseManager();
  }

  private createQdrantClient(userId: number): ExecutionContext["qdrant"] {
    if (!this.config.enableLearning || userId === 0) {
      return createNoOpQdrantClient();
    }
    return getGlobalQdrantClient(userId);
  }

  private createNoOpRedis(): ExecutionContext["redis"] {
    return {
      xadd: async () => "0-0",
      xread: async () => [],
      get: async () => null,
      set: async () => {},
      publish: async () => 0,
    };
  }

  getAvailableToolsForLegacy(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return this.registry.getToolDefinitions().map(def => ({
      name: def.name,
      description: def.description,
      parameters: def.parameters,
    }));
  }

  getAvailableToolsForAgent(agentType: AgentType): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return this.registry.getToolDefinitionsForAgent(agentType).map(def => ({
      name: def.name,
      description: def.description,
      parameters: def.parameters,
    }));
  }

  getToolMetadata(toolName: string): JARVISToolMetadata | undefined {
    return this.registry.get(toolName)?.wrapper.getMetadata();
  }

  isToolHighRisk(toolName: string): boolean {
    const metadata = this.getToolMetadata(toolName);
    return metadata?.riskLevel === "high" || metadata?.riskLevel === "critical";
  }

  isToolRequiresApproval(toolName: string): boolean {
    return this.getToolMetadata(toolName)?.requiresApproval || false;
  }

  getRegistry(): JARVISToolRegistry {
    return this.registry;
  }

  getStats(): ReturnType<JARVISToolRegistry["getStats"]> {
    return this.registry.getStats();
  }
}

let globalCompatLayer: RasputinCompatLayer | null = null;

export async function getCompatLayer(): Promise<RasputinCompatLayer> {
  if (!globalCompatLayer) {
    globalCompatLayer = new RasputinCompatLayer();
    await globalCompatLayer.initialize();
  }
  return globalCompatLayer;
}

export function resetCompatLayer(): void {
  globalCompatLayer = null;
}

export async function createOrchestratorExecutor(
  context: Partial<ExecutionContext> = {}
): Promise<LegacyToolExecutor> {
  const compat = await getCompatLayer();
  return compat.createExecuteToolFn(context);
}

export async function createAgentExecutor(
  agentType: AgentType,
  context: Partial<ExecutionContext> = {}
): Promise<LegacyToolExecutor> {
  const compat = await getCompatLayer();
  return compat.createExecuteToolFnForAgent(agentType, context);
}
