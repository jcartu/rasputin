/**
 * Consensus Service
 * Handles parallel model querying and consensus generation
 */

import {
  ModelConfig,
  ModelResponseData,
  ConsensusResult,
  SpeedTier,
  getModelsForTier,
  getSynthesizerModel,
  FRONTIER_MODELS,
} from "../../shared/rasputin";
import { queryModel, queryModelsInParallel } from "./aiModels";
import {
  performSearchPreStep,
  formatSearchContextForPrompt,
  shouldPerformSearch,
  SearchContext,
} from "./searchPreStep";

const SEARCH_PRESTEP_TIMEOUT_MS = 15_000;
const SYNTHESIS_TIMEOUT_MS = 30_000;

// ============================================================================
// Timeout Utility
// ============================================================================

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>(resolve => {
    timeoutId = setTimeout(() => resolve(fallback), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch {
    clearTimeout(timeoutId!);
    return fallback;
  }
}

// ============================================================================
// Types
// ============================================================================

interface ConsensusOptions {
  query: string;
  speedTier: SpeedTier;
  selectedModels?: string[];
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  onModelUpdate?: (modelId: string, update: Partial<ModelResponseData>) => void;
  onConsensusStart?: () => void;
  onSearchStart?: () => void;
  onSearchComplete?: (context: SearchContext | null) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getCurrentDateString(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getDateContext(): string {
  return `\n\n**IMPORTANT: Today's date is ${getCurrentDateString()}. This is the current date - any events mentioned that occurred recently (in late 2025 or early 2026) are real and should be treated as factual current events, not hypothetical scenarios.**`;
}

// ============================================================================
// System Prompts
// ============================================================================

const MODEL_SYSTEM_PROMPT_BASE = `You are a highly capable AI assistant participating in a multi-model consensus system called RASPUTIN. 
Your response will be compared with other frontier AI models to generate a comprehensive consensus.

Guidelines:
- Provide thorough, well-reasoned responses
- Be specific and cite sources when possible
- Structure your response clearly with headings if appropriate
- Acknowledge uncertainty when present
- Focus on accuracy and helpfulness
- When provided with current web research, use it to inform your response with up-to-date information
- Treat recent events from web research as factual current events`;

function getModelSystemPrompt(): string {
  return MODEL_SYSTEM_PROMPT_BASE + getDateContext();
}

const CONSENSUS_SYNTHESIS_PROMPT = `You are the synthesis engine for RASPUTIN, a multi-model AI consensus system.
You have received responses from multiple frontier AI models to the same query.

Your task is to:
1. Analyze all model responses for agreement and disagreement
2. Identify the key points where models agree (consensus)
3. Note any significant disagreements or unique insights
4. Synthesize a comprehensive final answer that incorporates the best insights from all models
5. Calculate an approximate agreement percentage based on how aligned the models are

Format your response as follows:

## Consensus Summary
[Your synthesized answer incorporating the best insights from all models]

## Agreement Analysis
- **Agreement Percentage**: [X]%
- **Key Points of Agreement**: [List main areas where models agree]
- **Notable Disagreements**: [List any significant differences in responses]
- **Unique Insights**: [Any valuable perspectives from individual models]

## Confidence Assessment
[Brief assessment of overall confidence in the consensus based on model agreement]`;

// ============================================================================
// Main Consensus Function
// ============================================================================

export async function generateConsensus(
  options: ConsensusOptions
): Promise<ConsensusResult> {
  const startTime = Date.now();

  const {
    query,
    speedTier,
    selectedModels,
    conversationHistory = [],
    onModelUpdate,
    onConsensusStart,
    onSearchStart,
    onSearchComplete,
  } = options;

  let models: ModelConfig[];
  if (selectedModels && selectedModels.length > 0) {
    models = FRONTIER_MODELS.filter(m => selectedModels.includes(m.id));
  } else {
    models = getModelsForTier(speedTier);
  }
  models = models.filter(m => m.id !== "sonar-pro");
  console.log(
    `[Consensus] Using ${models.length} models: ${models.map(m => m.id).join(", ")}`
  );

  let searchContext: SearchContext | null = null;
  if (shouldPerformSearch(query)) {
    console.log("[Consensus] Performing search pre-step (15s timeout)");
    onSearchStart?.();
    searchContext = await withTimeout(
      performSearchPreStep(query),
      SEARCH_PRESTEP_TIMEOUT_MS,
      null
    );
    onSearchComplete?.(searchContext);
    if (searchContext) {
      console.log(
        `[Consensus] Search completed, ${searchContext.searchResults.length} chars`
      );
    } else {
      console.log("[Consensus] Search timed out or failed, proceeding without");
    }
  }

  // Build system prompt with search context if available
  let systemPrompt = getModelSystemPrompt();
  if (searchContext) {
    systemPrompt += formatSearchContextForPrompt(searchContext);
  }

  // Build messages with conversation history
  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: query },
  ];

  console.log(
    `[Consensus] Querying ${models.length} models (45s timeout each)`
  );
  const modelResponses = await queryModelsInParallel(
    models,
    { messages, stream: true },
    onModelUpdate
  );

  const successfulResponses = modelResponses.filter(
    r => r.status === "completed" && r.content
  );

  console.log(
    `[Consensus] Results: ${modelResponses.length} total, ${successfulResponses.length} successful`
  );
  modelResponses.forEach(r => {
    console.log(
      `[Consensus]   ${r.modelId}: ${r.status} ${r.errorMessage || ""} (${r.content?.length || 0} chars)`
    );
  });

  if (successfulResponses.length === 0) {
    throw new Error("All models failed to respond");
  }

  // Notify that consensus synthesis is starting
  onConsensusStart?.();

  // Generate consensus using the synthesizer model
  const synthesizer = getSynthesizerModel(speedTier);

  const synthesisPrompt = buildSynthesisPrompt(query, successfulResponses);

  const synthesisMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: CONSENSUS_SYNTHESIS_PROMPT },
    { role: "user", content: synthesisPrompt },
  ];

  console.log(
    `[Consensus] Running synthesis (${SYNTHESIS_TIMEOUT_MS / 1000}s timeout)`
  );
  const synthesisResponse = await withTimeout(
    queryModel(synthesizer, {
      messages: synthesisMessages,
      stream: false,
    }),
    SYNTHESIS_TIMEOUT_MS,
    {
      modelId: synthesizer.id,
      modelName: synthesizer.name,
      content: `Synthesis timed out. Based on ${successfulResponses.length} model responses, key points: ${successfulResponses.map(r => r.content?.slice(0, 200)).join(" | ")}`,
      status: "completed" as const,
    }
  );

  // Parse agreement percentage from synthesis
  const agreementPercentage = parseAgreementPercentage(
    synthesisResponse.content
  );

  // Calculate totals
  const totalLatencyMs = Date.now() - startTime;
  const totalTokens =
    modelResponses.reduce(
      (acc, r) => acc + (r.inputTokens || 0) + (r.outputTokens || 0),
      0
    ) +
    (synthesisResponse.inputTokens || 0) +
    (synthesisResponse.outputTokens || 0);

  const totalCost =
    modelResponses.reduce((acc, r) => acc + (r.cost || 0), 0) +
    (synthesisResponse.cost || 0);

  return {
    summary: synthesisResponse.content,
    agreementPercentage,
    modelResponses,
    totalLatencyMs,
    totalTokens,
    totalCost,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildSynthesisPrompt(
  query: string,
  responses: ModelResponseData[]
): string {
  let prompt = `## Original Query\n${query}\n\n## Model Responses\n\n`;

  for (const response of responses) {
    prompt += `### ${response.modelName}\n${response.content}\n\n---\n\n`;
  }

  prompt += `\nPlease analyze these ${responses.length} model responses and generate a consensus synthesis.`;

  return prompt;
}

function parseAgreementPercentage(content: string): number {
  // Try to extract percentage from the synthesis response
  const percentageMatch = content.match(/Agreement Percentage[:\s]*(\d+)%/i);
  if (percentageMatch) {
    return parseInt(percentageMatch[1], 10);
  }

  // Fallback: estimate based on content analysis
  // This is a simplified heuristic
  return 75; // Default to 75% if not found
}

// ============================================================================
// Quick Consensus (for simple queries)
// ============================================================================

export async function quickConsensus(
  query: string,
  speedTier: SpeedTier = "fast"
): Promise<string> {
  const result = await generateConsensus({
    query,
    speedTier,
  });

  return result.summary;
}
