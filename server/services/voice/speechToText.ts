/**
 * Speech-to-Text Service using Whisper API
 * Transcribes audio from browser microphone to text
 */

import {
  transcribeAudio,
  type WhisperResponse,
  type TranscriptionError,
} from "../../_core/voiceTranscription";

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

/**
 * Type guard to check if response is an error
 */
function isTranscriptionError(
  response: WhisperResponse | TranscriptionError
): response is TranscriptionError {
  return "error" in response;
}

/**
 * Transcribe audio buffer to text
 * Accepts audio data as base64 string or URL
 */
export async function transcribeVoice(
  audioUrl: string,
  options: {
    language?: string;
    prompt?: string;
  } = {}
): Promise<TranscriptionResult> {
  try {
    const result = await transcribeAudio({
      audioUrl,
      language: options.language || "en",
      prompt:
        options.prompt ||
        "Transcribe the following voice command for JARVIS AI assistant",
    });

    // Check if it's an error response
    if (isTranscriptionError(result)) {
      throw new Error(
        `Transcription failed: ${result.error} - ${result.details || ""}`
      );
    }

    return {
      text: result.text,
      language: result.language,
      duration: result.duration,
      segments: result.segments?.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error(`Failed to transcribe audio: ${error}`);
  }
}

/**
 * Transcribe audio from base64 data
 * Used when audio is sent directly from browser
 */
export async function transcribeBase64Audio(
  base64Data: string,
  mimeType: string = "audio/webm"
): Promise<TranscriptionResult> {
  // Convert base64 to data URL format for the transcription service
  const audioUrl = `data:${mimeType};base64,${base64Data}`;

  return transcribeVoice(audioUrl);
}
