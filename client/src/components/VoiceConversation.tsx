/**
 * Voice Conversation Component
 * Push-to-talk interface with waveform visualization for JARVIS
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Volume2, VolumeX, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
// Audio upload will be handled via tRPC mutation
import { toast } from "sonner";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface VoiceConversationProps {
  onTranscription?: (text: string) => void;
  onSpeakingStart?: () => void;
  onSpeakingEnd?: () => void;
  autoSpeak?: boolean;
  voiceId?: string;
  className?: string;
}

export function VoiceConversation({
  onTranscription,
  onSpeakingStart,
  onSpeakingEnd,
  autoSpeak: _autoSpeak = true,
  voiceId,
  className,
}: VoiceConversationProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(
    new Array(32).fill(0)
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const ttsMutation = trpc.voice.textToSpeech.useMutation();
  const transcribeMutation = trpc.voice.transcribe.useMutation();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Analyze audio levels for visualization
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average level
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255);

    // Create waveform data (32 bars)
    const barCount = 32;
    const step = Math.floor(dataArray.length / barCount);
    const newWaveform = [];
    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i * step] / 255;
      newWaveform.push(value);
    }
    setWaveformData(newWaveform);

    if (state === "listening" || state === "speaking") {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, [state]);

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setState("processing");
        await processRecording();
      };

      mediaRecorder.start();
      setState("listening");
      analyzeAudio();
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Microphone access denied");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setAudioLevel(0);
    setWaveformData(new Array(32).fill(0));
  };

  // Process recorded audio
  const processRecording = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      // Upload via tRPC and transcribe
      const transcription = await transcribeMutation.mutateAsync({
        audioUrl: `data:audio/webm;base64,${base64}`,
      });

      if (transcription.text) {
        onTranscription?.(transcription.text);
      }
    } catch (error) {
      console.error("Failed to process recording:", error);
      toast.error("Failed to transcribe audio");
    } finally {
      setState("idle");
    }
  };

  // Speak text using TTS
  const speak = async (text: string) => {
    if (isMuted || !text) return;

    try {
      setState("speaking");
      onSpeakingStart?.();

      const result = await ttsMutation.mutateAsync({
        text,
        voiceId,
      });

      // Create audio element and play
      const audioData = `data:${result.mimeType};base64,${result.audio}`;
      const audio = new Audio(audioData);
      audioElementRef.current = audio;

      // Set up audio analysis for speaking visualization
      if (
        !audioContextRef.current ||
        audioContextRef.current.state === "closed"
      ) {
        audioContextRef.current = new AudioContext();
      }
      const source = audioContextRef.current.createMediaElementSource(audio);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      source.connect(audioContextRef.current.destination);

      audio.onplay = () => {
        analyzeAudio();
      };

      audio.onended = () => {
        setState("idle");
        onSpeakingEnd?.();
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        setWaveformData(new Array(32).fill(0));
      };

      await audio.play();
    } catch (error) {
      console.error("Failed to speak:", error);
      toast.error("Failed to generate speech");
      setState("idle");
      onSpeakingEnd?.();
    }
  };

  // Stop speaking
  const stopSpeaking = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    setState("idle");
    onSpeakingEnd?.();
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setWaveformData(new Array(32).fill(0));
  };

  // Handle push-to-talk
  const handlePushToTalk = () => {
    if (state === "listening") {
      stopRecording();
    } else if (state === "speaking") {
      stopSpeaking();
    } else if (state === "idle") {
      startRecording();
    }
  };

  // Expose speak function
  useEffect(() => {
    (window as any).jarvisSpeakFn = speak;
    return () => {
      delete (window as any).jarvisSpeakFn;
    };
  }, [voiceId, isMuted]);

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Waveform Visualization */}
      <div className="relative w-48 h-24 flex items-center justify-center">
        {/* Animated Orb Background */}
        <div
          className={cn(
            "absolute inset-0 rounded-full transition-all duration-300",
            state === "listening" && "bg-cyan-500/20 animate-pulse",
            state === "speaking" && "bg-purple-500/20 animate-pulse",
            state === "processing" && "bg-yellow-500/20 animate-pulse"
          )}
          style={{
            transform: `scale(${1 + audioLevel * 0.3})`,
          }}
        />

        {/* Waveform Bars */}
        <div className="relative flex items-center justify-center gap-0.5 h-16">
          {waveformData.map((value, index) => (
            <div
              key={index}
              className={cn(
                "w-1 rounded-full transition-all duration-75",
                state === "listening" && "bg-cyan-400",
                state === "speaking" && "bg-purple-400",
                state === "processing" && "bg-yellow-400",
                state === "idle" && "bg-muted-foreground/30"
              )}
              style={{
                height: `${Math.max(4, value * 64)}px`,
              }}
            />
          ))}
        </div>

        {/* Center Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {state === "processing" && (
            <Loader2 className="h-8 w-8 text-yellow-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Status Text */}
      <div className="text-sm text-muted-foreground">
        {state === "idle" && "Press to talk"}
        {state === "listening" && "Listening..."}
        {state === "processing" && "Processing..."}
        {state === "speaking" && "Speaking..."}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Mute Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className={cn(isMuted && "text-red-400")}
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </Button>

        {/* Main Push-to-Talk Button */}
        <Button
          size="lg"
          variant={state === "listening" ? "destructive" : "default"}
          onClick={handlePushToTalk}
          disabled={state === "processing"}
          className={cn(
            "w-16 h-16 rounded-full transition-all",
            state === "listening" &&
              "bg-red-500 hover:bg-red-600 animate-pulse",
            state === "speaking" && "bg-purple-500 hover:bg-purple-600"
          )}
        >
          {state === "listening" ? (
            <Square className="h-6 w-6" />
          ) : state === "speaking" ? (
            <Square className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>

        {/* Stop Button (when speaking) */}
        {state === "speaking" && (
          <Button variant="ghost" size="icon" onClick={stopSpeaking}>
            <MicOff className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Hook to use voice conversation
export function useVoiceConversation() {
  const speak = useCallback((text: string) => {
    const speakFn = (window as any).jarvisSpeakFn;
    if (speakFn) {
      speakFn(text);
    }
  }, []);

  return { speak };
}

export default VoiceConversation;
