import { storagePut } from "server/storage";

export type GenerateImageOptions = {
  prompt: string;
  size?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  imageUrls?: string[];
};

export type GenerateImageResponse = {
  url?: string;
  provider?: "nanobanana" | "dalle";
};

const NANOBANANA_API_KEY = process.env.NANOBANANA_API_KEY ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

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

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
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
      throw error;
    }
  }

  console.error(
    "[ImageGen] No API keys configured - NANOBANANA:",
    !!NANOBANANA_API_KEY,
    "OPENAI:",
    !!OPENAI_API_KEY
  );
  throw new Error(
    "No image generation API configured. Set NANOBANANA_API_KEY or OPENAI_API_KEY."
  );
}
