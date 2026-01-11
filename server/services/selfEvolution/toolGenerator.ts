/**
 * Tool Generator - Creates new tools from natural language descriptions
 * Generates tool schemas and implementations, validates them, and registers for use.
 */

import { invokeLLM } from "../../_core/llm";
import { getDb } from "../../db";
import { eq, and, sql } from "drizzle-orm";
import * as vm from "vm";

interface ToolParameter {
  type: string;
  description: string;
  required?: boolean;
  items?: { type: string };
}

export interface GeneratedTool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  implementation: string;
  testCases: Array<{
    input: Record<string, unknown>;
    expectedPattern: string;
  }>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface TestResult {
  success: boolean;
  output?: string;
  error?: string;
}

const FORBIDDEN_PATTERNS = [
  /process\.exit/i,
  /require\s*\(\s*['"]child_process['"]\s*\)/i,
  /require\s*\(\s*['"]fs['"]\s*\)/i,
  /eval\s*\(/i,
  /Function\s*\(/i,
  /\.env/i,
  /process\.env/i,
  /globalThis/i,
  /__dirname/i,
  /__filename/i,
];

const TOOL_GENERATION_PROMPT = `You are a tool generator for JARVIS, an AI agent system.

Given a natural language description, generate a tool definition in JSON format.

REQUIREMENTS:
1. Tool name should be snake_case, descriptive, and unique
2. Description should be clear and actionable
3. Parameters should have proper types (string, number, boolean, array, object)
4. Implementation must be a pure async function body (no require/import)
5. Implementation can use: fetch, JSON, Math, Date, String, Array, Object, console
6. Implementation must return a string result
7. Generate 1-2 test cases with input and expected output pattern

AVAILABLE UTILITIES IN IMPLEMENTATION:
- fetch(url, options) - HTTP requests
- JSON.parse/stringify - JSON handling
- new Date() - Date operations
- Math.* - Math operations

OUTPUT FORMAT (strict JSON):
{
  "name": "tool_name",
  "description": "What this tool does",
  "parameters": {
    "param1": {
      "type": "string",
      "description": "What this param is",
      "required": true
    }
  },
  "implementation": "const result = await fetch(input.url); return result.ok ? 'Success' : 'Failed';",
  "testCases": [
    {
      "input": { "url": "https://example.com" },
      "expectedPattern": "Success|Failed"
    }
  ]
}

IMPORTANT:
- DO NOT use require() or import
- DO NOT access file system
- DO NOT access environment variables
- DO NOT use eval or Function constructor
- Keep implementation simple and focused
- Always handle errors gracefully`;

export async function generateToolFromDescription(
  description: string,
  exampleUsage?: string
): Promise<GeneratedTool> {
  const userPrompt = exampleUsage
    ? `Create a tool that: ${description}\n\nExample usage: ${exampleUsage}`
    : `Create a tool that: ${description}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: TOOL_GENERATION_PROMPT },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 2000,
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Failed to get response from LLM");
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse tool definition from LLM response");
  }

  const tool = JSON.parse(jsonMatch[0]) as GeneratedTool;

  if (!tool.name || typeof tool.name !== "string") {
    throw new Error("Generated tool missing valid name");
  }
  if (!tool.description || typeof tool.description !== "string") {
    throw new Error("Generated tool missing valid description");
  }
  if (!tool.parameters || typeof tool.parameters !== "object") {
    throw new Error("Generated tool missing valid parameters");
  }
  if (!tool.implementation || typeof tool.implementation !== "string") {
    throw new Error("Generated tool missing valid implementation");
  }

  tool.name = tool.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

  return tool;
}

export function validateGeneratedTool(tool: GeneratedTool): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
    errors.push(`Invalid tool name: ${tool.name}. Must be snake_case.`);
  }

  if (tool.name.length < 3 || tool.name.length > 50) {
    errors.push(
      `Tool name must be between 3-50 characters, got ${tool.name.length}`
    );
  }

  if (tool.description.length < 10) {
    warnings.push("Description is very short, consider adding more detail");
  }

  const paramCount = Object.keys(tool.parameters).length;
  if (paramCount === 0) {
    warnings.push("Tool has no parameters - is this intentional?");
  }
  if (paramCount > 10) {
    errors.push(`Too many parameters (${paramCount}). Maximum is 10.`);
  }

  for (const [paramName, param] of Object.entries(tool.parameters)) {
    if (
      !["string", "number", "boolean", "array", "object"].includes(param.type)
    ) {
      errors.push(`Invalid parameter type for ${paramName}: ${param.type}`);
    }
    if (!param.description) {
      warnings.push(`Parameter ${paramName} has no description`);
    }
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(tool.implementation)) {
      errors.push(`Forbidden pattern detected: ${pattern.source}`);
    }
  }

  try {
    new Function("input", `return (async () => { ${tool.implementation} })()`);
  } catch (syntaxError) {
    errors.push(
      `Syntax error in implementation: ${syntaxError instanceof Error ? syntaxError.message : String(syntaxError)}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function testGeneratedTool(
  tool: GeneratedTool
): Promise<TestResult> {
  try {
    const wrappedCode = `
      (async function(input) {
        ${tool.implementation}
      })
    `;

    const context = {
      fetch: globalThis.fetch,
      JSON: globalThis.JSON,
      Math: globalThis.Math,
      Date: globalThis.Date,
      String: globalThis.String,
      Array: globalThis.Array,
      Object: globalThis.Object,
      console: {
        log: () => {},
        error: () => {},
        warn: () => {},
      },
      setTimeout: globalThis.setTimeout,
      AbortSignal: globalThis.AbortSignal,
    };

    const script = new vm.Script(wrappedCode);
    const vmContext = vm.createContext(context);
    const toolFn = script.runInContext(vmContext);

    if (tool.testCases && tool.testCases.length > 0) {
      const testCase = tool.testCases[0];

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Test timeout after 10s")), 10000);
      });

      const result = await Promise.race([
        toolFn(testCase.input),
        timeoutPromise,
      ]);

      const resultStr = String(result);
      const pattern = new RegExp(testCase.expectedPattern, "i");

      if (!pattern.test(resultStr)) {
        return {
          success: false,
          output: resultStr,
          error: `Output "${resultStr.substring(0, 100)}" did not match pattern "${testCase.expectedPattern}"`,
        };
      }

      return { success: true, output: resultStr };
    }

    const dryRunResult = await toolFn({});
    return {
      success: true,
      output: `Dry run completed: ${String(dryRunResult).substring(0, 100)}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function registerDynamicTool(
  tool: GeneratedTool,
  userId: number
): Promise<{ success: boolean; toolId?: number; error?: string }> {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  try {
    const existing = await db.execute(
      sql`SELECT id FROM dynamic_tools WHERE name = ${tool.name} AND is_active = 1 LIMIT 1`
    );

    if (Array.isArray(existing[0]) && existing[0].length > 0) {
      return {
        success: false,
        error: `Tool "${tool.name}" already exists. Use a different name.`,
      };
    }

    const result = await db.execute(sql`
      INSERT INTO dynamic_tools (user_id, name, description, parameters, implementation, test_cases, is_active, usage_count)
      VALUES (${userId}, ${tool.name}, ${tool.description}, ${JSON.stringify(tool.parameters)}, ${tool.implementation}, ${JSON.stringify(tool.testCases || [])}, 1, 0)
    `);

    const insertId = (result[0] as { insertId?: number }).insertId || 0;

    addToRuntimeRegistry(tool);

    return { success: true, toolId: insertId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function loadDynamicToolsFromDatabase(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.execute(
      sql`SELECT name, description, parameters, implementation, test_cases FROM dynamic_tools WHERE is_active = 1`
    );

    const rows = result[0] as unknown as Array<{
      name: string;
      description: string;
      parameters: string | Record<string, ToolParameter>;
      implementation: string;
      test_cases: string | GeneratedTool["testCases"];
    }>;

    if (!Array.isArray(rows)) return 0;

    for (const row of rows) {
      const tool: GeneratedTool = {
        name: row.name,
        description: row.description,
        parameters:
          typeof row.parameters === "string"
            ? JSON.parse(row.parameters)
            : row.parameters,
        implementation: row.implementation,
        testCases:
          typeof row.test_cases === "string"
            ? JSON.parse(row.test_cases)
            : row.test_cases || [],
      };
      addToRuntimeRegistry(tool);
    }

    return rows.length;
  } catch {
    return 0;
  }
}

export async function executeDynamicTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  const tool = runtimeRegistry.get(name);
  if (!tool) {
    return `Error: Dynamic tool "${name}" not found`;
  }

  try {
    const wrappedCode = `
      (async function(input) {
        ${tool.implementation}
      })
    `;

    const context = {
      fetch: globalThis.fetch,
      JSON: globalThis.JSON,
      Math: globalThis.Math,
      Date: globalThis.Date,
      String: globalThis.String,
      Array: globalThis.Array,
      Object: globalThis.Object,
      console: { log: () => {}, error: () => {}, warn: () => {} },
      setTimeout: globalThis.setTimeout,
      AbortSignal: globalThis.AbortSignal,
    };

    const script = new vm.Script(wrappedCode);
    const vmContext = vm.createContext(context);
    const toolFn = script.runInContext(vmContext);

    const result = await toolFn(input);

    incrementUsageCount(name);

    return String(result);
  } catch (error) {
    return `Error executing tool: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const runtimeRegistry: Map<string, GeneratedTool> = new Map();

function addToRuntimeRegistry(tool: GeneratedTool): void {
  runtimeRegistry.set(tool.name, tool);
}

export function getDynamicTools(): GeneratedTool[] {
  return Array.from(runtimeRegistry.values());
}

export function isDynamicTool(name: string): boolean {
  return runtimeRegistry.has(name);
}

async function incrementUsageCount(name: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execute(
      sql`UPDATE dynamic_tools SET usage_count = usage_count + 1, last_used_at = NOW() WHERE name = ${name} AND is_active = 1`
    );
  } catch {
    void 0;
  }
}

export async function deactivateDynamicTool(
  name: string,
  userId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.execute(
      sql`UPDATE dynamic_tools SET is_active = 0 WHERE name = ${name} AND user_id = ${userId}`
    );

    runtimeRegistry.delete(name);
    return true;
  } catch {
    return false;
  }
}

export async function listDynamicTools(userId?: number): Promise<
  Array<{
    name: string;
    description: string;
    usageCount: number;
    createdAt: Date | null;
  }>
> {
  const db = await getDb();
  if (!db) return [];

  try {
    const query = userId
      ? sql`SELECT name, description, usage_count, created_at FROM dynamic_tools WHERE user_id = ${userId} AND is_active = 1`
      : sql`SELECT name, description, usage_count, created_at FROM dynamic_tools WHERE is_active = 1`;

    const result = await db.execute(query);
    const rows = result[0] as unknown as Array<{
      name: string;
      description: string;
      usage_count: number;
      created_at: Date | null;
    }>;

    if (!Array.isArray(rows)) return [];

    return rows.map(t => ({
      name: t.name,
      description: t.description,
      usageCount: t.usage_count || 0,
      createdAt: t.created_at,
    }));
  } catch {
    return [];
  }
}
