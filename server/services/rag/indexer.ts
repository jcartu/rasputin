/**
 * RAG Indexer
 * Parses and indexes codebases for semantic search
 */

import { getDb } from "../../db";
import {
  codebaseProjects,
  codeChunks,
  codeRelationships,
  codeSymbols,
} from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import * as fs from "fs/promises";
import * as path from "path";
import {
  CodebaseProject,
  CodeChunk,
  ChunkType,
  SymbolType,
  ProjectSettings,
  DEFAULT_PROJECT_SETTINGS,
  LANGUAGE_CONFIGS,
  IndexingProgress,
  ChunkMetadata,
} from "./types";
import { generateEmbedding } from "./embeddings";

export class CodebaseIndexer {
  private indexingProgress: Map<number, IndexingProgress> = new Map();

  /**
   * Create a new codebase project
   */
  async createProject(
    userId: number,
    name: string,
    sourcePath: string,
    options: {
      description?: string;
      sourceType?: "local" | "github" | "gitlab" | "ssh";
      branch?: string;
      includePatterns?: string[];
      excludePatterns?: string[];
    } = {}
  ): Promise<CodebaseProject> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [inserted] = await db
      .insert(codebaseProjects)
      .values({
        userId,
        name,
        sourcePath,
        description: options.description,
        sourceType: options.sourceType || "local",
        branch: options.branch || "main",
        includePatterns:
          options.includePatterns || DEFAULT_PROJECT_SETTINGS.includePatterns,
        excludePatterns:
          options.excludePatterns || DEFAULT_PROJECT_SETTINGS.excludePatterns,
        status: "pending",
        totalFiles: 0,
        totalChunks: 0,
        totalSymbols: 0,
      })
      .$returningId();

    return {
      id: inserted.id,
      userId,
      name,
      rootPath: sourcePath,
      description: options.description,
      status: "pending",
      totalFiles: 0,
      totalChunks: 0,
      totalSymbols: 0,
      settings: DEFAULT_PROJECT_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Index a codebase project
   */
  async indexProject(projectId: number): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get project
    const [project] = await db
      .select()
      .from(codebaseProjects)
      .where(eq(codebaseProjects.id, projectId))
      .limit(1);

    if (!project) throw new Error("Project not found");

    const settings: ProjectSettings = {
      ...DEFAULT_PROJECT_SETTINGS,
      includePatterns:
        project.includePatterns || DEFAULT_PROJECT_SETTINGS.includePatterns,
      excludePatterns:
        project.excludePatterns || DEFAULT_PROJECT_SETTINGS.excludePatterns,
    };

    // Initialize progress tracking
    const progress: IndexingProgress = {
      projectId,
      status: "indexing",
      totalFiles: 0,
      processedFiles: 0,
      totalChunks: 0,
      errors: [],
      startedAt: new Date(),
    };
    this.indexingProgress.set(projectId, progress);

    // Update project status
    await db
      .update(codebaseProjects)
      .set({ status: "indexing" })
      .where(eq(codebaseProjects.id, projectId));

    try {
      // Clear existing data
      await this.clearProjectData(projectId);

      // Discover files
      const files = await this.discoverFiles(project.sourcePath, settings);
      progress.totalFiles = files.length;

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        progress.currentFile = filePath;
        progress.processedFiles = i;

        try {
          await this.indexFile(
            projectId,
            project.sourcePath,
            filePath,
            settings
          );
        } catch (error) {
          progress.errors.push(
            `Error indexing ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      // Get final counts
      const chunks = await db
        .select()
        .from(codeChunks)
        .where(eq(codeChunks.projectId, projectId));

      const symbols = await db
        .select()
        .from(codeSymbols)
        .where(eq(codeSymbols.projectId, projectId));

      // Update project status
      await db
        .update(codebaseProjects)
        .set({
          status: "ready",
          totalFiles: files.length,
          totalChunks: chunks.length,
          totalSymbols: symbols.length,
          lastIndexedAt: new Date(),
        })
        .where(eq(codebaseProjects.id, projectId));

      progress.status = "ready";
      progress.totalChunks = chunks.length;
    } catch (error) {
      await db
        .update(codebaseProjects)
        .set({
          status: "error",
          lastError: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(codebaseProjects.id, projectId));

      progress.status = "error";
      throw error;
    }
  }

  /**
   * Clear existing project data
   */
  private async clearProjectData(projectId: number): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
      .delete(codeRelationships)
      .where(eq(codeRelationships.projectId, projectId));
    await db.delete(codeSymbols).where(eq(codeSymbols.projectId, projectId));
    await db.delete(codeChunks).where(eq(codeChunks.projectId, projectId));
  }

  /**
   * Discover files to index
   */
  private async discoverFiles(
    rootPath: string,
    settings: ProjectSettings
  ): Promise<string[]> {
    const files: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(rootPath, fullPath);

          // Check exclude patterns
          const isExcluded = settings.excludePatterns.some(pattern => {
            const regex = new RegExp(
              pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
            );
            return regex.test(relativePath);
          });

          if (isExcluded) continue;

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            // Check include patterns
            const isIncluded = settings.includePatterns.some(pattern => {
              const regex = new RegExp(
                pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*")
              );
              return regex.test(relativePath);
            });

            if (isIncluded) {
              // Check file size
              const stats = await fs.stat(fullPath);
              if (stats.size <= settings.maxFileSize) {
                files.push(fullPath);
              }
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    await walk(rootPath);
    return files;
  }

  /**
   * Index a single file
   */
  private async indexFile(
    projectId: number,
    rootPath: string,
    filePath: string,
    settings: ProjectSettings
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const content = await fs.readFile(filePath, "utf-8");
    const relativePath = path.relative(rootPath, filePath);
    const ext = path.extname(filePath);
    const language = this.detectLanguage(ext);

    // Create file-level chunk
    await db.insert(codeChunks).values({
      projectId,
      filePath: relativePath,
      chunkType: "other", // file-level
      content: content.slice(0, 10000), // Truncate for storage
      startLine: 1,
      endLine: content.split("\n").length,
      language,
      embeddingModel: settings.embeddingModel,
    });

    // Parse and create semantic chunks
    const chunks = this.parseCode(content, language, settings);

    for (const chunk of chunks) {
      // Map chunk type to schema enum
      const schemaChunkType = this.mapChunkType(chunk.type);

      const [inserted] = await db
        .insert(codeChunks)
        .values({
          projectId,
          filePath: relativePath,
          chunkType: schemaChunkType,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          language,
          symbolName: chunk.symbolName,
          embeddingModel: settings.embeddingModel,
        })
        .$returningId();

      // Extract and store symbols
      if (chunk.symbolName && chunk.symbolType) {
        const schemaSymbolType = this.mapSymbolType(chunk.symbolType);
        await db.insert(codeSymbols).values({
          projectId,
          chunkId: inserted.id,
          name: chunk.symbolName,
          symbolType: schemaSymbolType,
          filePath: relativePath,
          line: chunk.startLine,
          signature: chunk.signature,
          docstring: chunk.docstring,
          isExported: chunk.isExported ? 1 : 0,
        });
      }
    }

    // Generate embeddings asynchronously
    this.generateChunkEmbeddings(
      projectId,
      relativePath,
      settings.embeddingModel
    );
  }

  /**
   * Map chunk type to schema enum
   */
  private mapChunkType(
    type: ChunkType
  ): "function" | "class" | "method" | "module" | "comment" | "other" {
    const mapping: Record<
      ChunkType,
      "function" | "class" | "method" | "module" | "comment" | "other"
    > = {
      file: "other",
      function: "function",
      class: "class",
      method: "method",
      comment: "comment",
      import: "other",
      export: "other",
      variable: "other",
      type: "other",
      interface: "other",
    };
    return mapping[type] || "other";
  }

  /**
   * Map symbol type to schema enum
   */
  private mapSymbolType(
    type: SymbolType
  ):
    | "function"
    | "class"
    | "method"
    | "variable"
    | "constant"
    | "type"
    | "interface"
    | "enum"
    | "module" {
    return type;
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(ext: string): string {
    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
      if (config.extensions.includes(ext)) {
        return lang;
      }
    }
    return "unknown";
  }

  /**
   * Parse code into semantic chunks
   */
  private parseCode(
    content: string,
    language: string,
    settings: ProjectSettings
  ): Array<{
    type: ChunkType;
    content: string;
    startLine: number;
    endLine: number;
    symbolName?: string;
    symbolType?: SymbolType;
    parentSymbol?: string;
    signature?: string;
    docstring?: string;
    isExported?: boolean;
    metadata?: ChunkMetadata;
  }> {
    const chunks: Array<{
      type: ChunkType;
      content: string;
      startLine: number;
      endLine: number;
      symbolName?: string;
      symbolType?: SymbolType;
      parentSymbol?: string;
      signature?: string;
      docstring?: string;
      isExported?: boolean;
      metadata?: ChunkMetadata;
    }> = [];

    const config = LANGUAGE_CONFIGS[language];

    if (!config) {
      // Fallback to simple chunking
      return this.simpleChunk(content, settings);
    }

    // Find functions
    for (const pattern of config.functionPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        const startIndex = match.index;
        const startLine = content.slice(0, startIndex).split("\n").length;
        const funcName = match[1];
        const isExported = match[0].includes("export");

        // Find function body (simplified - looks for matching braces)
        const funcContent = this.extractFunctionBody(content, startIndex);
        const endLine = startLine + funcContent.split("\n").length - 1;

        chunks.push({
          type: "function",
          content: funcContent,
          startLine,
          endLine,
          symbolName: funcName,
          symbolType: "function",
          isExported,
          signature: match[0].split("{")[0].trim(),
          metadata: {
            linesOfCode: funcContent.split("\n").length,
          },
        });
      }
    }

    // Find classes
    for (const pattern of config.classPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        const startIndex = match.index;
        const startLine = content.slice(0, startIndex).split("\n").length;
        const className = match[1];
        const isExported = match[0].includes("export");

        const classContent = this.extractFunctionBody(content, startIndex);
        const endLine = startLine + classContent.split("\n").length - 1;

        chunks.push({
          type: "class",
          content: classContent,
          startLine,
          endLine,
          symbolName: className,
          symbolType: "class",
          isExported,
          metadata: {
            linesOfCode: classContent.split("\n").length,
          },
        });
      }
    }

    // If no semantic chunks found, fall back to simple chunking
    if (chunks.length === 0) {
      return this.simpleChunk(content, settings);
    }

    return chunks;
  }

  /**
   * Extract function/class body by matching braces
   */
  private extractFunctionBody(content: string, startIndex: number): string {
    let braceCount = 0;
    let started = false;
    let endIndex = startIndex;

    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];

      if (char === "{") {
        braceCount++;
        started = true;
      } else if (char === "}") {
        braceCount--;
      }

      if (started && braceCount === 0) {
        endIndex = i + 1;
        break;
      }
    }

    return content.slice(startIndex, endIndex);
  }

  /**
   * Simple chunking fallback
   */
  private simpleChunk(
    content: string,
    settings: ProjectSettings
  ): Array<{
    type: ChunkType;
    content: string;
    startLine: number;
    endLine: number;
    metadata?: ChunkMetadata;
  }> {
    const chunks: Array<{
      type: ChunkType;
      content: string;
      startLine: number;
      endLine: number;
      metadata?: ChunkMetadata;
    }> = [];

    const chunkSize = settings.chunkSize;
    const overlap = settings.chunkOverlap;

    let currentChunk: string[] = [];
    let currentStartLine = 1;
    let charCount = 0;
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk.push(line);
      charCount += line.length + 1;

      if (charCount >= chunkSize) {
        chunks.push({
          type: "file",
          content: currentChunk.join("\n"),
          startLine: currentStartLine,
          endLine: currentStartLine + currentChunk.length - 1,
          metadata: {
            linesOfCode: currentChunk.length,
          },
        });

        // Calculate overlap
        const overlapLines = Math.ceil(
          overlap / (charCount / currentChunk.length)
        );
        currentChunk = currentChunk.slice(-overlapLines);
        currentStartLine = i - overlapLines + 2;
        charCount = currentChunk.join("\n").length;
      }
    }

    // Add remaining content
    if (currentChunk.length > 0) {
      chunks.push({
        type: "file",
        content: currentChunk.join("\n"),
        startLine: currentStartLine,
        endLine: currentStartLine + currentChunk.length - 1,
        metadata: {
          linesOfCode: currentChunk.length,
        },
      });
    }

    return chunks;
  }

  /**
   * Generate embeddings for chunks (async background task)
   */
  private async generateChunkEmbeddings(
    projectId: number,
    filePath: string,
    model: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    const chunks = await db
      .select()
      .from(codeChunks)
      .where(
        and(
          eq(codeChunks.projectId, projectId),
          eq(codeChunks.filePath, filePath)
        )
      );

    for (const chunk of chunks) {
      try {
        const embedding = await generateEmbedding(chunk.content, model);

        await db
          .update(codeChunks)
          .set({ embedding })
          .where(eq(codeChunks.id, chunk.id));
      } catch {
        // Skip embedding generation errors
      }
    }
  }

  /**
   * Get indexing progress
   */
  getProgress(projectId: number): IndexingProgress | null {
    return this.indexingProgress.get(projectId) || null;
  }

  /**
   * Get project by ID
   */
  async getProject(projectId: number): Promise<CodebaseProject | null> {
    const db = await getDb();
    if (!db) return null;

    const [row] = await db
      .select()
      .from(codebaseProjects)
      .where(eq(codebaseProjects.id, projectId))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      rootPath: row.sourcePath,
      description: row.description || undefined,
      status: row.status as CodebaseProject["status"],
      totalFiles: row.totalFiles || 0,
      totalChunks: row.totalChunks || 0,
      totalSymbols: row.totalSymbols || 0,
      lastIndexedAt: row.lastIndexedAt || undefined,
      settings: {
        ...DEFAULT_PROJECT_SETTINGS,
        includePatterns:
          row.includePatterns || DEFAULT_PROJECT_SETTINGS.includePatterns,
        excludePatterns:
          row.excludePatterns || DEFAULT_PROJECT_SETTINGS.excludePatterns,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * List all projects for a user
   */
  async listProjects(userId: number): Promise<CodebaseProject[]> {
    return this.getUserProjects(userId);
  }

  /**
   * Create and index a project (entry point for router)
   */
  async createAndIndexProject(
    userId: number,
    name: string,
    path: string,
    sshHostId?: number
  ): Promise<CodebaseProject> {
    const project = await this.createProject(userId, name, path, {
      sourceType: sshHostId ? "ssh" : "local",
    });

    // Start indexing in background
    this.indexProject(project.id).catch((err: Error) => {
      console.error(
        `[CodebaseIndexer] Indexing failed for project ${project.id}:`,
        err
      );
    });

    return project;
  }

  /**
   * Get project stats
   */
  async getProjectStats(
    projectId: number,
    userId: number
  ): Promise<{
    totalFiles: number;
    totalChunks: number;
    totalSymbols: number;
    status: string;
    lastIndexedAt?: Date;
  } | null> {
    const project = await this.getProject(projectId);
    if (!project || project.userId !== userId) {
      return null;
    }

    return {
      totalFiles: project.totalFiles,
      totalChunks: project.totalChunks,
      totalSymbols: project.totalSymbols,
      status: project.status,
      lastIndexedAt: project.lastIndexedAt,
    };
  }

  /**
   * Get user's projects
   */
  async getUserProjects(userId: number): Promise<CodebaseProject[]> {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select()
      .from(codebaseProjects)
      .where(eq(codebaseProjects.userId, userId));

    return rows.map(row => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      rootPath: row.sourcePath,
      description: row.description || undefined,
      status: row.status as CodebaseProject["status"],
      totalFiles: row.totalFiles || 0,
      totalChunks: row.totalChunks || 0,
      totalSymbols: row.totalSymbols || 0,
      lastIndexedAt: row.lastIndexedAt || undefined,
      settings: {
        ...DEFAULT_PROJECT_SETTINGS,
        includePatterns:
          row.includePatterns || DEFAULT_PROJECT_SETTINGS.includePatterns,
        excludePatterns:
          row.excludePatterns || DEFAULT_PROJECT_SETTINGS.excludePatterns,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * Delete a project and all its data
   */
  async deleteProject(projectId: number): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await this.clearProjectData(projectId);
    await db.delete(codebaseProjects).where(eq(codebaseProjects.id, projectId));
  }
}

// Singleton instance
export const codebaseIndexer = new CodebaseIndexer();
