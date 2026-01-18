export type {
  AgentType,
  RiskLevel,
  ToolCategory,
  ToolParameter,
  ToolDefinition,
  JARVISToolMetadata,
  ToolResult,
  ExecutionContext,
  LeaseManager,
  QdrantClient,
  QdrantSearchResult,
  RedisClient,
  StreamMessage,
  LearningPayload,
  ToolExecutionEvent,
  SwarmTask,
  AgentCapabilities,
  AgentState,
  AgentMetrics,
  ConsensusRequest,
  ConsensusVote,
  ConsensusResult,
} from "./types";

export {
  DEFAULT_TOOL_METADATA,
  HIGH_RISK_TOOLS,
  CRITICAL_TOOLS,
} from "./types";

export {
  JARVISToolWrapper,
  wrapTool,
  createTestContext,
  type ToolExecutionHooks,
  type WrappedTool,
  type OriginalToolExecutor,
} from "./toolWrapper";

export {
  JARVISToolRegistry,
  getGlobalRegistry,
  resetGlobalRegistry,
} from "./toolRegistry";

export {
  RedisLeaseManager,
  getGlobalLeaseManager,
  resetGlobalLeaseManager,
  createNoOpLeaseManager,
} from "./leaseManager";

export {
  V3QdrantClient,
  getGlobalQdrantClient,
  resetGlobalQdrantClients,
  createNoOpQdrantClient,
} from "./qdrantClient";

export {
  TOOL_METADATA,
  TOOL_COUNT,
  getToolMetadata,
  getToolMetadataOrDefault,
  getToolsForCategory,
  getToolsForAgent,
  getHighRiskTools,
  getToolsRequiringApproval,
  getToolsWithLearning,
} from "./toolMetadata";

export {
  RasputinCompatLayer,
  getCompatLayer,
  resetCompatLayer,
  createOrchestratorExecutor,
  createAgentExecutor,
} from "./compatLayer";

export {
  executeToolV3,
  createV3Executor,
  getToolsForAgentV3,
  getRegistryStats,
  isToolHighRisk,
  getToolCategory,
} from "./integration";

export {
  analyzeTask,
  getToolsForAgentType,
  filterToolsForAgent,
  createAgentTask,
  AgentCoordinator,
  getGlobalCoordinator,
  resetGlobalCoordinator,
  AGENT_DESCRIPTIONS,
} from "./agentCoordinator";

export type {
  TaskAnalysis,
  AgentTask,
  CoordinatorState,
} from "./agentCoordinator";

export {
  extractLearningFromExecution,
  extractBatchLearning,
} from "./learningExtractor";

export type {
  ExtractedLearning,
  ToolExecutionRecord,
} from "./learningExtractor";

export {
  V3MemoryIntegration,
  createV3MemoryClient,
  getGlobalMemoryClient,
  resetGlobalMemoryClient,
  enrichContextWithMemory,
} from "./memoryIntegration";

export type {
  V3MemoryClient,
  RelevantLearning,
  ToolLearningStats,
  ProceduralSequence,
} from "./memoryIntegration";

export {
  SwarmOrchestrator,
  getGlobalSwarmOrchestrator,
  resetGlobalSwarmOrchestrator,
  createSwarmExecutor,
  createFrontierExecutor,
} from "./swarmOrchestrator";

export type {
  SwarmConfig,
  SwarmExecutionResult,
  AgentExecutor,
  FrontierExecutorOptions,
} from "./swarmOrchestrator";

export {
  PerceptionAdapter,
  getGlobalPerceptionAdapter,
  resetGlobalPerceptionAdapter,
} from "./perceptionAdapter";

export type {
  EmbeddingResult,
  VisionAnalysisResult,
  VisionElement,
  STTResult,
  TTSResult,
  ImageGenResult,
  PerceptionStatus,
} from "./perceptionAdapter";

export {
  FrontierAdapter,
  getGlobalFrontierAdapter,
  resetGlobalFrontierAdapter,
  getAgentReasoningConfig,
  getAllAgentReasoningConfigs,
} from "./frontierAdapter";

export type {
  AgentReasoningConfig,
  ChatMessage,
  ToolCall,
  ToolDefinition as FrontierToolDefinition,
  ReasoningResult,
} from "./frontierAdapter";

export {
  getAgentBehavior,
  getAgentSystemPrompt,
  applyAgentPreProcess,
  applyAgentPostProcess,
  selectToolsForAgent,
  canAgentDelegate,
  getAgentDelegationTargets,
  requiresApproval,
  getAgentMaxIterations,
  getAgentTemperature,
  getAgentThinkingStyle,
  AGENT_BEHAVIORS,
} from "./agentBehaviors";

export type { AgentBehavior } from "./agentBehaviors";

import { getGlobalRegistry } from "./toolRegistry";
import { getGlobalCoordinator } from "./agentCoordinator";
import { TOOL_COUNT } from "./toolMetadata";
import type { PerceptionStatus } from "./perceptionAdapter";

export interface V3SubsystemStatus {
  name: string;
  status: "healthy" | "degraded" | "unavailable";
  details: Record<string, unknown>;
}

export interface V3Status {
  overall: "healthy" | "degraded" | "unavailable";
  timestamp: number;
  subsystems: V3SubsystemStatus[];
  metrics: {
    registeredTools: number;
    totalToolMetadata: number;
    activeAgents: number;
    pendingTasks: number;
  };
}

export async function getV3Status(): Promise<V3Status> {
  const subsystems: V3SubsystemStatus[] = [];
  let overallHealthy = true;
  let anyDegraded = false;

  let registeredToolCount = 0;
  let activeAgentCount = 0;
  let pendingTaskCount = 0;

  try {
    const registry = getGlobalRegistry();
    const stats = registry.getStats();
    registeredToolCount = stats.totalTools;
    subsystems.push({
      name: "toolRegistry",
      status: "healthy",
      details: {
        totalTools: stats.totalTools,
        toolsByCategory: stats.toolsByCategory,
        activeLeases: stats.activeLeases,
      },
    });
  } catch {
    subsystems.push({
      name: "toolRegistry",
      status: "unavailable",
      details: { error: "Failed to get registry stats" },
    });
    anyDegraded = true;
  }

  try {
    const coordinator = getGlobalCoordinator();
    const state = coordinator.getState();
    if (state) {
      const runningTasks = state.agentTasks.filter(t => t.status === "running");
      const pendingTasks = state.agentTasks.filter(t => t.status === "pending");
      activeAgentCount = runningTasks.length;
      pendingTaskCount = pendingTasks.length;
      subsystems.push({
        name: "agentCoordinator",
        status: "healthy",
        details: {
          currentTask: state.currentTask,
          iteration: state.iteration,
          totalAgentTasks: state.agentTasks.length,
          runningTasks: runningTasks.length,
          pendingTasks: pendingTasks.length,
        },
      });
    } else {
      subsystems.push({
        name: "agentCoordinator",
        status: "healthy",
        details: { idle: true },
      });
    }
  } catch {
    subsystems.push({
      name: "agentCoordinator",
      status: "unavailable",
      details: { error: "Failed to get coordinator state" },
    });
    anyDegraded = true;
  }

  try {
    const { getGlobalSwarmOrchestrator } = await import("./swarmOrchestrator");
    const swarm = getGlobalSwarmOrchestrator();
    const activeAgents = swarm.getActiveAgents();
    const config = swarm.getConfig();
    subsystems.push({
      name: "swarmOrchestrator",
      status: "healthy",
      details: {
        activeAgents: activeAgents.length,
        maxConcurrent: config.maxConcurrentAgents,
        consensusThreshold: config.consensusThreshold,
      },
    });
  } catch {
    subsystems.push({
      name: "swarmOrchestrator",
      status: "unavailable",
      details: { error: "Failed to get swarm status" },
    });
    anyDegraded = true;
  }

  try {
    const { getGlobalPerceptionAdapter } = await import("./perceptionAdapter");
    const perception = await getGlobalPerceptionAdapter();
    const perceptionStatus = await perception.getStatus();
    const cacheStats = perception.getCacheStats();
    subsystems.push({
      name: "perception",
      status: perceptionStatus.available ? "healthy" : "degraded",
      details: {
        available: perceptionStatus.available,
        services: perceptionStatus.services,
        cacheSize: cacheStats.size,
        gpuMemoryUsedMB: perceptionStatus.gpuMemoryUsedMB,
      },
    });
    if (!perceptionStatus.available) anyDegraded = true;
  } catch {
    subsystems.push({
      name: "perception",
      status: "unavailable",
      details: { error: "Perception adapter not available" },
    });
    anyDegraded = true;
  }

  try {
    const frontierModule = await import("./frontierAdapter");
    const configs = frontierModule.getAllAgentReasoningConfigs();
    subsystems.push({
      name: "frontier",
      status: "healthy",
      details: {
        agentConfigs: Object.keys(configs).length,
        defaultModel: configs.planner?.primaryModel || "unknown",
      },
    });
  } catch {
    subsystems.push({
      name: "frontier",
      status: "unavailable",
      details: { error: "Frontier adapter not available" },
    });
    anyDegraded = true;
  }

  if (subsystems.some(s => s.status === "unavailable")) {
    overallHealthy = false;
  }

  return {
    overall: !overallHealthy
      ? "unavailable"
      : anyDegraded
        ? "degraded"
        : "healthy",
    timestamp: Date.now(),
    subsystems,
    metrics: {
      registeredTools: registeredToolCount,
      totalToolMetadata: TOOL_COUNT,
      activeAgents: activeAgentCount,
      pendingTasks: pendingTaskCount,
    },
  };
}
