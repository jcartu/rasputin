import { create } from "zustand";

export type ArtifactType = "code" | "document" | "data";

export interface Artifact {
  id: string;
  title: string;
  language: string;
  content: string;
  type: ArtifactType;
  messageId: string;
  sessionId: string;
  createdAt: Date;
}

interface ArtifactState {
  artifacts: Artifact[];
  selectedArtifactId: string | null;
  addArtifact: (artifact: Artifact) => void;
  removeArtifact: (id: string) => void;
  selectArtifact: (id: string | null) => void;
  clearSessionArtifacts: (sessionId: string) => void;
  getSessionArtifacts: (sessionId: string) => Artifact[];
}

const dataLanguages = new Set([
  "json",
  "yaml",
  "yml",
  "toml",
  "xml",
  "csv",
  "tsv",
]);

const documentLanguages = new Set([
  "markdown",
  "md",
  "txt",
  "text",
  "rst",
  "adoc",
]);

const browserLanguages = new Set(["browser", "webpage", "html-preview"]);

const inferType = (language: string): ArtifactType => {
  const normalized = language.toLowerCase();
  if (dataLanguages.has(normalized)) return "data";
  if (browserLanguages.has(normalized)) return "document";
  if (documentLanguages.has(normalized)) return "document";
  return "code";
};

const getTitle = (content: string): string => {
  const firstLine = content.split("\n")[0]?.trim();
  return firstLine && firstLine.length > 0 ? firstLine : "Code snippet";
};

const countLines = (content: string): number => {
  const cleaned = content.replace(/\n$/, "");
  return cleaned === "" ? 0 : cleaned.split("\n").length;
};

const isValidUrl = (value?: string) => {
  if (!value) return false;
  try {
    const parsed = new URL(value.trim());
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const extractBrowserBlocks = (content: string) => {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const results: { url: string; content: string }[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }

    if (!inFence && isValidUrl(trimmed)) {
      const nextLine = lines[index + 1];
      if (nextLine && nextLine.trim().length > 0) {
        const contentLines: string[] = [];
        let cursor = index + 1;
        while (cursor < lines.length && lines[cursor].trim().length > 0) {
          contentLines.push(lines[cursor]);
          cursor += 1;
        }
        const blockContent = contentLines.join("\n").trim();
        results.push({ url: trimmed, content: blockContent });
        index = cursor - 1;
      }
    }
  }

  return results;
};

export const extractArtifacts = (
  content: string,
  messageId: string,
  sessionId: string
): Artifact[] => {
  const artifacts: Artifact[] = [];
  const regex = /```([\w-]+)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null = regex.exec(content);

  while (match) {
    const language = match[1]?.trim() || "";
    const code = match[2] ?? "";
    const lineCount = countLines(code.trim());

    const normalizedLanguage = language.toLowerCase();
    const shouldInclude =
      lineCount > 3 || browserLanguages.has(normalizedLanguage);

    if (language && shouldInclude) {
      artifacts.push({
        id: crypto.randomUUID(),
        title: getTitle(code),
        language,
        content: code.trim(),
        type: inferType(language),
        messageId,
        sessionId,
        createdAt: new Date(),
      });
    }

    match = regex.exec(content);
  }

  const browserBlocks = extractBrowserBlocks(content);
  const existingKeys = new Set(
    artifacts.map(artifact => `${artifact.language}:${artifact.content}`)
  );

  browserBlocks.forEach(block => {
    const payload = `${block.url}\n${block.content}`.trim();
    const key = `browser:${payload}`;
    if (existingKeys.has(key)) return;
    artifacts.push({
      id: crypto.randomUUID(),
      title: block.url,
      language: "browser",
      content: payload,
      type: "document",
      messageId,
      sessionId,
      createdAt: new Date(),
    });
  });

  return artifacts;
};

export const useArtifactStore = create<ArtifactState>()((set, get) => ({
  artifacts: [],
  selectedArtifactId: null,
  addArtifact: (artifact) =>
    set((state) => ({
      artifacts: [artifact, ...state.artifacts],
    })),
  removeArtifact: (id) =>
    set((state) => ({
      artifacts: state.artifacts.filter((artifact) => artifact.id !== id),
      selectedArtifactId:
        state.selectedArtifactId === id ? null : state.selectedArtifactId,
    })),
  selectArtifact: (id) => set({ selectedArtifactId: id }),
  clearSessionArtifacts: (sessionId) =>
    set((state) => ({
      artifacts: state.artifacts.filter(
        (artifact) => artifact.sessionId !== sessionId
      ),
      selectedArtifactId:
        state.selectedArtifactId &&
        state.artifacts.find((artifact) => artifact.id === state.selectedArtifactId)
          ?.sessionId === sessionId
          ? null
          : state.selectedArtifactId,
    })),
  getSessionArtifacts: (sessionId) =>
    get().artifacts.filter((artifact) => artifact.sessionId === sessionId),
}));
