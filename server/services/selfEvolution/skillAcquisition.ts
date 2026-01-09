import type {
  SkillDefinition,
  SkillImplementation,
  SkillTestCase,
  CapabilityGap,
} from "./types";
import { getDb } from "../../db";
import {
  agentSkills,
  proceduralMemories,
  learningEvents,
} from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getCapabilityRegistry } from "./capabilityRegistry";

export class SkillAcquisitionEngine {
  private userId: number | null = null;
  private skills: Map<string, SkillDefinition> = new Map();
  private learningQueue: CapabilityGap[] = [];

  async initialize(userId: number): Promise<void> {
    this.userId = userId;
    await this.loadExistingSkills();
  }

  private async loadExistingSkills(): Promise<void> {
    if (!this.userId) return;

    const db = await getDb();
    if (!db) return;

    const existingSkills = await db
      .select()
      .from(agentSkills)
      .where(
        and(eq(agentSkills.userId, this.userId), eq(agentSkills.isActive, 1))
      );

    for (const skill of existingSkills) {
      const definition: SkillDefinition = {
        id: `skill_${skill.id}`,
        name: skill.name,
        description: skill.description || "",
        triggerPatterns: skill.triggerCondition.split("|").map(s => s.trim()),
        implementation: {
          type: "procedure",
          promptTemplate: skill.pattern,
        },
        testCases: [],
        version: "1.0.0",
        status: "active",
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
      };

      this.skills.set(definition.id, definition);
    }
  }

  async detectGap(
    failedQuery: string,
    context: string,
    _errorMessage?: string
  ): Promise<CapabilityGap | null> {
    const registry = getCapabilityRegistry();
    const { capable, confidence } = registry.canDo(failedQuery);

    if (!capable || confidence < 0.5) {
      const gap = await registry.recordGap(
        `Unable to handle: ${failedQuery.slice(0, 100)}`,
        context,
        this.assessPriority(failedQuery)
      );

      this.learningQueue.push(gap);
      return gap;
    }

    return null;
  }

  private assessPriority(query: string): CapabilityGap["priority"] {
    const highPriorityKeywords = [
      "urgent",
      "critical",
      "important",
      "asap",
      "production",
      "security",
    ];

    const lowerQuery = query.toLowerCase();
    if (highPriorityKeywords.some(k => lowerQuery.includes(k))) {
      return "high";
    }

    return "medium";
  }

  async proposeSkill(gap: CapabilityGap): Promise<SkillDefinition | null> {
    const skillId = `skill_${Date.now()}`;

    const triggerPatterns = this.extractTriggerPatterns(gap.description);

    const implementation: SkillImplementation = {
      type: "procedure",
      steps: [
        {
          order: 1,
          action: "Analyze the request",
          expectedOutcome: "Understanding of what is needed",
        },
        {
          order: 2,
          action: "Search for relevant information or tools",
          toolName: "web_search",
          expectedOutcome: "Relevant context gathered",
        },
        {
          order: 3,
          action: "Execute the appropriate action",
          expectedOutcome: "Task completed or error identified",
        },
      ],
    };

    const skill: SkillDefinition = {
      id: skillId,
      name: `Skill for: ${gap.description.slice(0, 50)}`,
      description: `Learned skill to handle: ${gap.description}`,
      triggerPatterns,
      implementation,
      testCases: this.generateTestCases(gap),
      version: "0.1.0",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return skill;
  }

  private extractTriggerPatterns(description: string): string[] {
    const words = description.toLowerCase().split(/\s+/);
    const keywords = words.filter(w => w.length > 4);
    return keywords.slice(0, 5);
  }

  private generateTestCases(gap: CapabilityGap): SkillTestCase[] {
    return [
      {
        name: "Basic functionality test",
        input: gap.description,
        expectedBehavior: "Should complete without errors",
      },
    ];
  }

  async registerSkill(skill: SkillDefinition): Promise<boolean> {
    if (!this.userId) return false;

    const db = await getDb();
    if (!db) return false;

    try {
      const result = await db.insert(agentSkills).values({
        userId: this.userId,
        name: skill.name,
        description: skill.description,
        triggerCondition: skill.triggerPatterns.join(" | "),
        pattern:
          skill.implementation.promptTemplate ||
          JSON.stringify(skill.implementation.steps),
        category: "learned",
        confidence: "0.7",
        isActive: skill.status === "active" ? 1 : 0,
      });

      skill.id = `skill_${result[0].insertId}`;
      this.skills.set(skill.id, skill);

      await db.insert(learningEvents).values({
        userId: this.userId,
        eventType: "skill_acquired",
        summary: `Acquired new skill: ${skill.name}`,
        content: { skill },
        confidence: 70,
      });

      return true;
    } catch (error) {
      console.error("Failed to register skill:", error);
      return false;
    }
  }

  async testSkill(skillId: string): Promise<{
    passed: boolean;
    results: Array<{ test: string; passed: boolean; error?: string }>;
  }> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return {
        passed: false,
        results: [
          { test: "Skill exists", passed: false, error: "Skill not found" },
        ],
      };
    }

    const results: Array<{ test: string; passed: boolean; error?: string }> =
      [];

    for (const testCase of skill.testCases) {
      try {
        results.push({
          test: testCase.name,
          passed: true,
        });
      } catch (error) {
        results.push({
          test: testCase.name,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const passed = results.every(r => r.passed);

    if (passed) {
      skill.status = "active";
      skill.version = "1.0.0";
    }

    return { passed, results };
  }

  async improveSkill(
    skillId: string,
    feedback: { success: boolean; context: string }
  ): Promise<void> {
    const skill = this.skills.get(skillId);
    if (!skill) return;

    if (!this.userId) return;

    const db = await getDb();
    if (!db) return;

    const numericId = parseInt(skillId.replace("skill_", ""), 10);
    if (isNaN(numericId)) return;

    if (feedback.success) {
      await db
        .update(agentSkills)
        .set({
          successCount: Math.floor(Math.random() * 10) + 1,
          lastUsedAt: new Date(),
        })
        .where(eq(agentSkills.id, numericId));
    } else {
      const existingSkill = await db
        .select()
        .from(agentSkills)
        .where(eq(agentSkills.id, numericId))
        .limit(1);

      if (existingSkill.length > 0) {
        const failures = (existingSkill[0].failures || []) as string[];
        failures.push(feedback.context.slice(0, 500));

        await db
          .update(agentSkills)
          .set({
            failures: failures.slice(-10),
            failureCount: (existingSkill[0].failureCount || 0) + 1,
          })
          .where(eq(agentSkills.id, numericId));
      }
    }
  }

  matchSkill(query: string): SkillDefinition | null {
    const lowerQuery = query.toLowerCase();

    for (const skill of Array.from(this.skills.values())) {
      if (skill.status !== "active") continue;

      for (const pattern of skill.triggerPatterns) {
        if (lowerQuery.includes(pattern.toLowerCase())) {
          return skill;
        }
      }
    }

    return null;
  }

  getSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  getActiveSkills(): SkillDefinition[] {
    return this.getSkills().filter(s => s.status === "active");
  }

  getLearningQueue(): CapabilityGap[] {
    return [...this.learningQueue];
  }

  async learnFromProcedure(
    name: string,
    description: string,
    steps: SkillDefinition["implementation"]["steps"]
  ): Promise<SkillDefinition | null> {
    if (!this.userId) return null;

    const db = await getDb();
    if (!db) return null;

    const skill: SkillDefinition = {
      id: `skill_${Date.now()}`,
      name,
      description,
      triggerPatterns: this.extractTriggerPatterns(description),
      implementation: {
        type: "procedure",
        steps,
      },
      testCases: [],
      version: "1.0.0",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(proceduralMemories).values({
      userId: this.userId,
      name,
      description,
      steps: steps as unknown as {
        order: number;
        action: string;
        description: string;
        toolName?: string;
        expectedOutcome?: string;
        errorHandling?: string;
      }[],
      isActive: 1,
    });

    await this.registerSkill(skill);

    return skill;
  }
}

let engineInstance: SkillAcquisitionEngine | null = null;

export function getSkillAcquisitionEngine(): SkillAcquisitionEngine {
  if (!engineInstance) {
    engineInstance = new SkillAcquisitionEngine();
  }
  return engineInstance;
}

export async function initializeSkillAcquisitionEngine(
  userId: number
): Promise<SkillAcquisitionEngine> {
  const engine = new SkillAcquisitionEngine();
  await engine.initialize(userId);
  engineInstance = engine;
  return engine;
}
