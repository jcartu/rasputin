import type {
  IntrospectionQuery,
  IntrospectionResult,
  SelfReflectionReport,
  CodeSymbolInfo,
  Capability,
  CapabilityCategory,
  SkillDefinition,
} from "./types";
import { getCodeMap, CodeMap } from "./codeMap";
import {
  getCapabilityRegistry,
  CapabilityRegistry,
} from "./capabilityRegistry";
import {
  getSelfModificationPipeline,
  SelfModificationPipeline,
} from "./selfModification";
import {
  getSkillAcquisitionEngine,
  SkillAcquisitionEngine,
} from "./skillAcquisition";
import { getDb } from "../../db";
import { agentTasks, learningEvents } from "../../../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export class IntrospectionAPI {
  private codeMap: CodeMap | null = null;
  private capabilityRegistry: CapabilityRegistry | null = null;
  private modificationPipeline: SelfModificationPipeline | null = null;
  private skillEngine: SkillAcquisitionEngine | null = null;
  private userId: number | null = null;

  async initialize(userId: number, projectPath: string): Promise<void> {
    this.userId = userId;

    try {
      this.codeMap = getCodeMap(projectPath);
    } catch {
      this.codeMap = null;
    }

    try {
      this.capabilityRegistry = getCapabilityRegistry();
    } catch {
      this.capabilityRegistry = null;
    }

    try {
      this.modificationPipeline = getSelfModificationPipeline(projectPath);
    } catch {
      this.modificationPipeline = null;
    }

    try {
      this.skillEngine = getSkillAcquisitionEngine();
    } catch {
      this.skillEngine = null;
    }
  }

  async query(query: IntrospectionQuery): Promise<IntrospectionResult> {
    const startTime = Date.now();
    let results: unknown[] = [];

    switch (query.type) {
      case "symbol":
        results = await this.querySymbols(query.query);
        break;
      case "file":
        results = await this.queryFiles(query.query);
        break;
      case "capability":
        results = this.queryCapabilities(query.query);
        break;
      case "modification":
        results = await this.queryModifications(query.query);
        break;
      case "skill":
        results = this.querySkills(query.query);
        break;
      case "gap":
        results = this.queryGaps();
        break;
    }

    return {
      query,
      results,
      totalCount: results.length,
      executionTimeMs: Date.now() - startTime,
    };
  }

  private async querySymbols(query: string): Promise<CodeSymbolInfo[]> {
    if (!this.codeMap) return [];
    return this.codeMap.searchSymbols(query);
  }

  private async queryFiles(query: string): Promise<string[]> {
    if (!this.codeMap) return [];
    const symbols = await this.codeMap.searchSymbols(query);
    const files = new Set(symbols.map(s => s.filePath));
    return Array.from(files);
  }

  private queryCapabilities(query: string): Capability[] {
    if (!this.capabilityRegistry) return [];
    return this.capabilityRegistry.search(query);
  }

  private async queryModifications(query: string): Promise<unknown[]> {
    if (!this.modificationPipeline) return [];
    const history = await this.modificationPipeline.getModificationHistory();
    return history.filter(
      m =>
        m.description.toLowerCase().includes(query.toLowerCase()) ||
        m.target.toLowerCase().includes(query.toLowerCase())
    );
  }

  private querySkills(query: string): SkillDefinition[] {
    if (!this.skillEngine) return [];
    const skills = this.skillEngine.getSkills();
    return skills.filter(
      s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.description.toLowerCase().includes(query.toLowerCase())
    );
  }

  private queryGaps(): unknown[] {
    if (!this.capabilityRegistry) return [];
    return this.capabilityRegistry.getGaps();
  }

  async whatCanIDo(): Promise<string> {
    if (!this.capabilityRegistry) {
      return "Capability registry not initialized";
    }

    const capabilities = this.capabilityRegistry.getAll();
    const byCategory: Record<string, Capability[]> = {};

    for (const cap of capabilities) {
      if (!byCategory[cap.category]) {
        byCategory[cap.category] = [];
      }
      byCategory[cap.category].push(cap);
    }

    let response = "## My Capabilities\n\n";

    for (const [category, caps] of Object.entries(byCategory)) {
      response += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
      for (const cap of caps) {
        response += `- **${cap.name}**: ${cap.description} (confidence: ${Math.round(cap.confidence * 100)}%)\n`;
      }
      response += "\n";
    }

    const gaps = this.capabilityRegistry.getGaps();
    if (gaps.length > 0) {
      response += `### Known Limitations\n`;
      for (const gap of gaps.slice(0, 5)) {
        response += `- ${gap.description}\n`;
      }
    }

    return response;
  }

  async whatDoIKnowAbout(topic: string): Promise<string> {
    const results: string[] = [];

    if (this.codeMap) {
      const symbols = await this.codeMap.searchSymbols(topic);
      if (symbols.length > 0) {
        results.push(`## Code Knowledge\n`);
        results.push(
          `Found ${symbols.length} code symbols related to "${topic}":\n`
        );
        for (const symbol of symbols.slice(0, 10)) {
          results.push(
            `- **${symbol.name}** (${symbol.type}) in ${symbol.filePath}:${symbol.startLine}`
          );
        }
        results.push("");
      }
    }

    if (this.capabilityRegistry) {
      const capabilities = this.capabilityRegistry.search(topic);
      if (capabilities.length > 0) {
        results.push(`## Capabilities\n`);
        results.push(
          `Found ${capabilities.length} capabilities related to "${topic}":\n`
        );
        for (const cap of capabilities.slice(0, 5)) {
          results.push(`- **${cap.name}**: ${cap.description}`);
        }
        results.push("");
      }
    }

    if (this.skillEngine) {
      const skill = this.skillEngine.matchSkill(topic);
      if (skill) {
        results.push(`## Skills\n`);
        results.push(`Found skill: **${skill.name}**\n`);
        results.push(`${skill.description}`);
        results.push("");
      }
    }

    if (results.length === 0) {
      return `I don't have specific knowledge about "${topic}" in my current context.`;
    }

    return results.join("\n");
  }

  async howAmIDoing(): Promise<SelfReflectionReport> {
    const db = await getDb();
    if (!db || !this.userId) {
      return this.getEmptyReport();
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentTasks = await db
      .select()
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.userId, this.userId),
          gte(agentTasks.createdAt, oneDayAgo)
        )
      )
      .orderBy(desc(agentTasks.createdAt))
      .limit(10);

    const successfulTasks = recentTasks.filter(
      t => t.status === "completed"
    ).length;
    const failedTasks = recentTasks.filter(t => t.status === "failed").length;

    const recentLearnings = await db
      .select()
      .from(learningEvents)
      .where(gte(learningEvents.createdAt, oneDayAgo))
      .orderBy(desc(learningEvents.createdAt))
      .limit(5);

    const recommendations: string[] = [];

    if (failedTasks > successfulTasks) {
      recommendations.push("Consider analyzing failed tasks for patterns");
    }

    if (this.capabilityRegistry) {
      const gaps = this.capabilityRegistry.getGaps();
      if (gaps.length > 0) {
        recommendations.push(
          `${gaps.length} capability gaps identified - consider acquiring new skills`
        );
      }

      const lowConfidence = this.capabilityRegistry
        .getAll()
        .filter(c => c.confidence < 0.6);
      if (lowConfidence.length > 0) {
        recommendations.push(
          `${lowConfidence.length} capabilities have low confidence - need more practice`
        );
      }
    }

    const codeMapStatus = this.codeMap
      ? await this.codeMap.getStats()
      : {
          totalFiles: 0,
          totalSymbols: 0,
          totalLines: 0,
          languages: {},
          lastIndexed: null,
        };

    const capabilitySummary = this.capabilityRegistry?.getSummary() || {
      total: 0,
      byCategory: {} as Record<CapabilityCategory, number>,
      topUsed: [],
      lowConfidence: [],
      gaps: 0,
    };

    return {
      timestamp: new Date(),
      codeMapStatus,
      capabilities: {
        total: capabilitySummary.total,
        byCategory: capabilitySummary.byCategory,
        topUsed: capabilitySummary.topUsed,
        recentlyFailed: capabilitySummary.lowConfidence,
      },
      gaps: this.capabilityRegistry?.getGaps() || [],
      pendingModifications: this.modificationPipeline?.getPendingSpecs() || [],
      recentLearnings: recentLearnings.map(l => l.summary),
      recommendations,
    };
  }

  private getEmptyReport(): SelfReflectionReport {
    return {
      timestamp: new Date(),
      codeMapStatus: {
        totalFiles: 0,
        totalSymbols: 0,
        totalLines: 0,
        languages: {},
        lastIndexed: null,
      },
      capabilities: {
        total: 0,
        byCategory: {} as Record<CapabilityCategory, number>,
        topUsed: [],
        recentlyFailed: [],
      },
      gaps: [],
      pendingModifications: [],
      recentLearnings: [],
      recommendations: ["Initialize the self-evolution system first"],
    };
  }

  async canILearn(description: string): Promise<{
    possible: boolean;
    approach?: string;
    blockers?: string[];
  }> {
    const blockers: string[] = [];

    if (!this.skillEngine) {
      blockers.push("Skill acquisition engine not initialized");
    }

    if (!this.capabilityRegistry) {
      blockers.push("Capability registry not available");
    }

    if (blockers.length > 0) {
      return { possible: false, blockers };
    }

    const existingCapability = this.capabilityRegistry?.canDo(description);
    if (existingCapability?.capable && existingCapability.confidence > 0.8) {
      return {
        possible: false,
        blockers: ["Already have this capability with high confidence"],
      };
    }

    return {
      possible: true,
      approach: this.suggestLearningApproach(description),
    };
  }

  private suggestLearningApproach(description: string): string {
    const lower = description.toLowerCase();

    if (
      lower.includes("api") ||
      lower.includes("http") ||
      lower.includes("web")
    ) {
      return "Learn by analyzing API documentation and creating tool wrappers";
    }

    if (
      lower.includes("code") ||
      lower.includes("program") ||
      lower.includes("script")
    ) {
      return "Learn by studying code patterns and creating execution procedures";
    }

    if (lower.includes("file") || lower.includes("data")) {
      return "Learn by creating file handling procedures with appropriate validation";
    }

    return "Learn by researching the topic and creating a structured procedure";
  }

  async suggestImprovement(): Promise<string> {
    const report = await this.howAmIDoing();
    const suggestions: string[] = [];

    if (report.gaps.length > 0) {
      suggestions.push(`## Address Capability Gaps`);
      suggestions.push(
        `I have ${report.gaps.length} identified gaps. Top priorities:`
      );
      for (const gap of report.gaps.slice(0, 3)) {
        suggestions.push(`- ${gap.description} (${gap.priority} priority)`);
      }
      suggestions.push("");
    }

    if (report.capabilities.recentlyFailed.length > 0) {
      suggestions.push(`## Improve Low-Confidence Capabilities`);
      for (const cap of report.capabilities.recentlyFailed.slice(0, 3)) {
        suggestions.push(
          `- ${cap.name}: ${Math.round(cap.confidence * 100)}% confidence`
        );
      }
      suggestions.push("");
    }

    if (!report.codeMapStatus.lastIndexed) {
      suggestions.push(`## Index Codebase`);
      suggestions.push(
        `The code map hasn't been indexed yet. Index it to gain self-awareness of my own code.`
      );
      suggestions.push("");
    }

    if (suggestions.length === 0) {
      return "I'm operating well! No immediate improvements suggested.";
    }

    return suggestions.join("\n");
  }
}

let apiInstance: IntrospectionAPI | null = null;

export function getIntrospectionAPI(): IntrospectionAPI {
  if (!apiInstance) {
    apiInstance = new IntrospectionAPI();
  }
  return apiInstance;
}

export async function initializeIntrospectionAPI(
  userId: number,
  projectPath: string
): Promise<IntrospectionAPI> {
  const api = new IntrospectionAPI();
  await api.initialize(userId, projectPath);
  apiInstance = api;
  return api;
}
