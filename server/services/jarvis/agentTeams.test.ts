import { describe, it, expect, vi } from "vitest";
import type {
  SubTask,
  AgentRole,
  TeamCallback,
  TeamCoordination,
} from "./agentTeams";

vi.mock("../../_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            subtasks: [
              { assignedAgent: "researcher", description: "Research topic" },
              {
                assignedAgent: "analyst",
                description: "Analyze data",
                dependsOn: ["subtask-0"],
              },
            ],
          }),
        },
      },
    ],
  }),
}));

vi.mock("./orchestrator", () => ({
  runOrchestrator: vi
    .fn()
    .mockImplementation(
      async (_task: string, callbacks: { onComplete: (s: string) => void }) => {
        await new Promise(r => setTimeout(r, 10));
        callbacks.onComplete("Mock result");
      }
    ),
}));

vi.mock("./tools", () => ({
  executeTool: vi.fn().mockResolvedValue("Tool executed"),
}));

describe("Agent Teams", () => {
  describe("SubTask interface", () => {
    it("should support dependency tracking", () => {
      const subtask: SubTask = {
        id: "subtask-1",
        assignedAgent: "analyst",
        description: "Analyze the research results",
        status: "pending",
        dependsOn: ["subtask-0"],
        priority: 1,
      };

      expect(subtask.dependsOn).toContain("subtask-0");
      expect(subtask.priority).toBe(1);
    });

    it("should track timing information", () => {
      const subtask: SubTask = {
        id: "subtask-0",
        assignedAgent: "researcher",
        description: "Research topic",
        status: "complete",
        startedAt: 1000,
        completedAt: 2000,
      };

      expect(subtask.completedAt! - subtask.startedAt!).toBe(1000);
    });

    it("should support cancellation status", () => {
      const subtask: SubTask = {
        id: "subtask-0",
        assignedAgent: "coder",
        description: "Write code",
        status: "cancelled",
      };

      expect(subtask.status).toBe("cancelled");
    });
  });

  describe("Dependency ordering", () => {
    it("should identify independent tasks for parallel execution", () => {
      const subtasks: SubTask[] = [
        {
          id: "subtask-0",
          assignedAgent: "researcher",
          description: "Task A",
          status: "pending",
        },
        {
          id: "subtask-1",
          assignedAgent: "coder",
          description: "Task B",
          status: "pending",
        },
        {
          id: "subtask-2",
          assignedAgent: "analyst",
          description: "Task C",
          status: "pending",
          dependsOn: ["subtask-0", "subtask-1"],
        },
      ];

      const independent = subtasks.filter(
        t => !t.dependsOn || t.dependsOn.length === 0
      );
      const dependent = subtasks.filter(
        t => t.dependsOn && t.dependsOn.length > 0
      );

      expect(independent).toHaveLength(2);
      expect(dependent).toHaveLength(1);
      expect(dependent[0].id).toBe("subtask-2");
    });

    it("should support chain dependencies", () => {
      const subtasks: SubTask[] = [
        {
          id: "subtask-0",
          assignedAgent: "researcher",
          description: "Research",
          status: "pending",
        },
        {
          id: "subtask-1",
          assignedAgent: "analyst",
          description: "Analyze",
          status: "pending",
          dependsOn: ["subtask-0"],
        },
        {
          id: "subtask-2",
          assignedAgent: "writer",
          description: "Write",
          status: "pending",
          dependsOn: ["subtask-1"],
        },
      ];

      expect(subtasks[1].dependsOn).toContain("subtask-0");
      expect(subtasks[2].dependsOn).toContain("subtask-1");
    });
  });

  describe("TeamCoordination", () => {
    it("should track shared context between agents", () => {
      const coordination: TeamCoordination = {
        sharedContext: new Map(),
        messageQueue: [],
        activeAgents: new Set(),
        cancelledAgents: new Set(),
        completedSubtasks: new Map(),
      };

      coordination.sharedContext.set("originalQuery", "Test query");
      coordination.completedSubtasks.set("subtask-0", "Research results");

      expect(coordination.sharedContext.get("originalQuery")).toBe(
        "Test query"
      );
      expect(coordination.completedSubtasks.get("subtask-0")).toBe(
        "Research results"
      );
    });

    it("should track active and cancelled agents", () => {
      const coordination: TeamCoordination = {
        sharedContext: new Map(),
        messageQueue: [],
        activeAgents: new Set(["subtask-0", "subtask-1"]),
        cancelledAgents: new Set(),
        completedSubtasks: new Map(),
      };

      expect(coordination.activeAgents.size).toBe(2);

      coordination.cancelledAgents.add("subtask-1");
      expect(coordination.cancelledAgents.has("subtask-1")).toBe(true);
    });
  });

  describe("TeamCallback", () => {
    it("should receive all callback events", () => {
      const events: string[] = [];

      const callbacks: TeamCallback = {
        onPlanCreated: subtasks => events.push(`plan:${subtasks.length}`),
        onAgentStart: (agent, _subtask) => events.push(`start:${agent}`),
        onAgentProgress: (agent, msg) =>
          events.push(`progress:${agent}:${msg.slice(0, 10)}`),
        onAgentComplete: (agent, _subtask, _result) =>
          events.push(`complete:${agent}`),
        onAgentError: (agent, _subtask, error) =>
          events.push(`error:${agent}:${error}`),
        onTeamMessage: msg => events.push(`message:${msg.from}->${msg.to}`),
        onSynthesisStart: () => events.push("synthesis"),
        onComplete: _result => events.push("done"),
        onError: error => events.push(`failed:${error}`),
      };

      callbacks.onPlanCreated([
        {
          id: "subtask-0",
          assignedAgent: "researcher",
          description: "Test",
          status: "pending",
        },
      ]);
      callbacks.onAgentStart("researcher", {
        id: "subtask-0",
        assignedAgent: "researcher",
        description: "Test",
        status: "running",
      });
      callbacks.onAgentComplete(
        "researcher",
        {
          id: "subtask-0",
          assignedAgent: "researcher",
          description: "Test",
          status: "complete",
        },
        "Result"
      );
      callbacks.onTeamMessage({
        from: "researcher",
        to: "coordinator",
        content: "Done",
        timestamp: Date.now(),
      });
      callbacks.onSynthesisStart();
      callbacks.onComplete("Final result");

      expect(events).toContain("plan:1");
      expect(events).toContain("start:researcher");
      expect(events).toContain("complete:researcher");
      expect(events).toContain("message:researcher->coordinator");
      expect(events).toContain("synthesis");
      expect(events).toContain("done");
    });
  });

  describe("Parallel execution metrics", () => {
    it("should calculate time savings from parallelization", () => {
      const subtasks: SubTask[] = [
        {
          id: "subtask-0",
          assignedAgent: "researcher",
          description: "A",
          status: "complete",
          startedAt: 1000,
          completedAt: 2000,
        },
        {
          id: "subtask-1",
          assignedAgent: "coder",
          description: "B",
          status: "complete",
          startedAt: 1000,
          completedAt: 2500,
        },
      ];

      const sequentialTime = subtasks.reduce(
        (sum, t) => sum + ((t.completedAt || 0) - (t.startedAt || 0)),
        0
      );

      const actualStart = Math.min(...subtasks.map(t => t.startedAt || 0));
      const actualEnd = Math.max(...subtasks.map(t => t.completedAt || 0));
      const actualTime = actualEnd - actualStart;

      expect(sequentialTime).toBe(2500);
      expect(actualTime).toBe(1500);

      const savings = Math.round(
        ((sequentialTime - actualTime) / sequentialTime) * 100
      );
      expect(savings).toBe(40);
    });
  });

  describe("Agent roles", () => {
    it("should support all defined roles", () => {
      const roles: AgentRole[] = [
        "researcher",
        "analyst",
        "coder",
        "writer",
        "coordinator",
      ];

      roles.forEach(role => {
        const subtask: SubTask = {
          id: "test",
          assignedAgent: role,
          description: "Test task",
          status: "pending",
        };
        expect(subtask.assignedAgent).toBe(role);
      });
    });
  });
});
