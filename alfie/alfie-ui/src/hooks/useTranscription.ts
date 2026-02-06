'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useMeetingStore } from '@/stores/meetingStore';
import type { TranscriptSegment } from '@/types/meeting';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onspeechstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface UseTranscriptionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onSegmentComplete?: (segment: Omit<TranscriptSegment, 'id'>) => void;
  onInterimTranscript?: (text: string) => void;
  onError?: (error: string) => void;
}

interface TranscriptionState {
  isListening: boolean;
  interimText: string;
  error: string | null;
  audioLevel: number;
}

function getSpeechRecognitionAPI(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor })
    .SpeechRecognition || 
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition || 
    null;
}

export function useWebSpeechTranscription(options: UseTranscriptionOptions = {}) {
  const {
    language = 'en-US',
    continuous = true,
    interimResults = true,
    onSegmentComplete,
    onInterimTranscript,
    onError,
  } = options;

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const startTimeRef = useRef<number>(0);
  const segmentStartRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const isListeningRef = useRef(false);

  const [state, setState] = useState<TranscriptionState>({
    isListening: false,
    interimText: '',
    error: null,
    audioLevel: 0,
  });

  const { setWebSpeechEngine, addTranscriptSegment, currentMeeting } = useMeetingStore();

  const SpeechRecognitionAPI = getSpeechRecognitionAPI();
  const isSupported = SpeechRecognitionAPI !== null;

  const setupAudioAnalyser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setState(s => ({ ...s, audioLevel: average / 255 }));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.error('Failed to setup audio analyser:', err);
    }
  }, []);

  const cleanupAudioAnalyser = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || !SpeechRecognitionAPI) {
      const errorMsg = 'Speech recognition not supported in this browser';
      setState(s => ({ ...s, error: errorMsg }));
      onError?.(errorMsg);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    startTimeRef.current = Date.now();
    segmentStartRef.current = Date.now();

    recognition.onstart = () => {
      isListeningRef.current = true;
      setState(s => ({ ...s, isListening: true, error: null }));
      setWebSpeechEngine({ status: 'listening' });
    };

    recognition.onspeechstart = () => {
      segmentStartRef.current = Date.now();
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
          
          const now = Date.now();
          const segment: Omit<TranscriptSegment, 'id'> = {
            speakerId: currentMeeting?.speakers[0]?.id || 'unknown',
            text: transcript.trim(),
            startTimeMs: segmentStartRef.current - startTimeRef.current,
            endTime: now - startTimeRef.current,
            confidence: confidence || 0.9,
            isEdited: false,
          };
          
          onSegmentComplete?.(segment);
          addTranscriptSegment(segment);
          segmentStartRef.current = now;
        } else {
          interimTranscript += transcript;
        }
      }

      setState(s => ({ ...s, interimText: interimTranscript }));
      if (interimTranscript) {
        onInterimTranscript?.(interimTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMsg = `Speech recognition error: ${event.error}`;
      setState(s => ({ ...s, error: errorMsg, isListening: false }));
      setWebSpeechEngine({ status: 'error', errorMessage: errorMsg });
      onError?.(errorMsg);
    };

    recognition.onend = () => {
      setState(s => ({ ...s, isListening: false, interimText: '' }));
      setWebSpeechEngine({ status: 'idle' });
      
      if (isListeningRef.current && continuous && recognitionRef.current) {
        setTimeout(() => {
          if (recognitionRef.current && isListeningRef.current) {
            try {
              recognitionRef.current.start();
            } catch {
              isListeningRef.current = false;
            }
          }
        }, 100);
      }
    };

    setupAudioAnalyser();
    recognition.start();
  }, [
    isSupported, 
    SpeechRecognitionAPI,
    continuous, 
    interimResults, 
    language, 
    currentMeeting,
    onSegmentComplete, 
    onInterimTranscript, 
    onError,
    setWebSpeechEngine,
    addTranscriptSegment,
    setupAudioAnalyser,
  ]);

  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    cleanupAudioAnalyser();
    setState(s => ({ ...s, isListening: false, interimText: '', audioLevel: 0 }));
    setWebSpeechEngine({ status: 'idle' });
  }, [cleanupAudioAnalyser, setWebSpeechEngine]);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      cleanupAudioAnalyser();
    };
  }, [cleanupAudioAnalyser]);

  return {
    ...state,
    isSupported,
    startListening,
    stopListening,
  };
}

interface WhisperTranscriptionOptions extends UseTranscriptionOptions {
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  apiEndpoint?: string;
}

export function useWhisperTranscription(options: WhisperTranscriptionOptions = {}) {
  const {
    language = 'en',
    model = 'base',
    apiEndpoint = '/api/meetings/transcribe',
    onSegmentComplete,
    onError,
  } = options;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);

  const [state, setState] = useState<TranscriptionState>({
    isListening: false,
    interimText: '',
    error: null,
    audioLevel: 0,
  });

  const { setWhisperEngine, addTranscriptSegment, currentMeeting } = useMeetingStore();

  const processAudioChunk = useCallback(async (audioBlob: Blob) => {
    setState(s => ({ ...s, interimText: 'Processing...' }));
    setWhisperEngine({ status: 'processing' });

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('model', model);
      formData.append('language', language);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.segments) {
        for (const seg of result.segments) {
          const segment: Omit<TranscriptSegment, 'id'> = {
            speakerId: currentMeeting?.speakers[0]?.id || 'unknown',
            text: seg.text.trim(),
            startTimeMs: seg.start * 1000,
            endTime: seg.end * 1000,
            confidence: seg.confidence || 0.9,
            isEdited: false,
          };
          
          onSegmentComplete?.(segment);
          addTranscriptSegment(segment);
        }
      } else if (result.text) {
        const segment: Omit<TranscriptSegment, 'id'> = {
          speakerId: currentMeeting?.speakers[0]?.id || 'unknown',
          text: result.text.trim(),
          startTimeMs: startTimeRef.current,
          endTime: Date.now() - startTimeRef.current,
          confidence: 0.9,
          isEdited: false,
        };
        
        onSegmentComplete?.(segment);
        addTranscriptSegment(segment);
      }

      setState(s => ({ ...s, interimText: '' }));
      setWhisperEngine({ status: 'listening' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Whisper transcription failed';
      setState(s => ({ ...s, error: errorMsg }));
      setWhisperEngine({ status: 'error', errorMessage: errorMsg });
      onError?.(errorMsg);
    }
  }, [model, language, apiEndpoint, currentMeeting, onSegmentComplete, onError, setWhisperEngine, addTranscriptSegment]);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setState(s => ({ ...s, audioLevel: average / 255 }));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });

      startTimeRef.current = Date.now();
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudioChunk(audioBlob);
        chunksRef.current = [];
      };

      mediaRecorderRef.current.start(5000);
      
      setState(s => ({ ...s, isListening: true, error: null }));
      setWhisperEngine({ status: 'listening' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start recording';
      setState(s => ({ ...s, error: errorMsg }));
      setWhisperEngine({ status: 'error', errorMessage: errorMsg });
      onError?.(errorMsg);
    }
  }, [processAudioChunk, setWhisperEngine, onError]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => {
        track.stop();
      });
      mediaRecorderRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setState(s => ({ ...s, isListening: false, interimText: '', audioLevel: 0 }));
    setWhisperEngine({ status: 'idle' });
  }, [setWhisperEngine]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => {
          track.stop();
        });
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    isSupported: true,
    startListening,
    stopListening,
  };
}
