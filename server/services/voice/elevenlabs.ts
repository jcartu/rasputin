/**
 * ElevenLabs Text-to-Speech Service
 * Provides high-quality voice synthesis for JARVIS
 */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

// Voice options - using professional, clear voices suitable for AI assistant
export const VOICE_OPTIONS = {
  hal9000: {
    id: "onwK4e9ZLuTAKqWW03F9",
    name: "Daniel",
    description: "HAL 9000 Style - Calm, Monotone, Menacing British AI",
    accent: "british",
  },
  jarvis: {
    id: "N2lVS1w4EtoT3dr4eOWO",
    name: "Callum",
    description: "British, Intense, Transatlantic - Evil AI Computer Style",
    accent: "british",
  },
  daniel: {
    id: "onwK4e9ZLuTAKqWW03F9",
    name: "Daniel",
    description: "British, Deep, Authoritative - News Presenter Style",
    accent: "british",
  },
  george: {
    id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    description: "British, Mature, Warm Storyteller - Serious and Professional",
    accent: "british",
  },
  roger: {
    id: "CwhRBWXzGAHq8TQ4Fs17",
    name: "Roger",
    description: "American, Laid-Back, Casual, Resonant",
    accent: "american",
  },
  charlie: {
    id: "IKne3meq5aSn9XLyUdCD",
    name: "Charlie",
    description: "Australian, Deep, Confident, Energetic",
    accent: "australian",
  },
  sarah: {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah",
    description: "American, Mature, Reassuring, Confident",
    accent: "american",
  },
  laura: {
    id: "FGY2WhTYpPnrIDTdsKH5",
    name: "Laura",
    description: "American, Enthusiastic, Quirky Attitude",
    accent: "american",
  },
} as const;

export const DEFAULT_VOICE = VOICE_OPTIONS.hal9000;

function normalizeTextForSpeech(text: string): string {
  let normalized = text;

  normalized = normalized.replace(/(\d+)\s*°C/gi, "$1 degrees Celsius");
  normalized = normalized.replace(/(\d+)\s*°F/gi, "$1 degrees Fahrenheit");
  normalized = normalized.replace(/(\d+)\s*°/g, "$1 degrees");
  normalized = normalized.replace(/(\d+)\s*km\/h/gi, "$1 kilometers per hour");
  normalized = normalized.replace(/(\d+)\s*mph/gi, "$1 miles per hour");
  normalized = normalized.replace(/(\d+)\s*m\/s/gi, "$1 meters per second");
  normalized = normalized.replace(/(\d+)\s*hPa/gi, "$1 hectopascals");
  normalized = normalized.replace(/(\d+)\s*mb/gi, "$1 millibars");
  normalized = normalized.replace(/(\d+)\s*mm/gi, "$1 millimeters");
  normalized = normalized.replace(/(\d+)\s*cm/gi, "$1 centimeters");
  normalized = normalized.replace(/(\d+)\s*km/gi, "$1 kilometers");
  normalized = normalized.replace(/(\d+)\s*%/g, "$1 percent");
  normalized = normalized.replace(/UV\s*(\d+)/gi, "UV index $1");

  normalized = normalized.replace(/\b0\b/g, "zero");
  normalized = normalized.replace(/\b1\b/g, "one");
  normalized = normalized.replace(/\b2\b/g, "two");
  normalized = normalized.replace(/\b3\b/g, "three");
  normalized = normalized.replace(/\b4\b/g, "four");
  normalized = normalized.replace(/\b5\b/g, "five");
  normalized = normalized.replace(/\b6\b/g, "six");
  normalized = normalized.replace(/\b7\b/g, "seven");
  normalized = normalized.replace(/\b8\b/g, "eight");
  normalized = normalized.replace(/\b9\b/g, "nine");
  normalized = normalized.replace(/\b10\b/g, "ten");

  normalized = normalized.replace(/-(\d+)/g, "minus $1");

  normalized = normalized.replace(/\bN\b(?!\w)/g, "North");
  normalized = normalized.replace(/\bS\b(?!\w)/g, "South");
  normalized = normalized.replace(/\bE\b(?!\w)/g, "East");
  normalized = normalized.replace(/\bW\b(?!\w)/g, "West");
  normalized = normalized.replace(/\bNE\b/g, "Northeast");
  normalized = normalized.replace(/\bNW\b/g, "Northwest");
  normalized = normalized.replace(/\bSE\b/g, "Southeast");
  normalized = normalized.replace(/\bSW\b/g, "Southwest");
  normalized = normalized.replace(/\bNNE\b/g, "North-Northeast");
  normalized = normalized.replace(/\bENE\b/g, "East-Northeast");
  normalized = normalized.replace(/\bESE\b/g, "East-Southeast");
  normalized = normalized.replace(/\bSSE\b/g, "South-Southeast");
  normalized = normalized.replace(/\bSSW\b/g, "South-Southwest");
  normalized = normalized.replace(/\bWSW\b/g, "West-Southwest");
  normalized = normalized.replace(/\bWNW\b/g, "West-Northwest");
  normalized = normalized.replace(/\bNNW\b/g, "North-Northwest");

  normalized = normalized.replace(/[╔╗╚╝╠╣║═│┌┐└┘├┤─┬┴┼]/g, "");
  normalized = normalized.replace(/```[\s\S]*?```/g, "");
  normalized = normalized.replace(/`[^`]+`/g, match => match.replace(/`/g, ""));

  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

export interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

/**
 * Generate speech from text using ElevenLabs
 * Returns audio as ArrayBuffer
 */
export async function textToSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<ArrayBuffer> {
  const {
    voiceId = DEFAULT_VOICE.id,
    modelId = "eleven_turbo_v2_5",
    stability = 0.85,
    similarityBoost = 0.75,
    style = 0.05,
    useSpeakerBoost = false,
  } = options;

  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  const normalizedText = normalizeTextForSpeech(text);

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: normalizedText,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: useSpeakerBoost,
          speed: 0.92,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs TTS error: ${error}`);
  }

  return response.arrayBuffer();
}

/**
 * Generate speech with streaming support
 * Returns a ReadableStream of audio chunks
 */
export async function textToSpeechStream(
  text: string,
  options: TTSOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const {
    voiceId = DEFAULT_VOICE.id,
    modelId = "eleven_turbo_v2_5",
    stability = 0.85,
    similarityBoost = 0.75,
    style = 0.05,
    useSpeakerBoost = false,
  } = options;

  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  const normalizedText = normalizeTextForSpeech(text);

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: normalizedText,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: useSpeakerBoost,
          speed: 0.92,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs streaming TTS error: ${error}`);
  }

  if (!response.body) {
    throw new Error("No response body from ElevenLabs");
  }

  return response.body;
}

/**
 * Get available voices from ElevenLabs
 */
export async function getVoices(): Promise<
  Array<{
    voice_id: string;
    name: string;
    description?: string;
    preview_url?: string;
  }>
> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs voices error: ${error}`);
  }

  const data = await response.json();
  return data.voices;
}

/**
 * Get user subscription info (for rate limit awareness)
 */
export async function getSubscriptionInfo(): Promise<{
  character_count: number;
  character_limit: number;
  can_extend_character_limit: boolean;
}> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs subscription error: ${error}`);
  }

  return response.json();
}
