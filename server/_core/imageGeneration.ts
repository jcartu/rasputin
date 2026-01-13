import { storagePut } from "server/storage";

export type GenerateImageOptions = {
  prompt: string;
  size?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  imageUrls?: string[];
};

export type GenerateImageResponse = {
  url?: string;
  provider?: "nanobanana" | "dalle" | "flux-local";
};

const NANOBANANA_API_KEY = process.env.NANOBANANA_API_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
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

  const maxAttempts = 60;
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

  throw new Error("Nano Banana timeout - task did not complete in 2 minutes");
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
      width: size.width,
      height: size.height,
      num_inference_steps: 28,
      guidance_scale: 3.5,
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
    const { url } = await storagePut(
      `generated/flux-${Date.now()}.png`,
      buffer,
      "image/png"
    );
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
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png"
  );

  console.info("[ImageGen] DALL-E complete:", url);
  return { url, provider: "dalle" };
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
  if (isNsfwPrompt(options.prompt)) {
    console.info("[ImageGen] NSFW content detected, routing to local Flux");
    try {
      return await generateWithLocalFlux(options);
    } catch (error) {
      console.error("[ImageGen] Local Flux failed:", error);
      throw new Error(
        "NSFW content requires local Flux, but it is not available. " +
          "Please configure FLUX_LOCAL_URL."
      );
    }
  }

  if (NANOBANANA_API_KEY) {
    try {
      return await generateWithNanoBanana(options);
    } catch (error) {
      console.error("[ImageGen] Nano Banana failed, trying DALL-E:", error);
    }
  }

  if (OPENAI_API_KEY) {
    try {
      return await generateWithDallE(options);
    } catch (error) {
      console.error("[ImageGen] DALL-E also failed:", error);
    }
  }

  try {
    return await generateWithLocalFlux(options);
  } catch (error) {
    console.error("[ImageGen] Local Flux also failed:", error);
  }

  console.error(
    "[ImageGen] No providers available - NANOBANANA:",
    !!NANOBANANA_API_KEY,
    "OPENAI:",
    !!OPENAI_API_KEY
  );
  throw new Error(
    "No image generation API configured. Set NANOBANANA_API_KEY, OPENAI_API_KEY, or FLUX_LOCAL_URL."
  );
}
