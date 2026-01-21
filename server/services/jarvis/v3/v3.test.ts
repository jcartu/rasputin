import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  analyzeTask,
  AgentCoordinator as _AgentCoordinator,
  getGlobalCoordinator,
  resetGlobalCoordinator,
  AGENT_DESCRIPTIONS,
} from "./agentCoordinator";
import {
  extractLearningFromExecution,
  extractBatchLearning,
  type ToolExecutionRecord,
} from "./learningExtractor";
import type { ExecutionContext, AgentType } from "./types";
import {
  getAgentReasoningConfig,
  getAllAgentReasoningConfigs,
  FrontierAdapter,
} from "./frontierAdapter";
import { getToolsForAgent, getHighRiskTools } from "./toolMetadata";
import {
  applyAgentPreProcess,
  applyAgentPostProcess,
  selectToolsForAgent,
} from "./agentBehaviors";
import {
  SwarmOrchestrator as _SwarmOrchestrator,
  getGlobalSwarmOrchestrator,
  resetGlobalSwarmOrchestrator,
  createFrontierExecutor,
  createSwarmExecutor,
  type AgentExecutor,
} from "./swarmOrchestrator";
import {
  PerceptionAdapter,
  getGlobalPerceptionAdapter,
  resetGlobalPerceptionAdapter,
} from "./perceptionAdapter";
import {
  V3MemoryIntegration,
  getGlobalMemoryClient as _getGlobalMemoryClient,
  resetGlobalMemoryClient,
  enrichContextWithMemory,
} from "./memoryIntegration";

describe("AgentCoordinator", () => {
  beforeEach(() => {
    resetGlobalCoordinator();
  });

  describe("analyzeTask", () => {
    it("should route coding tasks to coder agent", () => {
      const analysis = analyzeTask("Write a Python function to sort an array");

      expect(analysis.primaryAgent).toBe("coder");
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.suggestedTools.length).toBeGreaterThan(0);
    });

    it("should route research tasks to researcher agent", () => {
      const analysis = analyzeTask("Search for best practices in React");

      expect(analysis.primaryAgent).toBe("researcher");
    });

    it("should route deployment tasks to executor agent", () => {
      const analysis = analyzeTask("Deploy the application to production");

      expect(analysis.primaryAgent).toBe("executor");
    });

    it("should route testing tasks to verifier agent", () => {
      const analysis = analyzeTask("Test the login functionality");

      expect(analysis.primaryAgent).toBe("verifier");
    });

    it("should route planning tasks to planner agent", () => {
      const analysis = analyzeTask("Plan the architecture for the new feature");

      expect(analysis.primaryAgent).toBe("planner");
    });

    it("should identify complex tasks requiring multi-agent coordination", () => {
      const analysis = analyzeTask(
        "Build a complete user authentication system with tests and deploy it to staging"
      );

      expect(analysis.estimatedComplexity).toBe("complex");
      expect(analysis.requiresMultiAgent).toBe(true);
    });

    it("should identify simple tasks", () => {
      const analysis = analyzeTask("Fix typo");

      expect(analysis.estimatedComplexity).toBe("simple");
    });
  });

  describe("AgentCoordinator class", () => {
    it("should create and manage subtasks", () => {
      const coordinator = getGlobalCoordinator();
      coordinator.analyzeAndPlan("Build a REST API");

      const subtask = coordinator.createSubtask("coder", "Write endpoints");

      expect(subtask.id).toBeDefined();
      expect(subtask.type).toBe("coder");
      expect(subtask.status).toBe("pending");
    });

    it("should track task status transitions", () => {
      const coordinator = getGlobalCoordinator();
      coordinator.analyzeAndPlan("Build a REST API");

      const subtask = coordinator.createSubtask("coder", "Write endpoints");

      coordinator.startTask(subtask.id);
      const state1 = coordinator.getState();
      expect(state1?.agentTasks[0].status).toBe("running");

      coordinator.completeTask(subtask.id, "Endpoints created");
      const state2 = coordinator.getState();
      expect(state2?.agentTasks[0].status).toBe("completed");
    });

    it("should track agent stats", () => {
      const coordinator = getGlobalCoordinator();
      coordinator.analyzeAndPlan("Build a REST API");

      coordinator.createSubtask("coder", "Task 1");
      coordinator.createSubtask("coder", "Task 2");
      coordinator.createSubtask("verifier", "Task 3");

      const stats = coordinator.getAgentStats();

      expect(stats.coder.total).toBe(2);
      expect(stats.verifier.total).toBe(1);
    });
  });

  describe("AGENT_DESCRIPTIONS", () => {
    it("should have descriptions for all agent types", () => {
      const agentTypes = [
        "planner",
        "coder",
        "executor",
        "verifier",
        "researcher",
        "learner",
        "safety",
      ];

      for (const type of agentTypes) {
        expect(
          AGENT_DESCRIPTIONS[type as keyof typeof AGENT_DESCRIPTIONS]
        ).toBeDefined();
        expect(
          AGENT_DESCRIPTIONS[type as keyof typeof AGENT_DESCRIPTIONS].length
        ).toBeGreaterThan(0);
      }
    });
  });
});

describe("LearningExtractor", () => {
  const createMockContext = (): ExecutionContext => ({
    sessionId: "test-session",
    userId: 1,
    taskId: 123,
    params: {},
    startTime: Date.now(),
    leaseManager: {
      acquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(undefined),
      isHeld: vi.fn().mockResolvedValue(false),
      extend: vi.fn().mockResolvedValue(true),
    },
    qdrant: {
      search: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    redis: {
      xadd: vi.fn().mockResolvedValue("0-0"),
      xread: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(0),
    },
  });

  describe("extractLearningFromExecution", () => {
    it("should extract learning from successful file operation", () => {
      const record: ToolExecutionRecord = {
        toolName: "write_file",
        category: "file",
        params: { filePath: "/src/components/Button.tsx", content: "code" },
        result: { success: true, output: "File written", durationMs: 100 },
        context: createMockContext(),
      };

      const learning = extractLearningFromExecution(record);

      expect(learning.rawPayload.success).toBe(true);
      expect(learning.rawPayload.toolName).toBe("write_file");
      expect(learning.rawPayload.patterns).toContain("file_type:tsx");
      expect(learning.rawPayload.patterns).toContain("outcome:success");
    });

    it("should extract learning from failed operation", () => {
      const record: ToolExecutionRecord = {
        toolName: "http_request",
        category: "web",
        params: { url: "https://api.example.com/data" },
        result: {
          success: false,
          output: "Error: timeout",
          error: "Request timeout",
          durationMs: 30000,
        },
        context: createMockContext(),
      };

      const learning = extractLearningFromExecution(record);

      expect(learning.rawPayload.success).toBe(false);
      expect(learning.rawPayload.patterns).toContain("outcome:failure");
      expect(learning.episodic).toBeDefined();
      expect(learning.episodic?.memoryType).toBe("task_failure");
    });

    it("should extract git patterns", () => {
      const record: ToolExecutionRecord = {
        toolName: "git_commit",
        category: "git",
        params: {
          repoPath: "/home/user/project",
          message: "feat: add new feature",
        },
        result: { success: true, output: "Committed", durationMs: 500 },
        context: createMockContext(),
      };

      const learning = extractLearningFromExecution(record);

      expect(learning.rawPayload.patterns).toContain("repo:/home/user/project");
      expect(learning.rawPayload.patterns).toContain("commit_type:feat");
    });

    it("should create procedural memory for successful complex operations", () => {
      const record: ToolExecutionRecord = {
        toolName: "docker_build",
        category: "docker",
        params: { image: "myapp:latest", dockerfile: "./Dockerfile" },
        result: { success: true, output: "Built", durationMs: 5000 },
        context: createMockContext(),
      };

      const learning = extractLearningFromExecution(record);

      expect(learning.procedural).toBeDefined();
      expect(learning.procedural?.name).toBe("docker_build_procedure");
    });
  });

  describe("extractBatchLearning", () => {
    it("should aggregate patterns from multiple executions", () => {
      const records: ToolExecutionRecord[] = [
        {
          toolName: "write_file",
          category: "file",
          params: { filePath: "/src/a.ts" },
          result: { success: true, output: "OK", durationMs: 100 },
          context: createMockContext(),
        },
        {
          toolName: "write_file",
          category: "file",
          params: { filePath: "/src/b.ts" },
          result: { success: true, output: "OK", durationMs: 150 },
          context: createMockContext(),
        },
        {
          toolName: "write_file",
          category: "file",
          params: { filePath: "/src/c.tsx" },
          result: { success: false, output: "Error", durationMs: 50 },
          context: createMockContext(),
        },
      ];

      const batch = extractBatchLearning(records);

      expect(batch.toolStats.get("write_file")?.success).toBe(2);
      expect(batch.toolStats.get("write_file")?.failure).toBe(1);
      expect(batch.patterns.get("file_type:ts")).toBe(2);
    });
  });
});

describe("FrontierAdapter", () => {
  describe("getAgentReasoningConfig", () => {
    it("should return config for coder agent with frontier models", () => {
      const config = getAgentReasoningConfig("coder");

      expect(config.primaryModel).toContain("claude");
      expect(config.supportsTools).toBe(true);
      expect(config.temperature).toBeLessThan(0.5);
    });

    it("should return config for researcher agent", () => {
      const config = getAgentReasoningConfig("researcher");

      expect(config.primaryModel).toContain("sonar");
      expect(config.temperature).toBeGreaterThan(0.5);
    });

    it("should return config for safety agent with low temperature", () => {
      const config = getAgentReasoningConfig("safety");

      expect(config.temperature).toBeLessThanOrEqual(0.1);
      expect(config.supportsTools).toBe(false);
    });
  });

  describe("getAllAgentReasoningConfigs", () => {
    it("should return configs for all agent types", () => {
      const allConfigs = getAllAgentReasoningConfigs();

      expect(Object.keys(allConfigs)).toHaveLength(7);
      expect(allConfigs.planner).toBeDefined();
      expect(allConfigs.coder).toBeDefined();
      expect(allConfigs.executor).toBeDefined();
      expect(allConfigs.verifier).toBeDefined();
      expect(allConfigs.researcher).toBeDefined();
      expect(allConfigs.learner).toBeDefined();
      expect(allConfigs.safety).toBeDefined();
    });

    it("should use frontier models for all agents", () => {
      const allConfigs = getAllAgentReasoningConfigs();

      for (const [, config] of Object.entries(allConfigs)) {
        expect(config.primaryModel).toMatch(/claude|gpt|gemini|sonar|grok/i);
      }
    });
  });

  describe("FrontierAdapter class", () => {
    it("should get config for agent type", () => {
      const adapter = new FrontierAdapter();

      const coderConfig = adapter.getConfig("coder");
      const plannerConfig = adapter.getConfig("planner");

      expect(coderConfig.primaryModel).toBeDefined();
      expect(plannerConfig.primaryModel).toBeDefined();
    });

    it("should generate agent system prompts", () => {
      const adapter = new FrontierAdapter();

      const coderPrompt = adapter.getSystemPrompt("coder");
      const safetyPrompt = adapter.getSystemPrompt("safety");

      expect(coderPrompt).toContain("coding specialist");
      expect(safetyPrompt).toContain("safety agent");
    });
  });
});

describe("ToolMetadata", () => {
  describe("getToolsForAgent", () => {
    it("should return tools for coder agent", () => {
      const tools = getToolsForAgent("coder");

      expect(tools).toContain("write_file");
      expect(tools).toContain("read_file");
      expect(tools).toContain("git_commit");
    });

    it("should return tools for executor agent", () => {
      const tools = getToolsForAgent("executor");

      expect(tools).toContain("run_shell");
      expect(tools).toContain("ssh_execute");
    });

    it("should return tools for researcher agent", () => {
      const tools = getToolsForAgent("researcher");

      expect(tools).toContain("web_search");
      expect(tools).toContain("deep_research");
    });
  });

  describe("getHighRiskTools", () => {
    it("should return high risk tools", () => {
      const highRiskTools = getHighRiskTools();

      expect(highRiskTools).toContain("run_shell");
      expect(highRiskTools).toContain("git_push");
      expect(highRiskTools).toContain("ssh_execute");
    });
  });
});

describe("SwarmOrchestrator", () => {
  beforeEach(() => {
    resetGlobalSwarmOrchestrator();
    resetGlobalCoordinator();
  });

  const createMockContext = (): ExecutionContext => ({
    sessionId: "test-session",
    userId: 1,
    taskId: 123,
    params: {},
    startTime: Date.now(),
    leaseManager: {
      acquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(undefined),
      isHeld: vi.fn().mockResolvedValue(false),
      extend: vi.fn().mockResolvedValue(true),
    },
    qdrant: {
      search: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    redis: {
      xadd: vi.fn().mockResolvedValue("0-0"),
      xread: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(0),
    },
  });

  describe("analyzeAndPlan", () => {
    it("should analyze task and create plan", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      const analysis = await orchestrator.analyzeAndPlan(
        "Write a Python script"
      );

      expect(analysis.primaryAgent).toBeDefined();
      expect(analysis.suggestedTools).toBeDefined();
      expect(analysis.estimatedComplexity).toBeDefined();
    });

    it("should identify complex multi-agent tasks", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      const analysis = await orchestrator.analyzeAndPlan(
        "Build a REST API with authentication, write tests, deploy to staging, and verify deployment"
      );

      expect(analysis.requiresMultiAgent).toBe(true);
      expect(analysis.estimatedComplexity).toBe("complex");
    });
  });

  describe("executeSwarmTask", () => {
    it("should execute single agent task", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      const context = createMockContext();

      const mockExecutor: AgentExecutor = {
        executeWithAgent: vi.fn().mockResolvedValue({
          success: true,
          output: "Task completed",
          durationMs: 100,
        }),
      };

      const result = await orchestrator.executeSwarmTask(
        "Write a simple function",
        context,
        mockExecutor
      );

      expect(result.success).toBe(true);
      expect(result.agentsUsed.length).toBeGreaterThan(0);
      expect(mockExecutor.executeWithAgent).toHaveBeenCalled();
    });

    it("should track agent metrics", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      const context = createMockContext();

      const mockExecutor: AgentExecutor = {
        executeWithAgent: vi.fn().mockResolvedValue({
          success: true,
          output: "Done",
          durationMs: 50,
        }),
      };

      await orchestrator.executeSwarmTask("Code task", context, mockExecutor);

      const metrics = orchestrator.getAgentMetrics();
      expect(metrics.size).toBe(7);
    });
  });

  describe("createSwarmExecutor", () => {
    it("should create executor from base executor", async () => {
      const baseExecutor = vi.fn().mockResolvedValue("Result from base");
      const executor = createSwarmExecutor(baseExecutor);

      const result = await executor.executeWithAgent(
        "coder",
        "Write code",
        ["write_file"],
        createMockContext()
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain("Result");
    });

    it("should handle executor errors", async () => {
      const baseExecutor = vi
        .fn()
        .mockRejectedValue(new Error("Execution failed"));
      const executor = createSwarmExecutor(baseExecutor);

      const result = await executor.executeWithAgent(
        "coder",
        "Write code",
        ["write_file"],
        createMockContext()
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("failed");
    });
  });

  describe("createFrontierExecutor", () => {
    it("should create frontier executor without tool executor", () => {
      const executor = createFrontierExecutor();

      expect(executor.executeWithAgent).toBeDefined();
    });

    it("should create frontier executor with tool executor", () => {
      const toolExecutor = vi.fn().mockResolvedValue("Tool result");
      const executor = createFrontierExecutor(toolExecutor);

      expect(executor.executeWithAgent).toBeDefined();
    });
  });

  describe("consensus", () => {
    it("should handle consensus with abstaining participants", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();

      const result = await orchestrator.requestConsensus({
        taskId: "test-task",
        question: "Should we proceed?",
        participants: ["coder", "verifier", "safety"],
        requiredAgreement: 0.6,
        timeoutMs: 5000,
      });

      expect(["rejected", "insufficient", "timeout"]).toContain(
        result.decision
      );
      expect(result.votes.length).toBeLessThanOrEqual(3);
    });

    it("should identify high-risk tools", () => {
      const orchestrator = getGlobalSwarmOrchestrator();

      expect(orchestrator.isHighRiskTool("ssh_execute")).toBe(true);
      expect(orchestrator.isHighRiskTool("deploy_vercel")).toBe(true);
      expect(orchestrator.isHighRiskTool("git_push")).toBe(true);
      expect(orchestrator.isHighRiskTool("daemon_shell_exec")).toBe(true);

      expect(orchestrator.isHighRiskTool("read_file")).toBe(false);
      expect(orchestrator.isHighRiskTool("list_files")).toBe(false);
      expect(orchestrator.isHighRiskTool("web_search")).toBe(false);
    });

    it("should have consensus config options", () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      const config = orchestrator.getConfig();

      expect(config.enableConsensus).toBe(true);
      expect(config.consensusTimeoutMs).toBe(30000);
    });
  });

  describe("config management", () => {
    it("should return default config", () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      const config = orchestrator.getConfig();

      expect(config.maxConcurrentAgents).toBe(3);
      expect(config.consensusThreshold).toBe(0.6);
      expect(config.enableLearning).toBe(true);
    });

    it("should update config", () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      orchestrator.updateConfig({ maxConcurrentAgents: 5 });

      const config = orchestrator.getConfig();
      expect(config.maxConcurrentAgents).toBe(5);
    });

    it("should reset state", () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      orchestrator.reset();

      expect(orchestrator.getActiveAgents()).toHaveLength(0);
    });
  });
});

describe("PerceptionAdapter", () => {
  beforeEach(() => {
    resetGlobalPerceptionAdapter();
  });

  describe("initialization", () => {
    it("should initialize perception adapter", async () => {
      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      expect(adapter).toBeDefined();
    });

    it("should get global perception adapter", async () => {
      const adapter = await getGlobalPerceptionAdapter();

      expect(adapter).toBeDefined();
    });
  });

  describe("getStatus", () => {
    it("should return status with service availability info", async () => {
      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      const status = await adapter.getStatus();

      expect(typeof status.available).toBe("boolean");
      expect(typeof status.services.embeddings).toBe("boolean");
      expect(typeof status.services.vision).toBe("boolean");
      expect(typeof status.services.stt).toBe("boolean");
      expect(typeof status.services.tts).toBe("boolean");
      expect(typeof status.gpuMemoryUsedMB).toBe("number");
    });
  });

  describe("embed", () => {
    it("should throw error when model is not available", async () => {
      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      await expect(
        adapter.embed("test text", "nonexistent-model-xyz")
      ).rejects.toThrow(/not available/);
    });
  });

  describe("analyzeImage", () => {
    it("should throw error when vision model is not available", async () => {
      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      await expect(
        adapter.analyzeImage(
          "base64data",
          "Describe this",
          "nonexistent-vision-model"
        )
      ).rejects.toThrow(/not available/);
    });
  });

  describe("caching", () => {
    it("should return cache stats", async () => {
      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      const stats = adapter.getCacheStats();

      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("maxSize");
      expect(stats.maxSize).toBe(1000);
    });

    it("should clear cache", async () => {
      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      adapter.clearCache();
      const stats = adapter.getCacheStats();

      expect(stats.size).toBe(0);
    });
  });

  describe("model availability", () => {
    it("should check model availability", async () => {
      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      const available = await adapter.isModelAvailable("nomic-embed-text");

      expect(typeof available).toBe("boolean");
    });
  });
});

describe("V3MemoryIntegration", () => {
  const createMockContext = (): ExecutionContext => ({
    sessionId: "test-session",
    userId: 1,
    taskId: 123,
    params: {},
    startTime: Date.now(),
    leaseManager: {
      acquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(undefined),
      isHeld: vi.fn().mockResolvedValue(false),
      extend: vi.fn().mockResolvedValue(true),
    },
    qdrant: {
      search: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    redis: {
      xadd: vi.fn().mockResolvedValue("0-0"),
      xread: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(0),
    },
  });

  beforeEach(async () => {
    await resetGlobalMemoryClient();
  });

  describe("storeLearning", () => {
    it("should store learning in pending queue", async () => {
      const memory = new V3MemoryIntegration(1);

      const learning = extractLearningFromExecution({
        toolName: "write_file",
        category: "file",
        params: { filePath: "/test.ts" },
        result: { success: true, output: "OK", durationMs: 100 },
        context: createMockContext(),
      });

      await memory.storeLearning(learning);
    });
  });

  describe("searchRelevantLearnings", () => {
    it("should return empty array when no learnings", async () => {
      const memory = new V3MemoryIntegration(1);
      await memory.initialize();

      const results = await memory.searchRelevantLearnings("test query");

      expect(results).toEqual([]);
    });
  });

  describe("getToolStats", () => {
    it("should return null for unknown tool", async () => {
      const memory = new V3MemoryIntegration(1);

      const stats = await memory.getToolStats("unknown_tool");

      expect(stats).toBeNull();
    });

    it("should queue execution for later processing", async () => {
      const memory = new V3MemoryIntegration(1);

      await memory.recordExecution({
        toolName: "write_file",
        category: "file",
        params: { filePath: "/test.ts" },
        result: { success: true, output: "OK", durationMs: 100 },
        context: createMockContext(),
      });

      const stats = await memory.getToolStats("write_file");
      expect(stats === null || stats.totalExecutions >= 0).toBe(true);
    });
  });

  describe("enrichContextWithMemory", () => {
    it("should enrich context with memory search results", async () => {
      const context = createMockContext();

      const enrichedContext = await enrichContextWithMemory(
        context,
        "Write a test"
      );

      expect(enrichedContext.enrichment).toBeDefined();
      expect(enrichedContext.enrichment?.memorySearched).toBe(true);
    });
  });

  describe("pattern aggregation", () => {
    it("should return top patterns", async () => {
      const memory = new V3MemoryIntegration(1);

      const patterns = memory.getTopPatterns(5);

      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  describe("procedural sequences", () => {
    it("should return relevant sequences", async () => {
      const memory = new V3MemoryIntegration(1);

      const sequences = memory.getRelevantSequences("write_file");

      expect(Array.isArray(sequences)).toBe(true);
    });
  });

  describe("decay functionality", () => {
    it("should apply decay to stats", async () => {
      const memory = new V3MemoryIntegration(1);

      memory.applyDecayToStats();

      const stats = await memory.getToolStats("any_tool");
      expect(stats).toBeNull();
    });
  });
});

describe("Agent Type Specializations", () => {
  describe("all agent types have proper configuration", () => {
    const agentTypes: AgentType[] = [
      "planner",
      "coder",
      "executor",
      "verifier",
      "researcher",
      "learner",
      "safety",
    ];

    for (const agentType of agentTypes) {
      it(`${agentType} agent has reasoning config`, () => {
        const config = getAgentReasoningConfig(agentType);

        expect(config.primaryModel).toBeDefined();
        expect(config.fallbackModel).toBeDefined();
        expect(config.temperature).toBeGreaterThanOrEqual(0);
        expect(config.temperature).toBeLessThanOrEqual(1);
        expect(config.maxTokens).toBeGreaterThan(0);
      });

      it(`${agentType} agent has tools assigned`, () => {
        const tools = getToolsForAgent(agentType);

        expect(tools.length).toBeGreaterThan(0);
      });

      it(`${agentType} agent has description`, () => {
        expect(AGENT_DESCRIPTIONS[agentType]).toBeDefined();
        expect(AGENT_DESCRIPTIONS[agentType].length).toBeGreaterThan(10);
      });
    }
  });

  describe("agent specializations match their roles", () => {
    it("coder has file and git tools", () => {
      const tools = getToolsForAgent("coder");

      expect(tools).toContain("write_file");
      expect(tools).toContain("read_file");
    });

    it("executor has shell and ssh tools", () => {
      const tools = getToolsForAgent("executor");

      expect(tools).toContain("run_shell");
    });

    it("researcher has search tools", () => {
      const tools = getToolsForAgent("researcher");

      expect(tools).toContain("web_search");
    });

    it("verifier has validation tools", () => {
      const tools = getToolsForAgent("verifier");

      expect(tools.length).toBeGreaterThan(0);
    });

    it("planner has memory tools", () => {
      const tools = getToolsForAgent("planner");

      expect(tools).toContain("search_memory");
    });

    it("safety agent has low temperature for determinism", () => {
      const config = getAgentReasoningConfig("safety");

      expect(config.temperature).toBeLessThanOrEqual(0.2);
    });

    it("researcher agent uses perplexity for search", () => {
      const config = getAgentReasoningConfig("researcher");

      expect(config.primaryModel).toContain("sonar");
    });
  });
});

describe("E2E Multi-Agent Workflow", () => {
  const createMockContext = (): ExecutionContext => ({
    sessionId: "e2e-test-session",
    userId: 1,
    taskId: Date.now(),
    params: {},
    startTime: Date.now(),
    leaseManager: {
      acquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(undefined),
      isHeld: vi.fn().mockResolvedValue(false),
      extend: vi.fn().mockResolvedValue(true),
    },
    qdrant: {
      search: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    redis: {
      xadd: vi.fn().mockResolvedValue("0-0"),
      xread: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(0),
    },
  });

  beforeEach(() => {
    resetGlobalSwarmOrchestrator();
    resetGlobalCoordinator();
  });

  describe("task analysis and agent selection", () => {
    it("should select coder agent for coding tasks", () => {
      const analysis = analyzeTask(
        "Write a Python function to calculate fibonacci"
      );

      expect(analysis.primaryAgent).toBe("coder");
      expect(analysis.suggestedTools.length).toBeGreaterThan(0);
    });

    it("should select researcher agent for research tasks", () => {
      const analysis = analyzeTask(
        "Research the best practices for React hooks"
      );

      expect(analysis.primaryAgent).toBe("researcher");
    });

    it("should select executor agent for deployment tasks", () => {
      const analysis = analyzeTask("Deploy the application to production");

      expect(analysis.primaryAgent).toBe("executor");
    });

    it("should detect complex multi-agent tasks", () => {
      const analysis = analyzeTask(
        "Research best practices for React, then write a component following those patterns, and finally test it"
      );

      expect(analysis.requiresMultiAgent).toBe(true);
      expect(analysis.estimatedComplexity).toBe("complex");
    });

    it("should suggest multiple agents for complex tasks", () => {
      const analysis = analyzeTask(
        "Build and deploy a web application with proper testing"
      );

      expect(analysis.secondaryAgents.length).toBeGreaterThan(0);
    });
  });

  describe("swarm orchestrator workflow", () => {
    it("should execute single agent task", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      const context = createMockContext();

      const mockExecutor = {
        executeWithAgent: vi.fn().mockResolvedValue({
          success: true,
          output: "Task completed successfully",
          durationMs: 1000,
        }),
      };

      const result = await orchestrator.executeSwarmTask(
        "Write a hello world function",
        context,
        mockExecutor
      );

      expect(result.success).toBe(true);
      expect(result.agentsUsed.length).toBeGreaterThan(0);
      expect(result.tasksCompleted).toBeGreaterThanOrEqual(1);
    });

    it("should track agent metrics after execution", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      const context = createMockContext();

      const mockExecutor = {
        executeWithAgent: vi.fn().mockResolvedValue({
          success: true,
          output: "Done",
          durationMs: 500,
        }),
      };

      await orchestrator.executeSwarmTask(
        "Simple coding task",
        context,
        mockExecutor
      );

      const metrics = orchestrator.getAgentMetrics();
      const totalTasks = Array.from(metrics.values()).reduce(
        (sum, m) => sum + m.tasksCompleted,
        0
      );

      expect(totalTasks).toBeGreaterThan(0);
    });

    it("should handle task failures gracefully", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      const context = createMockContext();

      const mockExecutor = {
        executeWithAgent: vi.fn().mockResolvedValue({
          success: false,
          output: "Error: Task failed",
          error: "Simulated failure",
          durationMs: 100,
        }),
      };

      const result = await orchestrator.executeSwarmTask(
        "Failing task",
        context,
        mockExecutor
      );

      expect(result.success).toBe(false);
      expect(result.tasksFailed).toBeGreaterThan(0);
    });
  });

  describe("agent behavior integration", () => {
    it("should apply pre-processing to tasks", async () => {
      const context = createMockContext();
      const task = "Write a file";

      const processedTask = await applyAgentPreProcess("coder", task, context);

      expect(processedTask).toContain(task);
    });

    it("should apply post-processing to results", async () => {
      const context = createMockContext();
      const result = {
        success: true,
        output: "```typescript\nconst x = 1;\n```",
        durationMs: 100,
      };

      const processedResult = await applyAgentPostProcess(
        "coder",
        result,
        context
      );

      expect(processedResult.metadata?.containsCode).toBe(true);
    });

    it("should select appropriate tools for each agent", () => {
      const coderTools = selectToolsForAgent("coder", "Write a file");
      const researcherTools = selectToolsForAgent(
        "researcher",
        "Search the web"
      );

      expect(coderTools).toContain("write_file");
      expect(researcherTools).toContain("web_search");
    });
  });

  describe("consensus mechanism", () => {
    it("should identify high-risk tools", () => {
      const orchestrator = getGlobalSwarmOrchestrator();

      expect(orchestrator.isHighRiskTool("ssh_execute")).toBe(true);
      expect(orchestrator.isHighRiskTool("read_file")).toBe(false);
    });

    it("should request consensus for high-risk operations", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();

      const result = await orchestrator.requestToolConsensus("ssh_execute", {
        host: "production-server",
        command: "rm -rf /tmp/cache",
      });

      expect(result.taskId).toContain("tool-ssh_execute");
      expect(["approved", "rejected", "timeout", "insufficient"]).toContain(
        result.decision
      );
    });
  });

  describe("full workflow simulation", () => {
    it("should complete a multi-step coding workflow", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      const context = createMockContext();
      let callCount = 0;

      const mockExecutor = {
        executeWithAgent: vi.fn().mockImplementation(async agentType => {
          callCount++;
          return {
            success: true,
            output: `${agentType} completed step ${callCount}`,
            durationMs: 200 * callCount,
          };
        }),
      };

      const result = await orchestrator.executeSwarmTask(
        "Plan a feature, implement it, and verify the implementation",
        context,
        mockExecutor
      );

      expect(result.success).toBe(true);
      expect(result.agentsUsed.length).toBeGreaterThanOrEqual(1);
      expect(result.totalDurationMs).toBeGreaterThan(0);
    });

    it("should extract learnings from successful execution", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      orchestrator.updateConfig({ enableLearning: true });
      const context = createMockContext();

      const mockExecutor = {
        executeWithAgent: vi.fn().mockResolvedValue({
          success: true,
          output: "Task completed with learnings",
          durationMs: 1000,
        }),
      };

      const result = await orchestrator.executeSwarmTask(
        "Simple task for learning extraction",
        context,
        mockExecutor
      );

      expect(result.success).toBe(true);
    });

    it("should enrich context with memory when enabled", async () => {
      const orchestrator = getGlobalSwarmOrchestrator();
      orchestrator.updateConfig({ enableMemoryEnrichment: true });
      const context = createMockContext();

      const mockExecutor = {
        executeWithAgent: vi.fn().mockResolvedValue({
          success: true,
          output: "Memory-enriched execution",
          durationMs: 500,
        }),
      };

      const result = await orchestrator.executeSwarmTask(
        "Task with memory context",
        context,
        mockExecutor
      );

      expect(result.success).toBe(true);
    });
  });
});

describe("Ollama Integration Tests", () => {
  const checkOllamaAvailable = async (): Promise<boolean> => {
    try {
      const response = await fetch("http://localhost:11434/api/tags", {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  describe("perception adapter with real Ollama", () => {
    it("should detect Ollama availability", async () => {
      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      const status = await adapter.getStatus();

      if (await checkOllamaAvailable()) {
        expect(status.available).toBe(true);
        expect(status.services.embeddings).toBe(true);
        expect(status.services.vision).toBe(true);
      } else {
        expect(status.available).toBe(false);
      }
    });

    it("should generate embeddings with nomic-embed-text", async () => {
      if (!(await checkOllamaAvailable())) {
        console.log("Skipping: Ollama not available");
        return;
      }

      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      const result = await adapter.embed("Test embedding for JARVIS v3");

      expect(result.vector.length).toBeGreaterThan(0);
      expect(result.dimensions).toBe(768);
      expect(result.model).toBe("nomic-embed-text");
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it("should cache embeddings", async () => {
      if (!(await checkOllamaAvailable())) {
        console.log("Skipping: Ollama not available");
        return;
      }

      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      const text = "Cached embedding test";
      const first = await adapter.embed(text);
      const second = await adapter.embed(text);

      expect(first.cached).toBe(false);
      expect(second.cached).toBe(true);
      expect(second.durationMs).toBe(0);
      expect(first.vector).toEqual(second.vector);
    });

    it("should batch embed multiple texts", async () => {
      if (!(await checkOllamaAvailable())) {
        console.log("Skipping: Ollama not available");
        return;
      }

      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      const texts = ["First text", "Second text", "Third text"];
      const results = await adapter.embedBatch(texts);

      expect(results.length).toBe(3);
      results.forEach(r => {
        expect(r.dimensions).toBe(768);
      });
    });

    it("should analyze images with llama3.2-vision", async () => {
      if (!(await checkOllamaAvailable())) {
        console.log("Skipping: Ollama not available");
        return;
      }

      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      const redPixelBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

      const result = await adapter.analyzeImage(
        redPixelBase64,
        "What color is this image?"
      );

      expect(result.description.length).toBeGreaterThan(0);
      expect(result.description.toLowerCase()).toContain("red");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.durationMs).toBeGreaterThan(0);
    }, 200000);

    it("should report cache stats", async () => {
      const adapter = new PerceptionAdapter();
      await adapter.initialize();

      const stats = adapter.getCacheStats();

      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("maxSize");
      expect(stats.maxSize).toBe(1000);
    });
  });
});
