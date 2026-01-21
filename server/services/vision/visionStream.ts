import { EventEmitter } from "events";
import {
  getGlobalPerceptionAdapter,
  type VisionAnalysisResult,
} from "../jarvis/v3/perceptionAdapter";
import {
  fastVisionAnalyze,
  type VisionProvider,
  type FastVisionResponse,
} from "./vlmClient";

export interface VisionFrame {
  frameId: number;
  timestamp: number;
  analysis: VisionAnalysisResult | FastVisionResponse;
  screenshotSource: "server" | "desktop-daemon";
  skippedByDiff: boolean;
}

export interface VisionStreamConfig {
  targetFps: number;
  analysisPrompt: string;
  screenshotSource: "server" | "desktop-daemon";
  daemonWebSocketUrl?: string;
  visionProvider: VisionProvider;
  enableFrameDiff: boolean;
  frameDiffThreshold: number;
  onFrame?: (frame: VisionFrame) => void;
  onError?: (error: Error) => void;
}

interface FrameStats {
  totalFrames: number;
  analyzedFrames: number;
  skippedFrames: number;
  droppedFrames: number;
  avgAnalysisMs: number;
  actualFps: number;
  lastFrameTime: number;
  costSavingsPercent: number;
}

const DEFAULT_CONFIG: VisionStreamConfig = {
  targetFps: 1,
  analysisPrompt:
    "Describe the current screen state. Identify: active window, visible UI elements, any loading indicators, error messages, or popups.",
  screenshotSource: "server",
  visionProvider: "auto",
  enableFrameDiff: true,
  frameDiffThreshold: 0.05,
};

export class VisionStream extends EventEmitter {
  private config: VisionStreamConfig;
  private running = false;
  private frameId = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private analysisQueue: Promise<void> = Promise.resolve();
  private stats: FrameStats = {
    totalFrames: 0,
    analyzedFrames: 0,
    skippedFrames: 0,
    droppedFrames: 0,
    avgAnalysisMs: 0,
    actualFps: 0,
    lastFrameTime: 0,
    costSavingsPercent: 0,
  };
  private lastFrameHash: string | null = null;
  private analysisTimes: number[] = [];
  private frameTimestamps: number[] = [];
  private pendingAnalysis = false;

  constructor(config: Partial<VisionStreamConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(): Promise<void> {
    if (this.running) return;

    if (this.config.visionProvider === "local") {
      const adapter = await getGlobalPerceptionAdapter();
      const status = await adapter.getStatus();

      if (!status.available || !status.services.vision) {
        throw new Error("Local GPU vision not available");
      }
    }

    this.running = true;
    this.frameId = 0;
    this.stats = {
      totalFrames: 0,
      analyzedFrames: 0,
      skippedFrames: 0,
      droppedFrames: 0,
      avgAnalysisMs: 0,
      actualFps: 0,
      lastFrameTime: Date.now(),
      costSavingsPercent: 0,
    };
    this.analysisTimes = [];
    this.frameTimestamps = [];
    this.lastFrameHash = null;

    const intervalMs = Math.floor(1000 / this.config.targetFps);

    this.intervalId = setInterval(() => {
      this.captureAndAnalyze();
    }, intervalMs);

    this.emit("started", { targetFps: this.config.targetFps });
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.emit("stopped", this.stats);
  }

  private async captureAndAnalyze(): Promise<void> {
    if (!this.running) return;

    if (this.pendingAnalysis) {
      this.stats.droppedFrames++;
      return;
    }

    this.pendingAnalysis = true;
    const startTime = Date.now();

    try {
      const screenshot = await this.captureScreenshot();
      this.stats.totalFrames++;

      if (this.config.enableFrameDiff && this.lastFrameHash) {
        const currentHash = this.computeSimpleHash(screenshot);
        const similarity = this.compareHashes(this.lastFrameHash, currentHash);

        if (similarity > 1 - this.config.frameDiffThreshold) {
          this.stats.skippedFrames++;
          this.updateCostSavings();
          this.pendingAnalysis = false;
          return;
        }
        this.lastFrameHash = currentHash;
      } else {
        this.lastFrameHash = this.computeSimpleHash(screenshot);
      }

      const analysis = await this.analyzeFrame(screenshot);
      this.stats.analyzedFrames++;

      const frame: VisionFrame = {
        frameId: ++this.frameId,
        timestamp: Date.now(),
        analysis,
        screenshotSource: this.config.screenshotSource,
        skippedByDiff: false,
      };

      this.updateStats(Date.now() - startTime);
      this.emit("frame", frame);
      this.config.onFrame?.(frame);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit("error", err);
      this.config.onError?.(err);
    } finally {
      this.pendingAnalysis = false;
    }
  }

  private computeSimpleHash(base64Data: string): string {
    const sample =
      base64Data.substring(0, 1000) +
      base64Data.substring(
        base64Data.length / 2,
        base64Data.length / 2 + 1000
      ) +
      base64Data.substring(base64Data.length - 1000);
    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      const char = sample.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private compareHashes(hash1: string, hash2: string): number {
    return hash1 === hash2 ? 1 : 0;
  }

  private updateCostSavings(): void {
    if (this.stats.totalFrames > 0) {
      this.stats.costSavingsPercent =
        (this.stats.skippedFrames / this.stats.totalFrames) * 100;
    }
  }

  private async captureScreenshot(): Promise<string> {
    if (this.config.screenshotSource === "desktop-daemon") {
      return this.captureFromDaemon();
    }
    return this.captureFromServer();
  }

  private async captureFromServer(): Promise<string> {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    const fs = await import("fs/promises");
    const path = await import("path");

    const tmpPath = path.join("/tmp", `vision-frame-${Date.now()}.png`);

    try {
      await execAsync(`scrot -o ${tmpPath}`);
      const buffer = await fs.readFile(tmpPath);
      await fs.unlink(tmpPath).catch(() => {});
      return buffer.toString("base64");
    } catch {
      await execAsync(`import -window root ${tmpPath}`);
      const buffer = await fs.readFile(tmpPath);
      await fs.unlink(tmpPath).catch(() => {});
      return buffer.toString("base64");
    }
  }

  private async captureFromDaemon(): Promise<string> {
    if (!this.config.daemonWebSocketUrl) {
      throw new Error("Desktop daemon URL not configured");
    }

    const response = await fetch(
      this.config.daemonWebSocketUrl.replace("ws://", "http://") +
        "/screenshot",
      { method: "POST", signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) {
      throw new Error(`Daemon screenshot failed: ${response.status}`);
    }

    const data = (await response.json()) as { data: string };
    return data.data;
  }

  private async analyzeFrame(
    screenshotBase64: string
  ): Promise<VisionAnalysisResult | FastVisionResponse> {
    if (this.config.visionProvider === "local") {
      const adapter = await getGlobalPerceptionAdapter();
      return adapter.analyzeImage(screenshotBase64, this.config.analysisPrompt);
    }

    return fastVisionAnalyze(
      screenshotBase64,
      this.config.analysisPrompt,
      this.config.visionProvider
    );
  }

  private updateStats(analysisMs: number): void {
    this.stats.totalFrames++;
    this.analysisTimes.push(analysisMs);
    this.frameTimestamps.push(Date.now());

    const cutoff = Date.now() - 5000;
    this.analysisTimes = this.analysisTimes.slice(-50);
    this.frameTimestamps = this.frameTimestamps.filter(t => t > cutoff);

    this.stats.avgAnalysisMs =
      this.analysisTimes.reduce((a, b) => a + b, 0) / this.analysisTimes.length;

    if (this.frameTimestamps.length > 1) {
      const duration =
        this.frameTimestamps[this.frameTimestamps.length - 1] -
        this.frameTimestamps[0];
      this.stats.actualFps =
        ((this.frameTimestamps.length - 1) / duration) * 1000;
    }

    this.stats.lastFrameTime = Date.now();
  }

  getStats(): FrameStats {
    return { ...this.stats };
  }

  isRunning(): boolean {
    return this.running;
  }

  updateConfig(config: Partial<VisionStreamConfig>): void {
    const wasRunning = this.running;
    if (wasRunning) this.stop();

    this.config = { ...this.config, ...config };

    if (wasRunning) this.start();
  }
}

let globalVisionStream: VisionStream | null = null;

export function getGlobalVisionStream(): VisionStream {
  if (!globalVisionStream) {
    globalVisionStream = new VisionStream();
  }
  return globalVisionStream;
}

export function resetGlobalVisionStream(): void {
  if (globalVisionStream) {
    globalVisionStream.stop();
    globalVisionStream = null;
  }
}
