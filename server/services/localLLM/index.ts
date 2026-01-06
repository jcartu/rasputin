/**
 * Local LLM Integration
 *
 * Provides intelligent routing between local models (Ollama, vLLM) and cloud APIs.
 * Supports automatic failover, model selection based on task type, and streaming.
 */

export * from "./types";
export * from "./ollama";
export * from "./vllm";
export * from "./router";

// Re-export main router for convenience
export { getLocalLLMRouter as getRouter } from "./router";
