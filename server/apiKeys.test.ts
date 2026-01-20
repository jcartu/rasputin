import { describe, expect, it } from "vitest";

describe("API Keys Validation", () => {
  it("should have OPENROUTER_API_KEY set", () => {
    expect(process.env.OPENROUTER_API_KEY).toBeDefined();
    expect(process.env.OPENROUTER_API_KEY?.length).toBeGreaterThan(10);
  });

  it("should have ANTHROPIC_API_KEY set", () => {
    expect(process.env.ANTHROPIC_API_KEY).toBeDefined();
    expect(process.env.ANTHROPIC_API_KEY?.length).toBeGreaterThan(10);
  });

  it("should have GEMINI_API_KEY set", () => {
    expect(process.env.GEMINI_API_KEY).toBeDefined();
    expect(process.env.GEMINI_API_KEY?.length).toBeGreaterThan(10);
  });

  it("should have XAI_API_KEY set", () => {
    expect(process.env.XAI_API_KEY).toBeDefined();
    expect(process.env.XAI_API_KEY?.length).toBeGreaterThan(10);
  });

  it("should have SONAR_API_KEY set", () => {
    expect(process.env.SONAR_API_KEY).toBeDefined();
    expect(process.env.SONAR_API_KEY?.length).toBeGreaterThan(10);
  });

  it("should be able to call Anthropic API", async () => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say hi" }],
      }),
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.content).toBeDefined();
  }, 30000); // 30 second timeout for API call
});
