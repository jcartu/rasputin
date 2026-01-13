/**
 * Memory Service
 *
 * Persistent memory system for JARVIS with episodic, semantic, and procedural memory.
 */

export * from "./types";
export * from "./memoryService";
export * from "./warmMemory";

export { getMemoryService } from "./memoryService";
export {
  consolidateMemories,
  getWarmContext,
  runMemoryConsolidationJob,
} from "./warmMemory";
