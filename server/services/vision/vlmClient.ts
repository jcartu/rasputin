import * as fs from "fs/promises";
import * as path from "path";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

export async function analyzeScreenshot(
  request: VLMRequest,
  preferredModel: "claude" | "gpt4" = "claude"
): Promise<VLMResponse> {
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
    "No VLM API key configured (need ANTHROPIC_API_KEY or OPENAI_API_KEY)"
  );
}
