import * as fs from "fs/promises";
import * as path from "path";
import { getGlobalPerceptionAdapter } from "../jarvis/v3/perceptionAdapter";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const USE_LOCAL_GPU = process.env.USE_LOCAL_GPU !== "false";

export type VisionProvider =
  | "gemini-fast"
  | "local"
  | "claude"
  | "gpt4"
  | "auto";

export interface FastVisionResponse {
  description: string;
  confidence: number;
  latencyMs: number;
  provider: string;
}

export interface VLMResponse {
  thinking: string;
  action: string | null;
  confidence: number;
  reasoning: string;
  isComplete: boolean;
  completionReason?: string;
}

export interface VLMRequest {
  screenshot: string;
  goal: string;
  previousActions: string[];
  currentState?: string;
  errorContext?: string;
}

async function imageToBase64(imagePath: string): Promise<string> {
  const buffer = await fs.readFile(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function buildVLMPrompt(request: VLMRequest): string {
  const actionHistory =
    request.previousActions.length > 0
      ? `Previous actions taken:\n${request.previousActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}`
      : "No previous actions taken yet.";

  const errorSection = request.errorContext
    ? `\nLast action failed with error: ${request.errorContext}\nPlease try a different approach.`
    : "";

  const stateSection = request.currentState
    ? `\nCurrent application state: ${request.currentState}`
    : "";

  return `You are a desktop automation agent analyzing a screenshot to complete a task.

GOAL: ${request.goal}

${actionHistory}
${stateSection}
${errorSection}

Analyze the screenshot and determine the next action to take.

RESPONSE FORMAT (JSON):
{
  "thinking": "Your analysis of what you see on screen and what needs to happen",
  "action": "Natural language description of the next action, or null if task is complete",
  "confidence": 0.0-1.0 confidence in this action,
  "reasoning": "Why this action will help achieve the goal",
  "isComplete": true/false whether the goal has been achieved,
  "completionReason": "If complete, explain why the goal is achieved"
}

ACTION EXAMPLES:
- "Click on the 'Submit' button in the bottom right corner"
- "Type 'hello world' into the search box"
- "Press Ctrl+S to save the document"
- "Scroll down to see more content"
- "Wait for the loading spinner to disappear"

IMPORTANT:
- Be specific about UI element locations (top-left, center, etc.)
- If you see an error message, describe it
- If the goal appears complete, set isComplete to true
- If stuck after multiple attempts, suggest a different approach`;
}

export async function analyzeWithClaude(
  request: VLMRequest
): Promise<VLMResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const imageData = await imageToBase64(request.screenshot);
  const prompt = buildVLMPrompt(request);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: imageData.split(";")[0].split(":")[1],
                data: imageData.split(",")[1],
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content = result.content[0]?.text || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    return JSON.parse(jsonMatch[0]) as VLMResponse;
  } catch {
    return {
      thinking: content,
      action: null,
      confidence: 0,
      reasoning: "Failed to parse structured response",
      isComplete: false,
    };
  }
}

export async function analyzeWithGPT4(
  request: VLMRequest
): Promise<VLMResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const imageData = await imageToBase64(request.screenshot);
  const prompt = buildVLMPrompt(request);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageData },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    return JSON.parse(jsonMatch[0]) as VLMResponse;
  } catch {
    return {
      thinking: content,
      action: null,
      confidence: 0,
      reasoning: "Failed to parse structured response",
      isComplete: false,
    };
  }
}

async function analyzeWithLocalGPU(request: VLMRequest): Promise<VLMResponse> {
  const imageData = await imageToBase64(request.screenshot);
  const base64Only = imageData.split(",")[1];
  const prompt = buildVLMPrompt(request);

  const adapter = await getGlobalPerceptionAdapter();
  const result = await adapter.analyzeImage(base64Only, prompt);

  try {
    const jsonMatch = result.description.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as VLMResponse;
    }
  } catch {
    // Fall through to structured extraction
  }

  return {
    thinking: result.description,
    action: extractActionFromDescription(result.description),
    confidence: result.confidence,
    reasoning: "Extracted from local GPU vision analysis",
    isComplete:
      result.description.toLowerCase().includes("complete") ||
      result.description.toLowerCase().includes("goal achieved"),
  };
}

function extractActionFromDescription(description: string): string | null {
  const actionPatterns = [
    /click\s+(?:on\s+)?(?:the\s+)?["']?([^"'\n.]+)["']?/i,
    /type\s+["']([^"']+)["']/i,
    /press\s+([A-Za-z+]+)/i,
    /scroll\s+(up|down|left|right)/i,
    /wait\s+for\s+(.+)/i,
  ];

  for (const pattern of actionPatterns) {
    const match = description.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

async function isLocalGPUAvailable(): Promise<boolean> {
  if (!USE_LOCAL_GPU) return false;

  try {
    const adapter = await getGlobalPerceptionAdapter();
    const status = await adapter.getStatus();
    return status.available && status.services.vision;
  } catch {
    return false;
  }
}

export async function analyzeWithGeminiFast(
  imageBase64: string,
  prompt: string,
  model: string = "gemini-2.5-flash-lite"
): Promise<FastVisionResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const startTime = Date.now();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/png", data: imageBase64 } },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 500 },
      }),
    }
  );

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content =
    result.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

  return {
    description: content,
    confidence: 0.9,
    latencyMs,
    provider: model,
  };
}

export async function fastVisionAnalyze(
  imageBase64: string,
  prompt: string,
  provider: VisionProvider = "auto"
): Promise<FastVisionResponse> {
  const providerChain: VisionProvider[] =
    provider === "auto" ? ["gemini-fast", "local", "claude"] : [provider];

  let lastError: Error | null = null;

  for (const p of providerChain) {
    try {
      switch (p) {
        case "gemini-fast":
          if (GEMINI_API_KEY) {
            return await analyzeWithGeminiFast(imageBase64, prompt);
          }
          break;

        case "local":
          if (await isLocalGPUAvailable()) {
            const adapter = await getGlobalPerceptionAdapter();
            const startTime = Date.now();
            const result = await adapter.analyzeImage(imageBase64, prompt);
            return {
              description: result.description,
              confidence: result.confidence,
              latencyMs: Date.now() - startTime,
              provider: "local-ollama",
            };
          }
          break;

        case "claude":
          if (ANTHROPIC_API_KEY) {
            const startTime = Date.now();
            const response = await fetch(
              "https://api.anthropic.com/v1/messages",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-api-key": ANTHROPIC_API_KEY,
                  "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify({
                  model: "claude-3-haiku-20240307",
                  max_tokens: 500,
                  messages: [
                    {
                      role: "user",
                      content: [
                        { type: "text", text: prompt },
                        {
                          type: "image",
                          source: {
                            type: "base64",
                            media_type: "image/png",
                            data: imageBase64,
                          },
                        },
                      ],
                    },
                  ],
                }),
              }
            );

            if (!response.ok) {
              throw new Error(`Claude API error: ${response.status}`);
            }

            const result = await response.json();
            return {
              description: result.content?.[0]?.text || "No response",
              confidence: 0.9,
              latencyMs: Date.now() - startTime,
              provider: "claude-3-haiku",
            };
          }
          break;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Vision provider ${p} failed:`, lastError.message);
    }
  }

  throw lastError || new Error("No vision provider available");
}

export async function analyzeScreenshot(
  request: VLMRequest,
  preferredModel: "claude" | "gpt4" | "local" | "gemini-fast" = "gemini-fast"
): Promise<VLMResponse> {
  if (preferredModel === "gemini-fast" && GEMINI_API_KEY) {
    try {
      const imageData = await imageToBase64(request.screenshot);
      const base64Only = imageData.split(",")[1];
      const prompt = buildVLMPrompt(request);

      const result = await analyzeWithGeminiFast(base64Only, prompt);

      try {
        const jsonMatch = result.description.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as VLMResponse;
        }
      } catch {
        // Fall through to structured extraction
      }

      return {
        thinking: result.description,
        action: extractActionFromDescription(result.description),
        confidence: result.confidence,
        reasoning: `Analyzed by ${result.provider} in ${result.latencyMs}ms`,
        isComplete:
          result.description.toLowerCase().includes("complete") ||
          result.description.toLowerCase().includes("goal achieved"),
      };
    } catch (error) {
      console.error("Gemini fast vision failed, falling back:", error);
    }
  }

  if (preferredModel === "local" || (await isLocalGPUAvailable())) {
    try {
      return await analyzeWithLocalGPU(request);
    } catch (error) {
      console.error("Local GPU vision failed, falling back to cloud:", error);
    }
  }

  if (preferredModel === "claude" && ANTHROPIC_API_KEY) {
    return analyzeWithClaude(request);
  }
  if (OPENAI_API_KEY) {
    return analyzeWithGPT4(request);
  }
  if (ANTHROPIC_API_KEY) {
    return analyzeWithClaude(request);
  }
  throw new Error(
    "No VLM available (local GPU unavailable, no cloud API keys)"
  );
}
