import { describe, expect, it } from "vitest";
import {
  FRONTIER_MODELS,
  getModelsForTier,
  getSynthesizerModel,
} from "../../shared/rasputin";

describe("AI Models Configuration", () => {
  describe("FRONTIER_MODELS", () => {
    it("should have at least 5 frontier models configured", () => {
      expect(FRONTIER_MODELS.length).toBeGreaterThanOrEqual(5);
    });

    it("should have all required properties for each model", () => {
      for (const model of FRONTIER_MODELS) {
        expect(model.id).toBeDefined();
        expect(model.name).toBeDefined();
        expect(model.provider).toBeDefined();
        expect(model.contextWindow).toBeGreaterThan(0);
        expect(model.maxOutputTokens).toBeGreaterThan(0);
        expect(typeof model.supportsStreaming).toBe("boolean");
        expect(["fast", "normal", "max"]).toContain(model.tier);
      }
    });

    it("should have unique model IDs", () => {
      const ids = FRONTIER_MODELS.map(m => m.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should include models from all major providers", () => {
      const providers = new Set(FRONTIER_MODELS.map(m => m.provider));
      expect(providers.has("openai")).toBe(true);
      expect(providers.has("anthropic")).toBe(true);
      expect(providers.has("google")).toBe(true);
      expect(providers.has("xai")).toBe(true);
      expect(providers.has("perplexity")).toBe(true);
    });
  });

  describe("getModelsForTier", () => {
    it("should return fast tier models", () => {
      const fastModels = getModelsForTier("fast");
      expect(fastModels.length).toBeGreaterThan(0);
      // Fast tier should include Gemini Flash
      expect(fastModels.some(m => m.id.includes("flash"))).toBe(true);
    });

    it("should return normal tier models", () => {
      const normalModels = getModelsForTier("normal");
      expect(normalModels.length).toBeGreaterThan(0);
      // Normal tier should include base GPT-5 and Claude Sonnet
      expect(normalModels.some(m => m.id === "gpt-5")).toBe(true);
      expect(normalModels.some(m => m.id === "claude-sonnet-4.5")).toBe(true);
    });

    it("should return max tier models", () => {
      const maxModels = getModelsForTier("max");
      expect(maxModels.length).toBeGreaterThan(0);
      // Max tier should include pro versions
      expect(
        maxModels.some(m => m.id.includes("pro") || m.id.includes("opus"))
      ).toBe(true);
    });

    it("should return different models for different tiers", () => {
      const fastModels = getModelsForTier("fast");
      const maxModels = getModelsForTier("max");

      // Fast and max should have different model selections
      const fastIds = fastModels.map(m => m.id);
      const maxIds = maxModels.map(m => m.id);

      // At least some models should be different
      const allSame = fastIds.every(id => maxIds.includes(id));
      expect(allSame).toBe(false);
    });
  });

  describe("getSynthesizerModel", () => {
    it("should return Claude Opus for max tier", () => {
      const synthesizer = getSynthesizerModel("max");
      expect(synthesizer.id).toBe("claude-opus-4.5");
      expect(synthesizer.provider).toBe("anthropic");
    });

    it("should return Claude Sonnet for fast tier", () => {
      const synthesizer = getSynthesizerModel("fast");
      expect(synthesizer.id).toBe("claude-sonnet-4.5");
      expect(synthesizer.provider).toBe("anthropic");
    });

    it("should return Claude Sonnet for normal tier", () => {
      const synthesizer = getSynthesizerModel("normal");
      expect(synthesizer.id).toBe("claude-sonnet-4.5");
      expect(synthesizer.provider).toBe("anthropic");
    });

    it("should always return a valid model config", () => {
      for (const tier of ["fast", "normal", "max"] as const) {
        const synthesizer = getSynthesizerModel(tier);
        expect(synthesizer).toBeDefined();
        expect(synthesizer.id).toBeDefined();
        expect(synthesizer.contextWindow).toBeGreaterThan(0);
      }
    });
  });
});

describe("Model Context Windows", () => {
  it("should have context windows configured for long conversations", () => {
    // Most models should have at least 100k context (except some fast inference models)
    const largeContextModels = FRONTIER_MODELS.filter(
      m => m.provider !== "cerebras"
    );
    for (const model of largeContextModels) {
      expect(model.contextWindow).toBeGreaterThanOrEqual(100000);
    }

    // Cerebras models have smaller but still useful context windows
    const cerebrasModels = FRONTIER_MODELS.filter(
      m => m.provider === "cerebras"
    );
    for (const model of cerebrasModels) {
      expect(model.contextWindow).toBeGreaterThanOrEqual(32000);
    }
  });

  it("should have Gemini with the largest context window", () => {
    const geminiModels = FRONTIER_MODELS.filter(m => m.provider === "google");
    const maxContext = Math.max(...geminiModels.map(m => m.contextWindow));
    expect(maxContext).toBeGreaterThanOrEqual(1000000);
  });
});
