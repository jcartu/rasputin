/**
 * ElevenLabs Text-to-Speech Service
 * Provides high-quality voice synthesis for JARVIS
 */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

// Voice options - using professional, clear voices suitable for AI assistant
export const VOICE_OPTIONS = {
  // Male voices - British
  george: {
    id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George",
    description: "British, Mature, Warm Storyteller - Serious and Professional",
    accent: "british",
  },
  // Male voices - Other
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
  // Female voices
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

// Default voice for JARVIS - Serious British male (George)
export const DEFAULT_VOICE = VOICE_OPTIONS.george;

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
    modelId = "eleven_turbo_v2_5", // Fast, high-quality model
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.0,
    useSpeakerBoost = true,
  } = options;

  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: useSpeakerBoost,
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
    stability = 0.5,
    similarityBoost = 0.75,
    style = 0.0,
    useSpeakerBoost = true,
  } = options;

  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: useSpeakerBoost,
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
