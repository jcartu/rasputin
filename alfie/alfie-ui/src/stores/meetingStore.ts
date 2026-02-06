import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Meeting,
  Speaker,
  TranscriptSegment,
  ActionItem,
  KeyPoint,
  MeetingSummary,
  MeetingFilter,
  TranscriptionConfig,
  RecordingState,
  TranscriptionEngine,
  MeetingStats,
} from '@/types/meeting';

const SPEAKER_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

interface MeetingState {
  // Meetings data
  meetings: Meeting[];
  currentMeeting: Meeting | null;
  
  // Recording state
  recording: RecordingState;
  
  // Transcription engines
  webSpeechEngine: TranscriptionEngine;
  whisperEngine: TranscriptionEngine;
  
  // Config
  config: TranscriptionConfig;
  
  // UI state
  filter: MeetingFilter;
  selectedMeetingId: string | null;
  isLibraryOpen: boolean;
  isRecorderOpen: boolean;
  isProcessing: boolean;
  
  // Stats
  stats: MeetingStats;
  
  // Meeting CRUD
  createMeeting: (title: string, description?: string) => Meeting;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  getMeeting: (id: string) => Meeting | undefined;
  
  // Recording actions
  startRecording: (meetingId: string) => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<void>;
  
  // Transcript actions
  addTranscriptSegment: (segment: Omit<TranscriptSegment, 'id'>) => void;
  updateTranscriptSegment: (segmentId: string, updates: Partial<TranscriptSegment>) => void;
  deleteTranscriptSegment: (segmentId: string) => void;
  
  // Speaker actions
  addSpeaker: (name: string) => Speaker;
  updateSpeaker: (speakerId: string, updates: Partial<Speaker>) => void;
  deleteSpeaker: (speakerId: string) => void;
  assignSpeakerToSegment: (segmentId: string, speakerId: string) => void;
  
  // Summary actions
  generateSummary: (meetingId: string) => Promise<void>;
  updateSummary: (meetingId: string, summary: Partial<MeetingSummary>) => void;
  
  // Action items
  addActionItem: (meetingId: string, item: Omit<ActionItem, 'id' | 'createdAt'>) => void;
  updateActionItem: (meetingId: string, itemId: string, updates: Partial<ActionItem>) => void;
  deleteActionItem: (meetingId: string, itemId: string) => void;
  
  // Key points
  addKeyPoint: (meetingId: string, point: Omit<KeyPoint, 'id'>) => void;
  deleteKeyPoint: (meetingId: string, pointId: string) => void;
  
  // Config
  setConfig: (config: Partial<TranscriptionConfig>) => void;
  
  // Filter
  setFilter: (filter: Partial<MeetingFilter>) => void;
  clearFilter: () => void;
  getFilteredMeetings: () => Meeting[];
  
  // UI state
  setSelectedMeeting: (id: string | null) => void;
  setLibraryOpen: (open: boolean) => void;
  setRecorderOpen: (open: boolean) => void;
  setProcessing: (processing: boolean) => void;
  
  // Engine state
  setWebSpeechEngine: (engine: Partial<TranscriptionEngine>) => void;
  setWhisperEngine: (engine: Partial<TranscriptionEngine>) => void;
  
  // Recording state updates
  setRecordingState: (state: Partial<RecordingState>) => void;
  
  // Stats
  refreshStats: () => void;
  
  // Tags
  toggleFavorite: (meetingId: string) => void;
  addTag: (meetingId: string, tag: string) => void;
  removeTag: (meetingId: string, tag: string) => void;
  
  // Export
  exportMeeting: (meetingId: string, format: 'json' | 'txt' | 'pdf' | 'docx') => Promise<Blob>;
}

export const useMeetingStore = create<MeetingState>()(
  persist(
    (set, get) => ({
      // Initial state
      meetings: [],
      currentMeeting: null,
      
      recording: {
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioLevel: 0,
        speakerCount: 0,
      },
      
      webSpeechEngine: {
        status: 'idle',
        isSupported: typeof window !== 'undefined' && 
          !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      },
      
      whisperEngine: {
        status: 'idle',
        isSupported: true, // API-based, always supported
      },
      
      config: {
        engine: 'webspeech',
        language: 'en-US',
        enableDiarization: true,
        enablePunctuation: true,
        enableTimestamps: true,
        maxSpeakers: 6,
        whisperModel: 'base',
      },
      
      filter: {},
      selectedMeetingId: null,
      isLibraryOpen: false,
      isRecorderOpen: false,
      isProcessing: false,
      
      stats: {
        totalMeetings: 0,
        totalDuration: 0,
        averageDuration: 0,
        meetingsThisWeek: 0,
        meetingsThisMonth: 0,
        topSpeakers: [],
        topTags: [],
      },
      
      // Meeting CRUD
      createMeeting: (title, description) => {
        const meeting: Meeting = {
          id: crypto.randomUUID(),
          title,
          description,
          startTime: new Date().toISOString(),
          durationMs: 0,
          status: 'scheduled',
          speakers: [],
          transcript: [],
          tags: [],
          isFavorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        set((state) => ({
          meetings: [meeting, ...state.meetings],
          currentMeeting: meeting,
          selectedMeetingId: meeting.id,
        }));
        
        return meeting;
      },
      
      updateMeeting: (id, updates) => {
        set((state) => ({
          meetings: state.meetings.map((m) =>
            m.id === id ? { ...m, ...updates, updatedAt: new Date().toISOString() } : m
          ),
          currentMeeting: state.currentMeeting?.id === id
            ? { ...state.currentMeeting, ...updates, updatedAt: new Date().toISOString() }
            : state.currentMeeting,
        }));
      },
      
      deleteMeeting: (id) => {
        set((state) => ({
          meetings: state.meetings.filter((m) => m.id !== id),
          currentMeeting: state.currentMeeting?.id === id ? null : state.currentMeeting,
          selectedMeetingId: state.selectedMeetingId === id ? null : state.selectedMeetingId,
        }));
      },
      
      getMeeting: (id) => {
        return get().meetings.find((m) => m.id === id);
      },
      
      // Recording actions
      startRecording: (meetingId) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting) return;
        
        set({
          currentMeeting: { ...meeting, status: 'recording', startTime: new Date().toISOString() },
          recording: {
            isRecording: true,
            isPaused: false,
            duration: 0,
            audioLevel: 0,
            speakerCount: 0,
          },
        });
        
        get().updateMeeting(meetingId, { status: 'recording', startTime: new Date().toISOString() });
      },
      
      pauseRecording: () => {
        set((state) => ({
          recording: { ...state.recording, isPaused: true },
        }));
      },
      
      resumeRecording: () => {
        set((state) => ({
          recording: { ...state.recording, isPaused: false },
        }));
      },
      
      stopRecording: async () => {
        const { currentMeeting, recording } = get();
        if (!currentMeeting) return;
        
        set({
          recording: { ...recording, isRecording: false, isPaused: false },
        });
        
        get().updateMeeting(currentMeeting.id, {
          status: 'processing',
          endTime: new Date().toISOString(),
          durationMs: recording.duration,
        });
        
        // Trigger summary generation
        set({ isProcessing: true });
        try {
          await get().generateSummary(currentMeeting.id);
          get().updateMeeting(currentMeeting.id, { status: 'completed' });
        } catch (error) {
          console.error('Failed to generate summary:', error);
          get().updateMeeting(currentMeeting.id, { status: 'completed' });
        } finally {
          set({ isProcessing: false });
        }
      },
      
      // Transcript actions
      addTranscriptSegment: (segment) => {
        const { currentMeeting } = get();
        if (!currentMeeting) return;
        
        const newSegment: TranscriptSegment = {
          ...segment,
          id: crypto.randomUUID(),
        };
        
        set((state) => ({
          currentMeeting: state.currentMeeting
            ? {
                ...state.currentMeeting,
                transcript: [...state.currentMeeting.transcript, newSegment],
              }
            : null,
        }));
        
        get().updateMeeting(currentMeeting.id, {
          transcript: [...currentMeeting.transcript, newSegment],
        });
      },
      
      updateTranscriptSegment: (segmentId, updates) => {
        const { currentMeeting } = get();
        if (!currentMeeting) return;
        
        const updatedTranscript = currentMeeting.transcript.map((s) =>
          s.id === segmentId ? { ...s, ...updates, isEdited: true } : s
        );
        
        set((state) => ({
          currentMeeting: state.currentMeeting
            ? { ...state.currentMeeting, transcript: updatedTranscript }
            : null,
        }));
        
        get().updateMeeting(currentMeeting.id, { transcript: updatedTranscript });
      },
      
      deleteTranscriptSegment: (segmentId) => {
        const { currentMeeting } = get();
        if (!currentMeeting) return;
        
        const updatedTranscript = currentMeeting.transcript.filter((s) => s.id !== segmentId);
        
        set((state) => ({
          currentMeeting: state.currentMeeting
            ? { ...state.currentMeeting, transcript: updatedTranscript }
            : null,
        }));
        
        get().updateMeeting(currentMeeting.id, { transcript: updatedTranscript });
      },
      
      // Speaker actions
      addSpeaker: (name) => {
        const { currentMeeting } = get();
        if (!currentMeeting) {
          throw new Error('No current meeting');
        }
        
        const colorIndex = currentMeeting.speakers.length % SPEAKER_COLORS.length;
        const speaker: Speaker = {
          id: crypto.randomUUID(),
          name,
          color: SPEAKER_COLORS[colorIndex],
        };
        
        const updatedSpeakers = [...currentMeeting.speakers, speaker];
        
        set((state) => ({
          currentMeeting: state.currentMeeting
            ? { ...state.currentMeeting, speakers: updatedSpeakers }
            : null,
        }));
        
        get().updateMeeting(currentMeeting.id, { speakers: updatedSpeakers });
        
        return speaker;
      },
      
      updateSpeaker: (speakerId, updates) => {
        const { currentMeeting } = get();
        if (!currentMeeting) return;
        
        const updatedSpeakers = currentMeeting.speakers.map((s) =>
          s.id === speakerId ? { ...s, ...updates } : s
        );
        
        set((state) => ({
          currentMeeting: state.currentMeeting
            ? { ...state.currentMeeting, speakers: updatedSpeakers }
            : null,
        }));
        
        get().updateMeeting(currentMeeting.id, { speakers: updatedSpeakers });
      },
      
      deleteSpeaker: (speakerId) => {
        const { currentMeeting } = get();
        if (!currentMeeting) return;
        
        const updatedSpeakers = currentMeeting.speakers.filter((s) => s.id !== speakerId);
        
        set((state) => ({
          currentMeeting: state.currentMeeting
            ? { ...state.currentMeeting, speakers: updatedSpeakers }
            : null,
        }));
        
        get().updateMeeting(currentMeeting.id, { speakers: updatedSpeakers });
      },
      
      assignSpeakerToSegment: (segmentId, speakerId) => {
        get().updateTranscriptSegment(segmentId, { speakerId });
      },
      
      // Summary actions
      generateSummary: async (meetingId) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting || meeting.transcript.length === 0) return;
        
        set({ isProcessing: true });
        
        try {
          const response = await fetch('/api/meetings/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meetingId,
              transcript: meeting.transcript,
              speakers: meeting.speakers,
            }),
          });
          
          if (!response.ok) throw new Error('Failed to generate summary');
          
          const summary: MeetingSummary = await response.json();
          get().updateMeeting(meetingId, { summary });
        } catch (error) {
          console.error('Summary generation failed:', error);
          // Generate a basic local summary as fallback
          const basicSummary: MeetingSummary = {
            overview: `Meeting "${meeting.title}" with ${meeting.speakers.length} participants.`,
            keyPoints: [],
            actionItems: [],
            decisions: [],
            nextSteps: [],
            participants: meeting.speakers.map((s) => s.name),
            duration: meeting.durationMs,
            generatedAt: new Date().toISOString(),
          };
          get().updateMeeting(meetingId, { summary: basicSummary });
        } finally {
          set({ isProcessing: false });
        }
      },
      
      updateSummary: (meetingId, summaryUpdates) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting || !meeting.summary) return;
        
        get().updateMeeting(meetingId, {
          summary: { ...meeting.summary, ...summaryUpdates },
        });
      },
      
      // Action items
      addActionItem: (meetingId, item) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting || !meeting.summary) return;
        
        const actionItem: ActionItem = {
          ...item,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        
        get().updateSummary(meetingId, {
          actionItems: [...meeting.summary.actionItems, actionItem],
        });
      },
      
      updateActionItem: (meetingId, itemId, updates) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting || !meeting.summary) return;
        
        const updatedItems = meeting.summary.actionItems.map((item) =>
          item.id === itemId ? { ...item, ...updates } : item
        );
        
        get().updateSummary(meetingId, { actionItems: updatedItems });
      },
      
      deleteActionItem: (meetingId, itemId) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting || !meeting.summary) return;
        
        const updatedItems = meeting.summary.actionItems.filter((item) => item.id !== itemId);
        get().updateSummary(meetingId, { actionItems: updatedItems });
      },
      
      // Key points
      addKeyPoint: (meetingId, point) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting || !meeting.summary) return;
        
        const keyPoint: KeyPoint = {
          ...point,
          id: crypto.randomUUID(),
        };
        
        get().updateSummary(meetingId, {
          keyPoints: [...meeting.summary.keyPoints, keyPoint],
        });
      },
      
      deleteKeyPoint: (meetingId, pointId) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting || !meeting.summary) return;
        
        const updatedPoints = meeting.summary.keyPoints.filter((p) => p.id !== pointId);
        get().updateSummary(meetingId, { keyPoints: updatedPoints });
      },
      
      // Config
      setConfig: (configUpdates) => {
        set((state) => ({
          config: { ...state.config, ...configUpdates },
        }));
      },
      
      // Filter
      setFilter: (filterUpdates) => {
        set((state) => ({
          filter: { ...state.filter, ...filterUpdates },
        }));
      },
      
      clearFilter: () => {
        set({ filter: {} });
      },
      
      getFilteredMeetings: () => {
        const { meetings, filter } = get();
        
        return meetings.filter((meeting) => {
          if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            const matchesSearch =
              meeting.title.toLowerCase().includes(searchLower) ||
              meeting.description?.toLowerCase().includes(searchLower) ||
              meeting.transcript.some((s) => s.text.toLowerCase().includes(searchLower));
            if (!matchesSearch) return false;
          }
          
          if (filter.status?.length && !filter.status.includes(meeting.status)) {
            return false;
          }
          
          if (filter.dateFrom && new Date(meeting.startTime) < new Date(filter.dateFrom)) {
            return false;
          }
          
          if (filter.dateTo && new Date(meeting.startTime) > new Date(filter.dateTo)) {
            return false;
          }
          
          if (filter.tags?.length && !filter.tags.some((tag) => meeting.tags.includes(tag))) {
            return false;
          }
          
          if (filter.hasSummary !== undefined && !meeting.summary === filter.hasSummary) {
            return false;
          }
          
          if (filter.isFavorite !== undefined && meeting.isFavorite !== filter.isFavorite) {
            return false;
          }
          
          return true;
        });
      },
      
      // UI state
      setSelectedMeeting: (id) => {
        const meeting = id ? get().getMeeting(id) : null;
        set({ selectedMeetingId: id, currentMeeting: meeting || null });
      },
      
      setLibraryOpen: (open) => set({ isLibraryOpen: open }),
      setRecorderOpen: (open) => set({ isRecorderOpen: open }),
      setProcessing: (processing) => set({ isProcessing: processing }),
      
      // Engine state
      setWebSpeechEngine: (engine) => {
        set((state) => ({
          webSpeechEngine: { ...state.webSpeechEngine, ...engine },
        }));
      },
      
      setWhisperEngine: (engine) => {
        set((state) => ({
          whisperEngine: { ...state.whisperEngine, ...engine },
        }));
      },
      
      // Recording state
      setRecordingState: (recordingState) => {
        set((state) => ({
          recording: { ...state.recording, ...recordingState },
        }));
      },
      
      // Stats
      refreshStats: () => {
        const { meetings } = get();
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const totalDuration = meetings.reduce((sum, m) => sum + m.durationMs, 0);
        const meetingsThisWeek = meetings.filter((m) => new Date(m.startTime) >= weekAgo).length;
        const meetingsThisMonth = meetings.filter((m) => new Date(m.startTime) >= monthAgo).length;
        
        // Calculate top speakers
        const speakerCounts: Record<string, number> = {};
        meetings.forEach((m) => {
          m.speakers.forEach((s) => {
            speakerCounts[s.name] = (speakerCounts[s.name] || 0) + 1;
          });
        });
        const topSpeakers = Object.entries(speakerCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        
        // Calculate top tags
        const tagCounts: Record<string, number> = {};
        meetings.forEach((m) => {
          m.tags.forEach((tag) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        });
        const topTags = Object.entries(tagCounts)
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        
        set({
          stats: {
            totalMeetings: meetings.length,
            totalDuration,
            averageDuration: meetings.length > 0 ? totalDuration / meetings.length : 0,
            meetingsThisWeek,
            meetingsThisMonth,
            topSpeakers,
            topTags,
          },
        });
      },
      
      // Tags & favorites
      toggleFavorite: (meetingId) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting) return;
        get().updateMeeting(meetingId, { isFavorite: !meeting.isFavorite });
      },
      
      addTag: (meetingId, tag) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting || meeting.tags.includes(tag)) return;
        get().updateMeeting(meetingId, { tags: [...meeting.tags, tag] });
      },
      
      removeTag: (meetingId, tag) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting) return;
        get().updateMeeting(meetingId, { tags: meeting.tags.filter((t) => t !== tag) });
      },
      
      // Export
      exportMeeting: async (meetingId, format) => {
        const meeting = get().getMeeting(meetingId);
        if (!meeting) throw new Error('Meeting not found');
        
        if (format === 'json') {
          return new Blob([JSON.stringify(meeting, null, 2)], { type: 'application/json' });
        }
        
        if (format === 'txt') {
          let content = `# ${meeting.title}\n`;
          content += `Date: ${new Date(meeting.startTime).toLocaleString()}\n`;
          content += `Duration: ${Math.round(meeting.durationMs / 60000)} minutes\n\n`;
          
          if (meeting.summary) {
            content += `## Summary\n${meeting.summary.overview}\n\n`;
            
            if (meeting.summary.keyPoints.length > 0) {
              content += `## Key Points\n`;
              meeting.summary.keyPoints.forEach((kp) => {
                content += `- ${kp.text}\n`;
              });
              content += '\n';
            }
            
            if (meeting.summary.actionItems.length > 0) {
              content += `## Action Items\n`;
              meeting.summary.actionItems.forEach((ai) => {
                content += `- [${ai.status === 'completed' ? 'x' : ' '}] ${ai.text}`;
                if (ai.assignee) content += ` (@${ai.assignee})`;
                content += '\n';
              });
              content += '\n';
            }
          }
          
          content += `## Transcript\n`;
          meeting.transcript.forEach((segment) => {
            const speaker = meeting.speakers.find((s) => s.id === segment.speakerId);
            const time = formatTimestamp(segment.startTimeMs);
            content += `[${time}] ${speaker?.name || 'Unknown'}: ${segment.text}\n`;
          });
          
          return new Blob([content], { type: 'text/plain' });
        }
        
        // For PDF/DOCX, delegate to backend
        const response = await fetch('/api/meetings/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meetingId, format }),
        });
        
        if (!response.ok) throw new Error('Export failed');
        return response.blob();
      },
    }),
    {
      name: 'alfie-meeting-storage',
      partialize: (state) => ({
        meetings: state.meetings,
        config: state.config,
      }),
    }
  )
);

function formatTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}
