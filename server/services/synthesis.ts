/**
 * Synthesis Service
 * Implements the multi-stage synthesis pipeline:
 * 1. Web Search (Perplexity)
 * 2. Parallel Proposers
 * 3. Information Extraction
 * 4. Gap Detection & Conflict Resolution
 * 5. Meta-Synthesis
 */

import {
  ModelResponseData,
  SynthesisResult,
  SynthesisPipelineStageData,
  SynthesisStage,
  SpeedTier,
  getModelsForTier,
  getCerebrasForIntermediateStages,
  getClaudeForFinalSynthesis,
  FRONTIER_MODELS,
} from "../../shared/rasputin";
import { queryModel, queryModelsInParallel } from "./aiModels";

const WEB_SEARCH_TIMEOUT_MS = 20_000;
const INTERMEDIATE_STAGE_TIMEOUT_MS = 45_000;
const FINAL_SYNTHESIS_TIMEOUT_MS = 60_000;

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

interface SynthesisOptions {
  query: string;
  speedTier: SpeedTier;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  onStageUpdate?: (
    stage: SynthesisStage,
    status: "pending" | "running" | "completed" | "error",
    output?: string
  ) => void;
  onModelUpdate?: (modelId: string, update: Partial<ModelResponseData>) => void;
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
  return `\n\n**IMPORTANT: Today's date is ${getCurrentDateString()}. This is the current date - any events mentioned that occurred recently (in late 2025 or early 2026) are real and should be treated as factual current events, not hypothetical scenarios.**\n`;
}

// ============================================================================
// System Prompts
// ============================================================================

const WEB_SEARCH_PROMPT = `You are a research assistant with real-time web search capabilities.
Search for the most current and relevant information about the user's query.
Provide comprehensive, well-sourced information with citations where possible.
Focus on recent developments, authoritative sources, and factual accuracy.`;

const PROPOSER_PROMPT_BASE = `You are a highly capable AI assistant participating in a multi-model synthesis system called RASPUTIN.
Your response will be combined with other frontier AI models to generate a comprehensive synthesis.

You have been provided with recent web search results for context.

Guidelines:
- Provide thorough, well-reasoned analysis
- Build upon the web search context provided
- Offer unique insights and perspectives
- Structure your response clearly
- Treat recent events from web search as factual current events`;

function getProposerPrompt(): string {
  return PROPOSER_PROMPT_BASE + getDateContext();
}

const EXTRACTION_PROMPT = `You are an information extraction specialist for the RASPUTIN synthesis system.
Analyze the provided model responses and extract:

1. **Key Facts**: Concrete, verifiable information mentioned
2. **Main Arguments**: Core reasoning and conclusions
3. **Unique Insights**: Perspectives unique to specific models
4. **Common Themes**: Ideas that appear across multiple responses
5. **Confidence Levels**: How certain each model appears about their claims

Format your extraction in a structured manner for further processing.`;

const GAP_DETECTION_PROMPT = `You are a gap detection and conflict resolution specialist for the RASPUTIN synthesis system.

Analyze the extracted information and identify:

1. **Information Gaps**: What important aspects of the query were NOT addressed?
2. **Conflicting Claims**: Where do the models disagree?
3. **Resolution Suggestions**: How should conflicts be resolved?
4. **Missing Context**: What additional context would improve the answer?
5. **Confidence Assessment**: Overall reliability of the combined information

Be thorough in identifying gaps and conflicts that need to be addressed in the final synthesis.`;

const META_SYNTHESIS_PROMPT_BASE = `You are the meta-synthesis engine for RASPUTIN, a multi-model AI synthesis system.

You have received:
1. Web search results with current information
2. Multiple model responses analyzing the query
3. Extracted key information from all responses
4. Identified gaps and conflicts

Your task is to create the ULTIMATE synthesis that:
1. Incorporates the best insights from all sources
2. Fills identified gaps with reasoned analysis
3. Resolves conflicts with clear explanations
4. Provides a comprehensive, authoritative answer
5. Maintains intellectual honesty about uncertainties

Create a response that is MORE valuable than any individual model could provide alone.
Structure your response with clear sections and be thorough yet readable.`;

function getMetaSynthesisPrompt(): string {
  return META_SYNTHESIS_PROMPT_BASE + getDateContext();
}

// ============================================================================
// Stage Functions
// ============================================================================

async function runWebSearch(
  query: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  onUpdate?: (
    status: "running" | "completed" | "error",
    output?: string
  ) => void
): Promise<SynthesisPipelineStageData> {
  const startTime = Date.now();
  onUpdate?.("running");

  try {
    // Use Perplexity for web search
    const perplexityModel = FRONTIER_MODELS.find(m => m.id === "sonar-pro");
    if (!perplexityModel) {
      throw new Error("Perplexity model not configured");
    }

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: WEB_SEARCH_PROMPT },
      ...conversationHistory.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user",
        content: `Search for current information about: ${query}`,
      },
    ];

    console.log(
      `[Synthesis] Web search (${WEB_SEARCH_TIMEOUT_MS / 1000}s timeout)`
    );
    const response = await withTimeout(
      queryModel(perplexityModel, { messages, stream: false }),
      WEB_SEARCH_TIMEOUT_MS,
      {
        modelId: perplexityModel.id,
        modelName: perplexityModel.name,
        content:
          "Web search timed out. Proceeding without current web context.",
        status: "completed" as const,
      }
    );

    const durationMs = Date.now() - startTime;
    onUpdate?.("completed", response.content);

    return {
      stageName: "web_search",
      stageOrder: 1,
      status: "completed",
      output: response.content,
      durationMs,
      metadata: {
        model: perplexityModel.id,
        tokens: (response.inputTokens || 0) + (response.outputTokens || 0),
        cost: response.cost,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    onUpdate?.("error", errorMessage);

    return {
      stageName: "web_search",
      stageOrder: 1,
      status: "error",
      output: errorMessage,
      durationMs,
    };
  }
}

async function runParallelProposers(
  query: string,
  webSearchResults: string,
  speedTier: SpeedTier,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  onUpdate?: (
    status: "running" | "completed" | "error",
    output?: string
  ) => void,
  onModelUpdate?: (modelId: string, update: Partial<ModelResponseData>) => void
): Promise<{
  stage: SynthesisPipelineStageData;
  responses: ModelResponseData[];
}> {
  const startTime = Date.now();
  onUpdate?.("running");

  try {
    // Get proposer models (exclude Perplexity since it was used for search)
    const allModels = getModelsForTier(speedTier);
    const proposerModels = allModels.filter(m => m.id !== "sonar-pro");

    const contextMessage = `## Web Search Context\n${webSearchResults}\n\n## User Query\n${query}`;

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: getProposerPrompt() },
      ...conversationHistory.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: contextMessage },
    ];

    console.log(
      `[Synthesis] Querying ${proposerModels.length} models (45s timeout each)`
    );
    const responses = await queryModelsInParallel(
      proposerModels,
      { messages, stream: true },
      onModelUpdate
    );

    const successfulResponses = responses.filter(
      r => r.status === "completed" && r.content
    );
    const durationMs = Date.now() - startTime;

    console.log(
      `[Synthesis:Proposers] ${responses.length} total, ${successfulResponses.length} with content`
    );
    responses.forEach(r => {
      console.log(
        `[Synthesis:Proposers]   ${r.modelId}: ${r.status} (${r.content?.length || 0} chars) ${r.errorMessage || ""}`
      );
    });

    const output = `Received ${successfulResponses.length}/${proposerModels.length} model responses`;
    onUpdate?.("completed", output);

    return {
      stage: {
        stageName: "parallel_proposers",
        stageOrder: 2,
        status: "completed",
        output,
        durationMs,
        metadata: {
          modelCount: proposerModels.length,
          successCount: successfulResponses.length,
        },
      },
      responses,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    onUpdate?.("error", errorMessage);

    return {
      stage: {
        stageName: "parallel_proposers",
        stageOrder: 2,
        status: "error",
        output: errorMessage,
        durationMs,
      },
      responses: [],
    };
  }
}

async function runInformationExtraction(
  query: string,
  proposerResponses: ModelResponseData[],
  onUpdate?: (
    status: "running" | "completed" | "error",
    output?: string
  ) => void
): Promise<SynthesisPipelineStageData> {
  const startTime = Date.now();
  onUpdate?.("running");

  try {
    const fastModel = getCerebrasForIntermediateStages();

    const completedResponses = proposerResponses.filter(
      r => r.status === "completed" && r.content
    );
    console.log(
      `[Synthesis:Extraction] Using Cerebras for fast extraction (${completedResponses.length} responses)`
    );

    if (completedResponses.length === 0) {
      throw new Error("No model responses with content to extract from");
    }

    let prompt = `## Original Query\n${query}\n\n## Model Responses\n\n`;
    for (const response of completedResponses) {
      prompt += `### ${response.modelName}\n${response.content}\n\n---\n\n`;
    }
    prompt += `\nExtract and organize the key information from these responses.`;

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user", content: prompt },
    ];

    const response = await withTimeout(
      queryModel(fastModel, { messages, stream: false }),
      INTERMEDIATE_STAGE_TIMEOUT_MS,
      {
        modelId: fastModel.id,
        modelName: fastModel.name,
        content: "Extraction timed out. Using raw proposer responses.",
        status: "completed" as const,
      }
    );

    const durationMs = Date.now() - startTime;
    onUpdate?.("completed", response.content);

    return {
      stageName: "information_extraction",
      stageOrder: 3,
      status: "completed",
      output: response.content,
      durationMs,
      metadata: {
        model: fastModel.id,
        tokens: (response.inputTokens || 0) + (response.outputTokens || 0),
        cost: response.cost,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    onUpdate?.("error", errorMessage);

    return {
      stageName: "information_extraction",
      stageOrder: 3,
      status: "error",
      output: errorMessage,
      durationMs,
    };
  }
}

async function runGapDetection(
  query: string,
  extractedInfo: string,
  onUpdate?: (
    status: "running" | "completed" | "error",
    output?: string
  ) => void
): Promise<SynthesisPipelineStageData> {
  const startTime = Date.now();
  onUpdate?.("running");

  try {
    const fastModel = getCerebrasForIntermediateStages();
    console.log(`[Synthesis:GapDetection] Using Cerebras for fast analysis`);

    const prompt = `## Original Query\n${query}\n\n## Extracted Information\n${extractedInfo}\n\nIdentify gaps and conflicts in this information.`;

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: GAP_DETECTION_PROMPT },
      { role: "user", content: prompt },
    ];

    const response = await withTimeout(
      queryModel(fastModel, { messages, stream: false }),
      INTERMEDIATE_STAGE_TIMEOUT_MS,
      {
        modelId: fastModel.id,
        modelName: fastModel.name,
        content: "Gap detection timed out. No gaps identified.",
        status: "completed" as const,
      }
    );

    const durationMs = Date.now() - startTime;
    onUpdate?.("completed", response.content);

    return {
      stageName: "gap_detection",
      stageOrder: 4,
      status: "completed",
      output: response.content,
      durationMs,
      metadata: {
        model: fastModel.id,
        tokens: (response.inputTokens || 0) + (response.outputTokens || 0),
        cost: response.cost,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    onUpdate?.("error", errorMessage);

    return {
      stageName: "gap_detection",
      stageOrder: 4,
      status: "error",
      output: errorMessage,
      durationMs,
    };
  }
}

async function runMetaSynthesis(
  query: string,
  webSearchResults: string,
  extractedInfo: string,
  gapAnalysis: string,
  speedTier: SpeedTier,
  onUpdate?: (
    status: "running" | "completed" | "error",
    output?: string
  ) => void
): Promise<SynthesisPipelineStageData> {
  const startTime = Date.now();
  onUpdate?.("running");

  try {
    const synthesizer = getClaudeForFinalSynthesis(speedTier);
    console.log(
      `[Synthesis:Meta] Using ${synthesizer.name} for final synthesis`
    );

    const prompt = `## Original Query
${query}

## Web Search Results
${webSearchResults}

## Extracted Information from Model Responses
${extractedInfo}

## Gap and Conflict Analysis
${gapAnalysis}

Create the ultimate synthesis that addresses the query comprehensively.`;

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: getMetaSynthesisPrompt() },
      { role: "user", content: prompt },
    ];

    const response = await withTimeout(
      queryModel(synthesizer, { messages, stream: false }),
      FINAL_SYNTHESIS_TIMEOUT_MS,
      {
        modelId: synthesizer.id,
        modelName: synthesizer.name,
        content: `Based on the available information:\n\n${extractedInfo.slice(0, 2000)}`,
        status: "completed" as const,
      }
    );

    const durationMs = Date.now() - startTime;
    onUpdate?.("completed", response.content);

    return {
      stageName: "meta_synthesis",
      stageOrder: 5,
      status: "completed",
      output: response.content,
      durationMs,
      metadata: {
        model: synthesizer.id,
        tokens: (response.inputTokens || 0) + (response.outputTokens || 0),
        cost: response.cost,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    onUpdate?.("error", errorMessage);

    return {
      stageName: "meta_synthesis",
      stageOrder: 5,
      status: "error",
      output: errorMessage,
      durationMs,
    };
  }
}

// ============================================================================
// Main Synthesis Function
// ============================================================================

export async function generateSynthesis(
  options: SynthesisOptions
): Promise<SynthesisResult> {
  const startTime = Date.now();

  const {
    query,
    speedTier,
    conversationHistory = [],
    onStageUpdate,
    onModelUpdate,
  } = options;

  const stages: SynthesisPipelineStageData[] = [];
  let proposerResponses: ModelResponseData[] = [];

  console.log(
    "[Synthesis:Parallel] Starting Web Search and Proposers concurrently"
  );
  onStageUpdate?.("web_search", "running");

  const webSearchPromise = runWebSearch(
    query,
    conversationHistory,
    (status, output) => onStageUpdate?.("web_search", status, output)
  );

  const proposerPromise = runParallelProposers(
    query,
    "",
    speedTier,
    conversationHistory,
    (status, output) => onStageUpdate?.("parallel_proposers", status, output),
    onModelUpdate
  );

  const [webSearchStage, proposerResult] = await Promise.all([
    webSearchPromise,
    proposerPromise,
  ]);

  stages.push(webSearchStage);

  if (webSearchStage.status === "error") {
    // Continue with empty web search results
    webSearchStage.output =
      "Web search unavailable. Proceeding with model knowledge only.";
  }

  stages.push(proposerResult.stage);
  proposerResponses = proposerResult.responses;

  if (
    proposerResult.responses.filter(r => r.status === "completed" && r.content)
      .length === 0
  ) {
    throw new Error("All proposer models failed or returned empty responses");
  }

  const extractionStage = await runInformationExtraction(
    query,
    proposerResponses,
    (status, output) =>
      onStageUpdate?.("information_extraction", status, output)
  );
  stages.push(extractionStage);

  const gapStage = await runGapDetection(
    query,
    extractionStage.output || "",
    (status, output) => onStageUpdate?.("gap_detection", status, output)
  );
  stages.push(gapStage);

  // Stage 5: Meta-Synthesis
  const synthesisStage = await runMetaSynthesis(
    query,
    webSearchStage.output || "",
    extractionStage.output || "",
    gapStage.output || "",
    speedTier,
    (status, output) => onStageUpdate?.("meta_synthesis", status, output)
  );
  stages.push(synthesisStage);

  // Calculate totals
  const totalLatencyMs = Date.now() - startTime;

  const proposerTokens = proposerResponses.reduce(
    (acc, r) => acc + (r.inputTokens || 0) + (r.outputTokens || 0),
    0
  );
  const stageTokens = stages.reduce(
    (acc, s) => acc + ((s.metadata?.tokens as number) || 0),
    0
  );
  const totalTokens = proposerTokens + stageTokens;

  const proposerCost = proposerResponses.reduce(
    (acc, r) => acc + (r.cost || 0),
    0
  );
  const stageCost = stages.reduce(
    (acc, s) => acc + ((s.metadata?.cost as number) || 0),
    0
  );
  const totalCost = proposerCost + stageCost;

  // Parse gaps and conflicts from gap detection output
  const gapsIdentified = parseGaps(gapStage.output || "");
  const conflictsResolved = parseConflicts(gapStage.output || "");

  return {
    finalSynthesis: synthesisStage.output || "",
    stages,
    webSearchResults: webSearchStage.output,
    proposerResponses,
    gapsIdentified,
    conflictsResolved,
    totalLatencyMs,
    totalTokens,
    totalCost,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseGaps(gapAnalysis: string): string[] {
  const gaps: string[] = [];
  const gapMatch = gapAnalysis.match(
    /Information Gaps[:\s]*\n([\s\S]*?)(?=\n##|\n\*\*|$)/i
  );
  if (gapMatch) {
    const lines = gapMatch[1]
      .split("\n")
      .filter(l => l.trim().startsWith("-") || l.trim().startsWith("•"));
    gaps.push(
      ...lines.map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean)
    );
  }
  return gaps;
}

function parseConflicts(gapAnalysis: string): string[] {
  const conflicts: string[] = [];
  const conflictMatch = gapAnalysis.match(
    /Conflicting Claims[:\s]*\n([\s\S]*?)(?=\n##|\n\*\*|$)/i
  );
  if (conflictMatch) {
    const lines = conflictMatch[1]
      .split("\n")
      .filter(l => l.trim().startsWith("-") || l.trim().startsWith("•"));
    conflicts.push(
      ...lines.map(l => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean)
    );
  }
  return conflicts;
}
