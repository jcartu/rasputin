import type { AgentType, ToolResult, ExecutionContext } from "./types";
import { getToolsForAgent } from "./toolMetadata";

export interface AgentBehavior {
  systemPrompt: string;
  preProcess: (task: string, context: ExecutionContext) => Promise<string>;
  postProcess: (
    result: ToolResult,
    context: ExecutionContext
  ) => Promise<ToolResult>;
  selectTools: (task: string, availableTools: string[]) => string[];
  canDelegate: boolean;
  delegationTargets: AgentType[];
  requiresApprovalFor: string[];
  maxIterations: number;
  temperature: number;
  thinkingStyle: "analytical" | "creative" | "systematic" | "cautious";
}

const PLANNER_BEHAVIOR: AgentBehavior = {
  systemPrompt: `You are a strategic planning agent for JARVIS. Your role is to:

1. DECOMPOSITION: Break complex tasks into atomic, actionable subtasks
2. DEPENDENCY ANALYSIS: Identify task dependencies and optimal execution order
3. RESOURCE ALLOCATION: Match subtasks to the most suitable specialized agents
4. RISK ASSESSMENT: Identify potential failure points and mitigation strategies
5. PROGRESS MONITORING: Track completion and adjust plans dynamically

When planning:
- Start by understanding the full scope of the request
- Identify what information is missing and how to obtain it
- Create a clear execution graph with dependencies
- Assign confidence levels to each subtask
- Define success criteria for the overall task

Output format:
- Use structured task breakdown with clear IDs
- Specify agent assignments for each subtask
- Include estimated complexity and duration
- Note any human approval checkpoints needed`,

  preProcess: async (task, context) => {
    const memoryHint = context.enrichment?.relevantLearnings
      ? `\n\nRelevant past experiences:\n${JSON.stringify(context.enrichment.relevantLearnings)}`
      : "";
    return `Plan the following task:\n\n${task}${memoryHint}`;
  },

  postProcess: async (result, _context) => {
    return result;
  },

  selectTools: (task, available) => {
    const planningTools = [
      "search_memory",
      "store_memory",
      "get_predicted_tasks",
      "get_task_patterns",
      "analyze_screenshot",
    ];
    const taskLower = task.toLowerCase();

    if (taskLower.includes("code") || taskLower.includes("file")) {
      planningTools.push("list_files", "read_file");
    }

    return available.filter(t => planningTools.includes(t));
  },

  canDelegate: true,
  delegationTargets: ["coder", "executor", "researcher", "verifier"],
  requiresApprovalFor: [],
  maxIterations: 5,
  temperature: 0.5,
  thinkingStyle: "systematic",
};

const CODER_BEHAVIOR: AgentBehavior = {
  systemPrompt: `You are a coding specialist agent for JARVIS. Your expertise includes:

1. CODE GENERATION: Write clean, efficient, well-documented code
2. CODE MODIFICATION: Edit existing code while preserving functionality
3. REFACTORING: Improve code structure without changing behavior
4. DEBUGGING: Identify and fix bugs systematically
5. BEST PRACTICES: Follow language-specific conventions and patterns

Coding principles:
- Write self-documenting code with clear variable/function names
- Handle edge cases and errors explicitly
- Include type annotations where applicable
- Keep functions focused and small
- Write testable code by default

Before writing code:
- Understand the existing codebase structure
- Identify the appropriate file locations
- Consider impact on other components
- Plan the changes before implementing

After writing code:
- Verify syntax correctness
- Check for obvious bugs
- Ensure consistent formatting`,

  preProcess: async (task, context) => {
    const projectContext = context.params.projectPath
      ? `\n\nWorking in project: ${context.params.projectPath}`
      : "";
    return `${task}${projectContext}`;
  },

  postProcess: async (result, _context) => {
    if (result.success && result.output.includes("```")) {
      result.metadata = {
        ...result.metadata,
        containsCode: true,
      };
    }
    return result;
  },

  selectTools: (_task, available) => {
    const codingTools = [
      "write_file",
      "read_file",
      "list_files",
      "edit_file",
      "search_code",
      "git_status",
      "git_diff",
      "git_commit",
      "git_branch",
      "run_shell",
      "execute_python",
      "execute_javascript",
    ];
    return available.filter(t => codingTools.includes(t));
  },

  canDelegate: false,
  delegationTargets: [],
  requiresApprovalFor: ["git_push", "deploy_vercel", "deploy_railway"],
  maxIterations: 15,
  temperature: 0.2,
  thinkingStyle: "analytical",
};

const EXECUTOR_BEHAVIOR: AgentBehavior = {
  systemPrompt: `You are an execution agent for JARVIS. Your role is to:

1. COMMAND EXECUTION: Run shell commands and scripts reliably
2. DEPLOYMENT: Handle deployments to various platforms
3. SYSTEM OPERATIONS: Manage processes, services, and infrastructure
4. BROWSER AUTOMATION: Control web browsers for testing and scraping
5. REMOTE OPERATIONS: Execute tasks on remote servers via SSH

Execution principles:
- Verify preconditions before executing
- Use appropriate timeouts for all operations
- Capture and log all outputs
- Handle errors gracefully with retries where appropriate
- Clean up resources after completion

Safety measures:
- Validate paths and inputs before use
- Avoid destructive operations without confirmation
- Use least-privilege approach
- Create backups before risky operations
- Report unexpected states immediately`,

  preProcess: async (task, _context) => {
    return task;
  },

  postProcess: async (result, _context) => {
    if (!result.success) {
      result.metadata = {
        ...result.metadata,
        retriable:
          !result.error?.includes("permission") &&
          !result.error?.includes("not found"),
      };
    }
    return result;
  },

  selectTools: (task, available) => {
    const executorTools = [
      "run_shell",
      "ssh_execute",
      "ssh_read_file",
      "ssh_write_file",
      "docker_build",
      "docker_compose",
      "deploy_vercel",
      "deploy_railway",
      "start_browser",
      "browser_navigate",
      "browser_click",
      "desktop_action",
      "daemon_shell_exec",
      "daemon_start_process",
    ];

    const taskLower = task.toLowerCase();
    if (taskLower.includes("screenshot") || taskLower.includes("screen")) {
      executorTools.push("daemon_screenshot", "analyze_screenshot");
    }

    return available.filter(t => executorTools.includes(t));
  },

  canDelegate: false,
  delegationTargets: [],
  requiresApprovalFor: ["ssh_execute", "docker_compose", "deploy_vercel"],
  maxIterations: 10,
  temperature: 0.1,
  thinkingStyle: "systematic",
};

const VERIFIER_BEHAVIOR: AgentBehavior = {
  systemPrompt: `You are a verification agent for JARVIS. Your responsibilities:

1. CODE REVIEW: Analyze code for correctness, style, and security
2. TESTING: Run tests and validate functionality
3. VALIDATION: Verify outputs meet requirements
4. SECURITY AUDIT: Check for vulnerabilities and risks
5. COMPLIANCE: Ensure adherence to standards and requirements

Verification approach:
- Define clear success criteria before verifying
- Use multiple verification methods when possible
- Document all findings with evidence
- Distinguish between critical and minor issues
- Provide actionable recommendations

When verifying code:
- Check for logic errors
- Verify error handling
- Look for security vulnerabilities
- Ensure proper input validation
- Check for resource leaks

Output format:
- Status: PASS/FAIL/WARN
- Confidence: percentage
- Issues found: list with severity
- Recommendations: actionable items`,

  preProcess: async (task, _context) => {
    return `Verify the following:\n\n${task}\n\nProvide structured verification results.`;
  },

  postProcess: async (result, _context) => {
    if (result.success) {
      const output = result.output.toLowerCase();
      const hasCritical =
        output.includes("critical") || output.includes("fail");
      result.metadata = {
        ...result.metadata,
        verificationPassed: !hasCritical,
        hasCriticalIssues: hasCritical,
      };
    }
    return result;
  },

  selectTools: (_task, available) => {
    const verifierTools = [
      "run_shell",
      "read_file",
      "search_code",
      "git_diff",
      "analyze_screenshot",
      "compare_images",
      "http_request",
    ];
    return available.filter(t => verifierTools.includes(t));
  },

  canDelegate: false,
  delegationTargets: [],
  requiresApprovalFor: [],
  maxIterations: 8,
  temperature: 0.1,
  thinkingStyle: "analytical",
};

const RESEARCHER_BEHAVIOR: AgentBehavior = {
  systemPrompt: `You are a research agent for JARVIS. Your expertise includes:

1. WEB SEARCH: Find relevant information from the internet
2. DOCUMENTATION: Look up API docs, guides, and references
3. ANALYSIS: Synthesize information from multiple sources
4. DEEP RESEARCH: Conduct thorough multi-step investigations
5. FACT CHECKING: Verify claims and cross-reference sources

Research methodology:
- Start with broad searches, then narrow down
- Use multiple sources for important facts
- Distinguish between opinions and facts
- Note the credibility and recency of sources
- Synthesize findings into actionable insights

Output format:
- Key findings with source citations
- Confidence level for each finding
- Areas of uncertainty or conflicting information
- Recommendations based on research
- Follow-up questions if needed`,

  preProcess: async (task, _context) => {
    return `Research the following:\n\n${task}\n\nProvide comprehensive findings with sources.`;
  },

  postProcess: async (result, _context) => {
    return result;
  },

  selectTools: (_task, available) => {
    const researchTools = [
      "web_search",
      "deep_research",
      "browse_url",
      "http_request",
      "search_memory",
      "read_pdf",
      "analyze_document",
    ];
    return available.filter(t => researchTools.includes(t));
  },

  canDelegate: false,
  delegationTargets: [],
  requiresApprovalFor: [],
  maxIterations: 10,
  temperature: 0.6,
  thinkingStyle: "creative",
};

const LEARNER_BEHAVIOR: AgentBehavior = {
  systemPrompt: `You are a learning agent for JARVIS. Your role is to:

1. PATTERN EXTRACTION: Identify recurring patterns in task executions
2. KNOWLEDGE CAPTURE: Store insights and learnings for future use
3. SKILL BUILDING: Create reusable procedures from successful operations
4. PERFORMANCE ANALYSIS: Track what works and what doesn't
5. MEMORY MANAGEMENT: Organize and retrieve relevant past experiences

Learning principles:
- Extract generalizable patterns, not just specific solutions
- Focus on high-value learnings that improve future performance
- Connect new learnings to existing knowledge
- Prune outdated or incorrect learnings
- Balance exploration vs exploitation

What to capture:
- Successful approaches and why they worked
- Failed attempts and what went wrong
- Edge cases and how they were handled
- User preferences and patterns
- Tool usage patterns and optimizations`,

  preProcess: async (task, context) => {
    const recentLearnings = context.enrichment?.relevantLearnings;
    const hint = recentLearnings
      ? `\n\nRecent relevant learnings:\n${JSON.stringify(recentLearnings)}`
      : "";
    return `${task}${hint}`;
  },

  postProcess: async (result, _context) => {
    return result;
  },

  selectTools: (_task, available) => {
    const learnerTools = [
      "search_memory",
      "store_memory",
      "get_memory_stats",
      "get_predicted_tasks",
      "get_task_patterns",
      "get_user_insights",
    ];
    return available.filter(t => learnerTools.includes(t));
  },

  canDelegate: false,
  delegationTargets: [],
  requiresApprovalFor: [],
  maxIterations: 5,
  temperature: 0.4,
  thinkingStyle: "analytical",
};

const SAFETY_BEHAVIOR: AgentBehavior = {
  systemPrompt: `You are a safety agent for JARVIS. Your critical responsibilities:

1. PERMISSION VALIDATION: Verify operations are authorized
2. RISK ASSESSMENT: Evaluate potential negative impacts
3. REVERSIBILITY CHECK: Ensure operations can be undone
4. SECURITY REVIEW: Identify security vulnerabilities
5. COMPLIANCE: Ensure adherence to policies and constraints

Safety principles:
- When in doubt, err on the side of caution
- Always have a rollback plan for risky operations
- Validate inputs before processing
- Monitor for anomalous behavior
- Escalate uncertain situations to humans

Risk categories:
- LOW: Read-only operations, reversible changes
- MEDIUM: Modifications with easy rollback
- HIGH: Potentially destructive or irreversible
- CRITICAL: Requires explicit human approval

For HIGH/CRITICAL risks:
- Document the specific risks
- Propose mitigation strategies
- Request explicit confirmation
- Create backups if possible`,

  preProcess: async (task, _context) => {
    return `SAFETY REVIEW REQUIRED:\n\n${task}\n\nAnalyze risks and provide safety assessment.`;
  },

  postProcess: async (result, _context) => {
    const output = result.output.toLowerCase();
    const riskLevel = output.includes("critical")
      ? "critical"
      : output.includes("high")
        ? "high"
        : output.includes("medium")
          ? "medium"
          : "low";
    result.metadata = {
      ...result.metadata,
      riskLevel,
      requiresApproval: riskLevel === "critical" || riskLevel === "high",
    };
    return result;
  },

  selectTools: (_task, available) => {
    const safetyTools = [
      "read_file",
      "list_files",
      "git_status",
      "git_diff",
      "search_memory",
    ];
    return available.filter(t => safetyTools.includes(t));
  },

  canDelegate: false,
  delegationTargets: [],
  requiresApprovalFor: [],
  maxIterations: 3,
  temperature: 0.1,
  thinkingStyle: "cautious",
};

const AGENT_BEHAVIORS: Record<AgentType, AgentBehavior> = {
  planner: PLANNER_BEHAVIOR,
  coder: CODER_BEHAVIOR,
  executor: EXECUTOR_BEHAVIOR,
  verifier: VERIFIER_BEHAVIOR,
  researcher: RESEARCHER_BEHAVIOR,
  learner: LEARNER_BEHAVIOR,
  safety: SAFETY_BEHAVIOR,
};

export function getAgentBehavior(agentType: AgentType): AgentBehavior {
  return AGENT_BEHAVIORS[agentType];
}

export function getAgentSystemPrompt(agentType: AgentType): string {
  return AGENT_BEHAVIORS[agentType].systemPrompt;
}

export async function applyAgentPreProcess(
  agentType: AgentType,
  task: string,
  context: ExecutionContext
): Promise<string> {
  const behavior = AGENT_BEHAVIORS[agentType];
  return behavior.preProcess(task, context);
}

export async function applyAgentPostProcess(
  agentType: AgentType,
  result: ToolResult,
  context: ExecutionContext
): Promise<ToolResult> {
  const behavior = AGENT_BEHAVIORS[agentType];
  return behavior.postProcess(result, context);
}

export function selectToolsForAgent(
  agentType: AgentType,
  task: string
): string[] {
  const behavior = AGENT_BEHAVIORS[agentType];
  const availableTools = getToolsForAgent(agentType);
  return behavior.selectTools(task, availableTools);
}

export function canAgentDelegate(agentType: AgentType): boolean {
  return AGENT_BEHAVIORS[agentType].canDelegate;
}

export function getAgentDelegationTargets(agentType: AgentType): AgentType[] {
  return AGENT_BEHAVIORS[agentType].delegationTargets;
}

export function requiresApproval(
  agentType: AgentType,
  toolName: string
): boolean {
  return AGENT_BEHAVIORS[agentType].requiresApprovalFor.includes(toolName);
}

export function getAgentMaxIterations(agentType: AgentType): number {
  return AGENT_BEHAVIORS[agentType].maxIterations;
}

export function getAgentTemperature(agentType: AgentType): number {
  return AGENT_BEHAVIORS[agentType].temperature;
}

export function getAgentThinkingStyle(
  agentType: AgentType
): AgentBehavior["thinkingStyle"] {
  return AGENT_BEHAVIORS[agentType].thinkingStyle;
}

export { AGENT_BEHAVIORS };
