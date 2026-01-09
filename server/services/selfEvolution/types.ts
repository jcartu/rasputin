export interface CodeSymbolInfo {
  name: string;
  type:
    | "function"
    | "class"
    | "method"
    | "variable"
    | "type"
    | "interface"
    | "enum"
    | "constant";
  filePath: string;
  startLine: number;
  endLine: number;
  signature?: string;
  docstring?: string;
  isExported: boolean;
  dependencies: string[];
  dependents: string[];
}

export interface CodeFileInfo {
  path: string;
  language: string;
  size: number;
  hash: string;
  symbols: CodeSymbolInfo[];
  imports: string[];
  exports: string[];
  lastModified: Date;
}

export interface CodeMapStats {
  totalFiles: number;
  totalSymbols: number;
  totalLines: number;
  languages: Record<string, number>;
  lastIndexed: Date | null;
}

export interface Capability {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  toolName?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  examples: CapabilityExample[];
  limitations: string[];
  dependencies: string[];
  confidence: number;
  lastUsed?: Date;
  usageCount: number;
  successRate: number;
}

export type CapabilityCategory =
  | "web"
  | "code"
  | "file"
  | "data"
  | "communication"
  | "reasoning"
  | "memory"
  | "self"
  | "infrastructure";

export interface CapabilityExample {
  input: string;
  output: string;
  context?: string;
}

export interface CapabilityGap {
  description: string;
  detectedAt: Date;
  context: string;
  suggestedSolution?: string;
  priority: "low" | "medium" | "high" | "critical";
  status:
    | "identified"
    | "researching"
    | "implementing"
    | "resolved"
    | "wontfix";
}

export interface ModificationSpec {
  id: string;
  type:
    | "tool_update"
    | "prompt_update"
    | "skill_add"
    | "skill_update"
    | "config_change"
    | "code_patch";
  target: string;
  description: string;
  rationale: string;
  changes: ModificationChange[];
  testPlan: string[];
  rollbackPlan: string;
  status: ModificationStatus;
  createdAt: Date;
  approvedAt?: Date;
  appliedAt?: Date;
}

export type ModificationStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "testing"
  | "applied"
  | "rolled_back"
  | "rejected";

export interface ModificationChange {
  file: string;
  type: "create" | "modify" | "delete";
  diff?: string;
  newContent?: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  triggerPatterns: string[];
  implementation: SkillImplementation;
  testCases: SkillTestCase[];
  version: string;
  status: "draft" | "testing" | "active" | "deprecated";
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillImplementation {
  type: "tool" | "prompt" | "procedure" | "composite";
  toolName?: string;
  promptTemplate?: string;
  steps?: SkillStep[];
  code?: string;
}

export interface SkillStep {
  order: number;
  action: string;
  toolName?: string;
  input?: Record<string, unknown>;
  expectedOutcome?: string;
  onError?: "retry" | "skip" | "abort";
}

export interface SkillTestCase {
  name: string;
  input: string;
  expectedBehavior: string;
  validationFn?: string;
}

export interface IntrospectionQuery {
  type: "symbol" | "file" | "capability" | "modification" | "skill" | "gap";
  query: string;
  filters?: Record<string, unknown>;
}

export interface IntrospectionResult {
  query: IntrospectionQuery;
  results: unknown[];
  totalCount: number;
  executionTimeMs: number;
}

export interface SelfReflectionReport {
  timestamp: Date;
  codeMapStatus: CodeMapStats;
  capabilities: {
    total: number;
    byCategory: Record<CapabilityCategory, number>;
    topUsed: Capability[];
    recentlyFailed: Capability[];
  };
  gaps: CapabilityGap[];
  pendingModifications: ModificationSpec[];
  recentLearnings: string[];
  recommendations: string[];
}

export interface EmbeddingResult {
  text: string;
  vector: number[];
  model: string;
  dimensions: number;
}

export interface SemanticSearchResult {
  item: CodeSymbolInfo | Capability | SkillDefinition;
  score: number;
  matchType: "exact" | "semantic" | "fuzzy";
}
