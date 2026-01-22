/**
 * Tests for JARVIS Memory Integration
 */

import { describe, it, expect, vi } from "vitest";
import {
  formatMemoryForPrompt,
  getPreTaskContext,
  learnFromTask,
  getMemoryStats,
  type TaskContext,
  type TaskOutcome,
} from "./memoryIntegration";
import type {
  MemoryContext,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
} from "../memory/types";

// Mock the memory service
vi.mock("../memory", () => ({
  getMemoryService: vi.fn().mockReturnValue({
    getContextForTask: vi.fn().mockResolvedValue({
      relevantEpisodes: [],
      relevantKnowledge: [],
      relevantProcedures: [],
      totalMemoriesRetrieved: 0,
      retrievalTimeMs: 10,
    }),
    createEpisodicMemory: vi.fn().mockResolvedValue(1),
    createSemanticMemory: vi.fn().mockResolvedValue(1),
    recordLearning: vi.fn().mockResolvedValue(1),
    storeTrainingData: vi.fn().mockResolvedValue(1),
    recordProcedureExecution: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({
      totalEpisodic: 0,
      totalSemantic: 0,
      totalProcedural: 0,
      totalEmbeddings: 0,
      totalLearningEvents: 0,
      totalTrainingData: 0,
      recentAccessCount: 0,
      topEntities: [],
      topTags: [],
    }),
  }),
}));

describe("formatMemoryForPrompt", () => {
  it("should return empty string for empty context", () => {
    const context: MemoryContext = {
      relevantEpisodes: [],
      relevantKnowledge: [],
      relevantProcedures: [],
      totalMemoriesRetrieved: 0,
      retrievalTimeMs: 10,
    };

    const result = formatMemoryForPrompt(context);
    expect(result).toBe("");
  });

  it("should format episodic memories correctly", () => {
    const episodicMemory: EpisodicMemory = {
      id: 1,
      title: "Test Task",
      description: "A test task description",
      memoryType: "task_success",
      lessons: ["Lesson 1", "Lesson 2"],
      importance: 80,
      accessCount: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const context: MemoryContext = {
      relevantEpisodes: [{ memory: episodicMemory, relevance: 0.85 }],
      relevantKnowledge: [],
      relevantProcedures: [],
      totalMemoriesRetrieved: 1,
      retrievalTimeMs: 10,
    };

    const result = formatMemoryForPrompt(context);
    expect(result).toContain("Relevant Past Experiences");
    expect(result).toContain("Test Task");
    expect(result).toContain("85%");
    expect(result).toContain("Lesson 1");
  });

  it("should format semantic memories correctly", () => {
    const semanticMemory: SemanticMemory = {
      id: 1,
      category: "domain_knowledge",
      subject: "Python",
      predicate: "is_useful_for",
      object: "data analysis",
      confidence: 90,
      isValid: true,
      accessCount: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const context: MemoryContext = {
      relevantEpisodes: [],
      relevantKnowledge: [{ memory: semanticMemory, relevance: 0.75 }],
      relevantProcedures: [],
      totalMemoriesRetrieved: 1,
      retrievalTimeMs: 10,
    };

    const result = formatMemoryForPrompt(context);
    expect(result).toContain("Relevant Knowledge");
    expect(result).toContain("Python");
    expect(result).toContain("is_useful_for");
    expect(result).toContain("data analysis");
  });

  it("should format procedural memories correctly", () => {
    const proceduralMemory: ProceduralMemory = {
      id: 1,
      name: "Deploy Application",
      description: "Steps to deploy an application",
      triggerConditions: ["deploy", "release"],
      successRate: 95,
      executionCount: 20,
      successCount: 19,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const context: MemoryContext = {
      relevantEpisodes: [],
      relevantKnowledge: [],
      relevantProcedures: [{ memory: proceduralMemory, relevance: 0.9 }],
      totalMemoriesRetrieved: 1,
      retrievalTimeMs: 10,
    };

    const result = formatMemoryForPrompt(context);
    expect(result).toContain("Known Procedures");
    expect(result).toContain("Deploy Application");
    expect(result).toContain("95%");
    expect(result).toContain("20 times");
  });

  it("should include memory context markers", () => {
    const context: MemoryContext = {
      relevantEpisodes: [
        {
          memory: {
            id: 1,
            title: "Test",
            description: "Test",
            memoryType: "task_success",
            importance: 50,
            accessCount: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          relevance: 0.5,
        },
      ],
      relevantKnowledge: [],
      relevantProcedures: [],
      totalMemoriesRetrieved: 1,
      retrievalTimeMs: 10,
    };

    const result = formatMemoryForPrompt(context);
    expect(result).toContain("--- MEMORY CONTEXT ---");
    expect(result).toContain("--- END MEMORY CONTEXT ---");
  });
});

describe("getPreTaskContext", () => {
  it("should return context and prompt addition", async () => {
    const result = await getPreTaskContext("test task");

    expect(result.context).toBeDefined();
    expect(result.promptAddition).toBeDefined();
    expect(typeof result.promptAddition).toBe("string");
  });

  it("should accept optional userId", async () => {
    const result = await getPreTaskContext("test task", 123);
    expect(result.context).toBeDefined();
  });
});

describe("learnFromTask", () => {
  it("should process successful task outcome", async () => {
    const taskContext: TaskContext = {
      taskId: 1,
      userId: 123,
      query: "Test query",
    };

    const outcome: TaskOutcome = {
      success: true,
      result: "Task completed successfully",
      toolsUsed: ["web_search", "execute_python"],
      duration: 5000,
      iterations: 3,
    };

    // Should not throw
    await expect(learnFromTask(taskContext, outcome)).resolves.not.toThrow();
  });

  it("should process failed task outcome", async () => {
    const taskContext: TaskContext = {
      taskId: 2,
      userId: 123,
      query: "Failing test query",
    };

    const outcome: TaskOutcome = {
      success: false,
      error: "Something went wrong",
      toolsUsed: ["web_search"],
      duration: 10000,
      iterations: 5,
    };

    // Should not throw
    await expect(learnFromTask(taskContext, outcome)).resolves.not.toThrow();
  });
});

describe("getMemoryStats", () => {
  it("should return memory statistics", async () => {
    const stats = await getMemoryStats();

    expect(stats).toBeDefined();
    expect(typeof stats.totalEpisodic).toBe("number");
    expect(typeof stats.totalSemantic).toBe("number");
    expect(typeof stats.totalProcedural).toBe("number");
  });

  it("should accept optional userId", async () => {
    const stats = await getMemoryStats(123);
    expect(stats).toBeDefined();
  });
});
