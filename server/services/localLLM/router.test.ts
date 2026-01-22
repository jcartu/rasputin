/**
 * Tests for Local LLM Router
 */

import { describe, it, expect, beforeEach } from "vitest";
import { LocalLLMRouter, getLocalLLMRouter } from "./router";
import type { LocalLLMConfig } from "./types";

describe("LocalLLMRouter", () => {
  let router: LocalLLMRouter;

  beforeEach(() => {
    // Create a fresh router for each test
    router = new LocalLLMRouter({
      ollamaBaseUrl: "http://localhost:11434",
      vllmBaseUrl: "http://localhost:8000",
      preferLocal: true,
      fallbackToCloud: true,
    });
  });

  describe("Configuration", () => {
    it("should initialize with default configuration", () => {
      const defaultRouter = getLocalLLMRouter();
      expect(defaultRouter).toBeDefined();
    });

    it("should accept custom configuration", () => {
      const config: LocalLLMConfig = {
        ollamaUrl: "http://custom:11434",
        vllmUrl: "http://custom:8000",
        defaultProvider: "vllm",
        fallbackToCloud: false,
        models: {},
      };
      const customRouter = new LocalLLMRouter(config);
      expect(customRouter).toBeDefined();
    });
  });

  describe("Model Selection", () => {
    it("should have complete method for chat completion", () => {
      expect(typeof router.complete).toBe("function");
    });

    it("should have checkHealth method", async () => {
      expect(typeof router.checkHealth).toBe("function");
    });
  });

  describe("Provider Detection", () => {
    it("should have getStatus method", () => {
      expect(typeof router.getStatus).toBe("function");
    });
  });

  describe("Singleton Pattern", () => {
    it("should return same instance from getLocalLLMRouter", () => {
      const router1 = getLocalLLMRouter();
      const router2 = getLocalLLMRouter();
      expect(router1).toBe(router2);
    });
  });

  describe("Chat Completion Interface", () => {
    it("should have complete method", () => {
      expect(typeof router.complete).toBe("function");
    });

    it("should have embed method", () => {
      expect(typeof router.embed).toBe("function");
    });

    it("should have completeStream method", () => {
      expect(typeof router.completeStream).toBe("function");
    });
  });

  describe("Health Check", () => {
    it("should have checkHealth method", () => {
      expect(typeof router.checkHealth).toBe("function");
    });

    it("should have getStatus method", () => {
      expect(typeof router.getStatus).toBe("function");
    });
  });
});

describe("Model Routing Logic", () => {
  it("should be configurable with custom options", () => {
    const router = new LocalLLMRouter({
      ollamaBaseUrl: "http://custom:11434",
      preferLocal: false,
      fallbackToCloud: true,
    });

    expect(router).toBeDefined();
    expect(typeof router.complete).toBe("function");
  });

  it("should support cloud fallback configuration", () => {
    const router = new LocalLLMRouter({
      fallbackToCloud: true,
    });

    expect(router).toBeDefined();
  });
});
