/**
 * Image generation helper using OpenAI DALL-E 3
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 */
import { storagePut } from "server/storage";

export type GenerateImageOptions = {
  prompt: string;
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
};

export type GenerateImageResponse = {
  url?: string;
  revisedPrompt?: string;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured for image generation");
  }

  console.info(
    "[ImageGen] Generating image with DALL-E 3:",
    options.prompt.slice(0, 100) + "..."
  );

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
      size: options.size || "1024x1024",
      quality: options.quality || "standard",
      style: options.style || "vivid",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[ImageGen] DALL-E API error:", response.status, detail);
    throw new Error(
      `Image generation failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    data: Array<{
      b64_json: string;
      revised_prompt?: string;
    }>;
  };

  if (!result.data || result.data.length === 0) {
    throw new Error("No image data returned from DALL-E");
  }

  const imageData = result.data[0];
  const buffer = Buffer.from(imageData.b64_json, "base64");

  // Save to S3/storage
  const { url } = await storagePut(
    `generated/${Date.now()}.png`,
    buffer,
    "image/png"
  );

  console.info("[ImageGen] Image generated and saved:", url);

  return {
    url,
    revisedPrompt: imageData.revised_prompt,
  };
}
