'use client';

import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  Monitor,
  AppWindow,
  Chrome,
  Mic,
  MicOff,
  X,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMediaStore, type RecordingSource, generateThumbnail } from '@/lib/mediaStore';
import { cn } from '@/lib/utils';

const sourceOptions: { id: RecordingSource; label: string; icon: typeof Monitor; description: string }[] = [
  { id: 'screen', label: 'Entire Screen', icon: Monitor, description: 'Capture everything on your screen' },
  { id: 'window', label: 'Application Window', icon: AppWindow, description: 'Record a specific application' },
  { id: 'tab', label: 'Browser Tab', icon: Chrome, description: 'Record a single browser tab' },
];

export function ScreenRecorder() {
  const {
    recording,
    isRecordingPanelOpen,
    setRecordingPanelOpen,
    setRecordingState,
    startRecording,
    stopRecording,
    setCountdown,
    addItem,
  } = useMediaStore();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const handleSourceSelect = async (source: RecordingSource) => {
    setRecordingState({ source });
  };

  const handleAudioToggle = (enabled: boolean) => {
    setRecordingState({ hasAudio: enabled });
  };

  const startCountdown = useCallback(() => {
    setCountdown(3);
  }, [setCountdown]);

  const initiateRecording = useCallback(async () => {
    try {
      const displayMediaOptions: DisplayMediaStreamOptions = {
        video: {
          displaySurface: recording.source === 'screen' ? 'monitor' : 
                         recording.source === 'window' ? 'window' : 'browser',
        },
        audio: recording.hasAudio,
      };

      const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      
      let finalStream = stream;
      
      if (recording.hasAudio) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioTrack = audioStream.getAudioTracks()[0];
          if (audioTrack) {
            finalStream = new MediaStream([...stream.getTracks(), audioTrack]);
          }
        } catch {
          console.log('Microphone access denied, recording without mic audio');
        }
      }

      streamRef.current = finalStream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(finalStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video.currentTime = 1;
          };
          video.onseeked = () => resolve();
          video.onerror = () => resolve();
        });

        const thumbnail = await generateThumbnail(video);

        addItem({
          type: 'recording',
          name: `Recording ${new Date().toLocaleTimeString()}`,
          thumbnail,
          url,
          blob,
          duration: recording.duration,
          width: video.videoWidth || 1920,
          height: video.videoHeight || 1080,
          hasAudio: recording.hasAudio,
        });

        video.remove();
        stopRecording();
      };

      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      };

      mediaRecorder.start(1000);
      startRecording();
      setRecordingPanelOpen(false);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingState({ source: null });
    }
  }, [recording.source, recording.hasAudio, recording.duration, addItem, stopRecording, startRecording, setRecordingPanelOpen, setRecordingState]);

  useEffect(() => {
    if (recording.countdown === null) return;
    
    if (recording.countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(recording.countdown! - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (recording.countdown === 0) {
      setCountdown(null);
      initiateRecording();
    }
  }, [recording.countdown, setCountdown, initiateRecording]);

  const handleStartRecording = () => {
    if (!recording.source) return;
    startCountdown();
    setRecordingPanelOpen(false);
  };

  return (
    <Dialog open={isRecordingPanelOpen} onOpenChange={setRecordingPanelOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Start Recording
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Select what to record</h4>
            <div className="space-y-2">
              {sourceOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSourceSelect(option.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                    recording.source === option.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    recording.source === option.id ? 'bg-primary/10' : 'bg-muted'
                  )}>
                    <option.icon className={cn(
                      'w-5 h-5',
                      recording.source === option.id ? 'text-primary' : 'text-muted-foreground'
                    )} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              {recording.hasAudio ? (
                <Mic className="w-5 h-5 text-primary" />
              ) : (
                <MicOff className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Include microphone</p>
                <p className="text-xs text-muted-foreground">Record your voice narration</p>
              </div>
            </div>
            <Switch
              checked={recording.hasAudio}
              onCheckedChange={handleAudioToggle}
            />
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleStartRecording}
            disabled={!recording.source}
          >
            <Play className="w-4 h-4 mr-2" />
            Start Recording
          </Button>
        </div>
      </DialogContent>

      <AnimatePresence>
        {recording.countdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              key={recording.countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-9xl font-bold text-primary"
            >
              {recording.countdown || 'GO!'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

export function useRecordingControls() {
  const { recording, pauseRecording, resumeRecording, stopRecording } = useMediaStore();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const handlePause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      pauseRecording();
    }
  }, [pauseRecording]);

  const handleResume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      resumeRecording();
    }
  }, [resumeRecording]);

  const handleStop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    recording,
    handlePause,
    handleResume,
    handleStop,
  };
}
