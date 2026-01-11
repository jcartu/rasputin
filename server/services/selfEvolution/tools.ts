import { initializeCodeMap, getCodeMap } from "./codeMap";
import {
  initializeCapabilityRegistry,
  getCapabilityRegistry,
} from "./capabilityRegistry";
import {
  initializeSelfModificationPipeline,
  getSelfModificationPipeline,
} from "./selfModification";
import {
  initializeSkillAcquisitionEngine,
  getSkillAcquisitionEngine,
} from "./skillAcquisition";
import {
  initializeIntrospectionAPI,
  getIntrospectionAPI,
} from "./introspection";
import {
  generateToolFromDescription,
  validateGeneratedTool,
  testGeneratedTool,
  registerDynamicTool,
  listDynamicTools,
  deactivateDynamicTool,
} from "./toolGenerator";
import {
  analyzeTaskPatterns,
  shouldProposeNewAgentType,
  generateAgentType,
  registerAgentType,
  listDynamicAgentTypes,
  deactivateDynamicAgentType,
} from "./agentTypeGenerator";

const RASPUTIN_PROJECT_PATH =
  process.env.RASPUTIN_PROJECT_PATH || "/home/josh/rasputin";

let initialized = false;

export async function initializeSelfEvolution(userId: number): Promise<string> {
  try {
    await initializeCodeMap(RASPUTIN_PROJECT_PATH, userId);
    await initializeCapabilityRegistry(userId);
    await initializeSelfModificationPipeline(RASPUTIN_PROJECT_PATH, userId);
    await initializeSkillAcquisitionEngine(userId);
    await initializeIntrospectionAPI(userId, RASPUTIN_PROJECT_PATH);

    initialized = true;
    return "Self-evolution system initialized successfully";
  } catch (error) {
    return `Failed to initialize self-evolution: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const INDEX_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let lastIndexTime: number | null = null;
let lastIndexStats: {
  totalFiles: number;
  totalSymbols: number;
  languages: Record<string, number>;
  lastIndexed: Date | null;
} | null = null;

export async function indexMyCode(forceReindex = false): Promise<string> {
  try {
    const codeMap = getCodeMap(RASPUTIN_PROJECT_PATH);

    if (!forceReindex && lastIndexTime && lastIndexStats) {
      const timeSinceLastIndex = Date.now() - lastIndexTime;
      if (timeSinceLastIndex < INDEX_CACHE_TTL_MS) {
        const minutesAgo = Math.round(timeSinceLastIndex / 60000);
        return `Codebase already indexed (${minutesAgo} minutes ago):
- Files: ${lastIndexStats.totalFiles}
- Symbols: ${lastIndexStats.totalSymbols}
- Languages: ${Object.entries(lastIndexStats.languages)
          .map(([lang, count]) => `${lang}: ${count}`)
          .join(", ")}
- Last indexed: ${lastIndexStats.lastIndexed?.toISOString() || "recently"}
(Use force_reindex=true to re-index)`;
      }
    }

    const stats = await codeMap.indexCodebase();
    lastIndexTime = Date.now();
    lastIndexStats = stats;

    return `Codebase indexed successfully:
- Files: ${stats.totalFiles}
- Symbols: ${stats.totalSymbols}
- Languages: ${Object.entries(stats.languages)
      .map(([lang, count]) => `${lang}: ${count}`)
      .join(", ")}
- Last indexed: ${stats.lastIndexed?.toISOString() || "just now"}`;
  } catch (error) {
    return `Failed to index codebase: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function searchMyCode(query: string): Promise<string> {
  try {
    const codeMap = getCodeMap();
    const results = await codeMap.searchSymbols(query);

    if (results.length === 0) {
      return `No symbols found matching "${query}"`;
    }

    const formatted = results
      .slice(0, 20)
      .map(
        r =>
          `- ${r.name} (${r.type}) at ${r.filePath}:${r.startLine}${r.signature ? ` - ${r.signature}` : ""}`
      )
      .join("\n");

    return `Found ${results.length} symbols matching "${query}":\n${formatted}`;
  } catch (error) {
    return `Failed to search code: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function getSymbolDetails(symbolName: string): Promise<string> {
  try {
    const codeMap = getCodeMap();
    const symbol = await codeMap.getSymbolByName(symbolName);

    if (!symbol) {
      return `Symbol "${symbolName}" not found`;
    }

    return `Symbol: ${symbol.name}
Type: ${symbol.type}
File: ${symbol.filePath}
Lines: ${symbol.startLine} - ${symbol.endLine}
Exported: ${symbol.isExported ? "Yes" : "No"}
${symbol.signature ? `Signature: ${symbol.signature}` : ""}
${symbol.docstring ? `Documentation: ${symbol.docstring}` : ""}`;
  } catch (error) {
    return `Failed to get symbol details: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function whatCanIDo(): Promise<string> {
  try {
    const api = getIntrospectionAPI();
    return await api.whatCanIDo();
  } catch (error) {
    return `Failed to list capabilities: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function whatDoIKnow(topic: string): Promise<string> {
  try {
    const api = getIntrospectionAPI();
    return await api.whatDoIKnowAbout(topic);
  } catch (error) {
    return `Failed to search knowledge: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function howAmIDoing(): Promise<string> {
  try {
    const api = getIntrospectionAPI();
    const report = await api.howAmIDoing();

    return `# Self-Reflection Report

## Code Map Status
- Files indexed: ${report.codeMapStatus.totalFiles}
- Symbols: ${report.codeMapStatus.totalSymbols}
- Last indexed: ${report.codeMapStatus.lastIndexed?.toISOString() || "Never"}

## Capabilities
- Total: ${report.capabilities.total}
- Top used: ${report.capabilities.topUsed.map(c => c.name).join(", ") || "None"}
- Low confidence: ${report.capabilities.recentlyFailed.length}

## Gaps Identified: ${report.gaps.length}
${
  report.gaps
    .slice(0, 3)
    .map(g => `- ${g.description}`)
    .join("\n") || "None"
}

## Pending Modifications: ${report.pendingModifications.length}

## Recent Learnings
${
  report.recentLearnings
    .slice(0, 5)
    .map(l => `- ${l}`)
    .join("\n") || "None"
}

## Recommendations
${report.recommendations.map(r => `- ${r}`).join("\n") || "Everything looks good!"}`;
  } catch (error) {
    return `Failed to generate reflection: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function suggestImprovement(): Promise<string> {
  try {
    const api = getIntrospectionAPI();
    return await api.suggestImprovement();
  } catch (error) {
    return `Failed to suggest improvements: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function comprehensiveIntrospection(): Promise<string> {
  const sections: string[] = [];

  try {
    const [statusReport, capabilitiesReport, skillsReport, memStats] =
      await Promise.all([
        howAmIDoing().catch(() => "Unable to get status"),
        whatCanIDo().catch(() => "Unable to list capabilities"),
        listMySkills().catch(() => "Unable to list skills"),
        getMemoryStatsForIntrospection().catch(
          () => "Unable to get memory stats"
        ),
      ]);

    sections.push("# Comprehensive Self-Assessment\n");
    sections.push("## Status Report");
    sections.push(statusReport);
    sections.push("\n## Capabilities Summary");
    sections.push(capabilitiesReport);
    sections.push("\n## Active Skills");
    sections.push(skillsReport);
    sections.push("\n## Memory Statistics");
    sections.push(memStats);

    return sections.join("\n");
  } catch (error) {
    return `Failed comprehensive introspection: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function getMemoryStatsForIntrospection(): Promise<string> {
  try {
    const { getMemoryService } = await import("../memory");
    const memoryService = getMemoryService();
    const stats = await memoryService.getStats(1);
    return `- Episodic memories: ${(stats as { episodic?: number }).episodic || 0}
- Semantic memories: ${(stats as { semantic?: number }).semantic || 0}
- Procedural memories: ${(stats as { procedural?: number }).procedural || 0}`;
  } catch {
    return "Memory service not available";
  }
}

export async function detectCapabilityGap(
  failedQuery: string,
  context: string
): Promise<string> {
  try {
    const engine = getSkillAcquisitionEngine();
    const gap = await engine.detectGap(failedQuery, context);

    if (!gap) {
      return "No capability gap detected - I should be able to handle this";
    }

    return `Capability gap detected:
- Description: ${gap.description}
- Priority: ${gap.priority}
- Status: ${gap.status}
- Context: ${gap.context}`;
  } catch (error) {
    return `Failed to detect gap: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function proposeNewSkill(gapDescription: string): Promise<string> {
  try {
    const engine = getSkillAcquisitionEngine();
    const registry = getCapabilityRegistry();

    const gap = await registry.recordGap(
      gapDescription,
      "User requested skill acquisition",
      "medium"
    );
    const skill = await engine.proposeSkill(gap);

    if (!skill) {
      return "Failed to propose a skill for this gap";
    }

    return `Proposed new skill:
- ID: ${skill.id}
- Name: ${skill.name}
- Description: ${skill.description}
- Trigger patterns: ${skill.triggerPatterns.join(", ")}
- Status: ${skill.status}

Implementation type: ${skill.implementation.type}
${skill.implementation.steps ? `Steps:\n${skill.implementation.steps.map(s => `  ${s.order}. ${s.action}`).join("\n")}` : ""}

To register this skill, use learn_skill("${skill.id}")`;
  } catch (error) {
    return `Failed to propose skill: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function learnSkill(
  name: string,
  description: string,
  _triggerPatterns: string[]
): Promise<string> {
  try {
    const engine = getSkillAcquisitionEngine();

    const skill = await engine.learnFromProcedure(name, description, [
      { order: 1, action: "Parse user request" },
      { order: 2, action: "Execute appropriate action" },
      { order: 3, action: "Return result" },
    ]);

    if (!skill) {
      return "Failed to learn skill";
    }

    return `Skill learned successfully:
- ID: ${skill.id}
- Name: ${skill.name}
- Status: ${skill.status}
- Trigger patterns: ${skill.triggerPatterns.join(", ")}`;
  } catch (error) {
    return `Failed to learn skill: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function listMySkills(): Promise<string> {
  try {
    const engine = getSkillAcquisitionEngine();
    const skills = engine.getActiveSkills();

    if (skills.length === 0) {
      return "No active skills registered";
    }

    const formatted = skills
      .map(
        s =>
          `- **${s.name}** (v${s.version})\n  ${s.description}\n  Triggers: ${s.triggerPatterns.join(", ")}`
      )
      .join("\n\n");

    return `## Active Skills (${skills.length})\n\n${formatted}`;
  } catch (error) {
    return `Failed to list skills: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function proposeCodeChange(
  target: string,
  description: string,
  rationale: string
): Promise<string> {
  try {
    const pipeline = getSelfModificationPipeline();

    const spec = await pipeline.createModificationSpec(
      "code_patch",
      target,
      description,
      rationale,
      []
    );

    return `Code change proposed:
- ID: ${spec.id}
- Target: ${spec.target}
- Description: ${spec.description}
- Status: ${spec.status}

Test plan:
${spec.testPlan.map(t => `- ${t}`).join("\n")}

Rollback plan:
${spec.rollbackPlan}

To validate, use: validate_change("${spec.id}")`;
  } catch (error) {
    return `Failed to propose change: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function validateCodeChange(specId: string): Promise<string> {
  try {
    const pipeline = getSelfModificationPipeline();
    const result = await pipeline.validateSpec(specId);

    if (result.valid) {
      return `Change ${specId} validated successfully. Ready for approval.
Use approve_change("${specId}") to approve.`;
    }

    return `Change ${specId} validation failed:
${result.errors.map(e => `- ${e}`).join("\n")}`;
  } catch (error) {
    return `Failed to validate change: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function approveCodeChange(specId: string): Promise<string> {
  try {
    const pipeline = getSelfModificationPipeline();
    const approved = await pipeline.approveSpec(specId);

    if (approved) {
      return `Change ${specId} approved. Ready to apply.
Use apply_change("${specId}") to apply.`;
    }

    return `Failed to approve change ${specId}. It may not be in pending_review status.`;
  } catch (error) {
    return `Failed to approve change: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function applyCodeChange(specId: string): Promise<string> {
  try {
    const pipeline = getSelfModificationPipeline();
    const result = await pipeline.applyChanges(specId);

    if (result.success) {
      return `Change ${specId} applied successfully!
Use promote_change("${specId}") to merge to main branch.`;
    }

    return `Failed to apply change ${specId}: ${result.error}`;
  } catch (error) {
    return `Failed to apply change: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function getModificationHistory(): Promise<string> {
  try {
    const pipeline = getSelfModificationPipeline();
    const history = await pipeline.getModificationHistory(10);

    if (history.length === 0) {
      return "No modification history";
    }

    const formatted = history
      .map(
        h =>
          `- [${h.success ? "✓" : "✗"}] ${h.type}: ${h.description} (${h.target}) - ${h.createdAt.toISOString()}`
      )
      .join("\n");

    return `## Recent Modifications\n\n${formatted}`;
  } catch (error) {
    return `Failed to get history: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function getSelfEvolutionTools(): Array<{
  name: string;
  description: string;
  parameters: Record<
    string,
    { type: string; description: string; required?: boolean }
  >;
}> {
  return [
    {
      name: "self_init",
      description:
        "Initialize the self-evolution system. Run this first before using other self-* tools.",
      parameters: {},
    },
    {
      name: "self_index_code",
      description:
        "Index my own codebase to understand my structure. Creates a searchable map of all functions, classes, and types.",
      parameters: {},
    },
    {
      name: "self_search_code",
      description:
        "Search my own code for symbols (functions, classes, types) by name.",
      parameters: {
        query: {
          type: "string",
          description: "Search query for symbol names",
          required: true,
        },
      },
    },
    {
      name: "self_get_symbol",
      description:
        "Get detailed information about a specific symbol in my codebase.",
      parameters: {
        name: {
          type: "string",
          description: "Exact name of the symbol",
          required: true,
        },
      },
    },
    {
      name: "self_what_can_i_do",
      description:
        "List all my capabilities organized by category with confidence levels.",
      parameters: {},
    },
    {
      name: "self_what_do_i_know",
      description:
        "Search my knowledge about a specific topic across code, capabilities, and skills.",
      parameters: {
        topic: {
          type: "string",
          description: "Topic to search for",
          required: true,
        },
      },
    },
    {
      name: "self_how_am_i_doing",
      description:
        "Generate a self-reflection report including performance, capabilities, gaps, and recommendations.",
      parameters: {},
    },
    {
      name: "self_comprehensive_introspection",
      description:
        "PREFERRED: Get a complete self-assessment combining status, capabilities, skills, and memory stats in ONE call. Use this instead of calling self_how_am_i_doing, self_what_can_i_do, and self_list_skills separately.",
      parameters: {},
    },
    {
      name: "self_suggest_improvement",
      description:
        "Get suggestions for how I can improve based on my current state.",
      parameters: {},
    },
    {
      name: "self_detect_gap",
      description:
        "Analyze a failed task to identify capability gaps I should address.",
      parameters: {
        failedQuery: {
          type: "string",
          description: "The query/task that failed",
          required: true,
        },
        context: {
          type: "string",
          description: "Context about why it failed",
          required: true,
        },
      },
    },
    {
      name: "self_propose_skill",
      description:
        "Propose a new skill to learn based on an identified capability gap.",
      parameters: {
        gapDescription: {
          type: "string",
          description: "Description of the capability gap",
          required: true,
        },
      },
    },
    {
      name: "self_learn_skill",
      description:
        "Learn and register a new skill with the given name, description, and trigger patterns.",
      parameters: {
        name: {
          type: "string",
          description: "Name of the skill",
          required: true,
        },
        description: {
          type: "string",
          description: "What the skill does",
          required: true,
        },
        triggers: {
          type: "string",
          description: "Comma-separated trigger patterns",
          required: true,
        },
      },
    },
    {
      name: "self_list_skills",
      description: "List all my currently active learned skills.",
      parameters: {},
    },
    {
      name: "self_propose_change",
      description: "Propose a code change to myself with safety validations.",
      parameters: {
        target: {
          type: "string",
          description: "File or component to modify",
          required: true,
        },
        description: {
          type: "string",
          description: "What the change does",
          required: true,
        },
        rationale: {
          type: "string",
          description: "Why this change is needed",
          required: true,
        },
      },
    },
    {
      name: "self_validate_change",
      description: "Validate a proposed code change before applying.",
      parameters: {
        specId: {
          type: "string",
          description: "ID of the modification spec",
          required: true,
        },
      },
    },
    {
      name: "self_approve_change",
      description: "Approve a validated code change for application.",
      parameters: {
        specId: {
          type: "string",
          description: "ID of the modification spec",
          required: true,
        },
      },
    },
    {
      name: "self_apply_change",
      description: "Apply an approved code change in an isolated workspace.",
      parameters: {
        specId: {
          type: "string",
          description: "ID of the modification spec",
          required: true,
        },
      },
    },
    {
      name: "self_modification_history",
      description: "View history of all self-modifications I have made.",
      parameters: {},
    },
    {
      name: "self_generate_tool",
      description:
        "Generate a new tool from a natural language description. The tool will be validated and tested in a sandbox before being registered for use. This is how JARVIS can extend its own capabilities dynamically.",
      parameters: {
        description: {
          type: "string",
          description:
            "Natural language description of what the tool should do (e.g., 'check if a website is up and return the status code')",
          required: true,
        },
        exampleUsage: {
          type: "string",
          description:
            "Optional example of how the tool would be used (e.g., 'check_website_status(url=\"https://google.com\")')",
          required: false,
        },
      },
    },
    {
      name: "self_list_dynamic_tools",
      description:
        "List all dynamically generated tools that have been created.",
      parameters: {},
    },
    {
      name: "self_deactivate_tool",
      description: "Deactivate a dynamically generated tool by name.",
      parameters: {
        toolName: {
          type: "string",
          description: "Name of the dynamic tool to deactivate",
          required: true,
        },
      },
    },
    {
      name: "self_analyze_task_patterns",
      description:
        "Analyze recent task history to identify patterns that might warrant a new specialized agent type.",
      parameters: {
        lookbackDays: {
          type: "number",
          description: "Number of days of task history to analyze (default: 7)",
          required: false,
        },
      },
    },
    {
      name: "self_propose_agent_type",
      description:
        "Analyze task patterns and propose a new specialized agent type if warranted. This creates a new kind of agent with specific capabilities and domain expertise.",
      parameters: {
        lookbackDays: {
          type: "number",
          description: "Number of days of task history to analyze (default: 7)",
          required: false,
        },
      },
    },
    {
      name: "self_list_agent_types",
      description: "List all dynamically created agent types.",
      parameters: {},
    },
    {
      name: "self_deactivate_agent_type",
      description: "Deactivate a dynamically created agent type by name.",
      parameters: {
        typeName: {
          type: "string",
          description: "Name of the agent type to deactivate",
          required: true,
        },
      },
    },
  ];
}

export async function executeSelfEvolutionTool(
  name: string,
  input: Record<string, unknown>,
  userId: number
): Promise<string> {
  if (!initialized && name !== "self_init") {
    await initializeSelfEvolution(userId);
  }

  switch (name) {
    case "self_init":
      return initializeSelfEvolution(userId);
    case "self_index_code":
      return indexMyCode();
    case "self_search_code":
      return searchMyCode(input.query as string);
    case "self_get_symbol":
      return getSymbolDetails(input.name as string);
    case "self_what_can_i_do":
      return whatCanIDo();
    case "self_what_do_i_know":
      return whatDoIKnow(input.topic as string);
    case "self_how_am_i_doing":
      return howAmIDoing();
    case "self_comprehensive_introspection":
      return comprehensiveIntrospection();
    case "self_suggest_improvement":
      return suggestImprovement();
    case "self_detect_gap":
      return detectCapabilityGap(
        input.failedQuery as string,
        input.context as string
      );
    case "self_propose_skill":
      return proposeNewSkill(input.gapDescription as string);
    case "self_learn_skill":
      return learnSkill(
        input.name as string,
        input.description as string,
        (input.triggers as string).split(",").map(t => t.trim())
      );
    case "self_list_skills":
      return listMySkills();
    case "self_propose_change":
      return proposeCodeChange(
        input.target as string,
        input.description as string,
        input.rationale as string
      );
    case "self_validate_change":
      return validateCodeChange(input.specId as string);
    case "self_approve_change":
      return approveCodeChange(input.specId as string);
    case "self_apply_change":
      return applyCodeChange(input.specId as string);
    case "self_modification_history":
      return getModificationHistory();
    case "self_generate_tool":
      return generateNewTool(
        input.description as string,
        input.exampleUsage as string | undefined,
        userId
      );
    case "self_list_dynamic_tools":
      return listMyDynamicTools(userId);
    case "self_deactivate_tool":
      return deactivateMyTool(input.toolName as string, userId);
    case "self_analyze_task_patterns":
      return analyzeMyTaskPatterns(
        userId,
        input.lookbackDays as number | undefined
      );
    case "self_propose_agent_type":
      return proposeNewAgentType(
        userId,
        input.lookbackDays as number | undefined
      );
    case "self_list_agent_types":
      return listMyAgentTypes(userId);
    case "self_deactivate_agent_type":
      return deactivateMyAgentType(input.typeName as string, userId);
    default:
      return `Unknown self-evolution tool: ${name}`;
  }
}

async function generateNewTool(
  description: string,
  exampleUsage: string | undefined,
  userId: number
): Promise<string> {
  try {
    const tool = await generateToolFromDescription(description, exampleUsage);

    const validation = validateGeneratedTool(tool);
    if (!validation.valid) {
      return `Tool generation failed validation:\n${validation.errors.join("\n")}`;
    }

    const testResult = await testGeneratedTool(tool);
    if (!testResult.success) {
      return `Tool generated but failed testing:\n${testResult.error}`;
    }

    const registration = await registerDynamicTool(tool, userId);
    if (!registration.success) {
      return `Tool generated and tested but failed to register:\n${registration.error}`;
    }

    let result = `Tool "${tool.name}" successfully created and registered!\n\n`;
    result += `**Description**: ${tool.description}\n`;
    result += `**Parameters**:\n`;
    for (const [paramName, param] of Object.entries(tool.parameters)) {
      result += `  - ${paramName} (${param.type}${param.required ? ", required" : ""}): ${param.description}\n`;
    }
    result += `\n**Test Result**: ${testResult.output?.substring(0, 200) || "Passed"}\n`;

    if (validation.warnings.length > 0) {
      result += `\n**Warnings**:\n${validation.warnings.map(w => `  - ${w}`).join("\n")}`;
    }

    result += `\nThe tool is now available and can be used immediately.`;

    return result;
  } catch (error) {
    return `Failed to generate tool: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function listMyDynamicTools(userId: number): Promise<string> {
  try {
    const tools = await listDynamicTools(userId);

    if (tools.length === 0) {
      return "No dynamic tools have been created yet. Use self_generate_tool to create new tools.";
    }

    let result = `## Dynamic Tools (${tools.length})\n\n`;
    for (const tool of tools) {
      result += `- **${tool.name}**: ${tool.description}\n`;
      result += `  Used: ${tool.usageCount} times | Created: ${tool.createdAt?.toLocaleDateString() || "unknown"}\n\n`;
    }

    return result;
  } catch (error) {
    return `Failed to list dynamic tools: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function deactivateMyTool(
  toolName: string,
  userId: number
): Promise<string> {
  try {
    const success = await deactivateDynamicTool(toolName, userId);
    if (success) {
      return `Tool "${toolName}" has been deactivated and is no longer available.`;
    }
    return `Failed to deactivate tool "${toolName}". It may not exist or you may not have permission.`;
  } catch (error) {
    return `Error deactivating tool: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function analyzeMyTaskPatterns(
  userId: number,
  lookbackDays?: number
): Promise<string> {
  try {
    const patterns = await analyzeTaskPatterns(userId, lookbackDays || 7);

    if (patterns.length === 0) {
      return "No significant task patterns found in the specified time period.";
    }

    let result = `## Task Pattern Analysis (last ${lookbackDays || 7} days)\n\n`;
    for (const pattern of patterns) {
      result += `### ${pattern.domain}\n`;
      result += `- Frequency: ${pattern.frequency} tasks\n`;
      result += `- Success Rate: ${pattern.averageSuccessRate.toFixed(0)}%\n`;
      result += `- Tools Used: ${pattern.toolsUsed.slice(0, 5).join(", ")}\n`;
      result += `- Common Terms: ${pattern.commonPromptPatterns.slice(0, 5).join(", ")}\n\n`;
    }

    return result;
  } catch (error) {
    return `Failed to analyze patterns: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function proposeNewAgentType(
  userId: number,
  lookbackDays?: number
): Promise<string> {
  try {
    const patterns = await analyzeTaskPatterns(userId, lookbackDays || 7);

    if (patterns.length === 0) {
      return "No task patterns found. Run more tasks before proposing new agent types.";
    }

    const proposal = await shouldProposeNewAgentType(patterns);

    if (!proposal.propose) {
      return `No new agent type needed at this time.\nReason: ${proposal.rationale}`;
    }

    const generatedType = await generateAgentType(patterns);

    if (!generatedType) {
      return "Pattern analysis suggested a new agent type, but generation failed.";
    }

    const registration = await registerAgentType(generatedType, userId);

    if (!registration.success) {
      return `Agent type generated but failed to register: ${registration.error}`;
    }

    let result = `New agent type "${generatedType.displayName}" created!\n\n`;
    result += `**Type Name**: ${generatedType.typeName}\n`;
    result += `**System Prompt**: ${generatedType.systemPrompt.substring(0, 200)}...\n`;
    result += `**Capabilities**:\n`;
    for (const [cap, enabled] of Object.entries(generatedType.capabilities)) {
      if (enabled) result += `  - ${cap}\n`;
    }
    result += `\n**Reason**: ${generatedType.proposedReason}\n`;
    result += `\nThis agent type is now available for use.`;

    return result;
  } catch (error) {
    return `Failed to propose agent type: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function listMyAgentTypes(userId: number): Promise<string> {
  try {
    const types = await listDynamicAgentTypes(userId);

    if (types.length === 0) {
      return "No dynamic agent types have been created yet. Use self_propose_agent_type to create new agent types based on your task patterns.";
    }

    let result = `## Dynamic Agent Types (${types.length})\n\n`;
    for (const type of types) {
      result += `- **${type.displayName}** (${type.typeName})\n`;
      result += `  Used: ${type.usageCount} times | Success: ${type.successRate?.toFixed(0) || "N/A"}% | Created: ${type.createdAt?.toLocaleDateString() || "unknown"}\n\n`;
    }

    return result;
  } catch (error) {
    return `Failed to list agent types: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function deactivateMyAgentType(
  typeName: string,
  userId: number
): Promise<string> {
  try {
    const success = await deactivateDynamicAgentType(typeName, userId);
    if (success) {
      return `Agent type "${typeName}" has been deactivated and is no longer available.`;
    }
    return `Failed to deactivate agent type "${typeName}". It may not exist or you may not have permission.`;
  } catch (error) {
    return `Error deactivating agent type: ${error instanceof Error ? error.message : String(error)}`;
  }
}
