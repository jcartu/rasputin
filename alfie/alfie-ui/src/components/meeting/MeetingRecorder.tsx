'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Square,
  Pause,
  Play,
  Settings,
  Users,
  Clock,
  Radio,
  X,
  Plus,
  Edit2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useMeetingStore } from '@/stores/meetingStore';
import { useWebSpeechTranscription, useWhisperTranscription } from '@/hooks/useTranscription';
import type { Speaker } from '@/types/meeting';

interface MeetingRecorderProps {
  onClose?: () => void;
}

export function MeetingRecorder({ onClose }: MeetingRecorderProps) {
  const {
    currentMeeting,
    recording,
    config,
    createMeeting,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    addSpeaker,
    updateSpeaker,
    deleteSpeaker,
    setRecordingState,
  } = useMeetingStore();

  const [title, setTitle] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [editingSpeakerName, setEditingSpeakerName] = useState('');
  const durationRef = useRef<NodeJS.Timeout | null>(null);

  const webSpeech = useWebSpeechTranscription({
    language: config.language,
  });

  const whisper = useWhisperTranscription({
    language: config.language,
    model: config.whisperModel,
  });

  const transcription = config.engine === 'whisper' ? whisper : webSpeech;

  useEffect(() => {
    if (recording.isRecording && !recording.isPaused) {
      durationRef.current = setInterval(() => {
        setRecordingState({ duration: recording.duration + 1000 });
      }, 1000);
    }

    return () => {
      if (durationRef.current) {
        clearInterval(durationRef.current);
      }
    };
  }, [recording.isRecording, recording.isPaused, recording.duration, setRecordingState]);

  const handleStartRecording = useCallback(() => {
    let meeting = currentMeeting;
    if (!meeting) {
      meeting = createMeeting(title || `Meeting ${new Date().toLocaleDateString()}`);
    }
    startRecording(meeting.id);
    transcription.startListening();
  }, [currentMeeting, createMeeting, title, startRecording, transcription]);

  const handleStopRecording = useCallback(async () => {
    transcription.stopListening();
    await stopRecording();
  }, [transcription, stopRecording]);

  const handleTogglePause = useCallback(() => {
    if (recording.isPaused) {
      resumeRecording();
      transcription.startListening();
    } else {
      pauseRecording();
      transcription.stopListening();
    }
  }, [recording.isPaused, resumeRecording, pauseRecording, transcription]);

  const handleAddSpeaker = useCallback(() => {
    if (newSpeakerName.trim() && currentMeeting) {
      addSpeaker(newSpeakerName.trim());
      setNewSpeakerName('');
    }
  }, [newSpeakerName, currentMeeting, addSpeaker]);

  const handleUpdateSpeaker = useCallback(() => {
    if (editingSpeakerId && editingSpeakerName.trim()) {
      updateSpeaker(editingSpeakerId, { name: editingSpeakerName.trim() });
      setEditingSpeakerId(null);
      setEditingSpeakerName('');
    }
  }, [editingSpeakerId, editingSpeakerName, updateSpeaker]);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const AUDIO_BARS = ['bar-0', 'bar-1', 'bar-2', 'bar-3', 'bar-4'] as const;
  
  const AudioLevelIndicator = () => (
    <div className="flex items-center gap-1 h-6">
      {AUDIO_BARS.map((barId, barIndex) => (
        <motion.div
          key={barId}
          className={cn(
            'w-1 rounded-full transition-colors',
            transcription.audioLevel > (barIndex + 1) / 5
              ? 'bg-primary'
              : 'bg-muted'
          )}
          animate={{
            height: transcription.isListening
              ? Math.max(4, Math.min(24, transcription.audioLevel * 24 + (barIndex * 2)))
              : 4,
          }}
          transition={{ duration: 0.1 }}
        />
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col h-full bg-background rounded-xl border shadow-lg overflow-hidden"
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            recording.isRecording ? 'bg-red-500/10' : 'bg-muted'
          )}>
            {recording.isRecording ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Radio className="w-5 h-5 text-red-500" />
              </motion.div>
            ) : (
              <Mic className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-semibold">
              {currentMeeting?.title || 'New Meeting'}
            </h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDuration(recording.duration)}</span>
              {recording.isPaused && (
                <Badge variant="secondary" className="text-xs">
                  Paused
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4">
        {!recording.isRecording && (
          <div className="space-y-4">
            <div>
              <label htmlFor="meeting-title" className="text-sm font-medium mb-2 block">
                Meeting Title
              </label>
              <Input
                id="meeting-title"
                placeholder="Enter meeting title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="participant-name" className="text-sm font-medium mb-2 block">
                Participants ({currentMeeting?.speakers.length || 0})
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  id="participant-name"
                  placeholder="Add participant..."
                  value={newSpeakerName}
                  onChange={(e) => setNewSpeakerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSpeaker()}
                  disabled={!currentMeeting}
                />
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleAddSpeaker}
                  disabled={!newSpeakerName.trim() || !currentMeeting}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentMeeting?.speakers.map((speaker: Speaker) => (
                  <motion.div
                    key={speaker.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
                    style={{ borderColor: speaker.color }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: speaker.color }}
                    />
                    {editingSpeakerId === speaker.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingSpeakerName}
                          onChange={(e) => setEditingSpeakerName(e.target.value)}
                          className="h-6 w-24 text-sm px-1"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateSpeaker()}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={handleUpdateSpeaker}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm">{speaker.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => {
                            setEditingSpeakerId(speaker.id);
                            setEditingSpeakerName(speaker.name);
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-destructive"
                          onClick={() => deleteSpeaker(speaker.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}

        {recording.isRecording && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AudioLevelIndicator />
                <span className="text-sm text-muted-foreground">
                  {transcription.isListening ? 'Listening...' : 'Paused'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {currentMeeting?.speakers.length || 0} participants
                </span>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-lg p-4">
              <div className="space-y-3">
                {currentMeeting?.transcript.map((segment, index) => {
                  const speaker = currentMeeting.speakers.find(
                    (s) => s.id === segment.speakerId
                  );
                  return (
                    <motion.div
                      key={segment.id || index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3"
                    >
                      <div
                        className="w-1 rounded-full shrink-0"
                        style={{ backgroundColor: speaker?.color || '#888' }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-sm font-medium"
                            style={{ color: speaker?.color }}
                          >
                            {speaker?.name || 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(segment.startTimeMs)}
                          </span>
                        </div>
                        <p className="text-sm">{segment.text}</p>
                      </div>
                    </motion.div>
                  );
                })}
                {transcription.interimText && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    className="flex gap-3"
                  >
                    <div className="w-1 rounded-full bg-muted shrink-0" />
                    <p className="text-sm italic text-muted-foreground">
                      {transcription.interimText}
                    </p>
                  </motion.div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-center gap-4">
          {!recording.isRecording ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="lg"
                  className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600"
                  onClick={handleStartRecording}
                  disabled={!transcription.isSupported}
                >
                  <Mic className="w-6 h-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Start Recording</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full w-12 h-12"
                    onClick={handleTogglePause}
                  >
                    {recording.isPaused ? (
                      <Play className="w-5 h-5" />
                    ) : (
                      <Pause className="w-5 h-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {recording.isPaused ? 'Resume' : 'Pause'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="lg"
                    variant="destructive"
                    className="rounded-full w-16 h-16"
                    onClick={handleStopRecording}
                  >
                    <Square className="w-6 h-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Stop Recording</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
        {transcription.error && (
          <p className="text-sm text-destructive text-center mt-2">
            {transcription.error}
          </p>
        )}
        {!transcription.isSupported && config.engine === 'webspeech' && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            Speech recognition not supported. Try using Whisper engine.
          </p>
        )}
      </div>
    </motion.div>
  );
}
