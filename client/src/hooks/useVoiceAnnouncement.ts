import { useEffect, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { getSocket, type VoiceAnnouncementEvent } from "@/lib/socket";
import { trpc } from "@/lib/trpc";

const VOICE_ENABLED_KEY = "rasputin:voice-announcements-enabled";

export function useVoiceAnnouncement() {
  const [isEnabled, setIsEnabled] = useState(() => {
    const stored = localStorage.getItem(VOICE_ENABLED_KEY);
    return stored === null ? true : stored === "true";
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<VoiceAnnouncementEvent[]>([]);
  const processingRef = useRef(false);

  const ttsMutation = trpc.voice.textToSpeech.useMutation();

  useEffect(() => {
    localStorage.setItem(VOICE_ENABLED_KEY, String(isEnabled));
  }, [isEnabled]);

  const toggle = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
    queueRef.current = [];
    processingRef.current = false;
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current || queueRef.current.length === 0) return;

    processingRef.current = true;
    const event = queueRef.current.shift();

    if (!event) {
      processingRef.current = false;
      return;
    }

    try {
      setIsSpeaking(true);
      const result = await ttsMutation.mutateAsync({
        text: event.text.slice(0, 4000),
      });
      const audio = new Audio(`data:${result.mimeType};base64,${result.audio}`);
      audioRef.current = audio;

      audio.onended = () => {
        audioRef.current = null;
        setIsSpeaking(false);
        processingRef.current = false;
        processQueue();
      };

      audio.onerror = () => {
        audioRef.current = null;
        setIsSpeaking(false);
        processingRef.current = false;
        processQueue();
      };

      await audio.play();
    } catch {
      setIsSpeaking(false);
      processingRef.current = false;
      processQueue();
    }
  }, [ttsMutation]);

  useEffect(() => {
    const socket = getSocket();

    const handleVoiceAnnouncement = (event: VoiceAnnouncementEvent) => {
      if (!isEnabled) return;

      if (event.priority === "high") {
        toast.info(`🔊 ${event.text.slice(0, 100)}...`, {
          duration: 5000,
        });
      }

      queueRef.current.push(event);
      processQueue();
    };

    socket.on("voice:announce", handleVoiceAnnouncement);

    return () => {
      socket.off("voice:announce", handleVoiceAnnouncement);
    };
  }, [isEnabled, processQueue]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return {
    isEnabled,
    isSpeaking,
    toggle,
    stop,
    setEnabled: setIsEnabled,
  };
}
