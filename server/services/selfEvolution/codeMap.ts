import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { parse } from "@typescript-eslint/parser";
import type { TSESTree } from "@typescript-eslint/types";
import type {
  CodeSymbolInfo,
  CodeFileInfo,
  CodeMapStats,
  SemanticSearchResult,
} from "./types";
import { getDb } from "../../db";
import {
  codebaseProjects,
  codeChunks,
  codeSymbols,
} from "../../../drizzle/schema";
import { eq, and, like, sql } from "drizzle-orm";

const SUPPORTED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const IGNORE_PATTERNS = [
  "node_modules",
  "dist",
  "build",
  ".git",
  "coverage",
  ".next",
  ".turbo",
];

export class CodeMap {
  private projectPath: string;
  private projectId: number | null = null;
  private symbolCache: Map<string, CodeSymbolInfo[]> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async initialize(userId: number): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const existing = await db
      .select()
      .from(codebaseProjects)
      .where(
        and(
          eq(codebaseProjects.sourcePath, this.projectPath),
          eq(codebaseProjects.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      this.projectId = existing[0].id;
    } else {
      const result = await db.insert(codebaseProjects).values({
        userId,
        name: path.basename(this.projectPath),
        sourcePath: this.projectPath,
        sourceType: "local",
        status: "pending",
      });
      this.projectId = Number(result[0].insertId);
    }
  }

  async indexCodebase(): Promise<CodeMapStats> {
    const db = await getDb();
    if (!db || !this.projectId) throw new Error("Not initialized");

    await db
      .update(codebaseProjects)
      .set({ status: "indexing" })
      .where(eq(codebaseProjects.id, this.projectId));

    const files = await this.findSourceFiles(this.projectPath);
    let totalSymbols = 0;
    let totalLines = 0;
    const languages: Record<string, number> = {};

    for (const filePath of files) {
      try {
        const fileInfo = await this.parseFile(filePath);
        await this.storeFileInfo(fileInfo);
        totalSymbols += fileInfo.symbols.length;
        totalLines += fileInfo.size;
        languages[fileInfo.language] = (languages[fileInfo.language] || 0) + 1;
      } catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
      }
    }

    await db
      .update(codebaseProjects)
      .set({
        status: "ready",
        totalFiles: files.length,
        totalSymbols,
        lastIndexedAt: new Date(),
      })
      .where(eq(codebaseProjects.id, this.projectId));

    return {
      totalFiles: files.length,
      totalSymbols,
      totalLines,
      languages,
      lastIndexed: new Date(),
    };
  }

  private async findSourceFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORE_PATTERNS.some(p => entry.name.includes(p))) {
          const subFiles = await this.findSourceFiles(fullPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  private async parseFile(filePath: string): Promise<CodeFileInfo> {
    const content = await fs.readFile(filePath, "utf-8");
    const ext = path.extname(filePath);
    const language = this.getLanguage(ext);
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    const lines = content.split("\n").length;

    const symbols: CodeSymbolInfo[] = [];
    const imports: string[] = [];
    const exports: string[] = [];

    try {
      const ast = parse(content, {
        sourceType: "module",
        ecmaFeatures: { jsx: ext === ".tsx" || ext === ".jsx" },
        ecmaVersion: 2022,
      });

      this.extractSymbols(ast, filePath, symbols, imports, exports);
    } catch {
      this.extractSymbolsRegex(content, filePath, symbols);
    }

    const stat = await fs.stat(filePath);

    return {
      path: filePath,
      language,
      size: lines,
      hash,
      symbols,
      imports,
      exports,
      lastModified: stat.mtime,
    };
  }

  private getLanguage(ext: string): string {
    const langMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".mjs": "javascript",
      ".cjs": "javascript",
    };
    return langMap[ext] || "unknown";
  }

  private extractSymbols(
    ast: TSESTree.Program,
    filePath: string,
    symbols: CodeSymbolInfo[],
    imports: string[],
    exports: string[]
  ): void {
    for (const node of ast.body) {
      switch (node.type) {
        case "ImportDeclaration":
          if (node.source.value) {
            imports.push(String(node.source.value));
          }
          break;

        case "ExportNamedDeclaration":
          if (node.declaration) {
            this.extractDeclarationSymbols(
              node.declaration as TSESTree.Node,
              filePath,
              symbols,
              true
            );
            if ("name" in node.declaration && node.declaration.name) {
              exports.push(node.declaration.name as string);
            }
          }
          break;

        case "ExportDefaultDeclaration":
          if (node.declaration) {
            this.extractDeclarationSymbols(
              node.declaration as TSESTree.Node,
              filePath,
              symbols,
              true
            );
          }
          break;

        case "FunctionDeclaration":
        case "ClassDeclaration":
        case "VariableDeclaration":
        case "TSTypeAliasDeclaration":
        case "TSInterfaceDeclaration":
        case "TSEnumDeclaration":
          this.extractDeclarationSymbols(node, filePath, symbols, false);
          break;
      }
    }
  }

  private extractDeclarationSymbols(
    node: TSESTree.Node,
    filePath: string,
    symbols: CodeSymbolInfo[],
    isExported: boolean
  ): void {
    if (!node.loc) return;

    switch (node.type) {
      case "FunctionDeclaration":
        if (node.id?.name) {
          symbols.push({
            name: node.id.name,
            type: "function",
            filePath,
            startLine: node.loc.start.line,
            endLine: node.loc.end.line,
            signature: this.getFunctionSignature(node),
            isExported,
            dependencies: [],
            dependents: [],
          });
        }
        break;

      case "ClassDeclaration":
        if (node.id?.name) {
          symbols.push({
            name: node.id.name,
            type: "class",
            filePath,
            startLine: node.loc.start.line,
            endLine: node.loc.end.line,
            isExported,
            dependencies: [],
            dependents: [],
          });

          for (const element of node.body.body) {
            if (
              element.type === "MethodDefinition" &&
              element.key.type === "Identifier"
            ) {
              symbols.push({
                name: `${node.id.name}.${element.key.name}`,
                type: "method",
                filePath,
                startLine: element.loc?.start.line || 0,
                endLine: element.loc?.end.line || 0,
                isExported,
                dependencies: [],
                dependents: [],
              });
            }
          }
        }
        break;

      case "VariableDeclaration":
        for (const declarator of node.declarations) {
          if (declarator.id.type === "Identifier") {
            const isArrowFn =
              declarator.init?.type === "ArrowFunctionExpression";
            symbols.push({
              name: declarator.id.name,
              type: isArrowFn ? "function" : "variable",
              filePath,
              startLine: node.loc.start.line,
              endLine: node.loc.end.line,
              isExported,
              dependencies: [],
              dependents: [],
            });
          }
        }
        break;

      case "TSTypeAliasDeclaration":
        symbols.push({
          name: node.id.name,
          type: "type",
          filePath,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          isExported,
          dependencies: [],
          dependents: [],
        });
        break;

      case "TSInterfaceDeclaration":
        symbols.push({
          name: node.id.name,
          type: "interface",
          filePath,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          isExported,
          dependencies: [],
          dependents: [],
        });
        break;

      case "TSEnumDeclaration":
        symbols.push({
          name: node.id.name,
          type: "enum",
          filePath,
          startLine: node.loc.start.line,
          endLine: node.loc.end.line,
          isExported,
          dependencies: [],
          dependents: [],
        });
        break;
    }
  }

  private getFunctionSignature(node: TSESTree.FunctionDeclaration): string {
    const params = node.params
      .map((p: TSESTree.Parameter) => {
        if (p.type === "Identifier") {
          return p.name;
        }
        return "...";
      })
      .join(", ");

    return `${node.id?.name || "anonymous"}(${params})`;
  }

  private extractSymbolsRegex(
    content: string,
    filePath: string,
    symbols: CodeSymbolInfo[]
  ): void {
    const lines = content.split("\n");

    const patterns = [
      {
        regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
        type: "function" as const,
      },
      { regex: /^(?:export\s+)?class\s+(\w+)/, type: "class" as const },
      {
        regex: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/,
        type: "variable" as const,
      },
      {
        regex: /^(?:export\s+)?type\s+(\w+)\s*=/,
        type: "type" as const,
      },
      {
        regex: /^(?:export\s+)?interface\s+(\w+)/,
        type: "interface" as const,
      },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      for (const { regex, type } of patterns) {
        const match = line.match(regex);
        if (match) {
          symbols.push({
            name: match[1],
            type,
            filePath,
            startLine: i + 1,
            endLine: i + 1,
            isExported: line.startsWith("export"),
            dependencies: [],
            dependents: [],
          });
          break;
        }
      }
    }
  }

  private async storeFileInfo(fileInfo: CodeFileInfo): Promise<void> {
    const db = await getDb();
    if (!db || !this.projectId) return;

    await db
      .delete(codeChunks)
      .where(
        and(
          eq(codeChunks.projectId, this.projectId),
          eq(codeChunks.filePath, fileInfo.path)
        )
      );

    const chunkResult = await db.insert(codeChunks).values({
      projectId: this.projectId,
      filePath: fileInfo.path,
      language: fileInfo.language,
      content: "",
      startLine: 1,
      endLine: fileInfo.size,
      chunkType: "module",
      hash: fileInfo.hash,
    });

    const chunkId = Number(chunkResult[0].insertId);

    for (const symbol of fileInfo.symbols) {
      await db.insert(codeSymbols).values({
        projectId: this.projectId,
        chunkId,
        name: symbol.name,
        symbolType: symbol.type,
        signature: symbol.signature,
        docstring: symbol.docstring,
        filePath: symbol.filePath,
        line: symbol.startLine,
        isExported: symbol.isExported ? 1 : 0,
      });
    }

    this.symbolCache.set(fileInfo.path, fileInfo.symbols);
  }

  async searchSymbols(query: string): Promise<CodeSymbolInfo[]> {
    const db = await getDb();
    if (!db || !this.projectId) return [];

    const results = await db
      .select()
      .from(codeSymbols)
      .where(
        and(
          eq(codeSymbols.projectId, this.projectId),
          like(codeSymbols.name, `%${query}%`)
        )
      )
      .limit(50);

    return results.map(r => ({
      name: r.name,
      type: r.symbolType as CodeSymbolInfo["type"],
      filePath: r.filePath,
      startLine: r.line,
      endLine: r.line,
      signature: r.signature || undefined,
      docstring: r.docstring || undefined,
      isExported: r.isExported === 1,
      dependencies: [],
      dependents: [],
    }));
  }

  async getSymbolByName(name: string): Promise<CodeSymbolInfo | null> {
    const db = await getDb();
    if (!db || !this.projectId) return null;

    const results = await db
      .select()
      .from(codeSymbols)
      .where(
        and(
          eq(codeSymbols.projectId, this.projectId),
          eq(codeSymbols.name, name)
        )
      )
      .limit(1);

    if (results.length === 0) return null;

    const r = results[0];
    return {
      name: r.name,
      type: r.symbolType as CodeSymbolInfo["type"],
      filePath: r.filePath,
      startLine: r.line,
      endLine: r.line,
      signature: r.signature || undefined,
      docstring: r.docstring || undefined,
      isExported: r.isExported === 1,
      dependencies: [],
      dependents: [],
    };
  }

  async getFileSymbols(filePath: string): Promise<CodeSymbolInfo[]> {
    if (this.symbolCache.has(filePath)) {
      return this.symbolCache.get(filePath)!;
    }

    const db = await getDb();
    if (!db || !this.projectId) return [];

    const results = await db
      .select()
      .from(codeSymbols)
      .where(
        and(
          eq(codeSymbols.projectId, this.projectId),
          eq(codeSymbols.filePath, filePath)
        )
      );

    const symbols = results.map(r => ({
      name: r.name,
      type: r.symbolType as CodeSymbolInfo["type"],
      filePath: r.filePath,
      startLine: r.line,
      endLine: r.line,
      signature: r.signature || undefined,
      docstring: r.docstring || undefined,
      isExported: r.isExported === 1,
      dependencies: [],
      dependents: [],
    }));

    this.symbolCache.set(filePath, symbols);
    return symbols;
  }

  async getStats(): Promise<CodeMapStats> {
    const db = await getDb();
    if (!db || !this.projectId) {
      return {
        totalFiles: 0,
        totalSymbols: 0,
        totalLines: 0,
        languages: {},
        lastIndexed: null,
      };
    }

    const project = await db
      .select()
      .from(codebaseProjects)
      .where(eq(codebaseProjects.id, this.projectId))
      .limit(1);

    if (project.length === 0) {
      return {
        totalFiles: 0,
        totalSymbols: 0,
        totalLines: 0,
        languages: {},
        lastIndexed: null,
      };
    }

    const languageStats = await db
      .select({
        language: codeChunks.language,
        count: sql<number>`count(*)`,
      })
      .from(codeChunks)
      .where(eq(codeChunks.projectId, this.projectId))
      .groupBy(codeChunks.language);

    const languages: Record<string, number> = {};
    for (const stat of languageStats) {
      if (stat.language) {
        languages[stat.language] = stat.count;
      }
    }

    return {
      totalFiles: project[0].totalFiles || 0,
      totalSymbols: project[0].totalSymbols || 0,
      totalLines: 0,
      languages,
      lastIndexed: project[0].lastIndexedAt,
    };
  }

  async semanticSearch(
    query: string,
    limit: number = 10
  ): Promise<SemanticSearchResult[]> {
    const symbols = await this.searchSymbols(query);

    return symbols.slice(0, limit).map((symbol, index) => ({
      item: symbol,
      score: 1 - index * 0.1,
      matchType: "fuzzy" as const,
    }));
  }
}

let codeMapInstance: CodeMap | null = null;

export function getCodeMap(projectPath?: string): CodeMap {
  if (!codeMapInstance && projectPath) {
    codeMapInstance = new CodeMap(projectPath);
  }
  if (!codeMapInstance) {
    throw new Error("CodeMap not initialized");
  }
  return codeMapInstance;
}

export async function initializeCodeMap(
  projectPath: string,
  userId: number
): Promise<CodeMap> {
  const codeMap = new CodeMap(projectPath);
  await codeMap.initialize(userId);
  codeMapInstance = codeMap;
  return codeMap;
}
