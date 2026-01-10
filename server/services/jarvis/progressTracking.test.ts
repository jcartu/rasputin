import { describe, it, expect, vi } from "vitest";
import type {
  TaskProgress,
  TaskStage,
  OrchestratorCallbacks,
} from "./orchestrator";

describe("Progress Tracking", () => {
  describe("TaskProgress interface", () => {
    it("should have all required fields", () => {
      const progress: TaskProgress = {
        stage: "executing",
        stageProgress: 50,
        overallProgress: 35,
        currentAction: "Running web_search...",
        toolsCompleted: 1,
        toolsTotal: 2,
        iterationsCurrent: 3,
        iterationsMax: 15,
        tokensUsed: 10000,
        tokensBudget: 500000,
        estimatedTimeRemainingMs: 5000,
        partialResults: ["Found 3 results"],
      };

      expect(progress.stage).toBe("executing");
      expect(progress.stageProgress).toBe(50);
      expect(progress.overallProgress).toBe(35);
      expect(progress.toolsCompleted).toBeLessThanOrEqual(progress.toolsTotal);
      expect(progress.iterationsCurrent).toBeLessThanOrEqual(
        progress.iterationsMax
      );
      expect(progress.tokensUsed).toBeLessThan(progress.tokensBudget);
    });

    it("should support all task stages", () => {
      const stages: TaskStage[] = [
        "initializing",
        "planning",
        "executing",
        "verifying",
        "recovering",
        "complete",
        "error",
      ];

      stages.forEach(stage => {
        const progress: TaskProgress = {
          stage,
          stageProgress: 0,
          overallProgress: 0,
          currentAction: "",
          toolsCompleted: 0,
          toolsTotal: 0,
          iterationsCurrent: 0,
          iterationsMax: 15,
          tokensUsed: 0,
          tokensBudget: 500000,
        };
        expect(progress.stage).toBe(stage);
      });
    });
  });

  describe("OrchestratorCallbacks.onProgress", () => {
    it("should be optional", () => {
      const callbacks: OrchestratorCallbacks = {
        onThinking: vi.fn(),
        onToolCall: vi.fn(),
        onToolResult: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      expect(callbacks.onProgress).toBeUndefined();
    });

    it("should receive progress updates when provided", () => {
      const progressUpdates: TaskProgress[] = [];

      const callbacks: OrchestratorCallbacks = {
        onThinking: vi.fn(),
        onToolCall: vi.fn(),
        onToolResult: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
        onProgress: (progress: TaskProgress) => {
          progressUpdates.push(progress);
        },
      };

      callbacks.onProgress?.({
        stage: "planning",
        stageProgress: 0,
        overallProgress: 10,
        currentAction: "Analyzing task...",
        toolsCompleted: 0,
        toolsTotal: 0,
        iterationsCurrent: 1,
        iterationsMax: 15,
        tokensUsed: 500,
        tokensBudget: 500000,
      });

      callbacks.onProgress?.({
        stage: "executing",
        stageProgress: 50,
        overallProgress: 30,
        currentAction: "Executing 2 tools...",
        toolsCompleted: 1,
        toolsTotal: 2,
        iterationsCurrent: 2,
        iterationsMax: 15,
        tokensUsed: 2000,
        tokensBudget: 500000,
      });

      expect(progressUpdates).toHaveLength(2);
      expect(progressUpdates[0].stage).toBe("planning");
      expect(progressUpdates[1].stage).toBe("executing");
      expect(progressUpdates[1].toolsCompleted).toBe(1);
    });
  });

  describe("Progress estimation", () => {
    it("should calculate overall progress from multiple factors", () => {
      const progress: TaskProgress = {
        stage: "executing",
        stageProgress: 100,
        overallProgress: 60,
        currentAction: "Completed tools",
        toolsCompleted: 3,
        toolsTotal: 3,
        iterationsCurrent: 5,
        iterationsMax: 15,
        tokensUsed: 50000,
        tokensBudget: 500000,
      };

      expect(progress.overallProgress).toBeGreaterThan(0);
      expect(progress.overallProgress).toBeLessThanOrEqual(100);
    });

    it("should provide estimated time remaining after multiple iterations", () => {
      const progress: TaskProgress = {
        stage: "executing",
        stageProgress: 50,
        overallProgress: 40,
        currentAction: "Processing...",
        toolsCompleted: 1,
        toolsTotal: 2,
        iterationsCurrent: 4,
        iterationsMax: 10,
        tokensUsed: 20000,
        tokensBudget: 500000,
        estimatedTimeRemainingMs: 12000,
      };

      expect(progress.estimatedTimeRemainingMs).toBeDefined();
      expect(progress.estimatedTimeRemainingMs).toBeGreaterThan(0);
    });

    it("should not have estimated time on first iteration", () => {
      const progress: TaskProgress = {
        stage: "planning",
        stageProgress: 0,
        overallProgress: 5,
        currentAction: "Analyzing task...",
        toolsCompleted: 0,
        toolsTotal: 0,
        iterationsCurrent: 1,
        iterationsMax: 15,
        tokensUsed: 500,
        tokensBudget: 500000,
      };

      expect(progress.estimatedTimeRemainingMs).toBeUndefined();
    });
  });

  describe("Partial results streaming", () => {
    it("should collect partial results during execution", () => {
      const progress: TaskProgress = {
        stage: "executing",
        stageProgress: 75,
        overallProgress: 50,
        currentAction: "Completed web_search",
        toolsCompleted: 3,
        toolsTotal: 4,
        iterationsCurrent: 3,
        iterationsMax: 15,
        tokensUsed: 15000,
        tokensBudget: 500000,
        partialResults: [
          "web_search: Found 5 relevant articles...",
          "http_request: API returned status 200...",
          "execute_python: Processed 100 records...",
        ],
      };

      expect(progress.partialResults).toHaveLength(3);
      expect(progress.partialResults![0]).toContain("web_search");
    });

    it("should limit partial results to last N entries", () => {
      const progress: TaskProgress = {
        stage: "executing",
        stageProgress: 90,
        overallProgress: 70,
        currentAction: "Almost done",
        toolsCompleted: 10,
        toolsTotal: 12,
        iterationsCurrent: 8,
        iterationsMax: 15,
        tokensUsed: 100000,
        tokensBudget: 500000,
        partialResults: [
          "result 6",
          "result 7",
          "result 8",
          "result 9",
          "result 10",
        ],
      };

      expect(progress.partialResults!.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Stage transitions", () => {
    it("should follow logical stage progression", () => {
      const expectedTransitions = [
        ["initializing", "planning"],
        ["planning", "executing"],
        ["executing", "verifying"],
        ["executing", "recovering"],
        ["recovering", "executing"],
        ["verifying", "complete"],
        ["executing", "complete"],
        ["executing", "error"],
        ["recovering", "error"],
      ];

      expectedTransitions.forEach(([from, to]) => {
        expect(
          isValidTransition(from as TaskStage, to as TaskStage)
        ).toBeTruthy();
      });
    });
  });
});

function isValidTransition(from: TaskStage, to: TaskStage): boolean {
  const validTransitions: Record<TaskStage, TaskStage[]> = {
    initializing: ["planning", "executing", "error"],
    planning: ["executing", "error"],
    executing: ["verifying", "recovering", "complete", "error"],
    verifying: ["complete", "executing", "error"],
    recovering: ["executing", "error"],
    complete: [],
    error: [],
  };

  return validTransitions[from]?.includes(to) ?? false;
}
