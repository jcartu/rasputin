import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MediaType = 'screenshot' | 'recording';
export type RecordingSource = 'screen' | 'window' | 'tab';
export type AnnotationTool = 'select' | 'pen' | 'highlighter' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'blur';

export interface Annotation {
  id: string;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  text?: string;
  fontSize?: number;
}

export interface MediaItem {
  id: string;
  type: MediaType;
  name: string;
  thumbnail: string;
  url: string;
  blob?: Blob;
  duration?: number; // For recordings, in seconds
  width: number;
  height: number;
  createdAt: Date;
  annotations?: Annotation[];
  tags?: string[];
  hasAudio?: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  source: RecordingSource | null;
  hasAudio: boolean;
  countdown: number | null;
  stream: MediaStream | null;
  mediaRecorder: MediaRecorder | null;
}

interface MediaState {
  // Gallery
  items: MediaItem[];
  selectedItemId: string | null;
  
  // Recording state
  recording: RecordingState;
  
  // Screenshot state
  isCapturing: boolean;
  capturedImage: string | null;
  isAnnotating: boolean;
  currentAnnotations: Annotation[];
  selectedAnnotationId: string | null;
  
  // Annotation tools
  activeTool: AnnotationTool;
  activeColor: string;
  activeStrokeWidth: number;
  activeFontSize: number;
  
  // UI state
  isGalleryOpen: boolean;
  isRecordingPanelOpen: boolean;
  showFloatingControls: boolean;
  
  // Actions - Gallery
  addItem: (item: Omit<MediaItem, 'id' | 'createdAt'>) => string;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<MediaItem>) => void;
  selectItem: (id: string | null) => void;
  clearGallery: () => void;
  
  // Actions - Recording
  setRecordingState: (state: Partial<RecordingState>) => void;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  setCountdown: (countdown: number | null) => void;
  incrementDuration: () => void;
  
  // Actions - Screenshot
  setIsCapturing: (isCapturing: boolean) => void;
  setCapturedImage: (image: string | null) => void;
  setIsAnnotating: (isAnnotating: boolean) => void;
  
  // Actions - Annotations
  addAnnotation: (annotation: Omit<Annotation, 'id'>) => string;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  clearAnnotations: () => void;
  
  // Actions - Tools
  setActiveTool: (tool: AnnotationTool) => void;
  setActiveColor: (color: string) => void;
  setActiveStrokeWidth: (width: number) => void;
  setActiveFontSize: (size: number) => void;
  
  // Actions - UI
  setGalleryOpen: (open: boolean) => void;
  setRecordingPanelOpen: (open: boolean) => void;
  setShowFloatingControls: (show: boolean) => void;
}

export const useMediaStore = create<MediaState>()(
  persist(
    (set, get) => ({
      // Initial state - Gallery
      items: [],
      selectedItemId: null,
      
      // Initial state - Recording
      recording: {
        isRecording: false,
        isPaused: false,
        duration: 0,
        source: null,
        hasAudio: true,
        countdown: null,
        stream: null,
        mediaRecorder: null,
      },
      
      // Initial state - Screenshot
      isCapturing: false,
      capturedImage: null,
      isAnnotating: false,
      currentAnnotations: [],
      selectedAnnotationId: null,
      
      // Initial state - Tools
      activeTool: 'pen',
      activeColor: '#ef4444',
      activeStrokeWidth: 3,
      activeFontSize: 16,
      
      // Initial state - UI
      isGalleryOpen: false,
      isRecordingPanelOpen: false,
      showFloatingControls: false,
      
      // Gallery actions
      addItem: (item) => {
        const id = crypto.randomUUID();
        const newItem: MediaItem = {
          ...item,
          id,
          createdAt: new Date(),
        };
        set((state) => ({
          items: [newItem, ...state.items],
        }));
        return id;
      },
      
      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
          selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
        }));
      },
      
      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },
      
      selectItem: (id) => set({ selectedItemId: id }),
      
      clearGallery: () => set({ items: [], selectedItemId: null }),
      
      // Recording actions
      setRecordingState: (recordingState) => {
        set((state) => ({
          recording: { ...state.recording, ...recordingState },
        }));
      },
      
      startRecording: () => {
        set((state) => ({
          recording: {
            ...state.recording,
            isRecording: true,
            isPaused: false,
            duration: 0,
          },
          showFloatingControls: true,
        }));
      },
      
      stopRecording: () => {
        set((state) => ({
          recording: {
            ...state.recording,
            isRecording: false,
            isPaused: false,
            stream: null,
            mediaRecorder: null,
          },
          showFloatingControls: false,
        }));
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
      
      setCountdown: (countdown) => {
        set((state) => ({
          recording: { ...state.recording, countdown },
        }));
      },
      
      incrementDuration: () => {
        set((state) => ({
          recording: {
            ...state.recording,
            duration: state.recording.duration + 1,
          },
        }));
      },
      
      // Screenshot actions
      setIsCapturing: (isCapturing) => set({ isCapturing }),
      setCapturedImage: (image) => set({ capturedImage: image }),
      setIsAnnotating: (isAnnotating) => set({ isAnnotating }),
      
      // Annotation actions
      addAnnotation: (annotation) => {
        const id = crypto.randomUUID();
        set((state) => ({
          currentAnnotations: [...state.currentAnnotations, { ...annotation, id }],
        }));
        return id;
      },
      
      updateAnnotation: (id, updates) => {
        set((state) => ({
          currentAnnotations: state.currentAnnotations.map((ann) =>
            ann.id === id ? { ...ann, ...updates } : ann
          ),
        }));
      },
      
      removeAnnotation: (id) => {
        set((state) => ({
          currentAnnotations: state.currentAnnotations.filter((ann) => ann.id !== id),
          selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
        }));
      },
      
      selectAnnotation: (id) => set({ selectedAnnotationId: id }),
      
      clearAnnotations: () => set({ currentAnnotations: [], selectedAnnotationId: null }),
      
      // Tool actions
      setActiveTool: (tool) => set({ activeTool: tool }),
      setActiveColor: (color) => set({ activeColor: color }),
      setActiveStrokeWidth: (width) => set({ activeStrokeWidth: width }),
      setActiveFontSize: (size) => set({ activeFontSize: size }),
      
      // UI actions
      setGalleryOpen: (open) => set({ isGalleryOpen: open }),
      setRecordingPanelOpen: (open) => set({ isRecordingPanelOpen: open }),
      setShowFloatingControls: (show) => set({ showFloatingControls: show }),
    }),
    {
      name: 'alfie-media-storage',
      partialize: (state) => ({
        items: state.items.map((item) => ({
          ...item,
          blob: undefined, // Don't persist blobs
        })),
        activeColor: state.activeColor,
        activeStrokeWidth: state.activeStrokeWidth,
        activeFontSize: state.activeFontSize,
      }),
    }
  )
);

// Utility functions
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function generateThumbnail(video: HTMLVideoElement): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    } else {
      resolve('');
    }
  });
}

export async function downloadMedia(item: MediaItem): Promise<void> {
  const link = document.createElement('a');
  link.href = item.url;
  link.download = `${item.name}.${item.type === 'screenshot' ? 'png' : 'webm'}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function copyToClipboard(item: MediaItem): Promise<boolean> {
  try {
    if (item.type === 'screenshot') {
      const response = await fetch(item.url);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
