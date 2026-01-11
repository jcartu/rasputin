export type TaskType =
  | "code"
  | "research"
  | "analysis"
  | "creative"
  | "general"
  | "fast";

export interface TaskClassification {
  type: TaskType;
  confidence: number;
  reasoning: string;
  suggestedModels: string[];
}

const CODE_PATTERNS = [
  /\b(write|create|implement|build|develop|code|program|script)\b.*\b(function|class|module|api|app|application|service|tool)\b/i,
  /\b(python|javascript|typescript|java|rust|go|c\+\+|ruby|php)\b/i,
  /\b(debug|fix|refactor|optimize|test|compile|run|execute)\b.*\b(code|script|program|function)\b/i,
  /\bwrite\s+(a\s+)?code\b/i,
  /\bcreate\s+(a\s+)?(script|function|class|module)\b/i,
  /\b(npm|pip|cargo|yarn|pnpm)\b/i,
  /\b(algorithm|data structure|regex|sql|query)\b/i,
];

const RESEARCH_PATTERNS = [
  /\b(research|find|search|look up|investigate|explore)\b/i,
  /\b(what is|who is|when did|where is|how does|why does)\b/i,
  /\b(latest|current|recent|news|updates)\b.*\b(about|on|regarding)\b/i,
  /\b(compare|comparison|difference|vs|versus)\b/i,
  /\b(information|details|facts|data)\b.*\b(about|on|regarding)\b/i,
  /\b(learn|understand|explain)\b.*\b(about|how)\b/i,
];

const ANALYSIS_PATTERNS = [
  /\b(analyze|analyse|evaluate|assess|review|examine)\b/i,
  /\b(data|statistics|metrics|numbers|figures)\b.*\b(analyze|show|interpret)\b/i,
  /\b(trend|pattern|correlation|insight)\b/i,
  /\b(breakdown|summary|overview)\b.*\b(of|for)\b/i,
  /\b(calculate|compute|determine|measure)\b/i,
  /\b(report|analysis|assessment)\b.*\b(on|of|for)\b/i,
  /\b(pros|cons|advantages|disadvantages|benefits|drawbacks)\b/i,
];

const CREATIVE_PATTERNS = [
  /\b(write|create|compose|draft)\b.*\b(story|poem|article|essay|blog|content)\b/i,
  /\b(creative|artistic|imaginative|original)\b/i,
  /\b(design|brainstorm|ideate|concept)\b/i,
  /\b(generate|make)\b.*\b(image|picture|art|logo|graphic)\b/i,
  /\b(marketing|slogan|tagline|headline|copy)\b/i,
  /\b(fiction|narrative|character|plot)\b/i,
];

const FAST_PATTERNS = [
  /\b(quick|fast|simple|basic)\b.*\b(answer|question|task)\b/i,
  /\bwhat\s+(is|are)\s+\d/i,
  /\b(calculate|convert|translate)\b.*\b(\d|simple)\b/i,
  /\b(time|date|weather)\b/i,
  /\b(yes|no)\s+question\b/i,
  /^(what|when|where|who)\b.{0,50}$/i,
];

function countPatternMatches(task: string, patterns: RegExp[]): number {
  return patterns.filter(p => p.test(task)).length;
}

export function classifyTask(task: string): TaskClassification {
  const codeScore = countPatternMatches(task, CODE_PATTERNS);
  const researchScore = countPatternMatches(task, RESEARCH_PATTERNS);
  const analysisScore = countPatternMatches(task, ANALYSIS_PATTERNS);
  const creativeScore = countPatternMatches(task, CREATIVE_PATTERNS);
  const fastScore = countPatternMatches(task, FAST_PATTERNS);

  const scores: { type: TaskType; score: number }[] = [
    { type: "code", score: codeScore * 1.2 },
    { type: "research", score: researchScore },
    { type: "analysis", score: analysisScore },
    { type: "creative", score: creativeScore },
    { type: "fast", score: fastScore * 0.8 },
  ];

  scores.sort((a, b) => b.score - a.score);
  const topScore = scores[0];
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);

  let finalType: TaskType = topScore.score > 0 ? topScore.type : "general";
  const confidence =
    totalScore > 0 ? Math.min(0.95, topScore.score / totalScore) : 0.5;

  if (topScore.score === 0) {
    finalType = "general";
  }

  const suggestedModels = getModelsForTaskType(finalType);
  const reasoning = generateReasoning(finalType, task, topScore.score);

  return {
    type: finalType,
    confidence,
    reasoning,
    suggestedModels,
  };
}

function getModelsForTaskType(type: TaskType): string[] {
  switch (type) {
    case "code":
      return ["claude-opus-4.5", "gpt-5.2-pro", "claude-sonnet-4.5", "gpt-5"];
    case "research":
      return ["sonar-pro", "gemini-3-pro", "gpt-5", "claude-sonnet-4.5"];
    case "analysis":
      return [
        "gpt-5.2-pro",
        "claude-opus-4.5",
        "gemini-3-pro",
        "claude-sonnet-4.5",
      ];
    case "creative":
      return [
        "claude-opus-4.5",
        "gpt-5.2-pro",
        "claude-sonnet-4.5",
        "gemini-3-pro",
      ];
    case "fast":
      return [
        "cerebras-llama-70b",
        "cerebras-qwen-32b",
        "gemini-3-flash",
        "gpt-5",
      ];
    case "general":
    default:
      return ["claude-sonnet-4.5", "gpt-5", "gemini-3-pro", "grok-4.1"];
  }
}

function generateReasoning(
  type: TaskType,
  task: string,
  score: number
): string {
  if (score === 0) {
    return "No strong indicators found; defaulting to general-purpose model selection.";
  }

  const reasons: Record<TaskType, string> = {
    code: "Task involves programming, code generation, or technical implementation.",
    research:
      "Task requires information gathering, web search, or fact-finding.",
    analysis:
      "Task involves data analysis, evaluation, or structured assessment.",
    creative:
      "Task requires creative writing, content generation, or artistic output.",
    fast: "Task is simple and can be handled quickly by a fast inference model.",
    general:
      "Task is general-purpose with no strong specialization indicators.",
  };

  return reasons[type];
}

export function getTaskTypeDescription(type: TaskType): string {
  const descriptions: Record<TaskType, string> = {
    code: "Code generation, debugging, programming tasks",
    research: "Information gathering, web search, fact-finding",
    analysis: "Data analysis, evaluation, structured assessment",
    creative: "Creative writing, content generation, artistic output",
    fast: "Simple queries, calculations, quick answers",
    general: "General-purpose tasks",
  };
  return descriptions[type];
}
