import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";

export type FileCategory =
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "code"
  | "archive"
  | "unknown";

export interface ProcessedFile {
  originalName: string;
  mimeType: string;
  category: FileCategory;
  size: number;
  storagePath: string;
  extractedText?: string;
  analysis?: string;
  metadata?: Record<string, unknown>;
  thumbnailPath?: string;
  error?: string;
}

const MIME_TO_CATEGORY: Record<string, FileCategory> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/gif": "image",
  "image/webp": "image",
  "image/svg+xml": "image",
  "image/bmp": "image",
  "image/tiff": "image",
  "application/pdf": "pdf",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "video/x-msvideo": "video",
  "video/x-matroska": "video",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/ogg": "audio",
  "audio/webm": "audio",
  "audio/mp4": "audio",
  "audio/flac": "audio",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "document",
  "application/msword": "document",
  "application/rtf": "document",
  "text/plain": "document",
  "text/markdown": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "spreadsheet",
  "application/vnd.ms-excel": "spreadsheet",
  "text/csv": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "presentation",
  "application/vnd.ms-powerpoint": "presentation",
  "application/zip": "archive",
  "application/x-rar-compressed": "archive",
  "application/x-7z-compressed": "archive",
  "application/gzip": "archive",
  "application/x-tar": "archive",
};

const CODE_EXTENSIONS = [
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".cs",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".scala",
  ".html",
  ".css",
  ".scss",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".sql",
  ".sh",
  ".bash",
];

export function categorizeFile(
  mimeType: string,
  filename: string
): FileCategory {
  if (MIME_TO_CATEGORY[mimeType]) {
    return MIME_TO_CATEGORY[mimeType];
  }

  const ext = path.extname(filename).toLowerCase();
  if (CODE_EXTENSIONS.includes(ext)) {
    return "code";
  }

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("text/")) return "document";

  return "unknown";
}

async function runCommand(
  cmd: string,
  args: string[],
  timeout = 30000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { timeout });
    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", data => (stdout += data));
    proc.stderr?.on("data", data => (stderr += data));

    proc.on("close", code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} failed: ${stderr || stdout}`));
    });

    proc.on("error", reject);
  });
}

async function extractPdfText(filePath: string): Promise<string> {
  try {
    return await runCommand("pdftotext", ["-layout", filePath, "-"]);
  } catch {
    return "";
  }
}

async function extractDocxText(filePath: string): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch {
    return "";
  }
}

async function extractXlsxData(
  filePath: string
): Promise<{ text: string; sheets: Record<string, unknown[][]> }> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.readFile(filePath);
    const sheets: Record<string, unknown[][]> = {};
    let text = "";

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
      }) as unknown[][];
      sheets[sheetName] = data;
      text += `\n=== Sheet: ${sheetName} ===\n`;
      text += data.map(row => (row as unknown[]).join("\t")).join("\n");
    }

    return { text, sheets };
  } catch {
    return { text: "", sheets: {} };
  }
}

async function extractVideoFrames(
  filePath: string,
  outputDir: string,
  frameCount = 5
): Promise<string[]> {
  try {
    await fs.mkdir(outputDir, { recursive: true });

    const durationOutput = await runCommand("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const duration = parseFloat(durationOutput.trim()) || 60;

    const framePaths: string[] = [];
    const interval = duration / (frameCount + 1);

    for (let i = 1; i <= frameCount; i++) {
      const timestamp = interval * i;
      const outputPath = path.join(outputDir, `frame_${i}.jpg`);

      await runCommand("ffmpeg", [
        "-ss",
        timestamp.toString(),
        "-i",
        filePath,
        "-vframes",
        "1",
        "-q:v",
        "2",
        "-y",
        outputPath,
      ]);

      framePaths.push(outputPath);
    }

    return framePaths;
  } catch (e) {
    console.error("Failed to extract video frames:", e);
    return [];
  }
}

async function extractAudioFromVideo(
  videoPath: string,
  outputPath: string
): Promise<string | null> {
  try {
    await runCommand("ffmpeg", [
      "-i",
      videoPath,
      "-vn",
      "-acodec",
      "libmp3lame",
      "-q:a",
      "4",
      "-y",
      outputPath,
    ]);
    return outputPath;
  } catch {
    return null;
  }
}

async function transcribeAudio(filePath: string): Promise<string> {
  try {
    const audioData = await fs.readFile(filePath);
    const uint8Array = new Uint8Array(audioData);
    const blob = new Blob([uint8Array], { type: "audio/mpeg" });
    const formData = new FormData();
    formData.append("file", blob, path.basename(filePath));
    formData.append("model", "whisper-1");
    formData.append("response_format", "text");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }

    return await response.text();
  } catch (e) {
    console.error("Audio transcription failed:", e);
    return "";
  }
}

async function analyzeImageWithVision(
  imagePath: string,
  prompt?: string
): Promise<string> {
  try {
    const { invokeLLM } = await import("../../_core/llm");
    const imageData = await fs.readFile(imagePath);
    const base64 = imageData.toString("base64");
    const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are an expert image analyst. Describe the image content comprehensively.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
            {
              type: "text",
              text: prompt || "Analyze this image in detail. What do you see?",
            },
          ],
        },
      ],
      maxTokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    return typeof content === "string" ? content : "";
  } catch (e) {
    console.error("Vision analysis failed:", e);
    return "";
  }
}

export interface ProcessOptions {
  analyzeWithVision?: boolean;
  transcribeAudio?: boolean;
  extractVideoFrames?: boolean;
  customPrompt?: string;
}

export async function processFile(
  filePath: string,
  mimeType: string,
  originalName: string,
  options: ProcessOptions = {}
): Promise<ProcessedFile> {
  const category = categorizeFile(mimeType, originalName);
  const stats = await fs.stat(filePath);

  const result: ProcessedFile = {
    originalName,
    mimeType,
    category,
    size: stats.size,
    storagePath: filePath,
  };

  try {
    switch (category) {
      case "image": {
        if (options.analyzeWithVision !== false) {
          result.analysis = await analyzeImageWithVision(
            filePath,
            options.customPrompt
          );
        }
        break;
      }

      case "pdf": {
        result.extractedText = await extractPdfText(filePath);
        if (
          options.analyzeWithVision !== false &&
          (!result.extractedText || result.extractedText.length < 100)
        ) {
          result.analysis = await analyzeImageWithVision(
            filePath,
            "This is a PDF document. Extract and describe all visible text and content."
          );
        }
        break;
      }

      case "video": {
        const videoDir = path.join(path.dirname(filePath), "video_analysis");
        const framePaths = await extractVideoFrames(filePath, videoDir);

        if (framePaths.length > 0 && options.extractVideoFrames !== false) {
          const frameAnalyses: string[] = [];
          for (let i = 0; i < framePaths.length; i++) {
            const analysis = await analyzeImageWithVision(
              framePaths[i],
              `Describe frame ${i + 1} of ${framePaths.length} from a video.`
            );
            frameAnalyses.push(`Frame ${i + 1}: ${analysis}`);
          }
          result.analysis = frameAnalyses.join("\n\n");
          result.metadata = { framePaths };
        }

        if (options.transcribeAudio !== false) {
          const audioPath = path.join(videoDir, "audio.mp3");
          const extracted = await extractAudioFromVideo(filePath, audioPath);
          if (extracted) {
            result.extractedText = await transcribeAudio(extracted);
          }
        }
        break;
      }

      case "audio": {
        if (options.transcribeAudio !== false) {
          result.extractedText = await transcribeAudio(filePath);
        }
        break;
      }

      case "document": {
        const ext = path.extname(originalName).toLowerCase();
        if (ext === ".docx") {
          result.extractedText = await extractDocxText(filePath);
        } else {
          result.extractedText = await fs.readFile(filePath, "utf-8");
        }
        break;
      }

      case "spreadsheet": {
        const xlsxData = await extractXlsxData(filePath);
        result.extractedText = xlsxData.text;
        result.metadata = { sheets: xlsxData.sheets };
        break;
      }

      case "code": {
        result.extractedText = await fs.readFile(filePath, "utf-8");
        break;
      }

      case "presentation": {
        result.extractedText =
          "[Presentation file - content extraction not yet implemented]";
        break;
      }

      default: {
        if (mimeType.startsWith("text/")) {
          result.extractedText = await fs.readFile(filePath, "utf-8");
        }
      }
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : "Processing failed";
  }

  return result;
}

export async function processMultipleFiles(
  files: Array<{ path: string; mimeType: string; name: string }>,
  options: ProcessOptions = {}
): Promise<ProcessedFile[]> {
  return Promise.all(
    files.map(f => processFile(f.path, f.mimeType, f.name, options))
  );
}

export function generateFileContext(processed: ProcessedFile[]): string {
  const sections: string[] = [];

  for (const file of processed) {
    const header = `## File: ${file.originalName} (${file.category})`;
    const parts = [header];

    if (file.extractedText) {
      parts.push(`### Extracted Content:\n${file.extractedText}`);
    }

    if (file.analysis) {
      parts.push(`### Analysis:\n${file.analysis}`);
    }

    if (file.error) {
      parts.push(`### Error: ${file.error}`);
    }

    sections.push(parts.join("\n\n"));
  }

  return sections.join("\n\n---\n\n");
}
