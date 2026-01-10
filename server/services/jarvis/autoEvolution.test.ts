import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../selfEvolution/capabilityRegistry", () => ({
  getCapabilityRegistry: () => ({
    getByTool: () => null,
    recordUsage: vi.fn(),
    recordGap: vi.fn().mockImplementation((desc, ctx, priority) => ({
      description: desc,
      context: ctx,
      priority,
      status: "identified",
      detectedAt: new Date(),
    })),
    canDo: () => ({ capable: false, confidence: 0 }),
    getGaps: () => [],
    getSummary: () => ({
      total: 0,
      byCategory: {},
      topUsed: [],
      lowConfidence: [],
      gaps: 0,
    }),
  }),
}));

vi.mock("../../db", () => ({
  getDb: () => null,
}));

import {
  postTaskEvolution,
  getRecentFailureStats,
  clearFailureHistory,
  runScheduledEvolutionCheck,
  type TaskOutcome,
} from "./autoEvolution";

describe("Auto Evolution", () => {
  beforeEach(() => {
    clearFailureHistory();
  });

  describe("postTaskEvolution", () => {
    it("should return empty suggestions for successful tasks", async () => {
      const outcome: TaskOutcome = {
        success: true,
        query: "Write hello world in Python",
        toolsUsed: ["execute_python"],
        toolsFailed: [],
        iterationsUsed: 2,
        tokensUsed: 1000,
        durationMs: 5000,
      };

      const suggestions = await postTaskEvolution(outcome);
      expect(suggestions).toHaveLength(0);
    });

    it("should detect module not found gaps", async () => {
      const outcome: TaskOutcome = {
        success: false,
        query: "Analyze data with pandas",
        error: "ModuleNotFoundError: No module named 'pandas'",
        toolsUsed: ["execute_python"],
        toolsFailed: ["execute_python"],
        iterationsUsed: 3,
        tokensUsed: 2000,
        durationMs: 10000,
      };

      const suggestions = await postTaskEvolution(outcome);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].description).toContain("pandas");
    });

    it("should detect API authentication failures", async () => {
      const outcome: TaskOutcome = {
        success: false,
        query: "Search the web",
        error: "API key invalid or expired",
        toolsUsed: ["web_search"],
        toolsFailed: ["web_search"],
        iterationsUsed: 1,
        tokensUsed: 500,
        durationMs: 2000,
      };

      const suggestions = await postTaskEvolution(outcome);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].description).toContain("auth");
    });

    it("should detect timeout issues", async () => {
      const outcome: TaskOutcome = {
        success: false,
        query: "Process large dataset",
        error: "Operation timed out after 30 seconds",
        toolsUsed: ["execute_python"],
        toolsFailed: ["execute_python"],
        iterationsUsed: 2,
        tokensUsed: 1500,
        durationMs: 35000,
      };

      const suggestions = await postTaskEvolution(outcome);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].description).toContain("timeout");
    });

    it("should detect rate limit issues", async () => {
      const outcome: TaskOutcome = {
        success: false,
        query: "Search multiple times",
        error: "Rate limit exceeded: 429 Too Many Requests",
        toolsUsed: ["web_search"],
        toolsFailed: ["web_search"],
        iterationsUsed: 3,
        tokensUsed: 1500,
        durationMs: 10000,
      };

      const suggestions = await postTaskEvolution(outcome);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].description).toContain("Rate limiting");
    });
  });

  describe("Failure pattern detection", () => {
    it("should detect patterns after multiple failures", async () => {
      for (let i = 0; i < 4; i++) {
        await postTaskEvolution({
          success: false,
          query: `Task ${i}`,
          error: "Connection timeout",
          toolsUsed: ["http_request"],
          toolsFailed: ["http_request"],
          iterationsUsed: 1,
          tokensUsed: 500,
          durationMs: 5000,
        });
      }

      const stats = await getRecentFailureStats(24);
      expect(stats.totalFailures).toBe(4);
      expect(stats.byTool["http_request"]).toBe(4);
      expect(stats.patterns.length).toBeGreaterThan(0);
    });

    it("should categorize errors correctly", async () => {
      const outcomes: TaskOutcome[] = [
        {
          success: false,
          query: "Task 1",
          error: "Permission denied",
          toolsUsed: ["write_file"],
          toolsFailed: ["write_file"],
          iterationsUsed: 1,
          tokensUsed: 300,
          durationMs: 1000,
        },
        {
          success: false,
          query: "Task 2",
          error: "Access denied for path /etc/passwd",
          toolsUsed: ["read_file"],
          toolsFailed: ["read_file"],
          iterationsUsed: 1,
          tokensUsed: 300,
          durationMs: 1000,
        },
        {
          success: false,
          query: "Task 3",
          error: "EACCES: permission denied",
          toolsUsed: ["run_shell"],
          toolsFailed: ["run_shell"],
          iterationsUsed: 1,
          tokensUsed: 300,
          durationMs: 1000,
        },
      ];

      for (const outcome of outcomes) {
        await postTaskEvolution(outcome);
      }

      const stats = await getRecentFailureStats(24);
      expect(stats.byErrorType["permission"]).toBe(3);
    });

    it("should suggest fallback for frequently failing tools", async () => {
      for (let i = 0; i < 4; i++) {
        await postTaskEvolution({
          success: false,
          query: `Browse URL ${i}`,
          error: "Failed to fetch page",
          toolsUsed: ["browse_url"],
          toolsFailed: ["browse_url"],
          iterationsUsed: 1,
          tokensUsed: 400,
          durationMs: 3000,
        });
      }

      const stats = await getRecentFailureStats(24);
      const hasToolPattern = stats.patterns.some(
        p => p.pattern.includes("browse_url") && p.pattern.includes("failing")
      );
      expect(hasToolPattern).toBe(true);
    });
  });

  describe("getRecentFailureStats", () => {
    it("should return empty stats when no failures", async () => {
      const stats = await getRecentFailureStats(24);
      expect(stats.totalFailures).toBe(0);
      expect(Object.keys(stats.byTool)).toHaveLength(0);
      expect(stats.patterns).toHaveLength(0);
    });

    it("should filter by time window", async () => {
      await postTaskEvolution({
        success: false,
        query: "Recent failure",
        error: "Some error",
        toolsUsed: ["test_tool"],
        toolsFailed: ["test_tool"],
        iterationsUsed: 1,
        tokensUsed: 100,
        durationMs: 1000,
      });

      const stats24h = await getRecentFailureStats(24);
      expect(stats24h.totalFailures).toBe(1);

      const stats1h = await getRecentFailureStats(1);
      expect(stats1h.totalFailures).toBe(1);
    });
  });

  describe("clearFailureHistory", () => {
    it("should clear all recorded failures", async () => {
      await postTaskEvolution({
        success: false,
        query: "Test",
        error: "Error",
        toolsUsed: ["test"],
        toolsFailed: ["test"],
        iterationsUsed: 1,
        tokensUsed: 100,
        durationMs: 1000,
      });

      let stats = await getRecentFailureStats(24);
      expect(stats.totalFailures).toBe(1);

      clearFailureHistory();

      stats = await getRecentFailureStats(24);
      expect(stats.totalFailures).toBe(0);
    });
  });

  describe("runScheduledEvolutionCheck", () => {
    it("should return suggestions based on accumulated data", async () => {
      for (let i = 0; i < 4; i++) {
        await postTaskEvolution({
          success: false,
          query: `Task ${i}`,
          error: "Network error",
          toolsUsed: ["http_request"],
          toolsFailed: ["http_request"],
          iterationsUsed: 1,
          tokensUsed: 500,
          durationMs: 5000,
        });
      }

      const suggestions = await runScheduledEvolutionCheck(1);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});
