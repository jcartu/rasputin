/**
 * JARVIS v3 Perception Adapter
 * Local GPU (96GB RTX PRO 6000) for PERCEPTION only:
 * - Embeddings: BGE-M3, Nomic
 * - Vision: LLaVA 34B, Qwen-VL
 * - STT: Whisper
 * - TTS: XTTS, StyleTTS
 * - Image Gen: SDXL, Flux via ComfyUI
 *
 * Agent REASONING uses Frontier APIs (Claude, GPT, Gemini, Grok)
 */

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
  durationMs: number;
  cached?: boolean;
}

export interface VisionAnalysisResult {
  description: string;
  elements: VisionElement[];
  text?: string;
  confidence: number;
  durationMs: number;
}

export interface VisionElement {
  type: "button" | "text" | "input" | "image" | "link" | "icon" | "other";
  label?: string;
  bounds: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export interface STTResult {
  text: string;
  language: string;
  segments?: { start: number; end: number; text: string }[];
  durationMs: number;
}

export interface TTSResult {
  audioData: Buffer;
  format: "mp3" | "wav" | "ogg";
  durationMs: number;
}

export interface ImageGenResult {
  imageData: Buffer;
  format: "png" | "jpeg" | "webp";
  width: number;
  height: number;
  seed: number;
  durationMs: number;
}

export interface PerceptionStatus {
  available: boolean;
  services: {
    embeddings: boolean;
    vision: boolean;
    stt: boolean;
    tts: boolean;
    imageGen: boolean;
  };
  gpuMemoryUsedMB: number;
  gpuMemoryTotalMB: number;
}

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const PERCEPTION_TIMEOUT_MS = 180000;
const EMBEDDING_CACHE_SIZE = 1000;
const MODEL_CACHE_TTL_MS = 60000; // 1 minute
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

export class PerceptionAdapter {
  private initialized = false;
  private embeddingCache = new Map<
    string,
    { vector: number[]; timestamp: number }
  >();
  private modelCache: string[] | null = null;
  private modelCacheTime = 0;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.refreshModelCache();
    this.initialized = true;
  }

  private async refreshModelCache(): Promise<void> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = (await response.json()) as { models?: { name: string }[] };
        this.modelCache = data.models?.map(m => m.name) || [];
        this.modelCacheTime = Date.now();
      }
    } catch {
      this.modelCache = null;
    }
  }

  private async ensureModelCacheFresh(): Promise<string[]> {
    if (
      !this.modelCache ||
      Date.now() - this.modelCacheTime > MODEL_CACHE_TTL_MS
    ) {
      await this.refreshModelCache();
    }
    return this.modelCache || [];
  }

  async isModelAvailable(model: string): Promise<boolean> {
    const models = await this.ensureModelCacheFresh();
    return models.some(m => m.includes(model) || model.includes(m));
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    timeoutMs: number = PERCEPTION_TIMEOUT_MS
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
          const status = response.status;
          if (status >= 500 || status === 429) {
            throw new Error(`Server error: ${status}`);
          }
          throw new Error(`Request failed: ${status}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const isRetryable =
          lastError.message.includes("Server error") ||
          lastError.message.includes("ETIMEDOUT") ||
          lastError.message.includes("ECONNREFUSED") ||
          lastError.message.includes("fetch failed");

        if (!isRetryable || attempt === MAX_RETRIES - 1) {
          throw lastError;
        }

        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  private getCacheKey(text: string, model: string): string {
    const hash = text.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    return `${model}:${hash}:${text.slice(0, 50)}`;
  }

  private pruneCache(): void {
    if (this.embeddingCache.size <= EMBEDDING_CACHE_SIZE) return;
    const entries = Array.from(this.embeddingCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - EMBEDDING_CACHE_SIZE);
    for (const [key] of toRemove) {
      this.embeddingCache.delete(key);
    }
  }

  async getStatus(): Promise<PerceptionStatus> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return this.unavailableStatus();
      }

      const data = (await response.json()) as { models?: { name: string }[] };
      const models = data.models?.map(m => m.name) || [];

      return {
        available: true,
        services: {
          embeddings: models.some(
            m => m.includes("nomic") || m.includes("bge") || m.includes("embed")
          ),
          vision: models.some(
            m =>
              m.includes("vision") || m.includes("llava") || m.includes("qwen")
          ),
          stt: true,
          tts: true,
          imageGen: true,
        },
        gpuMemoryUsedMB: 0,
        gpuMemoryTotalMB: 98304,
      };
    } catch {
      return this.unavailableStatus();
    }
  }

  private unavailableStatus(): PerceptionStatus {
    return {
      available: false,
      services: {
        embeddings: false,
        vision: false,
        stt: false,
        tts: false,
        imageGen: false,
      },
      gpuMemoryUsedMB: 0,
      gpuMemoryTotalMB: 0,
    };
  }

  async embed(
    text: string,
    model: string = "nomic-embed-text",
    useCache: boolean = true
  ): Promise<EmbeddingResult> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(text, model);

    if (useCache) {
      const cached = this.embeddingCache.get(cacheKey);
      if (cached) {
        return {
          vector: cached.vector,
          model,
          dimensions: cached.vector.length,
          durationMs: 0,
          cached: true,
        };
      }
    }

    if (!(await this.isModelAvailable(model))) {
      throw new Error(`Embedding model not available: ${model}`);
    }

    try {
      const data = await this.fetchWithRetry<{ embedding: number[] }>(
        `${OLLAMA_BASE_URL}/api/embeddings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: text }),
        }
      );

      if (useCache) {
        this.embeddingCache.set(cacheKey, {
          vector: data.embedding,
          timestamp: Date.now(),
        });
        this.pruneCache();
      }

      return {
        vector: data.embedding,
        model,
        dimensions: data.embedding.length,
        durationMs: Date.now() - startTime,
        cached: false,
      };
    } catch (error) {
      throw new Error(
        `Embedding error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async embedBatch(
    texts: string[],
    model: string = "nomic-embed-text",
    useCache: boolean = true
  ): Promise<EmbeddingResult[]> {
    const BATCH_SIZE = 10;
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(text => this.embed(text, model, useCache))
      );
      results.push(...batchResults);
    }

    return results;
  }

  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.embeddingCache.size,
      maxSize: EMBEDDING_CACHE_SIZE,
      hitRate: 0,
    };
  }

  clearCache(): void {
    this.embeddingCache.clear();
    this.modelCache = null;
    this.modelCacheTime = 0;
  }

  async analyzeImage(
    imageBase64: string,
    prompt: string = "Describe this image in detail. Identify all UI elements, buttons, text, and interactive components.",
    model: string = "llama3.2-vision:90b"
  ): Promise<VisionAnalysisResult> {
    const startTime = Date.now();

    if (!(await this.isModelAvailable(model))) {
      throw new Error(`Vision model not available: ${model}`);
    }

    try {
      const data = await this.fetchWithRetry<{ response: string }>(
        `${OLLAMA_BASE_URL}/api/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt,
            images: [imageBase64],
            stream: false,
          }),
        }
      );

      const elements = this.parseVisionElements(data.response);

      return {
        description: data.response,
        elements,
        confidence: 0.85,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(
        `Vision error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private parseVisionElements(description: string): VisionElement[] {
    const elements: VisionElement[] = [];
    const descLower = description.toLowerCase();

    const extractMatches = (
      text: string,
      pattern: RegExp,
      type: VisionElement["type"],
      confidence: number,
      maxLen: number
    ): void => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const label = (match[1] || match[0])?.trim();
        if (label && label.length > 0 && label.length < maxLen) {
          elements.push({
            type,
            label,
            bounds: { x: 0, y: 0, width: 0, height: 0 },
            confidence,
          });
        }
      }
    };

    extractMatches(
      description,
      /button[s]?\s*(?:labeled|called|named|saying|with text)?\s*["']?([^"'\n,]+)["']?/gi,
      "button",
      0.7,
      50
    );
    extractMatches(
      description,
      /["']([^"']+)["']\s*button/gi,
      "button",
      0.7,
      50
    );
    extractMatches(
      description,
      /click(?:able)?\s+(?:on\s+)?["']?([^"'\n,]+)["']?/gi,
      "button",
      0.65,
      50
    );

    extractMatches(
      description,
      /(?:text\s*)?(?:field|input|box)\s*(?:for|labeled|named)?\s*["']?([^"'\n,]+)["']?/gi,
      "input",
      0.6,
      50
    );

    extractMatches(
      description,
      /(?:link|hyperlink)\s*(?:to|for|labeled|named|saying)?\s*["']?([^"'\n,]+)["']?/gi,
      "link",
      0.65,
      100
    );

    if (descLower.includes("icon") || descLower.includes("logo")) {
      extractMatches(
        description,
        /(?:icon|logo)\s*(?:of|for|showing)?\s*["']?([^"'\n,]+)["']?/gi,
        "icon",
        0.5,
        50
      );
    }

    const seen = new Set<string>();
    return elements.filter(el => {
      const key = `${el.type}:${el.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async transcribe(
    audioData: Buffer,
    language: string = "en"
  ): Promise<STTResult> {
    const startTime = Date.now();
    const WHISPER_URL = process.env.WHISPER_URL || "http://localhost:8765";

    try {
      const formData = new FormData();
      formData.append(
        "audio",
        new Blob([new Uint8Array(audioData)]),
        "audio.wav"
      );
      formData.append("language", language);

      const response = await fetch(`${WHISPER_URL}/transcribe`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(PERCEPTION_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        text: string;
        language: string;
        segments?: { start: number; end: number; text: string }[];
      };

      return {
        text: data.text,
        language: data.language || language,
        segments: data.segments,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(
        `STT error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async synthesize(
    text: string,
    voice: string = "default",
    format: "mp3" | "wav" | "ogg" = "mp3"
  ): Promise<TTSResult> {
    const startTime = Date.now();
    const TTS_URL = process.env.TTS_URL || "http://localhost:8766";

    try {
      const response = await fetch(`${TTS_URL}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, format }),
        signal: AbortSignal.timeout(PERCEPTION_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`TTS failed: ${response.status}`);
      }

      const audioData = Buffer.from(await response.arrayBuffer());

      return {
        audioData,
        format,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(
        `TTS error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async generateImage(
    prompt: string,
    options: {
      negativePrompt?: string;
      width?: number;
      height?: number;
      steps?: number;
      seed?: number;
    } = {}
  ): Promise<ImageGenResult> {
    const startTime = Date.now();
    const COMFYUI_URL = process.env.COMFYUI_URL || "http://localhost:8188";

    const width = options.width || 1024;
    const height = options.height || 1024;
    const steps = options.steps || 20;
    const seed = options.seed || Math.floor(Math.random() * 2147483647);

    try {
      const response = await fetch(`${COMFYUI_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negative_prompt: options.negativePrompt || "",
          width,
          height,
          steps,
          seed,
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        throw new Error(`Image generation failed: ${response.status}`);
      }

      const imageData = Buffer.from(await response.arrayBuffer());

      return {
        imageData,
        format: "png",
        width,
        height,
        seed,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      throw new Error(
        `Image gen error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

let globalPerceptionAdapter: PerceptionAdapter | null = null;

export async function getGlobalPerceptionAdapter(): Promise<PerceptionAdapter> {
  if (!globalPerceptionAdapter) {
    globalPerceptionAdapter = new PerceptionAdapter();
    await globalPerceptionAdapter.initialize();
  }
  return globalPerceptionAdapter;
}

export function resetGlobalPerceptionAdapter(): void {
  globalPerceptionAdapter = null;
}
