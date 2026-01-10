export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
  items?: { type: string };
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionContext {
  userId?: number;
  workspacePath?: string;
  timeout?: number;
  abortSignal?: AbortSignal;
}

export interface ToolPlugin {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: Record<string, ToolParameter>;

  execute(
    input: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult>;

  validate?(input: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
  };
  estimateCost?(input: Record<string, unknown>): {
    tokens: number;
    timeMs: number;
  };
}

export type ToolCategory =
  | "web"
  | "code"
  | "file"
  | "data"
  | "git"
  | "ssh"
  | "media"
  | "memory"
  | "agent"
  | "system";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

class ToolRegistry {
  private plugins: Map<string, ToolPlugin> = new Map();
  private categoryIndex: Map<ToolCategory, Set<string>> = new Map();
  private executionStats: Map<string, ToolStats> = new Map();

  register(plugin: ToolPlugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(
        `[ToolRegistry] Overwriting existing plugin: ${plugin.name}`
      );
    }

    this.plugins.set(plugin.name, plugin);

    if (!this.categoryIndex.has(plugin.category)) {
      this.categoryIndex.set(plugin.category, new Set());
    }
    this.categoryIndex.get(plugin.category)!.add(plugin.name);

    if (!this.executionStats.has(plugin.name)) {
      this.executionStats.set(plugin.name, {
        totalCalls: 0,
        successCount: 0,
        failureCount: 0,
        totalDurationMs: 0,
        lastUsed: null,
      });
    }
  }

  unregister(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    this.plugins.delete(name);
    this.categoryIndex.get(plugin.category)?.delete(name);
    return true;
  }

  get(name: string): ToolPlugin | undefined {
    return this.plugins.get(name);
  }

  getByCategory(category: ToolCategory): ToolPlugin[] {
    const names = this.categoryIndex.get(category);
    if (!names) return [];
    return Array.from(names)
      .map(n => this.plugins.get(n))
      .filter((p): p is ToolPlugin => p !== undefined);
  }

  getAll(): ToolPlugin[] {
    return Array.from(this.plugins.values());
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  async execute(
    name: string,
    input: Record<string, unknown>,
    context: ExecutionContext = {}
  ): Promise<ToolResult> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return {
        success: false,
        output: "",
        error: `Tool not found: ${name}`,
      };
    }

    if (plugin.validate) {
      const validation = plugin.validate(input);
      if (!validation.valid) {
        return {
          success: false,
          output: "",
          error: `Validation failed: ${validation.errors.join(", ")}`,
        };
      }
    }

    const startTime = Date.now();
    const stats = this.executionStats.get(name)!;

    try {
      const result = await plugin.execute(input, context);

      stats.totalCalls++;
      stats.totalDurationMs += Date.now() - startTime;
      stats.lastUsed = new Date();

      if (result.success) {
        stats.successCount++;
      } else {
        stats.failureCount++;
      }

      return result;
    } catch (error) {
      stats.totalCalls++;
      stats.failureCount++;
      stats.totalDurationMs += Date.now() - startTime;
      stats.lastUsed = new Date();

      return {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.getAll().map(plugin => ({
      type: "function" as const,
      function: {
        name: plugin.name,
        description: plugin.description,
        parameters: {
          type: "object" as const,
          properties: Object.fromEntries(
            Object.entries(plugin.parameters).map(([key, param]) => [
              key,
              {
                type: param.type,
                description: param.description,
                ...(param.enum ? { enum: param.enum } : {}),
                ...(param.default !== undefined
                  ? { default: param.default }
                  : {}),
              },
            ])
          ),
          required: Object.entries(plugin.parameters)
            .filter(([, param]) => param.required)
            .map(([key]) => key),
        },
      },
    }));
  }

  getStats(name: string): ToolStats | undefined {
    return this.executionStats.get(name);
  }

  getAllStats(): Map<string, ToolStats> {
    return new Map(this.executionStats);
  }

  getSuccessRate(name: string): number {
    const stats = this.executionStats.get(name);
    if (!stats || stats.totalCalls === 0) return 0;
    return stats.successCount / stats.totalCalls;
  }

  getAverageDuration(name: string): number {
    const stats = this.executionStats.get(name);
    if (!stats || stats.totalCalls === 0) return 0;
    return stats.totalDurationMs / stats.totalCalls;
  }

  search(query: string): ToolPlugin[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      p =>
        p.name.toLowerCase().includes(lower) ||
        p.description.toLowerCase().includes(lower)
    );
  }

  getSummary(): RegistrySummary {
    const plugins = this.getAll();
    const byCategory: Record<string, number> = {};

    for (const plugin of plugins) {
      byCategory[plugin.category] = (byCategory[plugin.category] || 0) + 1;
    }

    const topUsed = Array.from(this.executionStats.entries())
      .sort((a, b) => b[1].totalCalls - a[1].totalCalls)
      .slice(0, 10)
      .map(([name, stats]) => ({ name, ...stats }));

    const lowSuccessRate = Array.from(this.executionStats.entries())
      .filter(([, stats]) => stats.totalCalls >= 5)
      .map(([name, stats]) => ({
        name,
        successRate: stats.successCount / stats.totalCalls,
      }))
      .filter(t => t.successRate < 0.7)
      .sort((a, b) => a.successRate - b.successRate);

    return {
      totalPlugins: plugins.length,
      byCategory,
      topUsed,
      lowSuccessRate,
    };
  }
}

interface ToolStats {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  lastUsed: Date | null;
}

interface RegistrySummary {
  totalPlugins: number;
  byCategory: Record<string, number>;
  topUsed: Array<{ name: string } & ToolStats>;
  lowSuccessRate: Array<{ name: string; successRate: number }>;
}

let registryInstance: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
  }
  return registryInstance;
}

export function createToolPlugin(
  name: string,
  description: string,
  category: ToolCategory,
  parameters: Record<string, ToolParameter>,
  executor: (
    input: Record<string, unknown>,
    context: ExecutionContext
  ) => Promise<ToolResult>
): ToolPlugin {
  return {
    name,
    description,
    category,
    parameters,
    execute: executor,
  };
}
