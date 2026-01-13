import { storagePut } from "server/storage";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

const PUBLIC_DIR = path.join(process.cwd(), "public", "generated");
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || "http://localhost:3000";

async function saveImageLocally(
  buffer: Buffer,
  filename: string
): Promise<string> {
  await fs.mkdir(PUBLIC_DIR, { recursive: true });
  const filePath = path.join(PUBLIC_DIR, filename);
  await fs.writeFile(filePath, buffer);
  return `${SERVER_BASE_URL}/generated/${filename}`;
}

async function saveImage(buffer: Buffer, prefix: string): Promise<string> {
  const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.png`;

  try {
    const { url } = await storagePut(
      `generated/${filename}`,
      buffer,
      "image/png"
    );
    return url;
  } catch (error) {
    console.info("[ImageGen] Forge storage unavailable, using local storage");
    return saveImageLocally(buffer, filename);
  }
}

export type GenerateImageOptions = {
  prompt: string;
  size?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  imageUrls?: string[];
};

export type GenerateImageResponse = {
  url?: string;
  provider?:
    | "local-sdxl"
    | "local-turbo"
    | "dalle"
    | "together"
    | "replicate"
    | "nanobanana"
    | "flux-local";
};

const NANOBANANA_API_KEY = process.env.NANOBANANA_API_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN ?? "";
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY ?? "";
const FLUX_LOCAL_URL = process.env.FLUX_LOCAL_URL || "http://localhost:8001";

const NANOBANANA_API_URL = "https://api.nanobananaapi.ai/api/v1/nanobanana";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateWithNanoBanana(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  console.info("[ImageGen] Using Nano Banana:", options.prompt.slice(0, 80));

  const isEdit = options.imageUrls && options.imageUrls.length > 0;

  const response = await fetch(`${NANOBANANA_API_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NANOBANANA_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      numImages: 1,
      type: isEdit ? "IMAGETOIAMGE" : "TEXTTOIAMGE",
      image_size: options.size || "1:1",
      imageUrls: options.imageUrls || [],
      callBackUrl: "https://rasputin.studio/api/webhook/nanobanana",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Nano Banana API error (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as {
    code: number;
    msg: string;
    data: { taskId: string };
  };

  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(`Nano Banana failed: ${result.msg}`);
  }

  const taskId = result.data.taskId;
  console.info("[ImageGen] Nano Banana task started:", taskId);

  const maxAttempts = 22;
  const pollInterval = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(pollInterval);

    const statusResponse = await fetch(
      `${NANOBANANA_API_URL}/record-info?taskId=${taskId}`,
      {
        headers: { Authorization: `Bearer ${NANOBANANA_API_KEY}` },
      }
    );

    if (!statusResponse.ok) continue;

    const status = (await statusResponse.json()) as {
      code: number;
      data: {
        successFlag: number;
        response?: { resultImageUrl?: string };
        errorMessage?: string;
      };
    };

    if (status.data.successFlag === 1) {
      const imageUrl = status.data.response?.resultImageUrl;
      if (imageUrl) {
        console.info("[ImageGen] Nano Banana complete:", imageUrl);
        return { url: imageUrl, provider: "nanobanana" };
      }
    } else if (status.data.successFlag >= 2) {
      throw new Error(
        `Nano Banana generation failed: ${status.data.errorMessage || "Unknown error"}`
      );
    }
  }

  throw new Error("Nano Banana timeout - task did not complete in 45 seconds");
}

async function checkLocalServerHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${FLUX_LOCAL_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

async function generateWithLocalSDXL(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  console.info("[ImageGen] Using LOCAL SDXL:", options.prompt.slice(0, 80));

  const sizeMap: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1344, height: 768 },
    "9:16": { width: 768, height: 1344 },
    "4:3": { width: 1152, height: 896 },
    "3:4": { width: 896, height: 1152 },
  };

  const size = sizeMap[options.size || "1:1"] || sizeMap["1:1"];

  const response = await fetch(`${FLUX_LOCAL_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: options.prompt,
      model: "sdxl",
      width: size.width,
      height: size.height,
      num_inference_steps: 25,
      guidance_scale: 7.5,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Local SDXL error (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as {
    image_url?: string;
    image_base64?: string;
    model?: string;
  };

  if (result.image_base64) {
    const buffer = Buffer.from(result.image_base64, "base64");
    const url = await saveImage(buffer, "local-sdxl");
    console.info("[ImageGen] Local SDXL complete:", url);
    return { url, provider: "local-sdxl" };
  }

  if (result.image_url) {
    console.info("[ImageGen] Local SDXL complete:", result.image_url);
    return { url: result.image_url, provider: "local-sdxl" };
  }

  throw new Error("No image data returned from local SDXL");
}

async function generateWithLocalTurbo(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  console.info("[ImageGen] Using LOCAL SD-Turbo:", options.prompt.slice(0, 80));

  const response = await fetch(`${FLUX_LOCAL_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: options.prompt,
      model: "sd_turbo",
      width: 512,
      height: 512,
      num_inference_steps: 4,
      guidance_scale: 0.0,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Local SD-Turbo error (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as {
    image_url?: string;
    image_base64?: string;
    model?: string;
  };

  if (result.image_base64) {
    const buffer = Buffer.from(result.image_base64, "base64");
    const url = await saveImage(buffer, "local-turbo");
    console.info("[ImageGen] Local SD-Turbo complete:", url);
    return { url, provider: "local-turbo" };
  }

  throw new Error("No image data returned from local SD-Turbo");
}

async function generateWithLocalFlux(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  console.info("[ImageGen] Using local Flux:", options.prompt.slice(0, 80));

  const sizeMap: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1792, height: 1024 },
    "9:16": { width: 1024, height: 1792 },
    "4:3": { width: 1365, height: 1024 },
    "3:4": { width: 1024, height: 1365 },
  };

  const size = sizeMap[options.size || "1:1"] || sizeMap["1:1"];

  const response = await fetch(`${FLUX_LOCAL_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: options.prompt,
      model: "flux",
      width: size.width,
      height: size.height,
      num_inference_steps: 4,
      guidance_scale: 0.0,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Local Flux API error (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as {
    image_url?: string;
    image_base64?: string;
  };

  if (result.image_url) {
    console.info("[ImageGen] Local Flux complete:", result.image_url);
    return { url: result.image_url, provider: "flux-local" };
  }

  if (result.image_base64) {
    const buffer = Buffer.from(result.image_base64, "base64");
    const url = await saveImage(buffer, "flux");
    console.info("[ImageGen] Local Flux complete (base64):", url);
    return { url, provider: "flux-local" };
  }

  throw new Error("No image data returned from local Flux");
}

async function generateWithDallE(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  console.info(
    "[ImageGen] Using DALL-E 3 fallback:",
    options.prompt.slice(0, 80)
  );

  const sizeMap: Record<string, string> = {
    "1:1": "1024x1024",
    "16:9": "1792x1024",
    "9:16": "1024x1792",
    "4:3": "1792x1024",
    "3:4": "1024x1792",
  };

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: options.prompt,
      n: 1,
      size: sizeMap[options.size || "1:1"] || "1024x1024",
      quality: "standard",
      style: "vivid",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`DALL-E API error (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as {
    data: Array<{ b64_json: string }>;
  };

  if (!result.data?.[0]?.b64_json) {
    throw new Error("No image data returned from DALL-E");
  }

  const buffer = Buffer.from(result.data[0].b64_json, "base64");
  const url = await saveImage(buffer, "dalle");

  console.info("[ImageGen] DALL-E complete:", url);
  return { url, provider: "dalle" };
}

async function generateWithReplicate(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  console.info("[ImageGen] Using Replicate SDXL:", options.prompt.slice(0, 80));

  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
    },
    body: JSON.stringify({
      version:
        "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      input: {
        prompt: options.prompt,
        width: 1024,
        height: 1024,
        num_outputs: 1,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Replicate API error (${response.status}): ${detail}`);
  }

  const prediction = (await response.json()) as {
    id: string;
    status: string;
    urls: { get: string };
  };

  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(1000);

    const statusResponse = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
    });

    if (!statusResponse.ok) continue;

    const status = (await statusResponse.json()) as {
      status: string;
      output?: string[];
      error?: string;
    };

    if (status.status === "succeeded" && status.output?.[0]) {
      const imageUrl = status.output[0];
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok)
        throw new Error("Failed to download Replicate image");
      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const url = await saveImage(buffer, "replicate");
      console.info("[ImageGen] Replicate complete:", url);
      return { url, provider: "replicate" };
    } else if (status.status === "failed") {
      throw new Error(`Replicate failed: ${status.error || "Unknown error"}`);
    }
  }

  throw new Error(
    "Replicate timeout - image generation did not complete in 30s"
  );
}

async function generateWithTogether(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  console.info(
    "[ImageGen] Using Together AI Flux:",
    options.prompt.slice(0, 80)
  );

  const response = await fetch(
    "https://api.together.xyz/v1/images/generations",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell-Free",
        prompt: options.prompt,
        width: 1024,
        height: 1024,
        n: 1,
        response_format: "b64_json",
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Together AI error (${response.status}): ${detail}`);
  }

  const result = (await response.json()) as {
    data: Array<{ b64_json: string }>;
  };

  if (!result.data?.[0]?.b64_json) {
    throw new Error("No image data returned from Together AI");
  }

  const buffer = Buffer.from(result.data[0].b64_json, "base64");
  const url = await saveImage(buffer, "together");

  console.info("[ImageGen] Together AI complete:", url);
  return { url, provider: "together" };
}

const NSFW_PATTERNS = [
  /nsfw/i,
  /nude/i,
  /naked/i,
  /sexual/i,
  /erotic/i,
  /porn/i,
  /explicit/i,
  /adult.*content/i,
  /hentai/i,
];

function isNsfwPrompt(prompt: string): boolean {
  return NSFW_PATTERNS.some(p => p.test(prompt));
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const errors: string[] = [];
  const localAvailable = await checkLocalServerHealth();

  if (localAvailable) {
    try {
      return await generateWithLocalSDXL(options);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`LocalSDXL: ${msg}`);
      console.error("[ImageGen] Local SDXL failed:", msg);
    }

    try {
      return await generateWithLocalTurbo(options);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`LocalTurbo: ${msg}`);
      console.error("[ImageGen] Local SD-Turbo failed:", msg);
    }
  } else {
    console.info(
      "[ImageGen] Local server not available, using cloud fallbacks"
    );
  }

  if (OPENAI_API_KEY) {
    try {
      return await generateWithDallE(options);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`DALL-E: ${msg}`);
      console.error("[ImageGen] DALL-E failed:", msg);
    }
  }

  if (TOGETHER_API_KEY) {
    try {
      return await generateWithTogether(options);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Together: ${msg}`);
      console.error("[ImageGen] Together AI failed:", msg);
    }
  }

  if (REPLICATE_API_TOKEN) {
    try {
      return await generateWithReplicate(options);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Replicate: ${msg}`);
      console.error("[ImageGen] Replicate failed:", msg);
    }
  }

  if (NANOBANANA_API_KEY) {
    try {
      return await generateWithNanoBanana(options);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`NanoBanana: ${msg}`);
      console.error("[ImageGen] Nano Banana failed:", msg);
    }
  }

  console.error(
    "[ImageGen] All providers failed - Local:",
    localAvailable,
    "DALL-E:",
    !!OPENAI_API_KEY,
    "Together:",
    !!TOGETHER_API_KEY,
    "Replicate:",
    !!REPLICATE_API_TOKEN,
    "NanoBanana:",
    !!NANOBANANA_API_KEY
  );

  if (errors.length > 0) {
    throw new Error(`All image providers failed:\n${errors.join("\n")}`);
  }

  throw new Error(
    "No image generation available. Start local server or configure cloud API keys."
  );
}
