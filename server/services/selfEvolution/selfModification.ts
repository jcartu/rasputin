import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { exec } from "child_process";
import { promisify } from "util";
import type { ModificationSpec, ModificationChange } from "./types";
import { getDb } from "../../db";
import { selfModificationLog } from "../../../drizzle/schema";
import { desc } from "drizzle-orm";

const execAsync = promisify(exec);

const SAFE_MODIFICATION_PATHS = [
  "server/services/jarvis/tools.ts",
  "server/services/selfEvolution",
  "server/services/jarvis/orchestrator.ts",
];

const FORBIDDEN_PATTERNS = [
  /process\.exit/,
  /require\(['"]child_process['"]\)/,
  /exec\s*\(/,
  /spawn\s*\(/,
  /eval\s*\(/,
  /Function\s*\(/,
  /rm\s+-rf/,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
];

export class SelfModificationPipeline {
  private projectPath: string;
  private pendingSpecs: Map<string, ModificationSpec> = new Map();
  private userId: number | null = null;
  private workspaceBranch: string | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async initialize(userId: number): Promise<void> {
    this.userId = userId;
  }

  async createModificationSpec(
    type: ModificationSpec["type"],
    target: string,
    description: string,
    rationale: string,
    changes: ModificationChange[]
  ): Promise<ModificationSpec> {
    const id = crypto.randomBytes(8).toString("hex");

    const spec: ModificationSpec = {
      id,
      type,
      target,
      description,
      rationale,
      changes,
      testPlan: this.generateTestPlan(type, target),
      rollbackPlan: await this.generateRollbackPlan(changes),
      status: "draft",
      createdAt: new Date(),
    };

    this.pendingSpecs.set(id, spec);
    return spec;
  }

  private generateTestPlan(
    type: ModificationSpec["type"],
    _target: string
  ): string[] {
    const basePlan = ["Run TypeScript compilation check", "Run ESLint"];

    switch (type) {
      case "code_patch":
        return [
          ...basePlan,
          "Verify tool appears in getAvailableTools()",
          "Test tool execution with sample input",
          "Verify error handling",
        ];
      case "tool_update":
        return [
          ...basePlan,
          "Run existing tests for the tool",
          "Test modified functionality",
          "Verify backward compatibility",
        ];
      case "prompt_update":
        return [
          ...basePlan,
          "Test prompt with sample queries",
          "Verify response quality",
        ];
      case "skill_add":
        return [
          ...basePlan,
          "Test skill trigger conditions",
          "Test skill execution",
          "Verify skill registration",
        ];
      case "config_change":
        return [
          ...basePlan,
          "Verify configuration loads correctly",
          "Test affected functionality",
        ];
      default:
        return basePlan;
    }
  }

  private async generateRollbackPlan(
    changes: ModificationChange[]
  ): Promise<string> {
    const steps: string[] = [];

    for (const change of changes) {
      if (change.type === "create") {
        steps.push(`Delete file: ${change.file}`);
      } else if (change.type === "modify") {
        steps.push(`Revert ${change.file} to previous version`);
      } else if (change.type === "delete") {
        steps.push(`Restore file: ${change.file}`);
      }
    }

    return steps.join("\n");
  }

  async validateSpec(
    specId: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const spec = this.pendingSpecs.get(specId);
    if (!spec) {
      return { valid: false, errors: ["Specification not found"] };
    }

    const errors: string[] = [];

    for (const change of spec.changes) {
      const isAllowed = SAFE_MODIFICATION_PATHS.some(p =>
        change.file.includes(p)
      );

      if (!isAllowed) {
        errors.push(`File not in allowed modification paths: ${change.file}`);
      }

      if (change.newContent) {
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (pattern.test(change.newContent)) {
            errors.push(
              `Forbidden pattern detected in ${change.file}: ${pattern}`
            );
          }
        }
      }
    }

    if (errors.length === 0) {
      spec.status = "pending_review";
    }

    return { valid: errors.length === 0, errors };
  }

  async approveSpec(specId: string): Promise<boolean> {
    const spec = this.pendingSpecs.get(specId);
    if (!spec || spec.status !== "pending_review") {
      return false;
    }

    spec.status = "approved";
    spec.approvedAt = new Date();
    return true;
  }

  async createIsolatedWorkspace(): Promise<string> {
    const branchName = `jarvis-mod-${Date.now()}`;

    try {
      await execAsync(`git checkout -b ${branchName}`, {
        cwd: this.projectPath,
      });
      this.workspaceBranch = branchName;
      return branchName;
    } catch (error) {
      throw new Error(`Failed to create workspace: ${error}`);
    }
  }

  async applyChanges(
    specId: string
  ): Promise<{ success: boolean; error?: string }> {
    const spec = this.pendingSpecs.get(specId);
    if (!spec || spec.status !== "approved") {
      return { success: false, error: "Specification not approved" };
    }

    spec.status = "testing";

    const backups: Map<string, string> = new Map();

    try {
      for (const change of spec.changes) {
        const fullPath = path.join(this.projectPath, change.file);

        if (change.type === "modify") {
          try {
            const existing = await fs.readFile(fullPath, "utf-8");
            backups.set(change.file, existing);
          } catch {
            backups.set(change.file, "");
          }
        }

        if (change.type === "create" || change.type === "modify") {
          if (change.newContent) {
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, change.newContent, "utf-8");
          }
        } else if (change.type === "delete") {
          try {
            const existing = await fs.readFile(fullPath, "utf-8");
            backups.set(change.file, existing);
            await fs.unlink(fullPath);
          } catch {
            /* ignore if file doesn't exist */
          }
        }
      }

      const testResult = await this.runTests(spec);

      if (!testResult.success) {
        await this.rollbackChanges(backups);
        spec.status = "rolled_back";
        return { success: false, error: `Tests failed: ${testResult.error}` };
      }

      spec.status = "applied";
      spec.appliedAt = new Date();

      await this.logModification(spec, "success");

      return { success: true };
    } catch (error) {
      await this.rollbackChanges(backups);
      spec.status = "rolled_back";
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.logModification(spec, "failure", errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  private async rollbackChanges(backups: Map<string, string>): Promise<void> {
    for (const [file, content] of Array.from(backups.entries())) {
      const fullPath = path.join(this.projectPath, file);
      if (content) {
        await fs.writeFile(fullPath, content, "utf-8");
      } else {
        try {
          await fs.unlink(fullPath);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private async runTests(
    _spec: ModificationSpec
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync("pnpm check", {
        cwd: this.projectPath,
        timeout: 60000,
      });

      return { success: true };
    } catch (error) {
      const execError = error as { stderr?: string; message?: string };
      return {
        success: false,
        error: execError.stderr || execError.message || "Unknown error",
      };
    }
  }

  private async logModification(
    spec: ModificationSpec,
    result: "success" | "failure",
    errorMessage?: string
  ): Promise<void> {
    const db = await getDb();
    if (!db || !this.userId) return;

    await db.insert(selfModificationLog).values({
      userId: this.userId,
      modificationType: spec.type,
      target: spec.target,
      description: spec.description,
      changeContent: JSON.stringify(spec.changes),
      reason: spec.rationale,
      success: result === "success" ? 1 : 0,
      errorMessage: errorMessage || null,
    });
  }

  async discardWorkspace(): Promise<void> {
    if (!this.workspaceBranch) return;

    try {
      await execAsync("git checkout master", { cwd: this.projectPath });
      await execAsync(`git branch -D ${this.workspaceBranch}`, {
        cwd: this.projectPath,
      });
      this.workspaceBranch = null;
    } catch {
      /* ignore */
    }
  }

  async promoteChanges(
    specId: string
  ): Promise<{ success: boolean; error?: string }> {
    const spec = this.pendingSpecs.get(specId);
    if (!spec || spec.status !== "applied") {
      return { success: false, error: "Changes not applied" };
    }

    if (!this.workspaceBranch) {
      return { success: true };
    }

    try {
      await execAsync(
        `git add -A && git commit -m "JARVIS self-modification: ${spec.description}"`,
        { cwd: this.projectPath }
      );

      await execAsync("git checkout master", { cwd: this.projectPath });
      await execAsync(`git merge ${this.workspaceBranch}`, {
        cwd: this.projectPath,
      });
      await execAsync(`git branch -d ${this.workspaceBranch}`, {
        cwd: this.projectPath,
      });

      this.workspaceBranch = null;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getPendingSpecs(): ModificationSpec[] {
    return Array.from(this.pendingSpecs.values());
  }

  getSpecById(id: string): ModificationSpec | undefined {
    return this.pendingSpecs.get(id);
  }

  async getModificationHistory(limit: number = 20): Promise<
    Array<{
      type: string;
      target: string;
      description: string;
      success: boolean;
      createdAt: Date;
    }>
  > {
    const db = await getDb();
    if (!db) return [];

    const logs = await db
      .select()
      .from(selfModificationLog)
      .orderBy(desc(selfModificationLog.createdAt))
      .limit(limit);

    return logs.map(log => ({
      type: log.modificationType,
      target: log.target,
      description: log.description,
      success: log.success === 1,
      createdAt: log.createdAt,
    }));
  }
}

let pipelineInstance: SelfModificationPipeline | null = null;

export function getSelfModificationPipeline(
  projectPath?: string
): SelfModificationPipeline {
  if (!pipelineInstance && projectPath) {
    pipelineInstance = new SelfModificationPipeline(projectPath);
  }
  if (!pipelineInstance) {
    throw new Error("SelfModificationPipeline not initialized");
  }
  return pipelineInstance;
}

export async function initializeSelfModificationPipeline(
  projectPath: string,
  userId: number
): Promise<SelfModificationPipeline> {
  const pipeline = new SelfModificationPipeline(projectPath);
  await pipeline.initialize(userId);
  pipelineInstance = pipeline;
  return pipeline;
}
