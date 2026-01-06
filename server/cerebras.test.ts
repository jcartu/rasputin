import { describe, it, expect } from "vitest";

describe("Cerebras Integration", () => {
  it("should have CEREBRAS_API_KEY set", () => {
    expect(process.env.CEREBRAS_API_KEY).toBeDefined();
    expect(process.env.CEREBRAS_API_KEY).not.toBe("");
  });

  it("should be able to call Cerebras API", async () => {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) {
      throw new Error("CEREBRAS_API_KEY not set");
    }

    // Use OpenAI-compatible endpoint with Cerebras
    const response = await fetch(
      "https://api.cerebras.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b",
          messages: [
            {
              role: "user",
              content: "Say 'hello' and nothing else.",
            },
          ],
          max_tokens: 10,
        }),
      }
    );

    const data = await response.json();
    console.log("Response status:", response.status);
    console.log("Response data:", JSON.stringify(data, null, 2));
    expect(response.ok).toBe(true);
    expect(data.choices).toBeDefined();
    expect(data.choices.length).toBeGreaterThan(0);
    expect(data.choices[0].message.content).toBeDefined();
    console.log("Cerebras API response:", data.choices[0].message.content);
  }, 30000); // 30 second timeout

  it("should have Cerebras models in FRONTIER_MODELS", async () => {
    const { FRONTIER_MODELS } = await import("../shared/rasputin");

    const cerebrasModels = FRONTIER_MODELS.filter(
      m => m.provider === "cerebras"
    );
    expect(cerebrasModels.length).toBeGreaterThan(0);

    // Check Llama model exists
    const llamaModel = cerebrasModels.find(m => m.id === "cerebras-llama-70b");
    expect(llamaModel).toBeDefined();
    expect(llamaModel?.name).toBe("Cerebras Llama 3.3 70B");
    expect(llamaModel?.supportsStreaming).toBe(true);
  });

  it("should include Cerebras models in fast tier", async () => {
    const { getModelsForTier } = await import("../shared/rasputin");

    const fastModels = getModelsForTier("fast");
    const cerebrasInFast = fastModels.filter(m => m.provider === "cerebras");

    expect(cerebrasInFast.length).toBeGreaterThan(0);
    expect(cerebrasInFast.some(m => m.id === "cerebras-llama-70b")).toBe(true);
  });
});
