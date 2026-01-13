type Provider =
  | "anthropic"
  | "openai"
  | "cerebras"
  | "local-dolphin"
  | "local-llama"
  | "local-flux";
type Priority = "realtime" | "quality" | "speed" | "background";

interface RouteDecision {
  provider: Provider;
  model: string;
  priority: Priority;
  reason: string;
}

interface RoutingContext {
  isVisionActionLoop?: boolean;
  phase?: "decide" | "emit_action" | "observe";
  hasToolCalls?: boolean;
  toolCount?: number;
  isBackgroundTask?: boolean;
  requiresSpeed?: boolean;
  requiresImage?: boolean;
}

const COMPLEX_REASONING_PATTERNS = [
  /architect/i,
  /design.*system/i,
  /how.*should.*implement/i,
  /best.*approach/i,
  /trade.*off/i,
  /compare.*option/i,
  /debug.*complex/i,
  /refactor/i,
  /security.*review/i,
  /performance.*optim/i,
  /what.*wrong/i,
  /why.*not.*work/i,
  /explain.*how/i,
  /plan.*for/i,
  /strategy/i,
];

const CODE_PATTERNS = [
  /write.*code/i,
  /implement/i,
  /create.*function/i,
  /fix.*bug/i,
  /add.*feature/i,
  /update.*file/i,
  /modify/i,
  /refactor/i,
  /test.*for/i,
  /\.(ts|js|py|go|rs|java|cpp|c|rb)$/i,
];

const SIMPLE_PATTERNS = [
  /^list/i,
  /^show/i,
  /^what.*is/i,
  /^define/i,
  /^convert/i,
  /^format/i,
  /^translate/i,
  /^summarize/i,
  /^classify/i,
];

const REFUSAL_TRIGGERS = [
  /nsfw/i,
  /explicit/i,
  /adult.*content/i,
  /violent.*content/i,
  /hack.*into/i,
  /create.*malware/i,
  /bypass.*security/i,
  /illegal/i,
  /weapon/i,
  /drug.*synthesis/i,
  /generate.*porn/i,
  /nude/i,
  /sexual/i,
];

function matchesPatterns(query: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(query));
}

function isComplexReasoning(query: string): boolean {
  if (query.length > 500) return true;
  if ((query.match(/\?/g) || []).length > 2) return true;
  return matchesPatterns(query, COMPLEX_REASONING_PATTERNS);
}

function isCodeTask(query: string): boolean {
  return matchesPatterns(query, CODE_PATTERNS);
}

function isSimpleTask(query: string): boolean {
  if (query.length > 200) return false;
  return matchesPatterns(query, SIMPLE_PATTERNS);
}

function wouldRefuse(query: string): boolean {
  return matchesPatterns(query, REFUSAL_TRIGGERS);
}

function isImageRequest(query: string): boolean {
  return (
    /generate.*image/i.test(query) ||
    /create.*picture/i.test(query) ||
    /draw/i.test(query) ||
    /visualize/i.test(query)
  );
}

export function routeRequest(
  query: string,
  context: RoutingContext = {}
): RouteDecision {
  if (context.requiresImage && isImageRequest(query)) {
    if (wouldRefuse(query)) {
      return {
        provider: "local-flux",
        model: "flux-uncensored-v2",
        priority: "background",
        reason: "NSFW image generation routed to local Flux",
      };
    }
  }

  if (wouldRefuse(query)) {
    return {
      provider: "local-dolphin",
      model: "dolphin-3.0-mistral-24b",
      priority: "quality",
      reason: "Content would be refused by frontier models",
    };
  }

  if (context.isVisionActionLoop) {
    if (context.phase === "decide") {
      return {
        provider: "anthropic",
        model: "claude-sonnet-4",
        priority: "quality",
        reason: "Vision-action decision requires smart model",
      };
    }
    if (context.phase === "emit_action") {
      return {
        provider: "cerebras",
        model: "qwen3-32b",
        priority: "speed",
        reason: "Action DSL emission needs speed",
      };
    }
  }

  if (isComplexReasoning(query)) {
    return {
      provider: "anthropic",
      model: "claude-4.5-opus",
      priority: "quality",
      reason: "Complex reasoning requires frontier intelligence",
    };
  }

  if (isCodeTask(query)) {
    return {
      provider: "anthropic",
      model: "claude-sonnet-4",
      priority: "quality",
      reason: "Code generation requires reliable model",
    };
  }

  if (context.hasToolCalls && (context.toolCount || 0) > 2) {
    return {
      provider: "anthropic",
      model: "claude-sonnet-4",
      priority: "quality",
      reason: "Complex tool orchestration needs reliable model",
    };
  }

  if (context.isBackgroundTask) {
    return {
      provider: "local-llama",
      model: "llama-4-70b-awq",
      priority: "background",
      reason: "Background task routed to local GPU",
    };
  }

  if (isSimpleTask(query) || context.requiresSpeed) {
    return {
      provider: "cerebras",
      model: "llama-4-scout",
      priority: "speed",
      reason: "Simple task, using fast inference",
    };
  }

  return {
    provider: "anthropic",
    model: "claude-sonnet-4",
    priority: "quality",
    reason: "Default to reliable frontier model",
  };
}

export function getProviderConfig(decision: RouteDecision): {
  apiUrl: string;
  modelId: string;
  maxTokens: number;
  temperature: number;
} {
  switch (decision.provider) {
    case "anthropic":
      return {
        apiUrl: "https://api.anthropic.com/v1/messages",
        modelId:
          decision.model === "claude-4.5-opus"
            ? "claude-sonnet-4-5-20250514"
            : "claude-sonnet-4-20250514",
        maxTokens: 8192,
        temperature: 0.7,
      };

    case "openai":
      return {
        apiUrl: "https://api.openai.com/v1/chat/completions",
        modelId: decision.model === "gpt-5.2" ? "gpt-5.2" : "gpt-5",
        maxTokens: 8192,
        temperature: 0.7,
      };

    case "cerebras":
      return {
        apiUrl: "https://api.cerebras.ai/v1/chat/completions",
        modelId:
          decision.model === "qwen3-32b" ? "qwen-3-32b" : "llama-3.3-70b",
        maxTokens: 4096,
        temperature: 0.5,
      };

    case "local-dolphin":
      return {
        apiUrl:
          process.env.VLLM_URL || "http://localhost:8000/v1/chat/completions",
        modelId: "dolphin-3.0-r1-mistral-24b-abliterated",
        maxTokens: 4096,
        temperature: 0.8,
      };

    case "local-llama":
      return {
        apiUrl:
          process.env.VLLM_URL || "http://localhost:8000/v1/chat/completions",
        modelId: "meta-llama/Llama-4-70B-Instruct-AWQ",
        maxTokens: 4096,
        temperature: 0.7,
      };

    case "local-flux":
      return {
        apiUrl: process.env.FLUX_URL || "http://localhost:8001/generate",
        modelId: "flux-uncensored-v2",
        maxTokens: 0,
        temperature: 0,
      };

    default:
      return {
        apiUrl: "https://api.anthropic.com/v1/messages",
        modelId: "claude-sonnet-4-20250514",
        maxTokens: 8192,
        temperature: 0.7,
      };
  }
}

export type { RouteDecision, RoutingContext, Provider, Priority };
