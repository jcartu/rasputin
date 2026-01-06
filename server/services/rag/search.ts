/**
 * RAG Search Service
 * Semantic search over indexed codebases
 */

import { getDb } from "../../db";
import {
  codeChunks,
  codeSymbols,
  codeRelationships,
} from "../../../drizzle/schema";
import { eq, and, like, or } from "drizzle-orm";
import {
  CodeChunk,
  CodeSymbol,
  CodeRelationship,
  SearchResult,
  CodeContext,
  ChunkMetadata,
} from "./types";
import { generateEmbedding, cosineSimilarity } from "./embeddings";

export class CodeSearch {
  /**
   * Semantic search over code chunks (router entry point)
   */
  async search(
    userId: number,
    query: string,
    projectId?: number,
    limit?: number
  ): Promise<SearchResult[]> {
    if (projectId) {
      return this.searchProject(projectId, query, { limit: limit || 10 });
    }
    // Search across all user's projects
    const db = await getDb();
    if (!db) return [];

    const { codebaseProjects } = await import("../../../drizzle/schema");
    const projects = await db
      .select()
      .from(codebaseProjects)
      .where(eq(codebaseProjects.userId, userId));

    const allResults: SearchResult[] = [];
    for (const project of projects) {
      const results = await this.searchProject(project.id, query, { limit: 5 });
      allResults.push(...results);
    }

    return allResults.sort((a, b) => b.score - a.score).slice(0, limit || 10);
  }

  /**
   * Semantic search over code chunks in a specific project
   */
  async searchProject(
    projectId: number,
    query: string,
    options: {
      limit?: number;
      minScore?: number;
      chunkTypes?: string[];
      filePath?: string;
    } = {}
  ): Promise<SearchResult[]> {
    const db = await getDb();
    if (!db) return [];

    const { limit = 10, minScore = 0.3, chunkTypes, filePath } = options;

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Get all chunks for the project
    let chunks = await db
      .select()
      .from(codeChunks)
      .where(eq(codeChunks.projectId, projectId));

    // Filter by chunk type if specified
    if (chunkTypes && chunkTypes.length > 0) {
      chunks = chunks.filter(c => chunkTypes.includes(c.chunkType || "other"));
    }

    // Filter by file path if specified
    if (filePath) {
      chunks = chunks.filter(c => c.filePath.includes(filePath));
    }

    // Calculate similarity scores
    const results: SearchResult[] = [];

    for (const chunk of chunks) {
      let score = 0;

      // Try embedding-based similarity first
      if (chunk.embedding && Array.isArray(chunk.embedding)) {
        score = cosineSimilarity(queryEmbedding, chunk.embedding);
      } else {
        // Text-based similarity
        score = this.textSimilarity(query, chunk.content);
      }

      if (score >= minScore) {
        results.push({
          chunk: this.rowToChunk(chunk),
          score,
          highlights: this.extractHighlights(query, chunk.content),
        });
      }
    }

    // Sort by score and limit
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Search for symbols by name
   */
  async searchSymbols(
    projectId: number,
    query: string,
    options: {
      limit?: number;
      symbolTypes?: string[];
    } = {}
  ): Promise<CodeSymbol[]> {
    const db = await getDb();
    if (!db) return [];

    const { limit = 20, symbolTypes } = options;

    let symbols = await db
      .select()
      .from(codeSymbols)
      .where(
        and(
          eq(codeSymbols.projectId, projectId),
          like(codeSymbols.name, `%${query}%`)
        )
      )
      .limit(limit);

    if (symbolTypes && symbolTypes.length > 0) {
      symbols = symbols.filter(s => symbolTypes.includes(s.symbolType));
    }

    return symbols.map(row => ({
      id: row.id,
      projectId: row.projectId,
      chunkId: row.chunkId,
      name: row.name,
      symbolType: row.symbolType as CodeSymbol["symbolType"],
      filePath: row.filePath,
      line: row.line,
      signature: row.signature || undefined,
      docstring: row.docstring || undefined,
      isExported: row.isExported === 1,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Get context for a specific chunk (related code)
   */
  async getChunkContext(
    projectId: number,
    chunkId: number,
    options: {
      includeRelated?: boolean;
      includeSymbols?: boolean;
      maxRelated?: number;
    } = {}
  ): Promise<CodeContext> {
    const db = await getDb();
    if (!db) {
      return {
        relevantChunks: [],
        symbols: [],
        relationships: [],
        summary: "",
      };
    }

    const {
      includeRelated = true,
      includeSymbols = true,
      maxRelated = 5,
    } = options;

    // Get the target chunk
    const [chunk] = await db
      .select()
      .from(codeChunks)
      .where(eq(codeChunks.id, chunkId))
      .limit(1);

    if (!chunk) {
      return {
        relevantChunks: [],
        symbols: [],
        relationships: [],
        summary: "Chunk not found",
      };
    }

    const relevantChunks: SearchResult[] = [
      {
        chunk: this.rowToChunk(chunk),
        score: 1.0,
      },
    ];

    // Get related chunks
    if (includeRelated) {
      // Get chunks from the same file
      const sameFileChunks = await db
        .select()
        .from(codeChunks)
        .where(
          and(
            eq(codeChunks.projectId, projectId),
            eq(codeChunks.filePath, chunk.filePath)
          )
        )
        .limit(maxRelated);

      for (const related of sameFileChunks) {
        if (related.id !== chunkId) {
          relevantChunks.push({
            chunk: this.rowToChunk(related),
            score: 0.8,
          });
        }
      }

      // Get chunks via relationships
      const relationships = await db
        .select()
        .from(codeRelationships)
        .where(
          and(
            eq(codeRelationships.projectId, projectId),
            or(
              eq(codeRelationships.sourceChunkId, chunkId),
              eq(codeRelationships.targetChunkId, chunkId)
            )
          )
        );

      for (const rel of relationships) {
        const relatedChunkId =
          rel.sourceChunkId === chunkId ? rel.targetChunkId : rel.sourceChunkId;

        if (relatedChunkId) {
          const [relatedChunk] = await db
            .select()
            .from(codeChunks)
            .where(eq(codeChunks.id, relatedChunkId))
            .limit(1);

          if (relatedChunk) {
            relevantChunks.push({
              chunk: this.rowToChunk(relatedChunk),
              score: 0.7,
            });
          }
        }
      }
    }

    // Get symbols
    let symbols: CodeSymbol[] = [];
    if (includeSymbols) {
      const symbolRows = await db
        .select()
        .from(codeSymbols)
        .where(eq(codeSymbols.chunkId, chunkId));

      symbols = symbolRows.map(row => ({
        id: row.id,
        projectId: row.projectId,
        chunkId: row.chunkId,
        name: row.name,
        symbolType: row.symbolType as CodeSymbol["symbolType"],
        filePath: row.filePath,
        line: row.line,
        signature: row.signature || undefined,
        docstring: row.docstring || undefined,
        isExported: row.isExported === 1,
        createdAt: row.createdAt,
      }));
    }

    // Get relationships
    const relationshipRows = await db
      .select()
      .from(codeRelationships)
      .where(
        and(
          eq(codeRelationships.projectId, projectId),
          or(
            eq(codeRelationships.sourceChunkId, chunkId),
            eq(codeRelationships.targetChunkId, chunkId)
          )
        )
      );

    const relationships: CodeRelationship[] = relationshipRows
      .filter(row => row.targetChunkId !== null)
      .map(row => ({
        id: row.id,
        projectId: row.projectId,
        sourceChunkId: row.sourceChunkId,
        targetChunkId: row.targetChunkId!,
        relationshipType:
          row.relationshipType as CodeRelationship["relationshipType"],
        createdAt: row.createdAt,
      }));

    // Generate summary
    const summary = this.generateContextSummary(
      this.rowToChunk(chunk),
      symbols,
      relationships
    );

    return {
      relevantChunks,
      symbols,
      relationships,
      summary,
    };
  }

  /**
   * Get code for answering a question
   */
  async getCodeForQuestion(
    projectId: number,
    question: string,
    options: {
      maxChunks?: number;
      includeContext?: boolean;
    } = {}
  ): Promise<{
    relevantCode: SearchResult[];
    context: string;
  }> {
    const { maxChunks = 5, includeContext = true } = options;

    // Search for relevant chunks
    const searchResults = await this.searchProject(projectId, question, {
      limit: maxChunks,
      minScore: 0.2,
    });

    // Build context string
    let context = "";

    for (const result of searchResults) {
      context += `\n### ${result.chunk.filePath} (lines ${result.chunk.startLine}-${result.chunk.endLine})\n`;
      context += "```" + (result.chunk.language || "") + "\n";
      context += result.chunk.content;
      context += "\n```\n";

      if (includeContext && result.chunk.symbolName) {
        context += `Symbol: ${result.chunk.symbolName}\n`;
      }
    }

    return {
      relevantCode: searchResults,
      context: context.trim(),
    };
  }

  /**
   * Text-based similarity (fallback when embeddings unavailable)
   */
  private textSimilarity(query: string, text: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const textLower = text.toLowerCase();

    let matches = 0;
    for (const term of queryTerms) {
      if (textLower.includes(term)) {
        matches++;
      }
    }

    return queryTerms.length > 0 ? matches / queryTerms.length : 0;
  }

  /**
   * Extract highlighted snippets from text
   */
  private extractHighlights(query: string, text: string): string[] {
    const highlights: string[] = [];
    const queryTerms = query.toLowerCase().split(/\s+/);
    const lines = text.split("\n");

    for (const line of lines) {
      const lineLower = line.toLowerCase();
      for (const term of queryTerms) {
        if (lineLower.includes(term) && line.trim().length > 0) {
          highlights.push(line.trim());
          break;
        }
      }
      if (highlights.length >= 3) break;
    }

    return highlights;
  }

  /**
   * Convert database row to CodeChunk
   */
  private rowToChunk(row: typeof codeChunks.$inferSelect): CodeChunk {
    return {
      id: row.id,
      projectId: row.projectId,
      filePath: row.filePath,
      chunkType: (row.chunkType || "other") as CodeChunk["chunkType"],
      content: row.content,
      startLine: row.startLine,
      endLine: row.endLine,
      language: row.language || undefined,
      symbolName: row.symbolName || undefined,
      embedding: row.embedding || undefined,
      embeddingModel: row.embeddingModel || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Generate a summary of the context
   */
  private generateContextSummary(
    chunk: CodeChunk,
    symbols: CodeSymbol[],
    relationships: CodeRelationship[]
  ): string {
    const parts: string[] = [];

    parts.push(`File: ${chunk.filePath}`);
    parts.push(`Type: ${chunk.chunkType}`);

    if (chunk.symbolName) {
      parts.push(`Symbol: ${chunk.symbolName}`);
    }

    if (symbols.length > 0) {
      parts.push(
        `Defines ${symbols.length} symbol(s): ${symbols.map(s => s.name).join(", ")}`
      );
    }

    if (relationships.length > 0) {
      parts.push(`Has ${relationships.length} relationship(s)`);
    }

    return parts.join(" | ");
  }
}

// Singleton instance
export const codeSearch = new CodeSearch();
