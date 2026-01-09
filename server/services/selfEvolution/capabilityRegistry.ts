import type { Capability, CapabilityCategory, CapabilityGap } from "./types";
import { getDb } from "../../db";
import { agentSkills } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getAvailableTools } from "../jarvis/tools";

const BUILTIN_CAPABILITIES: Capability[] = [
  {
    id: "web_search",
    name: "Web Search",
    description:
      "Search the internet for current information using Perplexity Sonar",
    category: "web",
    toolName: "web_search",
    inputSchema: { query: { type: "string", required: true } },
    examples: [
      {
        input: "latest news about AI",
        output: "Returns summarized search results with sources",
      },
    ],
    limitations: [
      "Requires API key",
      "Rate limited",
      "May not have real-time data",
    ],
    dependencies: [],
    confidence: 0.95,
    usageCount: 0,
    successRate: 0.9,
  },
  {
    id: "code_execution_python",
    name: "Python Code Execution",
    description: "Execute Python code in a sandboxed environment",
    category: "code",
    toolName: "execute_python",
    inputSchema: { code: { type: "string", required: true } },
    examples: [{ input: "print(2 + 2)", output: "4" }],
    limitations: [
      "30 second timeout",
      "Limited package availability",
      "No network access",
    ],
    dependencies: ["python3"],
    confidence: 0.95,
    usageCount: 0,
    successRate: 0.85,
  },
  {
    id: "code_execution_js",
    name: "JavaScript Code Execution",
    description: "Execute Node.js code in a sandboxed environment",
    category: "code",
    toolName: "execute_javascript",
    inputSchema: { code: { type: "string", required: true } },
    examples: [{ input: "console.log(2 + 2)", output: "4" }],
    limitations: ["30 second timeout", "Limited package availability"],
    dependencies: ["node"],
    confidence: 0.95,
    usageCount: 0,
    successRate: 0.85,
  },
  {
    id: "file_read",
    name: "File Reading",
    description: "Read contents of files from the filesystem",
    category: "file",
    toolName: "read_file",
    inputSchema: { path: { type: "string", required: true } },
    examples: [{ input: "/etc/hostname", output: "Returns file contents" }],
    limitations: ["Size limits", "Permission restrictions"],
    dependencies: [],
    confidence: 0.99,
    usageCount: 0,
    successRate: 0.95,
  },
  {
    id: "file_write",
    name: "File Writing",
    description: "Write content to files on the filesystem",
    category: "file",
    toolName: "write_file",
    inputSchema: {
      path: { type: "string", required: true },
      content: { type: "string", required: true },
    },
    examples: [
      {
        input: '{"path": "test.txt", "content": "hello"}',
        output: "File created",
      },
    ],
    limitations: ["Sandbox restrictions", "Permission restrictions"],
    dependencies: [],
    confidence: 0.99,
    usageCount: 0,
    successRate: 0.95,
  },
  {
    id: "shell_execution",
    name: "Shell Command Execution",
    description: "Run shell commands in the sandbox environment",
    category: "code",
    toolName: "run_shell",
    inputSchema: { command: { type: "string", required: true } },
    examples: [{ input: "ls -la", output: "Directory listing" }],
    limitations: [
      "Dangerous commands blocked",
      "60 second timeout",
      "Sandbox only",
    ],
    dependencies: ["bash"],
    confidence: 0.9,
    usageCount: 0,
    successRate: 0.8,
  },
  {
    id: "http_request",
    name: "HTTP Requests",
    description: "Make HTTP requests to APIs and web services",
    category: "web",
    toolName: "http_request",
    inputSchema: {
      url: { type: "string", required: true },
      method: { type: "string", required: false },
      headers: { type: "object", required: false },
      body: { type: "string", required: false },
    },
    examples: [
      { input: '{"url": "https://api.github.com"}', output: "API response" },
    ],
    limitations: ["Some hosts may block requests", "Response size limits"],
    dependencies: [],
    confidence: 0.9,
    usageCount: 0,
    successRate: 0.85,
  },
  {
    id: "ssh_remote",
    name: "SSH Remote Execution",
    description: "Execute commands on registered remote SSH hosts",
    category: "infrastructure",
    toolName: "ssh_execute",
    inputSchema: {
      host: { type: "string", required: true },
      command: { type: "string", required: true },
    },
    examples: [
      {
        input: '{"host": "production", "command": "uptime"}',
        output: "Remote command output",
      },
    ],
    limitations: [
      "Requires registered host",
      "Permission controls",
      "Approval may be required",
    ],
    dependencies: ["registered SSH host"],
    confidence: 0.85,
    usageCount: 0,
    successRate: 0.8,
  },
  {
    id: "browser_automation",
    name: "Browser Automation",
    description: "Control a headless browser for web interaction and testing",
    category: "web",
    toolName: "browser_session_start",
    examples: [
      {
        input: '{"url": "https://example.com"}',
        output: "Browser session started",
      },
    ],
    limitations: ["Headless only", "Some sites block automation"],
    dependencies: ["playwright", "chromium"],
    confidence: 0.85,
    usageCount: 0,
    successRate: 0.75,
  },
  {
    id: "git_operations",
    name: "Git Operations",
    description: "Perform git operations like status, diff, commit, push",
    category: "code",
    toolName: "git_status",
    examples: [
      {
        input: '{"projectPath": "/path/to/repo"}',
        output: "Git status output",
      },
    ],
    limitations: [
      "Requires git repository",
      "Authentication for remote operations",
    ],
    dependencies: ["git"],
    confidence: 0.95,
    usageCount: 0,
    successRate: 0.9,
  },
  {
    id: "image_generation",
    name: "AI Image Generation",
    description: "Generate images from text descriptions using AI",
    category: "data",
    toolName: "generate_image",
    inputSchema: { prompt: { type: "string", required: true } },
    examples: [
      { input: "a sunset over mountains", output: "URL to generated image" },
    ],
    limitations: ["Requires API key", "Content restrictions apply"],
    dependencies: ["image generation API"],
    confidence: 0.8,
    usageCount: 0,
    successRate: 0.85,
  },
  {
    id: "self_reflection",
    name: "Self Reflection",
    description:
      "Analyze own performance, capabilities, and areas for improvement",
    category: "self",
    examples: [
      {
        input: "What can I improve?",
        output: "Analysis of recent performance",
      },
    ],
    limitations: ["Requires task history", "Limited to recorded data"],
    dependencies: ["memory system"],
    confidence: 0.7,
    usageCount: 0,
    successRate: 0.9,
  },
  {
    id: "memory_recall",
    name: "Memory Recall",
    description: "Retrieve relevant memories from past interactions",
    category: "memory",
    examples: [
      {
        input: "What do I know about the user's preferences?",
        output: "Relevant memories",
      },
    ],
    limitations: [
      "Limited to stored memories",
      "May not find relevant matches",
    ],
    dependencies: ["memory system"],
    confidence: 0.75,
    usageCount: 0,
    successRate: 0.8,
  },
];

export class CapabilityRegistry {
  private capabilities: Map<string, Capability> = new Map();
  private gaps: CapabilityGap[] = [];
  private userId: number | null = null;

  async initialize(userId: number): Promise<void> {
    this.userId = userId;

    for (const cap of BUILTIN_CAPABILITIES) {
      this.capabilities.set(cap.id, { ...cap });
    }

    await this.loadLearnedCapabilities();
    await this.syncWithTools();
  }

  private async loadLearnedCapabilities(): Promise<void> {
    if (!this.userId) return;

    const db = await getDb();
    if (!db) return;

    const skills = await db
      .select()
      .from(agentSkills)
      .where(
        and(eq(agentSkills.userId, this.userId), eq(agentSkills.isActive, 1))
      );

    for (const skill of skills) {
      const capability: Capability = {
        id: `skill_${skill.id}`,
        name: skill.name,
        description: skill.description || "",
        category: (skill.category as CapabilityCategory) || "reasoning",
        examples: (skill.examples || []).map((ex: string) => ({
          input: ex,
          output: "",
        })),
        limitations: (skill.failures || []) as string[],
        dependencies: [],
        confidence: Number(skill.confidence) || 0.5,
        usageCount: skill.successCount + skill.failureCount,
        successRate:
          skill.successCount /
          Math.max(1, skill.successCount + skill.failureCount),
      };

      this.capabilities.set(capability.id, capability);
    }
  }

  private async syncWithTools(): Promise<void> {
    const tools = getAvailableTools();

    for (const tool of tools) {
      const existingCap = Array.from(this.capabilities.values()).find(
        c => c.toolName === tool.name
      );

      if (!existingCap) {
        const capability: Capability = {
          id: `tool_${tool.name}`,
          name: tool.name
            .replace(/_/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase()),
          description: tool.description,
          category: this.inferCategory(tool.name),
          toolName: tool.name,
          inputSchema: tool.parameters as Record<string, unknown>,
          examples: [],
          limitations: [],
          dependencies: [],
          confidence: 0.8,
          usageCount: 0,
          successRate: 0.8,
        };

        this.capabilities.set(capability.id, capability);
      }
    }
  }

  private inferCategory(toolName: string): CapabilityCategory {
    if (
      toolName.includes("web") ||
      toolName.includes("browse") ||
      toolName.includes("http")
    ) {
      return "web";
    }
    if (
      toolName.includes("file") ||
      toolName.includes("read") ||
      toolName.includes("write")
    ) {
      return "file";
    }
    if (
      toolName.includes("shell") ||
      toolName.includes("execute") ||
      toolName.includes("git")
    ) {
      return "code";
    }
    if (toolName.includes("ssh") || toolName.includes("infrastructure")) {
      return "infrastructure";
    }
    if (toolName.includes("memory") || toolName.includes("recall")) {
      return "memory";
    }
    return "reasoning";
  }

  getAll(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  getById(id: string): Capability | undefined {
    return this.capabilities.get(id);
  }

  getByCategory(category: CapabilityCategory): Capability[] {
    return this.getAll().filter(c => c.category === category);
  }

  getByTool(toolName: string): Capability | undefined {
    return this.getAll().find(c => c.toolName === toolName);
  }

  search(query: string): Capability[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      c =>
        c.name.toLowerCase().includes(lowerQuery) ||
        c.description.toLowerCase().includes(lowerQuery) ||
        c.toolName?.toLowerCase().includes(lowerQuery)
    );
  }

  async recordUsage(
    capabilityId: string,
    success: boolean,
    _context?: string
  ): Promise<void> {
    const cap = this.capabilities.get(capabilityId);
    if (!cap) return;

    cap.usageCount++;
    cap.lastUsed = new Date();

    const totalAttempts = cap.usageCount;
    const successCount =
      Math.round(cap.successRate * (totalAttempts - 1)) + (success ? 1 : 0);
    cap.successRate = successCount / totalAttempts;

    cap.confidence = Math.min(0.99, cap.confidence + (success ? 0.01 : -0.02));
    cap.confidence = Math.max(0.1, cap.confidence);
  }

  async recordGap(
    description: string,
    context: string,
    priority: CapabilityGap["priority"] = "medium"
  ): Promise<CapabilityGap> {
    const existingGap = this.gaps.find(
      g => g.description.toLowerCase() === description.toLowerCase()
    );

    if (existingGap) {
      return existingGap;
    }

    const gap: CapabilityGap = {
      description,
      detectedAt: new Date(),
      context,
      priority,
      status: "identified",
    };

    this.gaps.push(gap);
    return gap;
  }

  getGaps(): CapabilityGap[] {
    return [...this.gaps];
  }

  getGapsByPriority(priority: CapabilityGap["priority"]): CapabilityGap[] {
    return this.gaps.filter(g => g.priority === priority);
  }

  async resolveGap(description: string, solution?: string): Promise<void> {
    const gap = this.gaps.find(
      g => g.description.toLowerCase() === description.toLowerCase()
    );

    if (gap) {
      gap.status = "resolved";
      gap.suggestedSolution = solution;
    }
  }

  canDo(query: string): {
    capable: boolean;
    capability?: Capability;
    confidence: number;
  } {
    const matches = this.search(query);

    if (matches.length === 0) {
      return { capable: false, confidence: 0 };
    }

    const bestMatch = matches.reduce((a, b) =>
      a.confidence > b.confidence ? a : b
    );

    return {
      capable: bestMatch.confidence > 0.5,
      capability: bestMatch,
      confidence: bestMatch.confidence,
    };
  }

  getSummary(): {
    total: number;
    byCategory: Record<CapabilityCategory, number>;
    topUsed: Capability[];
    lowConfidence: Capability[];
    gaps: number;
  } {
    const all = this.getAll();
    const byCategory: Record<CapabilityCategory, number> = {
      web: 0,
      code: 0,
      file: 0,
      data: 0,
      communication: 0,
      reasoning: 0,
      memory: 0,
      self: 0,
      infrastructure: 0,
    };

    for (const cap of all) {
      byCategory[cap.category]++;
    }

    const topUsed = [...all]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    const lowConfidence = all.filter(c => c.confidence < 0.6);

    return {
      total: all.length,
      byCategory,
      topUsed,
      lowConfidence,
      gaps: this.gaps.length,
    };
  }

  toJSON(): object {
    return {
      capabilities: this.getAll(),
      gaps: this.gaps,
      summary: this.getSummary(),
    };
  }
}

let registryInstance: CapabilityRegistry | null = null;

export function getCapabilityRegistry(): CapabilityRegistry {
  if (!registryInstance) {
    registryInstance = new CapabilityRegistry();
  }
  return registryInstance;
}

export async function initializeCapabilityRegistry(
  userId: number
): Promise<CapabilityRegistry> {
  const registry = new CapabilityRegistry();
  await registry.initialize(userId);
  registryInstance = registry;
  return registry;
}
