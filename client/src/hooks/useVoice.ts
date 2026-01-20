import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";

const VOICE_ID = "TxGEqnHWrfWFTfGW9XjX"; // "Josh" - deep, professional

export function useVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ttsMutation = trpc.voice.textToSpeech.useMutation();

  const speak = useCallback(
    async (text: string) => {
      if (!text || isSpeaking) return;

      try {
        setIsSpeaking(true);
        const result = await ttsMutation.mutateAsync({
          text,
          voiceId: VOICE_ID,
        });

        // Convert base64 to blob and play
        const audioData = atob(result.audio);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        const blob = new Blob([audioArray], { type: result.mimeType });
        const audio = new Audio(URL.createObjectURL(blob));

        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => setIsSpeaking(false);
        audio.play();
      } catch (error) {
        console.error("TTS Error:", error);
        setIsSpeaking(false);
      }
    },
    [isSpeaking, ttsMutation]
  );

  return { speak, isSpeaking };
}
