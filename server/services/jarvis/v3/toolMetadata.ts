import type {
  JARVISToolMetadata,
  AgentType,
  ToolCategory,
  RiskLevel,
} from "./types";

type ToolMetadataConfig = Omit<JARVISToolMetadata, "category"> & {
  category?: ToolCategory;
};

const AGENT_GROUPS = {
  all: [
    "planner",
    "coder",
    "executor",
    "verifier",
    "researcher",
    "learner",
    "safety",
  ] as AgentType[],
  codeExecution: ["coder", "executor", "verifier"] as AgentType[],
  research: ["planner", "researcher", "learner"] as AgentType[],
  fileOps: ["coder", "executor"] as AgentType[],
  deployment: ["executor", "verifier"] as AgentType[],
  communication: ["planner", "executor"] as AgentType[],
  memory: ["planner", "learner", "researcher", "coder"] as AgentType[],
  safety: ["safety", "verifier"] as AgentType[],
};

function meta(
  agentAffinity: AgentType[],
  riskLevel: RiskLevel,
  category: ToolCategory,
  options: Partial<ToolMetadataConfig> = {}
): JARVISToolMetadata {
  return {
    agentAffinity,
    riskLevel,
    category,
    requiresLease: options.requiresLease || [],
    estimatedDurationMs: options.estimatedDurationMs || 5000,
    canParallelize: options.canParallelize ?? true,
    qdrantCollections: options.qdrantCollections || [],
    requiresApproval: options.requiresApproval || riskLevel === "critical",
    maxRetries: options.maxRetries || 2,
    timeoutMs: options.timeoutMs || 60000,
    fallbackTools: options.fallbackTools,
  };
}

export const TOOL_METADATA: Record<string, JARVISToolMetadata> = {
  // Web & Research Tools
  web_search: meta(AGENT_GROUPS.research, "low", "web", {
    qdrantCollections: ["research_queries"],
    estimatedDurationMs: 3000,
  }),
  browse_url: meta(AGENT_GROUPS.research, "low", "web", {
    estimatedDurationMs: 5000,
    qdrantCollections: ["web_content"],
  }),
  deep_research: meta(["researcher", "planner"], "low", "research", {
    estimatedDurationMs: 60000,
    timeoutMs: 300000,
    qdrantCollections: ["research_results", "citations"],
  }),
  query_consensus: meta(["researcher", "planner"], "low", "research", {
    estimatedDurationMs: 30000,
    timeoutMs: 120000,
  }),
  query_synthesis: meta(["researcher", "planner"], "low", "research", {
    estimatedDurationMs: 30000,
    timeoutMs: 120000,
  }),

  // Code Execution Tools
  execute_python: meta(AGENT_GROUPS.codeExecution, "high", "code", {
    requiresLease: ["sandbox:python"],
    estimatedDurationMs: 10000,
    timeoutMs: 120000,
    qdrantCollections: ["code_executions"],
  }),
  execute_javascript: meta(AGENT_GROUPS.codeExecution, "high", "code", {
    requiresLease: ["sandbox:node"],
    estimatedDurationMs: 10000,
    timeoutMs: 120000,
    qdrantCollections: ["code_executions"],
  }),
  run_shell: meta(["executor"], "high", "system", {
    requiresLease: ["shell"],
    estimatedDurationMs: 5000,
    timeoutMs: 60000,
    requiresApproval: true,
  }),
  calculate: meta(AGENT_GROUPS.all, "low", "code", {
    estimatedDurationMs: 100,
  }),

  // File Operations
  read_file: meta(AGENT_GROUPS.fileOps, "low", "file", {
    estimatedDurationMs: 500,
    qdrantCollections: ["file_reads"],
  }),
  write_file: meta(["coder"], "high", "file", {
    requiresLease: ["filesystem"],
    qdrantCollections: ["file_writes"],
    requiresApproval: true,
  }),
  list_files: meta(AGENT_GROUPS.fileOps, "low", "file", {
    estimatedDurationMs: 500,
  }),
  search_and_replace: meta(["coder"], "high", "file", {
    requiresLease: ["filesystem"],
    qdrantCollections: ["code_edits"],
  }),
  insert_at_line: meta(["coder"], "high", "file", {
    requiresLease: ["filesystem"],
    qdrantCollections: ["code_edits"],
  }),
  delete_lines: meta(["coder"], "high", "file", {
    requiresLease: ["filesystem"],
    qdrantCollections: ["code_edits"],
  }),
  replace_lines: meta(["coder"], "high", "file", {
    requiresLease: ["filesystem"],
    qdrantCollections: ["code_edits"],
  }),
  find_in_file: meta(AGENT_GROUPS.fileOps, "low", "file", {
    estimatedDurationMs: 1000,
  }),

  // Document Creation
  write_docx: meta(["coder", "executor"], "medium", "document", {
    estimatedDurationMs: 2000,
  }),
  write_pptx: meta(["coder", "executor"], "medium", "document", {
    estimatedDurationMs: 3000,
  }),
  write_xlsx: meta(["coder", "executor"], "medium", "document", {
    estimatedDurationMs: 2000,
  }),
  create_rich_report: meta(["coder", "researcher"], "medium", "document", {
    estimatedDurationMs: 5000,
    qdrantCollections: ["reports"],
  }),
  list_document_templates: meta(AGENT_GROUPS.all, "low", "document"),
  get_document_template: meta(AGENT_GROUPS.all, "low", "document"),
  render_document_template: meta(["coder", "executor"], "medium", "document", {
    estimatedDurationMs: 2000,
  }),

  // Git Operations
  git_status: meta(AGENT_GROUPS.fileOps, "low", "git"),
  git_diff: meta(AGENT_GROUPS.fileOps, "low", "git"),
  git_branch: meta(["coder"], "medium", "git", {
    requiresLease: ["git"],
  }),
  git_commit: meta(["coder"], "high", "git", {
    requiresLease: ["git"],
    requiresApproval: true,
    qdrantCollections: ["commits"],
  }),
  git_log: meta(AGENT_GROUPS.fileOps, "low", "git"),
  git_push: meta(["coder", "executor"], "high", "git", {
    requiresLease: ["git"],
    requiresApproval: true,
  }),
  git_pull: meta(["coder", "executor"], "medium", "git", {
    requiresLease: ["git"],
  }),
  git_stash: meta(["coder"], "medium", "git", {
    requiresLease: ["git"],
  }),
  git_clone: meta(["coder", "executor"], "medium", "git", {
    estimatedDurationMs: 30000,
  }),
  git_init: meta(["coder"], "medium", "git"),
  git_create_pr: meta(["coder"], "high", "git", {
    requiresApproval: true,
    qdrantCollections: ["pull_requests"],
  }),

  // SSH Operations
  ssh_execute: meta(["executor"], "high", "ssh", {
    requiresLease: ["ssh"],
    requiresApproval: true,
  }),
  ssh_read_file: meta(["executor", "coder"], "medium", "ssh", {
    requiresLease: ["ssh"],
  }),
  ssh_write_file: meta(["executor"], "high", "ssh", {
    requiresLease: ["ssh"],
    requiresApproval: true,
  }),
  ssh_list_files: meta(["executor", "coder"], "low", "ssh", {
    requiresLease: ["ssh"],
  }),

  // Deployment & DevOps
  deploy_vercel: meta(AGENT_GROUPS.deployment, "critical", "system", {
    requiresApproval: true,
    estimatedDurationMs: 60000,
    timeoutMs: 300000,
    qdrantCollections: ["deployments"],
  }),
  deploy_railway: meta(AGENT_GROUPS.deployment, "critical", "system", {
    requiresApproval: true,
    estimatedDurationMs: 120000,
    timeoutMs: 600000,
    qdrantCollections: ["deployments"],
  }),
  deploy_to_vercel: meta(AGENT_GROUPS.deployment, "critical", "system", {
    requiresApproval: true,
    estimatedDurationMs: 60000,
    timeoutMs: 300000,
    qdrantCollections: ["deployments"],
  }),
  docker_build: meta(["executor", "coder"], "high", "docker", {
    requiresLease: ["docker"],
    estimatedDurationMs: 60000,
    timeoutMs: 300000,
  }),
  docker_push: meta(["executor"], "critical", "docker", {
    requiresLease: ["docker"],
    requiresApproval: true,
    estimatedDurationMs: 30000,
  }),
  docker_compose: meta(["executor"], "critical", "docker", {
    requiresLease: ["docker"],
    requiresApproval: true,
    estimatedDurationMs: 30000,
  }),
  generate_dockerfile: meta(["coder"], "medium", "docker", {
    qdrantCollections: ["dockerfiles"],
  }),
  check_deployment_health: meta(AGENT_GROUPS.deployment, "low", "system"),

  // Build & Test
  run_build: meta(AGENT_GROUPS.codeExecution, "medium", "code", {
    estimatedDurationMs: 30000,
    timeoutMs: 300000,
    qdrantCollections: ["build_results"],
  }),
  run_tests: meta(["verifier", "coder"], "medium", "code", {
    estimatedDurationMs: 60000,
    timeoutMs: 600000,
    qdrantCollections: ["test_results"],
  }),
  run_typecheck: meta(["verifier", "coder"], "low", "code", {
    estimatedDurationMs: 30000,
    qdrantCollections: ["typecheck_results"],
  }),
  run_lint: meta(["verifier", "coder"], "low", "code", {
    estimatedDurationMs: 15000,
    qdrantCollections: ["lint_results"],
  }),
  start_dev_server: meta(["executor"], "medium", "system", {
    requiresLease: ["dev_server"],
  }),
  check_dev_server: meta(AGENT_GROUPS.codeExecution, "low", "system"),

  // Browser Automation
  browser_session_start: meta(["executor"], "medium", "browser", {
    requiresLease: ["browser"],
    estimatedDurationMs: 5000,
  }),
  browser_click: meta(["executor"], "medium", "browser", {
    requiresLease: ["browser"],
  }),
  browser_fill: meta(["executor"], "medium", "browser", {
    requiresLease: ["browser"],
  }),
  browser_navigate: meta(["executor", "researcher"], "medium", "browser", {
    requiresLease: ["browser"],
    estimatedDurationMs: 5000,
  }),
  browser_screenshot: meta(["executor", "verifier"], "low", "browser", {
    requiresLease: ["browser"],
    qdrantCollections: ["screenshots"],
  }),
  browser_get_content: meta(["executor", "researcher"], "low", "browser", {
    requiresLease: ["browser"],
  }),
  browser_wait_for: meta(["executor"], "low", "browser", {
    requiresLease: ["browser"],
  }),
  browser_session_end: meta(["executor"], "low", "browser"),

  // Database
  database_query: meta(["executor"], "critical", "database", {
    requiresLease: ["database"],
    requiresApproval: true,
    qdrantCollections: ["queries"],
  }),
  generate_schema: meta(["coder"], "medium", "database", {
    qdrantCollections: ["schemas"],
  }),

  // Communication
  send_email: meta(AGENT_GROUPS.communication, "high", "communication", {
    requiresApproval: true,
  }),
  slack_message: meta(AGENT_GROUPS.communication, "high", "communication", {
    requiresApproval: true,
  }),
  github_create_issue: meta(["coder", "planner"], "medium", "communication", {
    qdrantCollections: ["issues"],
  }),
  github_create_pr: meta(["coder"], "high", "communication", {
    requiresApproval: true,
    qdrantCollections: ["pull_requests"],
  }),
  github_api: meta(["coder", "researcher"], "medium", "communication"),

  // Terminal/Tmux
  tmux_start: meta(["executor"], "medium", "system", {
    requiresLease: ["tmux"],
  }),
  tmux_output: meta(["executor"], "low", "system", {
    requiresLease: ["tmux"],
  }),
  tmux_send: meta(["executor"], "medium", "system", {
    requiresLease: ["tmux"],
  }),
  tmux_stop: meta(["executor"], "low", "system"),
  tmux_list: meta(["executor"], "low", "system"),

  // Multi-Agent & Swarm
  spawn_agent_team: meta(["planner"], "medium", "multiagent", {
    qdrantCollections: ["agent_teams"],
  }),
  spawn_agent: meta(["planner"], "medium", "multiagent"),
  list_agents: meta(AGENT_GROUPS.all, "low", "multiagent"),
  delegate_to_agent: meta(["planner"], "medium", "multiagent", {
    qdrantCollections: ["delegations"],
  }),
  negotiate_task: meta(["planner"], "medium", "multiagent"),
  accept_negotiation_bid: meta(["planner"], "medium", "multiagent"),
  form_swarm_team: meta(["planner"], "medium", "multiagent", {
    qdrantCollections: ["swarm_teams"],
  }),
  run_swarm_consensus: meta(["planner", "safety"], "medium", "multiagent", {
    qdrantCollections: ["consensus_results"],
  }),
  get_active_swarm_teams: meta(AGENT_GROUPS.all, "low", "multiagent"),
  disband_swarm_team: meta(["planner"], "low", "multiagent"),
  broadcast_to_team: meta(["planner"], "low", "multiagent"),

  // Memory Operations
  search_memory: meta(AGENT_GROUPS.memory, "low", "memory", {
    estimatedDurationMs: 1000,
  }),
  store_memory: meta(AGENT_GROUPS.memory, "low", "memory", {
    estimatedDurationMs: 500,
    qdrantCollections: ["memories"],
  }),
  get_memory_stats: meta(AGENT_GROUPS.all, "low", "memory"),

  // Predictive & Proactive
  get_predicted_tasks: meta(["planner", "learner"], "low", "system"),
  get_task_patterns: meta(["planner", "learner"], "low", "system"),
  get_proactive_monitor_status: meta(AGENT_GROUPS.all, "low", "system"),
  configure_proactive_monitor: meta(["planner"], "medium", "system"),
  get_proactive_alerts: meta(AGENT_GROUPS.all, "low", "system"),
  get_user_insights: meta(["planner", "learner"], "low", "system"),

  // Event & Automation
  create_event_trigger: meta(["planner"], "medium", "system", {
    qdrantCollections: ["event_triggers"],
  }),
  define_macro: meta(["planner", "coder"], "medium", "system", {
    qdrantCollections: ["macros"],
  }),
  execute_macro: meta(["executor"], "high", "system"),
  list_macros: meta(AGENT_GROUPS.all, "low", "system"),
  list_event_triggers: meta(AGENT_GROUPS.all, "low", "system"),

  // MCP Connections
  connect_mcp_server: meta(["executor"], "medium", "mcp", {
    requiresLease: ["mcp"],
  }),
  call_mcp_tool: meta(["executor"], "high", "mcp", {
    requiresLease: ["mcp"],
  }),
  list_mcp_tools: meta(AGENT_GROUPS.all, "low", "mcp"),
  list_mcp_servers: meta(AGENT_GROUPS.all, "low", "mcp"),

  // Self-Review & Verification
  self_verify: meta(["verifier", "safety"], "low", "security", {
    qdrantCollections: ["verifications"],
  }),
  self_review: meta(["verifier", "safety"], "low", "security", {
    qdrantCollections: ["reviews"],
  }),
  assess_task_confidence: meta(["verifier", "planner"], "low", "system"),
  npm_audit: meta(["verifier", "safety"], "low", "security", {
    qdrantCollections: ["security_audits"],
  }),
  security_analysis: meta(["safety"], "low", "security", {
    qdrantCollections: ["security_analyses"],
  }),

  // Image & Media
  generate_image: meta(["executor"], "medium", "image", {
    estimatedDurationMs: 30000,
    qdrantCollections: ["generated_images"],
  }),
  analyze_image: meta(["researcher"], "low", "image", {
    qdrantCollections: ["image_analyses"],
  }),
  compare_images: meta(["verifier"], "low", "image"),
  extract_text_from_image: meta(["researcher"], "low", "image"),
  read_pdf: meta(AGENT_GROUPS.research, "low", "document"),
  analyze_document: meta(["researcher"], "low", "document", {
    qdrantCollections: ["document_analyses"],
  }),
  convert_document: meta(["executor"], "medium", "document"),

  // Audio & Video
  transcribe_audio: meta(["researcher"], "low", "audio", {
    estimatedDurationMs: 30000,
    qdrantCollections: ["transcriptions"],
  }),
  extract_audio_from_video: meta(["executor"], "medium", "video", {
    estimatedDurationMs: 60000,
  }),
  generate_speech: meta(["executor"], "medium", "audio", {
    estimatedDurationMs: 10000,
  }),

  // Desktop Automation
  desktop_action: meta(["executor"], "high", "desktop", {
    requiresLease: ["desktop"],
    requiresApproval: true,
  }),
  vision_automate: meta(["executor"], "high", "desktop", {
    requiresLease: ["desktop"],
    requiresApproval: true,
    estimatedDurationMs: 60000,
    timeoutMs: 300000,
  }),

  // Scaffold & Project Generation
  scaffold_project: meta(["coder"], "medium", "scaffold", {
    estimatedDurationMs: 30000,
    qdrantCollections: ["scaffolds"],
  }),
  scaffold_regional_map: meta(["coder"], "medium", "scaffold", {
    estimatedDurationMs: 60000,
    qdrantCollections: ["scaffolds"],
  }),
  scaffold_business_portal: meta(["coder"], "medium", "scaffold", {
    estimatedDurationMs: 120000,
    timeoutMs: 300000,
    qdrantCollections: ["scaffolds"],
  }),
  build_bilateral_portal_swarm: meta(["planner", "coder"], "high", "scaffold", {
    estimatedDurationMs: 300000,
    timeoutMs: 600000,
    qdrantCollections: ["portal_builds"],
  }),
  list_supported_countries: meta(AGENT_GROUPS.all, "low", "scaffold"),

  // Utility
  get_datetime: meta(AGENT_GROUPS.all, "low", "system", {
    estimatedDurationMs: 10,
  }),
  json_tool: meta(AGENT_GROUPS.all, "low", "system", {
    estimatedDurationMs: 50,
  }),
  get_weather: meta(AGENT_GROUPS.all, "low", "web", {
    estimatedDurationMs: 2000,
  }),
  text_process: meta(AGENT_GROUPS.all, "low", "system", {
    estimatedDurationMs: 100,
  }),
  http_request: meta(["executor", "researcher"], "medium", "web", {
    estimatedDurationMs: 5000,
  }),

  // Task Completion
  task_complete: meta(AGENT_GROUPS.all, "low", "system", {
    estimatedDurationMs: 100,
  }),
};

export function getToolMetadata(
  toolName: string
): JARVISToolMetadata | undefined {
  return TOOL_METADATA[toolName];
}

export function getToolMetadataOrDefault(
  toolName: string,
  category: ToolCategory = "system"
): JARVISToolMetadata {
  return (
    TOOL_METADATA[toolName] ||
    meta(["executor"], "low", category, { estimatedDurationMs: 5000 })
  );
}

export function getToolsForCategory(category: ToolCategory): string[] {
  return Object.entries(TOOL_METADATA)
    .filter(([_, metadata]) => metadata.category === category)
    .map(([name]) => name);
}

export function getToolsForAgent(agentType: AgentType): string[] {
  return Object.entries(TOOL_METADATA)
    .filter(([_, metadata]) => metadata.agentAffinity.includes(agentType))
    .map(([name]) => name);
}

export function getHighRiskTools(): string[] {
  return Object.entries(TOOL_METADATA)
    .filter(
      ([_, metadata]) =>
        metadata.riskLevel === "high" || metadata.riskLevel === "critical"
    )
    .map(([name]) => name);
}

export function getToolsRequiringApproval(): string[] {
  return Object.entries(TOOL_METADATA)
    .filter(([_, metadata]) => metadata.requiresApproval)
    .map(([name]) => name);
}

export function getToolsWithLearning(): string[] {
  return Object.entries(TOOL_METADATA)
    .filter(([_, metadata]) => metadata.qdrantCollections.length > 0)
    .map(([name]) => name);
}

export const TOOL_COUNT = Object.keys(TOOL_METADATA).length;
