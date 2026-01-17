import type { ExecutionContext, ToolExecutionEvent, AgentType } from "./types";
import { getGlobalRegistry, JARVISToolRegistry } from "./toolRegistry";
import { getToolMetadataOrDefault } from "./toolMetadata";
import { executeTool as legacyExecuteTool, getAvailableTools } from "../tools";

interface V3ExecutionOptions {
  userId: number;
  taskId: number;
  sessionId: string;
  agentType?: AgentType;
  onEvent?: (event: ToolExecutionEvent) => void;
  enableLearning?: boolean;
}

interface V3ExecutionResult {
  output: string;
  durationMs: number;
  metadata?: {
    riskLevel: string;
    category: string;
    learnedPatterns?: string[];
  };
}

let registryInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function ensureRegistryInitialized(): Promise<JARVISToolRegistry> {
  if (registryInitialized) {
    return getGlobalRegistry();
  }

  if (initializationPromise) {
    await initializationPromise;
    return getGlobalRegistry();
  }

  initializationPromise = initializeRegistry();
  await initializationPromise;
  return getGlobalRegistry();
}

async function initializeRegistry(): Promise<void> {
  const registry = getGlobalRegistry();
  const legacyTools = getAvailableTools();

  for (const tool of legacyTools) {
    if (registry.has(tool.name)) {
      continue;
    }

    const metadata = getToolMetadataOrDefault(tool.name, "system");

    const parameters: Record<
      string,
      { type: string; description: string; required: boolean }
    > = {};
    for (const [key, val] of Object.entries(tool.parameters)) {
      parameters[key] = {
        type: val.type,
        description: val.description,
        required: val.required ?? false,
      };
    }

    const executor = async (params: Record<string, unknown>) => {
      return legacyExecuteTool(tool.name, params);
    };

    registry.register(
      {
        name: tool.name,
        description: tool.description,
        parameters,
        category: metadata.category,
      },
      executor,
      metadata
    );
  }

  registryInitialized = true;
}

export async function executeToolV3(
  toolName: string,
  input: Record<string, unknown>,
  options: V3ExecutionOptions
): Promise<V3ExecutionResult> {
  const registry = await ensureRegistryInitialized();
  const startTime = Date.now();

  const tool = registry.get(toolName);
  if (!tool) {
    return {
      output: `Error: Tool '${toolName}' not found`,
      durationMs: Date.now() - startTime,
    };
  }

  const metadata = tool.wrapper.getMetadata();

  if (options.agentType && !tool.wrapper.isAuthorizedFor(options.agentType)) {
    return {
      output: `Error: Agent '${options.agentType}' is not authorized to use tool '${toolName}'`,
      durationMs: Date.now() - startTime,
      metadata: {
        riskLevel: metadata.riskLevel,
        category: metadata.category,
      },
    };
  }

  if (options.onEvent) {
    options.onEvent({
      eventType: "start",
      toolName,
      sessionId: options.sessionId,
      taskId: options.taskId,
      timestamp: startTime,
      data: { input, riskLevel: metadata.riskLevel },
    });
  }

  try {
    const output = await legacyExecuteTool(toolName, {
      ...input,
      userId: options.userId,
    });

    const durationMs = Date.now() - startTime;

    if (options.onEvent) {
      options.onEvent({
        eventType: "complete",
        toolName,
        sessionId: options.sessionId,
        taskId: options.taskId,
        timestamp: Date.now(),
        data: {
          success: !output.startsWith("Error:"),
          durationMs,
          category: metadata.category,
        },
      });
    }

    return {
      output,
      durationMs,
      metadata: {
        riskLevel: metadata.riskLevel,
        category: metadata.category,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (options.onEvent) {
      options.onEvent({
        eventType: "error",
        toolName,
        sessionId: options.sessionId,
        taskId: options.taskId,
        timestamp: Date.now(),
        data: { error: errorMessage, durationMs },
      });
    }

    return {
      output: `Error: ${errorMessage}`,
      durationMs,
      metadata: {
        riskLevel: metadata.riskLevel,
        category: metadata.category,
      },
    };
  }
}

export function createV3Executor(options: V3ExecutionOptions) {
  return async (
    toolName: string,
    input: Record<string, unknown>
  ): Promise<string> => {
    const result = await executeToolV3(toolName, input, options);
    return result.output;
  };
}

export async function getToolsForAgentV3(agentType: AgentType): Promise<
  Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    riskLevel: string;
    category: string;
  }>
> {
  const registry = await ensureRegistryInitialized();
  return registry.getToolsForAgent(agentType).map(t => ({
    name: t.definition.name,
    description: t.definition.description,
    parameters: t.definition.parameters,
    riskLevel: t.wrapper.getMetadata().riskLevel,
    category: t.wrapper.getMetadata().category,
  }));
}

export async function getRegistryStats(): Promise<{
  totalTools: number;
  toolsByCategory: Record<string, number>;
  toolsByRiskLevel: Record<string, number>;
  toolsByAgent: Record<AgentType, number>;
}> {
  const registry = await ensureRegistryInitialized();
  return registry.getStats();
}

export async function isToolHighRisk(toolName: string): Promise<boolean> {
  const registry = await ensureRegistryInitialized();
  const tool = registry.get(toolName);
  if (!tool) return false;
  const riskLevel = tool.wrapper.getMetadata().riskLevel;
  return riskLevel === "high" || riskLevel === "critical";
}

export async function getToolCategory(
  toolName: string
): Promise<string | undefined> {
  const registry = await ensureRegistryInitialized();
  const tool = registry.get(toolName);
  return tool?.wrapper.getMetadata().category;
}
