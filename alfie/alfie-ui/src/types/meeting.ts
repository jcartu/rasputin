export interface Speaker {
  id: string;
  name: string;
  color: string;
  voiceSignature?: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  text: string;
  startTimeMs: number;
  endTime: number;
  confidence: number;
  isEdited: boolean;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  segmentId?: string;
}

export interface KeyPoint {
  id: string;
  text: string;
  category: 'decision' | 'insight' | 'question' | 'followup' | 'other';
  timestamp: number;
  segmentId?: string;
}

export interface MeetingSummary {
  overview: string;
  keyPoints: KeyPoint[];
  actionItems: ActionItem[];
  decisions: string[];
  nextSteps: string[];
  participants: string[];
  duration: number;
  generatedAt: string;
}

export interface MeetingIntegration {
  type: 'zoom' | 'google_meet' | 'teams' | 'webex' | 'manual';
  meetingId?: string;
  joinUrl?: string;
  hostEmail?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  durationMs: number;
  status: 'scheduled' | 'recording' | 'processing' | 'completed' | 'failed';
  speakers: Speaker[];
  transcript: TranscriptSegment[];
  summary?: MeetingSummary;
  integration?: MeetingIntegration;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  audioUrl?: string;
  videoUrl?: string;
}

export interface MeetingFilter {
  search?: string;
  status?: Meeting['status'][];
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  speakers?: string[];
  hasSummary?: boolean;
  isFavorite?: boolean;
}

export interface TranscriptionConfig {
  engine: 'webspeech' | 'whisper' | 'hybrid';
  language: string;
  enableDiarization: boolean;
  enablePunctuation: boolean;
  enableTimestamps: boolean;
  maxSpeakers: number;
  whisperModel?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  currentSegment?: TranscriptSegment;
  audioLevel: number;
  speakerCount: number;
}

export type TranscriptionEngineStatus = 'idle' | 'initializing' | 'ready' | 'listening' | 'processing' | 'error';

export interface TranscriptionEngine {
  status: TranscriptionEngineStatus;
  errorMessage?: string;
  isSupported: boolean;
}

export interface MeetingStats {
  totalMeetings: number;
  totalDuration: number;
  averageDuration: number;
  meetingsThisWeek: number;
  meetingsThisMonth: number;
  topSpeakers: { name: string; count: number }[];
  topTags: { tag: string; count: number }[];
}
