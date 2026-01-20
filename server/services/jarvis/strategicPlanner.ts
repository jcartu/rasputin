/**
 * JARVIS Strategic Planner
 * Creates execution plans for complex tasks before acting
 */

export type TaskComplexity = "simple" | "moderate" | "complex";

export interface PlanPhase {
  id: string;
  name: string;
  description: string;
  estimatedTools: string[];
  successCriteria: string[];
  dependsOn: string[];
}

export interface ExecutionPlan {
  taskDescription: string;
  complexity: TaskComplexity;
  phases: PlanPhase[];
  estimatedIterations: number;
  risks: string[];
  fallbackStrategy?: string;
}

const COMPLEXITY_INDICATORS = {
  simple: [
    /^(what|who|when|where|how much|how many)\b/i,
    /^(get|fetch|read|show|display|list)\b/i,
    /^(calculate|compute|convert)\b/i,
  ],
  complex: [
    /\b(and then|after that|finally|also|additionally)\b/i,
    /\b(deploy|migrate|refactor|rewrite)\b/i,
    /\b(create|build|implement|develop)\s+.*(app|application|system|service)/i,
    /\b(multiple|several|various|all)\b.*\b(files|endpoints|components)/i,
    /\b(integrate|connect|sync)\b.*\b(with|to)\b/i,
    // Scaffold/portal tasks are inherently complex (generate 60+ files)
    /\b(scaffold|scaffolding)\b/i,
    /\b(portal|business.?portal|trade.?portal|bilateral)\b/i,
    /\bbuild_bilateral_portal/i,
    /\bscaffold_business_portal\b/i,
  ],
};

const TOOL_CATEGORIES: Record<string, string[]> = {
  research: ["web_search", "browse_url", "searxng_search"],
  coding: ["execute_python", "execute_javascript", "write_file", "read_file"],
  system: ["execute_shell", "ssh_execute", "tmux_start"],
  git: ["git_status", "git_commit", "git_push", "git_create_pr"],
  deployment: ["deploy_vercel", "deploy_railway", "docker_build"],
};

export function assessComplexity(task: string): TaskComplexity {
  const taskLower = task.toLowerCase();
  const wordCount = task.split(/\s+/).length;

  for (const pattern of COMPLEXITY_INDICATORS.complex) {
    if (pattern.test(task)) return "complex";
  }

  for (const pattern of COMPLEXITY_INDICATORS.simple) {
    if (pattern.test(task)) return "simple";
  }

  if (wordCount > 50) return "complex";
  if (wordCount > 20) return "moderate";
  return "simple";
}

export function estimateToolsNeeded(task: string): string[] {
  const taskLower = task.toLowerCase();
  const tools = new Set<string>();

  if (/search|find|look up|research/i.test(taskLower)) {
    TOOL_CATEGORIES.research.forEach(t => tools.add(t));
  }

  if (
    /code|script|program|function|write.*file|create.*file/i.test(taskLower)
  ) {
    TOOL_CATEGORIES.coding.forEach(t => tools.add(t));
  }

  if (/run|execute|command|shell|terminal/i.test(taskLower)) {
    TOOL_CATEGORIES.system.forEach(t => tools.add(t));
  }

  if (/git|commit|push|pull|branch|pr|pull request/i.test(taskLower)) {
    TOOL_CATEGORIES.git.forEach(t => tools.add(t));
  }

  if (/deploy|vercel|railway|docker|container/i.test(taskLower)) {
    TOOL_CATEGORIES.deployment.forEach(t => tools.add(t));
  }

  return Array.from(tools);
}

export function createExecutionPlan(task: string): ExecutionPlan {
  const complexity = assessComplexity(task);
  const estimatedTools = estimateToolsNeeded(task);

  if (complexity === "simple") {
    return {
      taskDescription: task,
      complexity,
      phases: [
        {
          id: "execute",
          name: "Execute",
          description: "Direct execution",
          estimatedTools,
          successCriteria: ["Task completed successfully"],
          dependsOn: [],
        },
      ],
      estimatedIterations: 1,
      risks: [],
    };
  }

  const phases: PlanPhase[] = [];

  if (estimatedTools.some(t => TOOL_CATEGORIES.research.includes(t))) {
    phases.push({
      id: "research",
      name: "Research & Information Gathering",
      description: "Gather necessary information before proceeding",
      estimatedTools: estimatedTools.filter(t =>
        TOOL_CATEGORIES.research.includes(t)
      ),
      successCriteria: ["Required information obtained"],
      dependsOn: [],
    });
  }

  if (estimatedTools.some(t => TOOL_CATEGORIES.coding.includes(t))) {
    phases.push({
      id: "implement",
      name: "Implementation",
      description: "Write and create necessary files/code",
      estimatedTools: estimatedTools.filter(t =>
        TOOL_CATEGORIES.coding.includes(t)
      ),
      successCriteria: ["Code/files created", "No syntax errors"],
      dependsOn: phases.length > 0 ? [phases[phases.length - 1].id] : [],
    });
  }

  if (estimatedTools.some(t => TOOL_CATEGORIES.system.includes(t))) {
    phases.push({
      id: "execute",
      name: "Execution & Testing",
      description: "Run commands and verify results",
      estimatedTools: estimatedTools.filter(t =>
        TOOL_CATEGORIES.system.includes(t)
      ),
      successCriteria: ["Commands executed successfully", "No errors"],
      dependsOn: phases.length > 0 ? [phases[phases.length - 1].id] : [],
    });
  }

  if (estimatedTools.some(t => TOOL_CATEGORIES.git.includes(t))) {
    phases.push({
      id: "version-control",
      name: "Version Control",
      description: "Commit and push changes",
      estimatedTools: estimatedTools.filter(t =>
        TOOL_CATEGORIES.git.includes(t)
      ),
      successCriteria: ["Changes committed", "Pushed to remote"],
      dependsOn: phases.length > 0 ? [phases[phases.length - 1].id] : [],
    });
  }

  if (estimatedTools.some(t => TOOL_CATEGORIES.deployment.includes(t))) {
    phases.push({
      id: "deploy",
      name: "Deployment",
      description: "Deploy to target environment",
      estimatedTools: estimatedTools.filter(t =>
        TOOL_CATEGORIES.deployment.includes(t)
      ),
      successCriteria: ["Deployment successful", "Application accessible"],
      dependsOn: phases.length > 0 ? [phases[phases.length - 1].id] : [],
    });
  }

  if (phases.length === 0) {
    phases.push({
      id: "execute",
      name: "Execute",
      description: "Direct execution",
      estimatedTools,
      successCriteria: ["Task completed"],
      dependsOn: [],
    });
  }

  const risks: string[] = [];
  if (complexity === "complex") {
    risks.push("Complex task may require multiple iterations");
    if (estimatedTools.some(t => TOOL_CATEGORIES.deployment.includes(t))) {
      risks.push("Deployment operations may have side effects");
    }
    if (estimatedTools.some(t => TOOL_CATEGORIES.system.includes(t))) {
      risks.push("System commands may require elevated permissions");
    }
  }

  return {
    taskDescription: task,
    complexity,
    phases,
    estimatedIterations: Math.max(phases.length * 2, 3),
    risks,
    fallbackStrategy:
      complexity === "complex"
        ? "Break into smaller subtasks if stuck after 5 iterations"
        : undefined,
  };
}

export function formatPlanForPrompt(plan: ExecutionPlan): string {
  if (plan.complexity === "simple") {
    return "";
  }

  const phasesText = plan.phases
    .map((p, i) => {
      const deps =
        p.dependsOn.length > 0 ? ` (after: ${p.dependsOn.join(", ")})` : "";
      return `${i + 1}. **${p.name}**${deps}\n   ${p.description}\n   Tools: ${p.estimatedTools.join(", ") || "TBD"}`;
    })
    .join("\n");

  const risksText =
    plan.risks.length > 0
      ? `\n\nPOTENTIAL RISKS:\n${plan.risks.map(r => `- ${r}`).join("\n")}`
      : "";

  const fallbackText = plan.fallbackStrategy
    ? `\n\nFALLBACK: ${plan.fallbackStrategy}`
    : "";

  return `
EXECUTION PLAN (${plan.complexity} complexity):
${phasesText}

Estimated iterations: ${plan.estimatedIterations}${risksText}${fallbackText}

Follow this plan but adapt as needed based on actual results.
`;
}
