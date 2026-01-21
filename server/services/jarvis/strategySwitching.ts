import type {
  ClassifiedError,
  ErrorClass as _ErrorClass,
} from "./errorClassification";

export type Strategy =
  | "default"
  | "decompose"
  | "verify_first"
  | "use_alternatives"
  | "reduce_scope"
  | "offline_mode";

export interface StrategyState {
  current: Strategy;
  pivots: number;
  reasons: string[];
  toolBlacklist: Set<string>;
  toolPreferences: string[];
  constraints: string[];
}

export function createInitialState(): StrategyState {
  return {
    current: "default",
    pivots: 0,
    reasons: [],
    toolBlacklist: new Set(),
    toolPreferences: [],
    constraints: [],
  };
}

export interface StrategyUpdateInput {
  classified: ClassifiedError;
  consecutiveFailures: number;
  sameSignatureCount: number;
  lastToolName: string;
}

export function updateStrategy(
  state: StrategyState,
  input: StrategyUpdateInput
): StrategyState {
  const newState = { ...state, toolBlacklist: new Set(state.toolBlacklist) };

  if (input.sameSignatureCount >= 2) {
    newState.toolBlacklist.add(input.lastToolName);
    newState.reasons.push(
      `Blacklisted ${input.lastToolName} after repeated failures`
    );
  }

  if (input.consecutiveFailures >= 3 && newState.current === "default") {
    newState.current = "decompose";
    newState.pivots++;
    newState.reasons.push(
      "Switching to decomposition after 3 consecutive failures"
    );
    newState.constraints.push("Break down the task into smaller steps");
  }

  if (
    input.classified.class === "validation_error" &&
    newState.current !== "verify_first"
  ) {
    newState.current = "verify_first";
    newState.pivots++;
    newState.reasons.push("Switching to verify-first after validation error");
    newState.constraints.push("Validate all inputs before executing tools");
  }

  if (
    input.classified.class === "code_error" &&
    input.consecutiveFailures >= 2
  ) {
    newState.current = "reduce_scope";
    newState.pivots++;
    newState.reasons.push("Reducing scope after repeated code errors");
    newState.constraints.push(
      "Start with minimal working code, then add complexity"
    );
  }

  if (
    (input.classified.class === "timeout" ||
      input.classified.class === "network_error") &&
    input.consecutiveFailures >= 2
  ) {
    newState.current = "offline_mode";
    newState.pivots++;
    newState.reasons.push("Switching to offline mode after network issues");
    newState.constraints.push("Prefer local operations over network calls");
    newState.toolPreferences = [
      "read_file",
      "write_file",
      "execute_python",
      "execute_node",
      "calculator",
    ];
  }

  if (input.classified.class === "rate_limit") {
    newState.current = "use_alternatives";
    newState.pivots++;
    newState.reasons.push("Switching to alternatives after rate limit");
    newState.constraints.push(
      "Use alternative tools or providers to avoid rate limits"
    );
  }

  return newState;
}

export function generateStrategyPrompt(state: StrategyState): string {
  if (state.current === "default" && state.constraints.length === 0) {
    return "";
  }

  const sections: string[] = [];

  sections.push(`\n--- STRATEGY ADJUSTMENT (${state.pivots} pivots) ---`);

  if (state.toolBlacklist.size > 0) {
    sections.push(
      `AVOID these tools (recent failures): ${Array.from(state.toolBlacklist).join(", ")}`
    );
  }

  if (state.toolPreferences.length > 0) {
    sections.push(`PREFER these tools: ${state.toolPreferences.join(", ")}`);
  }

  if (state.constraints.length > 0) {
    sections.push("CONSTRAINTS:");
    state.constraints.forEach(c => sections.push(`  - ${c}`));
  }

  const strategyGuidance: Record<Strategy, string> = {
    default: "",
    decompose:
      "Break the task into smaller, verifiable steps. Complete each step before moving to the next.",
    verify_first:
      "Before executing any tool, verify that all inputs are valid and resources exist.",
    use_alternatives:
      "Primary tools may be unavailable. Use alternative tools and providers.",
    reduce_scope:
      "Start with the simplest possible implementation. Add complexity incrementally.",
    offline_mode:
      "Network operations may fail. Prefer local file operations and cached data.",
  };

  if (strategyGuidance[state.current]) {
    sections.push(`STRATEGY: ${strategyGuidance[state.current]}`);
  }

  if (state.reasons.length > 0) {
    sections.push(`REASON: ${state.reasons[state.reasons.length - 1]}`);
  }

  sections.push("--- END STRATEGY ---\n");

  return sections.join("\n");
}

export function shouldForceComplete(
  state: StrategyState,
  iterations: number
): boolean {
  if (state.pivots >= 4) return true;
  if (iterations >= 15 && state.pivots >= 2) return true;
  return false;
}

export function getToolPriority(
  toolName: string,
  state: StrategyState
): number {
  if (state.toolBlacklist.has(toolName)) return -100;

  const preferenceIndex = state.toolPreferences.indexOf(toolName);
  if (preferenceIndex >= 0) return 100 - preferenceIndex;

  return 0;
}
