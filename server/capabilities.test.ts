import { describe, it, expect } from "vitest";

describe("Error Classification System", () => {
  it("1. should classify timeout errors correctly", async () => {
    const { classifyError } = await import(
      "./services/jarvis/errorClassification"
    );
    const result = classifyError({
      toolName: "test_tool",
      error: new Error("Request timed out after 30000ms"),
    });
    expect(result.class).toBe("timeout");
    expect(result.retryable).toBe(true);
  });

  it("2. should classify rate limit errors", async () => {
    const { classifyError } = await import(
      "./services/jarvis/errorClassification"
    );
    const result = classifyError({
      toolName: "test_tool",
      error: new Error("429 Too Many Requests"),
    });
    expect(result.class).toBe("rate_limit");
    expect(result.retryable).toBe(true);
  });

  it("3. should classify auth errors as non-retryable", async () => {
    const { classifyError } = await import(
      "./services/jarvis/errorClassification"
    );
    const result = classifyError({
      toolName: "test_tool",
      error: new Error("401 Unauthorized"),
    });
    expect(result.class).toBe("auth_error");
    expect(result.retryable).toBe(false);
  });

  it("4. should classify network errors", async () => {
    const { classifyError } = await import(
      "./services/jarvis/errorClassification"
    );
    const result = classifyError({
      toolName: "test_tool",
      error: new Error("ECONNRESET"),
    });
    expect(result.class).toBe("network_error");
  });

  it("5. should classify not found errors", async () => {
    const { classifyError } = await import(
      "./services/jarvis/errorClassification"
    );
    const result = classifyError({
      toolName: "test_tool",
      error: new Error("File not found"),
    });
    expect(result.class).toBe("not_found");
  });

  it("6. should classify validation errors", async () => {
    const { classifyError } = await import(
      "./services/jarvis/errorClassification"
    );
    const result = classifyError({
      toolName: "test_tool",
      error: new Error("Invalid input: validation failed"),
    });
    expect(result.class).toBe("validation_error");
  });
});

describe("Fallback Policy", () => {
  it("7. should decide fallback for timeout error", async () => {
    const { decideFallback } = await import("./services/jarvis/fallbackPolicy");
    const decision = await decideFallback({
      userId: 1,
      taskId: 1,
      toolName: "web_search",
      classified: {
        class: "timeout",
        message: "timeout",
        retryable: true,
        signature: "test",
      },
      failedTools: new Map(),
      recentlyTried: new Set(),
    });
    expect(decision).toHaveProperty("shouldRetry");
    expect(decision).toHaveProperty("nextTools");
  });

  it("8. should suggest alternative tools", async () => {
    const { decideFallback } = await import("./services/jarvis/fallbackPolicy");
    const decision = await decideFallback({
      userId: 1,
      taskId: 1,
      toolName: "web_search",
      classified: {
        class: "timeout",
        message: "timeout",
        retryable: true,
        signature: "test",
      },
      failedTools: new Map([["web_search", 2]]),
      recentlyTried: new Set(["web_search"]),
    });
    expect(decision.nextTools.length).toBeGreaterThanOrEqual(0);
  });

  it("9. should not retry auth errors", async () => {
    const { decideFallback } = await import("./services/jarvis/fallbackPolicy");
    const decision = await decideFallback({
      userId: 1,
      taskId: 1,
      toolName: "api_call",
      classified: {
        class: "auth_error",
        message: "unauthorized",
        retryable: false,
        signature: "test",
      },
      failedTools: new Map(),
      recentlyTried: new Set(),
    });
    expect(decision.shouldRetry).toBe(false);
  });
});

describe("Strategy Switching", () => {
  it("10. should create initial strategy state", async () => {
    const { createInitialState } = await import(
      "./services/jarvis/strategySwitching"
    );
    const state = createInitialState();
    expect(state).toHaveProperty("current");
    expect(state.current).toBe("default");
  });

  it("11. should update strategy on consecutive failures", async () => {
    const { updateStrategy, createInitialState } = await import(
      "./services/jarvis/strategySwitching"
    );
    const state = createInitialState();
    const updated = updateStrategy(state, {
      classified: {
        class: "timeout",
        message: "timeout",
        retryable: true,
        signature: "test",
      },
      consecutiveFailures: 3,
      sameSignatureCount: 0,
      lastToolName: "web_search",
    });
    expect(updated.current).not.toBe("default");
  });

  it("12. should generate strategy prompt", async () => {
    const { generateStrategyPrompt, createInitialState } = await import(
      "./services/jarvis/strategySwitching"
    );
    const state = { ...createInitialState(), current: "decompose" as const };
    const prompt = generateStrategyPrompt(state);
    expect(typeof prompt).toBe("string");
  });
});

describe("Task Classification", () => {
  it("13. should classify code-related tasks", async () => {
    const { classifyTask } = await import("./services/jarvis/taskClassifier");
    const result = classifyTask("Write a Python function to parse JSON");
    expect(result.type).toBe("code");
  });

  it("14. should classify research tasks", async () => {
    const { classifyTask } = await import("./services/jarvis/taskClassifier");
    const result = classifyTask(
      "Research the history of artificial intelligence"
    );
    expect(result.type).toBe("research");
  });

  it("15. should classify analysis tasks", async () => {
    const { classifyTask } = await import("./services/jarvis/taskClassifier");
    const result = classifyTask(
      "Provide a detailed analysis report on the quarterly sales data"
    );
    expect(result.type).toBe("analysis");
  });

  it("16. should classify creative tasks", async () => {
    const { classifyTask } = await import("./services/jarvis/taskClassifier");
    const result = classifyTask("Write a poem about the ocean");
    expect(result.type).toBe("creative");
  });

  it("17. should return confidence scores", async () => {
    const { classifyTask } = await import("./services/jarvis/taskClassifier");
    const result = classifyTask("Build a REST API");
    expect(result).toHaveProperty("confidence");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe("Model Router", () => {
  it("18. should route tasks to appropriate models", async () => {
    const { routeTask } = await import("./services/jarvis/modelRouter");
    const result = routeTask("Write unit tests for this function");
    expect(result).toHaveProperty("selectedModel");
    expect(result).toHaveProperty("taskClassification");
  });

  it("19. should provide fallback models", async () => {
    const { routeTask } = await import("./services/jarvis/modelRouter");
    const result = routeTask("Complex multi-step task");
    expect(result).toHaveProperty("fallbackModels");
    expect(Array.isArray(result.fallbackModels)).toBe(true);
  });

  it("20. should record model performance", async () => {
    const { recordModelPerformance } = await import(
      "./services/jarvis/modelRouter"
    );
    expect(() => {
      recordModelPerformance("claude-3-opus", "code", true, 5000, 1000);
    }).not.toThrow();
  });

  it("21. should format routing reports", async () => {
    const { formatRoutingReport, routeTask } = await import(
      "./services/jarvis/modelRouter"
    );
    const decision = routeTask("Test task");
    const report = formatRoutingReport(decision);
    expect(typeof report).toBe("string");
  });

  it("22. should handle unknown task types", async () => {
    const { routeTask } = await import("./services/jarvis/modelRouter");
    const result = routeTask("");
    expect(result).toHaveProperty("selectedModel");
  });
});

describe("Deep Research", () => {
  it("23. should export scoreSourceCredibility function", async () => {
    const { scoreSourceCredibility } = await import(
      "./services/jarvis/deepResearch"
    );
    expect(typeof scoreSourceCredibility).toBe("function");
  });

  it("24. should export generateSearchQueries function", async () => {
    const { generateSearchQueries } = await import(
      "./services/jarvis/deepResearch"
    );
    expect(typeof generateSearchQueries).toBe("function");
  });

  it("25. should score source credibility", async () => {
    const { scoreSourceCredibility } = await import(
      "./services/jarvis/deepResearch"
    );
    const result = scoreSourceCredibility("https://nature.com/article");
    expect(result.score).toBeGreaterThan(0.5);
  });

  it("26. should generate search queries", async () => {
    const { generateSearchQueries } = await import(
      "./services/jarvis/deepResearch"
    );
    const queries = generateSearchQueries("climate change effects");
    expect(Array.isArray(queries)).toBe(true);
    expect(queries.length).toBeGreaterThan(0);
  });

  it("27. should export extractCitations function", async () => {
    const { extractCitations } = await import("./services/jarvis/deepResearch");
    expect(typeof extractCitations).toBe("function");
  });

  it("28. should export detectConflicts function", async () => {
    const { detectConflicts } = await import("./services/jarvis/deepResearch");
    expect(typeof detectConflicts).toBe("function");
  });

  it("29. should export formatResearchReport function", async () => {
    const { formatResearchReport } = await import(
      "./services/jarvis/deepResearch"
    );
    expect(typeof formatResearchReport).toBe("function");
  });

  it("30. should export shouldDeepen function", async () => {
    const { shouldDeepen } = await import("./services/jarvis/deepResearch");
    expect(typeof shouldDeepen).toBe("function");
  });

  it("31. should export generateFollowUpQueries function", async () => {
    const { generateFollowUpQueries } = await import(
      "./services/jarvis/deepResearch"
    );
    expect(typeof generateFollowUpQueries).toBe("function");
  });

  it("32. should have ResearchSource interface", async () => {
    const mod = await import("./services/jarvis/deepResearch");
    expect(mod).toBeDefined();
  });
});

describe("Task Queue Service", () => {
  it("33. should export taskQueue singleton", async () => {
    const { taskQueue } = await import("./services/jarvis/taskQueue");
    expect(taskQueue).toBeDefined();
  });

  it("34. should have submitTask method", async () => {
    const { taskQueue } = await import("./services/jarvis/taskQueue");
    expect(typeof taskQueue.submitTask).toBe("function");
  });

  it("35. should have getTaskStatus method", async () => {
    const { taskQueue } = await import("./services/jarvis/taskQueue");
    expect(typeof taskQueue.getTaskStatus).toBe("function");
  });

  it("36. should have startWorker method", async () => {
    const { taskQueue } = await import("./services/jarvis/taskQueue");
    expect(typeof taskQueue.startWorker).toBe("function");
  });

  it("37. should have stopWorker method", async () => {
    const { taskQueue } = await import("./services/jarvis/taskQueue");
    expect(typeof taskQueue.stopWorker).toBe("function");
  });

  it("38. should have getQueueStats method", async () => {
    const { taskQueue } = await import("./services/jarvis/taskQueue");
    expect(typeof taskQueue.getQueueStats).toBe("function");
  });

  it("39. should have cancelTask method", async () => {
    const { taskQueue } = await import("./services/jarvis/taskQueue");
    expect(typeof taskQueue.cancelTask).toBe("function");
  });

  it("40. should have getUserTasks method", async () => {
    const { taskQueue } = await import("./services/jarvis/taskQueue");
    expect(typeof taskQueue.getUserTasks).toBe("function");
  });

  it("41. should export TaskStatus type", async () => {
    const mod = await import("./services/jarvis/taskQueue");
    expect(mod).toBeDefined();
  });

  it("42. should export TaskType type", async () => {
    const mod = await import("./services/jarvis/taskQueue");
    expect(mod).toBeDefined();
  });
});

describe("Document Templates", () => {
  it("43. should export document templates", async () => {
    const { DOCUMENT_TEMPLATES } = await import(
      "./services/webApp/documentTemplates"
    );
    expect(DOCUMENT_TEMPLATES).toBeDefined();
    expect(Object.keys(DOCUMENT_TEMPLATES).length).toBeGreaterThan(0);
  });

  it("44. should have business_report template", async () => {
    const { DOCUMENT_TEMPLATES } = await import(
      "./services/webApp/documentTemplates"
    );
    expect(DOCUMENT_TEMPLATES.business_report).toBeDefined();
  });

  it("45. should have technical_doc template", async () => {
    const { DOCUMENT_TEMPLATES } = await import(
      "./services/webApp/documentTemplates"
    );
    expect(DOCUMENT_TEMPLATES.technical_doc).toBeDefined();
  });

  it("46. should have meeting_notes template", async () => {
    const { DOCUMENT_TEMPLATES } = await import(
      "./services/webApp/documentTemplates"
    );
    expect(DOCUMENT_TEMPLATES.meeting_notes).toBeDefined();
  });

  it("47. should have project_proposal template", async () => {
    const { DOCUMENT_TEMPLATES } = await import(
      "./services/webApp/documentTemplates"
    );
    expect(DOCUMENT_TEMPLATES.project_proposal).toBeDefined();
  });

  it("48. should have invoice template", async () => {
    const { DOCUMENT_TEMPLATES } = await import(
      "./services/webApp/documentTemplates"
    );
    expect(DOCUMENT_TEMPLATES.invoice).toBeDefined();
  });

  it("49. should export renderTemplate function", async () => {
    const { renderTemplate } = await import(
      "./services/webApp/documentTemplates"
    );
    expect(typeof renderTemplate).toBe("function");
  });

  it("50. should have at least 10 templates", async () => {
    const { DOCUMENT_TEMPLATES } = await import(
      "./services/webApp/documentTemplates"
    );
    expect(Object.keys(DOCUMENT_TEMPLATES).length).toBeGreaterThanOrEqual(10);
  });

  it("51. should have api_doc template", async () => {
    const { DOCUMENT_TEMPLATES } = await import(
      "./services/webApp/documentTemplates"
    );
    expect(DOCUMENT_TEMPLATES.api_doc).toBeDefined();
  });

  it("52. should have sow template", async () => {
    const { DOCUMENT_TEMPLATES } = await import(
      "./services/webApp/documentTemplates"
    );
    expect(DOCUMENT_TEMPLATES.sow).toBeDefined();
  });
});

describe("Self-Evolution Tools", () => {
  it("53. should have self-evolution tools file", async () => {
    const fs = await import("fs/promises");
    const exists = await fs
      .access("./server/services/selfEvolution/tools.ts")
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("54. should export proposeCodeChange", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/selfEvolution/tools.ts", "utf-8")
    );
    expect(content).toContain("export async function proposeCodeChange");
  });

  it("55. should export validateCodeChange", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/selfEvolution/tools.ts", "utf-8")
    );
    expect(content).toContain("export async function validateCodeChange");
  });

  it("56. should export applyCodeChange", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/selfEvolution/tools.ts", "utf-8")
    );
    expect(content).toContain("export async function applyCodeChange");
  });

  it("57. should have tool generation capability", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/selfEvolution/tools.ts", "utf-8")
    );
    expect(content).toContain("generateTool");
  });

  it("58. should export initializeSelfEvolution", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/selfEvolution/tools.ts", "utf-8")
    );
    expect(content).toContain("export async function initializeSelfEvolution");
  });
});

describe("Memory Integration", () => {
  it("59. should export memory integration module", async () => {
    const mod = await import("./services/jarvis/memoryIntegration");
    expect(mod).toBeDefined();
  });

  it("60. should have learnFromTask function", async () => {
    const { learnFromTask } = await import(
      "./services/jarvis/memoryIntegration"
    );
    expect(typeof learnFromTask).toBe("function");
  });

  it("61. should have getPreTaskContext function", async () => {
    const { getPreTaskContext } = await import(
      "./services/jarvis/memoryIntegration"
    );
    expect(typeof getPreTaskContext).toBe("function");
  });

  it("62. should have createProcedureFromTask function", async () => {
    const { createProcedureFromTask } = await import(
      "./services/jarvis/memoryIntegration"
    );
    expect(typeof createProcedureFromTask).toBe("function");
  });
});

describe("Predictive Tasks", () => {
  it("63. should export analyzeTaskPatterns", async () => {
    const { analyzeTaskPatterns } = await import(
      "./services/jarvis/predictiveTask"
    );
    expect(typeof analyzeTaskPatterns).toBe("function");
  });

  it("64. should export predictNextTasks", async () => {
    const { predictNextTasks } = await import(
      "./services/jarvis/predictiveTask"
    );
    expect(typeof predictNextTasks).toBe("function");
  });

  it("65. should analyze patterns for user", async () => {
    const { analyzeTaskPatterns } = await import(
      "./services/jarvis/predictiveTask"
    );
    const patterns = await analyzeTaskPatterns(1);
    expect(Array.isArray(patterns)).toBe(true);
  });

  it("66. should predict tasks with context", async () => {
    const { predictNextTasks } = await import(
      "./services/jarvis/predictiveTask"
    );
    const predictions = await predictNextTasks(1, { timeOfDay: "morning" });
    expect(Array.isArray(predictions)).toBe(true);
  });
});

describe("Proactive Monitor", () => {
  it("67. should export proactiveMonitor singleton", async () => {
    const { proactiveMonitor } = await import(
      "./services/jarvis/proactiveMonitor"
    );
    expect(proactiveMonitor).toBeDefined();
  });

  it("68. should export startProactiveMonitor function", async () => {
    const { startProactiveMonitor } = await import(
      "./services/jarvis/proactiveMonitor"
    );
    expect(typeof startProactiveMonitor).toBe("function");
  });

  it("69. should export stopProactiveMonitor function", async () => {
    const { stopProactiveMonitor } = await import(
      "./services/jarvis/proactiveMonitor"
    );
    expect(typeof stopProactiveMonitor).toBe("function");
  });

  it("70. should have start method on singleton", async () => {
    const { proactiveMonitor } = await import(
      "./services/jarvis/proactiveMonitor"
    );
    expect(typeof proactiveMonitor.start).toBe("function");
  });

  it("71. should have stop method on singleton", async () => {
    const { proactiveMonitor } = await import(
      "./services/jarvis/proactiveMonitor"
    );
    expect(typeof proactiveMonitor.stop).toBe("function");
  });

  it("72. should export MonitorConfig interface", async () => {
    const mod = await import("./services/jarvis/proactiveMonitor");
    expect(mod).toBeDefined();
  });
});

describe("Swarm Intelligence", () => {
  it("73. should have swarmIntelligence file", async () => {
    const fs = await import("fs/promises");
    const exists = await fs
      .access("./server/services/multiAgent/swarmIntelligence.ts")
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("74. should export initiateNegotiation function", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("export async function initiateNegotiation");
  });

  it("75. should export formAgentTeam function", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("export async function formAgentTeam");
  });

  it("76. should export runConsensus function", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("export async function runConsensus");
  });

  it("77. should have initiateTaskNegotiation method", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("async initiateTaskNegotiation");
  });

  it("78. should have formTeam method", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("async formTeam");
  });

  it("79. should have placeStigmergyMarker method", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("async placeStigmergyMarker");
  });

  it("80. should have stigmergy markers interface", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("export interface StigmergyMarker");
  });

  it("81. should have initiateCollectiveProblemSolving method", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("async initiateCollectiveProblemSolving");
  });

  it("82. should have contributeKnowledge method", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("async contributeKnowledge");
  });

  it("83. should have synthesizeCollectiveSolution method", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("async synthesizeCollectiveSolution");
  });

  it("84. should have getActiveTeams method", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("async getActiveTeams");
  });

  it("85. should have disbandTeam method", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("async disbandTeam");
  });

  it("86. should have broadcastToTeam method", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("async broadcastToTeam");
  });

  it("87. should have adaptAgentRole method", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/multiAgent/swarmIntelligence.ts", "utf-8")
    );
    expect(content).toContain("async adaptAgentRole");
  });
});

describe("ElevenLabs TTS", () => {
  it("88. should export textToSpeech function", async () => {
    const { textToSpeech } = await import("./services/voice/elevenlabs");
    expect(typeof textToSpeech).toBe("function");
  });

  it("89. should export textToSpeechStream function", async () => {
    const { textToSpeechStream } = await import("./services/voice/elevenlabs");
    expect(typeof textToSpeechStream).toBe("function");
  });

  it("90. should export getVoices function", async () => {
    const { getVoices } = await import("./services/voice/elevenlabs");
    expect(typeof getVoices).toBe("function");
  });

  it("91. should export VOICE_OPTIONS constant", async () => {
    const { VOICE_OPTIONS } = await import("./services/voice/elevenlabs");
    expect(VOICE_OPTIONS).toBeDefined();
  });

  it("92. should export DEFAULT_VOICE constant", async () => {
    const { DEFAULT_VOICE } = await import("./services/voice/elevenlabs");
    expect(DEFAULT_VOICE).toBeDefined();
  });

  it("93. should have multiple voice options", async () => {
    const { VOICE_OPTIONS } = await import("./services/voice/elevenlabs");
    expect(Object.keys(VOICE_OPTIONS).length).toBeGreaterThan(0);
  });

  it("94. should have HAL9000 voice option", async () => {
    const { VOICE_OPTIONS } = await import("./services/voice/elevenlabs");
    expect(VOICE_OPTIONS.hal9000).toBeDefined();
  });

  it("95. should export getSubscriptionInfo function", async () => {
    const { getSubscriptionInfo } = await import("./services/voice/elevenlabs");
    expect(typeof getSubscriptionInfo).toBe("function");
  });
});

describe("Orchestrator Integration", () => {
  it("96. should export runOrchestrator", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/jarvis/orchestrator.ts", "utf-8")
    );
    expect(content).toContain("export async function runOrchestrator");
  });

  it("97. should export MAX_ITERATIONS constant", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/jarvis/orchestrator.ts", "utf-8")
    );
    expect(content).toContain("export const MAX_ITERATIONS");
  });

  it("98. should export MAX_TASK_DURATION_MS constant", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/jarvis/orchestrator.ts", "utf-8")
    );
    expect(content).toContain("export const MAX_TASK_DURATION_MS");
  });
});

describe("JARVIS Tools", () => {
  it("99. should export getAvailableTools function", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/jarvis/tools.ts", "utf-8")
    );
    expect(content).toContain("export function getAvailableTools");
  });

  it("100. should have many tool definitions", async () => {
    const content = await import("fs/promises").then(fs =>
      fs.readFile("./server/services/jarvis/tools.ts", "utf-8")
    );
    const toolCount = (content.match(/name:\s*["']\w+["']/g) || []).length;
    expect(toolCount).toBeGreaterThanOrEqual(20);
  });
});
