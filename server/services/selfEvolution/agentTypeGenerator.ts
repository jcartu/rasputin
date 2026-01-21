/**
 * Agent Type Generator - Creates new agent types from task pattern analysis
 * Analyzes task history to detect patterns and proposes specialized agent types.
 */

import { invokeLLM } from "../../_core/llm";
import { getDb } from "../../db";
import { agentTasks as _agentTasks } from "../../../drizzle/schema";
import { eq as _eq, gte as _gte, sql, desc as _desc } from "drizzle-orm";
import type { AgentCapabilities } from "../multiAgent/types";

interface TaskPattern {
  domain: string;
  frequency: number;
  toolsUsed: string[];
  commonPromptPatterns: string[];
  averageSuccessRate: number;
}

export interface GeneratedAgentType {
  typeName: string;
  displayName: string;
  systemPrompt: string;
  capabilities: AgentCapabilities;
  toolRestrictions?: {
    allowed?: string[];
    forbidden?: string[];
  };
  triggerPatterns: string[];
  proposedReason: string;
}

const EXISTING_AGENT_TYPES = [
  "orchestrator",
  "coordinator",
  "specialist",
  "worker",
  "code",
  "research",
  "sysadmin",
  "data",
];

const AGENT_TYPE_GENERATION_PROMPT = `You are an agent type analyzer for JARVIS, an AI agent system.

Based on task patterns, determine if a new specialized agent type should be created.

EXISTING AGENT TYPES: ${EXISTING_AGENT_TYPES.join(", ")}

Analyze the patterns and if warranted, propose a new agent type in JSON format:

{
  "shouldCreate": true/false,
  "typeName": "snake_case_name",
  "displayName": "Human Readable Name",
  "systemPrompt": "You are a specialized agent for... Your role is to...",
  "capabilities": {
    "canBrowse": true/false,
    "canCode": true/false,
    "canSearchWeb": true/false,
    "canUseFiles": true/false,
    "canRunShell": true/false,
    "canSSH": true/false,
    "canManageInfrastructure": true/false,
    "canDelegateToSubAgents": true/false,
    "canLearn": true/false,
    "domains": ["list", "of", "domains"]
  },
  "toolRestrictions": {
    "allowed": ["specific", "tools", "if any"],
    "forbidden": ["dangerous", "tools", "if any"]
  },
  "triggerPatterns": ["pattern1", "pattern2"],
  "proposedReason": "Why this agent type is needed"
}

CRITERIA FOR NEW AGENT TYPE:
1. Pattern appears 5+ times in recent tasks
2. No existing agent type covers this domain well
3. The specialization would improve task success rate
4. Clear separation of concerns from existing types

If no new type is needed, return: {"shouldCreate": false, "reason": "explanation"}`;

export async function analyzeTaskPatterns(
  userId: number,
  lookbackDays: number = 7
): Promise<TaskPattern[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const result = await db.execute(sql`
      SELECT prompt, status, toolCallsJson, createdAt
      FROM agent_tasks
      WHERE userId = ${userId}
        AND createdAt >= ${cutoffDate.toISOString().slice(0, 19).replace("T", " ")}
      ORDER BY createdAt DESC
      LIMIT 100
    `);

    const tasks = result[0] as unknown as Array<{
      prompt: string;
      status: string;
      toolCallsJson: string | null;
      createdAt: Date;
    }>;

    if (!Array.isArray(tasks) || tasks.length === 0) return [];

    const domainPatterns: Map<
      string,
      {
        count: number;
        tools: Set<string>;
        prompts: string[];
        successCount: number;
      }
    > = new Map();

    for (const task of tasks) {
      const domain = classifyTaskDomain(task.prompt);
      const existing = domainPatterns.get(domain) || {
        count: 0,
        tools: new Set<string>(),
        prompts: [],
        successCount: 0,
      };

      existing.count++;
      existing.prompts.push(task.prompt);
      if (task.status === "done") existing.successCount++;

      if (task.toolCallsJson) {
        try {
          const tools = JSON.parse(task.toolCallsJson);
          if (Array.isArray(tools)) {
            tools.forEach((t: { toolName?: string }) => {
              if (t.toolName) existing.tools.add(t.toolName);
            });
          }
        } catch {
          void 0;
        }
      }

      domainPatterns.set(domain, existing);
    }

    return Array.from(domainPatterns.entries())
      .map(([domain, data]) => ({
        domain,
        frequency: data.count,
        toolsUsed: Array.from(data.tools),
        commonPromptPatterns: extractCommonPatterns(data.prompts),
        averageSuccessRate:
          data.count > 0 ? (data.successCount / data.count) * 100 : 0,
      }))
      .filter(p => p.frequency >= 3)
      .sort((a, b) => b.frequency - a.frequency);
  } catch {
    return [];
  }
}

function classifyTaskDomain(prompt: string): string {
  const promptLower = prompt.toLowerCase();

  const domainKeywords: Record<string, string[]> = {
    devops: [
      "deploy",
      "docker",
      "kubernetes",
      "server",
      "nginx",
      "ci/cd",
      "pipeline",
      "infrastructure",
    ],
    security: [
      "security",
      "vulnerability",
      "audit",
      "scan",
      "penetration",
      "auth",
      "encryption",
    ],
    data_science: [
      "analyze",
      "data",
      "csv",
      "statistics",
      "chart",
      "visualization",
      "machine learning",
    ],
    frontend: [
      "ui",
      "css",
      "react",
      "vue",
      "component",
      "style",
      "layout",
      "design",
    ],
    backend: [
      "api",
      "database",
      "endpoint",
      "server",
      "rest",
      "graphql",
      "query",
    ],
    documentation: [
      "document",
      "readme",
      "write",
      "explain",
      "guide",
      "tutorial",
    ],
    testing: [
      "test",
      "spec",
      "coverage",
      "mock",
      "assertion",
      "unit",
      "integration",
    ],
    automation: ["automate", "script", "cron", "schedule", "workflow", "batch"],
  };

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    if (keywords.some(kw => promptLower.includes(kw))) {
      return domain;
    }
  }

  return "general";
}

function extractCommonPatterns(prompts: string[]): string[] {
  const wordFreq: Map<string, number> = new Map();

  for (const prompt of prompts) {
    const words = prompt
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4);
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  return Array.from(wordFreq.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

export async function shouldProposeNewAgentType(
  patterns: TaskPattern[]
): Promise<{ propose: boolean; domain?: string; rationale?: string }> {
  const significantPatterns = patterns.filter(
    p => p.frequency >= 5 && !EXISTING_AGENT_TYPES.includes(p.domain)
  );

  if (significantPatterns.length === 0) {
    return {
      propose: false,
      rationale: "No significant uncovered patterns detected",
    };
  }

  const topPattern = significantPatterns[0];

  return {
    propose: true,
    domain: topPattern.domain,
    rationale: `Pattern "${topPattern.domain}" appears ${topPattern.frequency} times with ${topPattern.averageSuccessRate.toFixed(0)}% success rate. Tools: ${topPattern.toolsUsed.slice(0, 5).join(", ")}`,
  };
}

export async function generateAgentType(
  patterns: TaskPattern[]
): Promise<GeneratedAgentType | null> {
  const patternSummary = patterns
    .slice(0, 5)
    .map(
      p =>
        `- ${p.domain}: ${p.frequency} tasks, ${p.averageSuccessRate.toFixed(0)}% success, tools: ${p.toolsUsed.slice(0, 5).join(", ")}`
    )
    .join("\n");

  const response = await invokeLLM({
    messages: [
      { role: "system", content: AGENT_TYPE_GENERATION_PROMPT },
      {
        role: "user",
        content: `Analyze these task patterns and propose a new agent type if warranted:\n\n${patternSummary}`,
      },
    ],
    maxTokens: 1500,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return null;
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return null;
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!parsed.shouldCreate) {
    return null;
  }

  return {
    typeName: parsed.typeName,
    displayName: parsed.displayName,
    systemPrompt: parsed.systemPrompt,
    capabilities: parsed.capabilities,
    toolRestrictions: parsed.toolRestrictions,
    triggerPatterns: parsed.triggerPatterns || [],
    proposedReason: parsed.proposedReason,
  };
}

export async function registerAgentType(
  agentType: GeneratedAgentType,
  userId: number
): Promise<{ success: boolean; typeId?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const existing = await db.execute(sql`
      SELECT id FROM dynamic_agent_types
      WHERE type_name = ${agentType.typeName} AND is_active = 1
      LIMIT 1
    `);

    if (Array.isArray(existing[0]) && (existing[0] as unknown[]).length > 0) {
      return {
        success: false,
        error: `Agent type "${agentType.typeName}" already exists`,
      };
    }

    const result = await db.execute(sql`
      INSERT INTO dynamic_agent_types
        (user_id, type_name, display_name, system_prompt, capabilities, tool_restrictions, proposed_reason, trigger_patterns, is_active, usage_count)
      VALUES
        (${userId}, ${agentType.typeName}, ${agentType.displayName}, ${agentType.systemPrompt},
         ${JSON.stringify(agentType.capabilities)}, ${JSON.stringify(agentType.toolRestrictions || {})},
         ${agentType.proposedReason}, ${JSON.stringify(agentType.triggerPatterns)}, 1, 0)
    `);

    const insertId = (result[0] as { insertId?: number }).insertId || 0;

    addToRuntimeRegistry(agentType);

    return { success: true, typeId: insertId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const runtimeAgentTypes: Map<string, GeneratedAgentType> = new Map();

function addToRuntimeRegistry(agentType: GeneratedAgentType): void {
  runtimeAgentTypes.set(agentType.typeName, agentType);
}

export function getDynamicAgentType(
  typeName: string
): GeneratedAgentType | undefined {
  return runtimeAgentTypes.get(typeName);
}

export function getDynamicAgentTypes(): GeneratedAgentType[] {
  return Array.from(runtimeAgentTypes.values());
}

export function isDynamicAgentType(typeName: string): boolean {
  return runtimeAgentTypes.has(typeName);
}

export async function loadDynamicAgentTypesFromDatabase(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.execute(sql`
      SELECT type_name, display_name, system_prompt, capabilities, tool_restrictions, trigger_patterns, proposed_reason
      FROM dynamic_agent_types
      WHERE is_active = 1
    `);

    const rows = result[0] as unknown as Array<{
      type_name: string;
      display_name: string;
      system_prompt: string;
      capabilities: string | AgentCapabilities;
      tool_restrictions: string | Record<string, string[]>;
      trigger_patterns: string | string[];
      proposed_reason: string;
    }>;

    if (!Array.isArray(rows)) return 0;

    for (const row of rows) {
      const agentType: GeneratedAgentType = {
        typeName: row.type_name,
        displayName: row.display_name,
        systemPrompt: row.system_prompt,
        capabilities:
          typeof row.capabilities === "string"
            ? JSON.parse(row.capabilities)
            : row.capabilities,
        toolRestrictions:
          typeof row.tool_restrictions === "string"
            ? JSON.parse(row.tool_restrictions)
            : row.tool_restrictions,
        triggerPatterns:
          typeof row.trigger_patterns === "string"
            ? JSON.parse(row.trigger_patterns)
            : row.trigger_patterns || [],
        proposedReason: row.proposed_reason,
      };
      addToRuntimeRegistry(agentType);
    }

    return rows.length;
  } catch {
    return 0;
  }
}

export async function listDynamicAgentTypes(userId?: number): Promise<
  Array<{
    typeName: string;
    displayName: string;
    usageCount: number;
    successRate: number | null;
    createdAt: Date | null;
  }>
> {
  const db = await getDb();
  if (!db) return [];

  try {
    const query = userId
      ? sql`SELECT type_name, display_name, usage_count, success_rate, created_at FROM dynamic_agent_types WHERE user_id = ${userId} AND is_active = 1`
      : sql`SELECT type_name, display_name, usage_count, success_rate, created_at FROM dynamic_agent_types WHERE is_active = 1`;

    const result = await db.execute(query);
    const rows = result[0] as unknown as Array<{
      type_name: string;
      display_name: string;
      usage_count: number;
      success_rate: string | null;
      created_at: Date | null;
    }>;

    if (!Array.isArray(rows)) return [];

    return rows.map(r => ({
      typeName: r.type_name,
      displayName: r.display_name,
      usageCount: r.usage_count || 0,
      successRate: r.success_rate ? parseFloat(r.success_rate) : null,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function deactivateDynamicAgentType(
  typeName: string,
  userId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.execute(sql`
      UPDATE dynamic_agent_types
      SET is_active = 0
      WHERE type_name = ${typeName} AND user_id = ${userId}
    `);

    runtimeAgentTypes.delete(typeName);
    return true;
  } catch {
    return false;
  }
}
