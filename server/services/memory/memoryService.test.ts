/**
 * Tests for Memory Service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryService, getMemoryService } from "./memoryService";

// Mock the database
vi.mock("../../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

describe("MemoryService", () => {
  let memoryService: MemoryService;

  beforeEach(() => {
    memoryService = new MemoryService();
  });

  describe("Singleton Pattern", () => {
    it("should return same instance from getMemoryService", () => {
      const service1 = getMemoryService();
      const service2 = getMemoryService();
      expect(service1).toBe(service2);
    });
  });

  describe("Embedding Generation", () => {
    it("should generate embedding for text", async () => {
      const embedding = await memoryService.generateEmbedding("test text");
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it("should generate consistent embeddings for same text", async () => {
      const text = "consistent test text";
      const embedding1 = await memoryService.generateEmbedding(text);
      const embedding2 = await memoryService.generateEmbedding(text);

      // Should be cached and return same result
      expect(embedding1).toEqual(embedding2);
    });

    it("should generate different embeddings for different text", async () => {
      const embedding1 = await memoryService.generateEmbedding("first text");
      const embedding2 = await memoryService.generateEmbedding(
        "completely different text"
      );

      // Should be different
      expect(embedding1).not.toEqual(embedding2);
    });

    it("should return normalized embeddings", async () => {
      const embedding = await memoryService.generateEmbedding("normalize test");

      // Calculate L2 norm
      const norm = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0)
      );

      // Should be approximately 1 (normalized)
      expect(norm).toBeCloseTo(1, 1);
    });
  });

  describe("Memory Operations (with null DB)", () => {
    it("should handle null database gracefully for episodic search", async () => {
      const results = await memoryService.searchEpisodicMemories("test query");
      expect(results).toEqual([]);
    });

    it("should handle null database gracefully for semantic search", async () => {
      const results = await memoryService.searchSemanticMemories("test query");
      expect(results).toEqual([]);
    });

    it("should handle null database gracefully for procedural search", async () => {
      const results =
        await memoryService.searchProceduralMemories("test query");
      expect(results).toEqual([]);
    });

    it("should handle null database gracefully for unified search", async () => {
      const results = await memoryService.search({ query: "test query" });
      expect(results).toEqual([]);
    });

    it("should handle null database gracefully for context retrieval", async () => {
      const context = await memoryService.getContextForTask("test task");
      expect(context.relevantEpisodes).toEqual([]);
      expect(context.relevantKnowledge).toEqual([]);
      expect(context.relevantProcedures).toEqual([]);
    });

    it("should return empty stats when database is null", async () => {
      const stats = await memoryService.getStats();
      expect(stats.totalEpisodic).toBe(0);
      expect(stats.totalSemantic).toBe(0);
      expect(stats.totalProcedural).toBe(0);
    });
  });

  describe("Context Retrieval", () => {
    it("should return context with timing information", async () => {
      const context = await memoryService.getContextForTask("test task");
      expect(context.retrievalTimeMs).toBeDefined();
      expect(typeof context.retrievalTimeMs).toBe("number");
    });

    it("should return total memories count", async () => {
      const context = await memoryService.getContextForTask("test task");
      expect(context.totalMemoriesRetrieved).toBeDefined();
      expect(typeof context.totalMemoriesRetrieved).toBe("number");
    });
  });

  describe("Knowledge Retrieval", () => {
    it("should handle getKnowledgeAbout with null database", async () => {
      const knowledge = await memoryService.getKnowledgeAbout("test subject");
      expect(knowledge).toEqual([]);
    });
  });

  describe("Procedure Finding", () => {
    it("should handle findProcedureForTask with null database", async () => {
      const procedure = await memoryService.findProcedureForTask("test task");
      expect(procedure).toBeNull();
    });
  });

  describe("Training Data", () => {
    it("should handle getUnusedTrainingData with null database", async () => {
      const data = await memoryService.getUnusedTrainingData();
      expect(data).toEqual([]);
    });
  });
});

describe("Embedding Consistency", () => {
  it("should generate embeddings of consistent length", async () => {
    const service = new MemoryService();

    const embedding1 = await service.generateEmbedding("short text");
    const embedding2 = await service.generateEmbedding(
      "this is a much longer text with more words"
    );

    // Both should have same dimensions
    expect(embedding1.length).toBe(embedding2.length);
  });

  it("should generate non-zero embeddings", async () => {
    const service = new MemoryService();
    const embedding = await service.generateEmbedding("test text");

    // At least some values should be non-zero
    const hasNonZero = embedding.some(v => v !== 0);
    expect(hasNonZero).toBe(true);
  });
});
