/**
 * RAG Pipeline Types for Codebase Understanding
 */

export type ChunkType =
  | "file"
  | "function"
  | "class"
  | "method"
  | "comment"
  | "import"
  | "export"
  | "variable"
  | "type"
  | "interface";
export type RelationshipType =
  | "imports"
  | "exports"
  | "calls"
  | "extends"
  | "implements"
  | "uses"
  | "defines"
  | "references";
export type SymbolType =
  | "function"
  | "class"
  | "method"
  | "variable"
  | "constant"
  | "type"
  | "interface"
  | "enum"
  | "module";
export type ProjectStatus =
  | "pending"
  | "indexing"
  | "ready"
  | "error"
  | "updating";

export interface CodebaseProject {
  id: number;
  userId: number;
  name: string;
  rootPath: string;
  description?: string;
  language?: string;
  framework?: string;
  status: ProjectStatus;
  totalFiles: number;
  totalChunks: number;
  totalSymbols: number;
  lastIndexedAt?: Date;
  indexingProgress?: number;
  indexingError?: string;
  settings?: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectSettings {
  excludePatterns: string[];
  includePatterns: string[];
  maxFileSize: number;
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  excludePatterns: [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "*.min.js",
    "*.map",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
  ],
  includePatterns: [
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx",
    "**/*.py",
    "**/*.go",
    "**/*.rs",
    "**/*.java",
    "**/*.md",
    "**/*.json",
  ],
  maxFileSize: 1024 * 1024, // 1MB
  chunkSize: 1000,
  chunkOverlap: 200,
  embeddingModel: "text-embedding-3-small",
};

export interface CodeChunk {
  id: number;
  projectId: number;
  filePath: string;
  chunkType: ChunkType;
  content: string;
  startLine: number;
  endLine: number;
  language?: string;
  symbolName?: string;
  parentSymbol?: string;
  metadata?: ChunkMetadata;
  embedding?: number[];
  embeddingModel?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkMetadata {
  imports?: string[];
  exports?: string[];
  dependencies?: string[];
  complexity?: number;
  linesOfCode?: number;
  comments?: number;
  docstring?: string;
}

export interface CodeRelationship {
  id: number;
  projectId: number;
  sourceChunkId: number;
  targetChunkId: number;
  relationshipType: RelationshipType;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CodeSymbol {
  id: number;
  projectId: number;
  chunkId: number;
  name: string;
  symbolType: SymbolType;
  filePath: string;
  line: number;
  column?: number;
  signature?: string;
  docstring?: string;
  isExported: boolean;
  createdAt: Date;
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  highlights?: string[];
}

export interface CodeContext {
  relevantChunks: SearchResult[];
  symbols: CodeSymbol[];
  relationships: CodeRelationship[];
  summary: string;
}

export interface IndexingProgress {
  projectId: number;
  status: ProjectStatus;
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  currentFile?: string;
  errors: string[];
  startedAt: Date;
  estimatedCompletion?: Date;
}

// Language-specific parsing configurations
export const LANGUAGE_CONFIGS: Record<
  string,
  {
    extensions: string[];
    commentPatterns: RegExp[];
    functionPatterns: RegExp[];
    classPatterns: RegExp[];
    importPatterns: RegExp[];
  }
> = {
  typescript: {
    extensions: [".ts", ".tsx"],
    commentPatterns: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//gm],
    functionPatterns: [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function/g,
    ],
    classPatterns: [/(?:export\s+)?class\s+(\w+)/g],
    importPatterns: [/import\s+.*\s+from\s+['"]([^'"]+)['"]/g],
  },
  javascript: {
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    commentPatterns: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//gm],
    functionPatterns: [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
    ],
    classPatterns: [/(?:export\s+)?class\s+(\w+)/g],
    importPatterns: [
      /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
      /require\(['"]([^'"]+)['"]\)/g,
    ],
  },
  python: {
    extensions: [".py"],
    commentPatterns: [/#.*$/gm, /'''[\s\S]*?'''/gm, /"""[\s\S]*?"""/gm],
    functionPatterns: [/def\s+(\w+)\s*\(/g],
    classPatterns: [/class\s+(\w+)/g],
    importPatterns: [/(?:from\s+(\S+)\s+)?import\s+/g],
  },
  go: {
    extensions: [".go"],
    commentPatterns: [/\/\/.*$/gm, /\/\*[\s\S]*?\*\//gm],
    functionPatterns: [/func\s+(?:\([^)]+\)\s+)?(\w+)/g],
    classPatterns: [/type\s+(\w+)\s+struct/g],
    importPatterns: [/import\s+(?:\(\s*)?["']([^"']+)["']/g],
  },
};
