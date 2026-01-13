import type { Action } from "../desktop/actionDSL";

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const ACTION_DSL_SCHEMA = `Action DSL Schema:

CLICK: { type: "CLICK", point?: {x, y}, target?: string, button?: "left"|"right"|"middle", double?: boolean, modifiers?: ["ctrl"|"alt"|"shift"][] }
TYPE: { type: "TYPE", text: string, clear?: boolean, submit?: boolean }
KEY: { type: "KEY", key: string, modifiers?: ["ctrl"|"alt"|"shift"][] }
SCROLL: { type: "SCROLL", direction: "up"|"down"|"left"|"right", amount?: number|"page" }
MOVE: { type: "MOVE", point: {x, y} }
DRAG: { type: "DRAG", from: {x, y}, to: {x, y} }
SCREENSHOT: { type: "SCREENSHOT" }
WAIT: { type: "WAIT", waitFor: "duration"|"idle"|"element", durationMs?: number, element?: string }
WINDOW: { type: "WINDOW", operation: "focus"|"minimize"|"maximize"|"close", window?: string }
LAUNCH: { type: "LAUNCH", app: string, args?: string[] }
CLIPBOARD: { type: "CLIPBOARD", operation: "copy"|"paste"|"set"|"get", text?: string }`;

function buildFormatterPrompt(
  naturalLanguageAction: string,
  screenContext?: string
): string {
  return `Convert this natural language action into Action DSL JSON.

${ACTION_DSL_SCHEMA}

Natural language action: "${naturalLanguageAction}"
${screenContext ? `Screen context: ${screenContext}` : ""}

Respond with ONLY valid JSON for a single action. No explanation, no markdown, just the JSON object.

Examples:
Input: "Click on the Submit button in the bottom right"
Output: {"type":"CLICK","target":"Submit button in bottom right","button":"left"}

Input: "Type hello world into the search box"
Output: {"type":"TYPE","text":"hello world"}

Input: "Press Ctrl+S"
Output: {"type":"KEY","key":"s","modifiers":["ctrl"]}

Input: "Scroll down"
Output: {"type":"SCROLL","direction":"down","amount":300}

Input: "Wait 2 seconds"
Output: {"type":"WAIT","waitFor":"duration","durationMs":2000}

Now convert: "${naturalLanguageAction}"`;
}

async function formatWithCerebras(
  naturalLanguageAction: string,
  screenContext?: string
): Promise<Action> {
  if (!CEREBRAS_API_KEY) {
    throw new Error("CEREBRAS_API_KEY not configured");
  }

  const prompt = buildFormatterPrompt(naturalLanguageAction, screenContext);

  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CEREBRAS_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 256,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cerebras API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content || "";

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to extract JSON from: ${content}`);
  }

  return JSON.parse(jsonMatch[0]) as Action;
}

async function formatWithOpenRouter(
  naturalLanguageAction: string,
  screenContext?: string
): Promise<Action> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const prompt = buildFormatterPrompt(naturalLanguageAction, screenContext);

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://rasputin.local",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 256,
        temperature: 0,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content || "";

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Failed to extract JSON from: ${content}`);
  }

  return JSON.parse(jsonMatch[0]) as Action;
}

function parseSimpleAction(naturalLanguageAction: string): Action | null {
  const lower = naturalLanguageAction.toLowerCase();

  if (lower.startsWith("click on") || lower.startsWith("click the")) {
    const target = naturalLanguageAction.replace(/^click (on |the )?/i, "");
    return {
      type: "CLICK",
      target,
      button: "left",
      double: false,
      modifiers: [],
    };
  }

  if (lower.startsWith("type ") || lower.startsWith("enter ")) {
    const textMatch = naturalLanguageAction.match(
      /(?:type|enter)\s+['"]?(.+?)['"]?(?:\s+into|\s+in|$)/i
    );
    if (textMatch) {
      return {
        type: "TYPE",
        text: textMatch[1],
        clear: false,
        submit: false,
        charByChar: false,
        charDelayMs: 50,
      };
    }
  }

  if (lower.startsWith("press ")) {
    const keyPart = naturalLanguageAction.replace(/^press\s+/i, "");
    const parts = keyPart.split("+").map(p => p.trim().toLowerCase());
    const modifiers: Array<"ctrl" | "alt" | "shift" | "meta" | "super"> = [];
    let key = parts[parts.length - 1];

    for (let i = 0; i < parts.length - 1; i++) {
      const mod = parts[i];
      if (mod === "ctrl" || mod === "control") modifiers.push("ctrl");
      else if (mod === "alt") modifiers.push("alt");
      else if (mod === "shift") modifiers.push("shift");
      else if (mod === "meta" || mod === "cmd" || mod === "command")
        modifiers.push("meta");
    }

    if (key === "enter" || key === "return") key = "Return";
    else if (key === "tab") key = "Tab";
    else if (key === "escape" || key === "esc") key = "Escape";
    else if (key === "backspace") key = "BackSpace";
    else if (key === "delete") key = "Delete";

    return { type: "KEY", key, modifiers, hold: false, release: false };
  }

  if (lower.includes("scroll down")) {
    return { type: "SCROLL", direction: "down", amount: 300 };
  }
  if (lower.includes("scroll up")) {
    return { type: "SCROLL", direction: "up", amount: 300 };
  }

  const waitMatch = lower.match(/wait (\d+)\s*(second|sec|s|millisecond|ms)?/);
  if (waitMatch) {
    const num = parseInt(waitMatch[1], 10);
    const unit = waitMatch[2] || "s";
    const ms = unit.startsWith("m") ? num : num * 1000;
    return {
      type: "WAIT",
      waitFor: "duration",
      durationMs: ms,
      timeoutMs: ms + 5000,
    };
  }

  return null;
}

export async function formatAction(
  naturalLanguageAction: string,
  screenContext?: string
): Promise<Action> {
  const simpleAction = parseSimpleAction(naturalLanguageAction);
  if (simpleAction) {
    return simpleAction;
  }

  if (CEREBRAS_API_KEY) {
    try {
      return await formatWithCerebras(naturalLanguageAction, screenContext);
    } catch (error) {
      console.error("[ActionFormatter] Cerebras failed:", error);
    }
  }

  if (OPENROUTER_API_KEY) {
    return await formatWithOpenRouter(naturalLanguageAction, screenContext);
  }

  throw new Error("No LLM API available for action formatting");
}
