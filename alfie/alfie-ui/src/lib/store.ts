import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  default: string;
}

export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  isBuiltIn: boolean;
  variables: TemplateVariable[];
  systemPrompt: string;
  initialMessage: string;
  tags: string[];
  usageCount: number;
  rating: number;
  createdAt: string;
  updatedAt?: string;
  author: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  count: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  thinking?: string;
  toolCalls?: ToolCall[];
  phase?: 'think' | 'act' | 'observe';
}

export interface ToolCitation {
  url: string;
  title?: string;
  snippet?: string;
}

export interface ToolResult {
  content?: string;
  citations?: ToolCitation[];
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  input?: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string | ToolResult;
  startTime?: Date;
  endTime?: Date;
}

export interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description?: string;
  maxTokens?: number;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
}

export interface SystemStats {
  cpu: number;
  memory: number;
  gpu?: {
    name: string;
    utilization: number;
    memory: number;
    temperature: number;
  };
  tokensPerSecond?: number;
  activeModel?: string;
}

// Chat Store
interface ChatState {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  currentPhase: 'idle' | 'think' | 'act' | 'observe';
  currentToolCall: ToolCall | null;
  
  // Actions
  createSession: (name?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setPhase: (phase: 'idle' | 'think' | 'act' | 'observe') => void;
  setCurrentToolCall: (toolCall: ToolCall | null) => void;
  clearSession: (id: string) => void;
  loadConversations: () => Promise<void>;
  loadConversationMessages: (sessionId: string) => Promise<void>;
  renameSession: (id: string, name: string) => void;
  mapSessionToThread: (sessionId: string, threadId: string) => void;
  getThreadId: (sessionId: string) => string | null;
  selectedModel: string | null;
  setSelectedModel: (model: string) => void;
  availableModels: ModelInfo[];
  loadModels: () => Promise<void>;
}

// Maps local session IDs to DB threadIds (and vice versa for DB-loaded sessions)
const _threadIdMap = new Map<string, string>();

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      isLoading: false,
      isStreaming: false,
      currentPhase: 'idle',
      currentToolCall: null,
      selectedModel: null,
      availableModels: [],

      createSession: (name) => {
        const id = crypto.randomUUID();
        const session: Session = {
          id,
          name: name || `Chat ${get().sessions.length + 1}`,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        };
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSessionId: id,
        }));
        return id;
      },

      deleteSession: (id) => {
        // Fire API call to delete from DB (fire-and-forget)
        const threadId = _threadIdMap.get(id) || id;
        import('./apiClient').then(({ apiFetch }) => {
          apiFetch(`/api/conversations/${threadId}`, { method: 'DELETE' }).catch(() => {});
        });
        _threadIdMap.delete(id);
        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== id);
          const newActiveId = state.activeSessionId === id
            ? newSessions[0]?.id || null
            : state.activeSessionId;
          return { sessions: newSessions, activeSessionId: newActiveId };
        });
      },

      setActiveSession: (id) => {
        set({ activeSessionId: id });
        // Auto-load messages if session has none (was loaded from DB sidebar)
        const session = get().sessions.find((s) => s.id === id);
        if (session && session.messages.length === 0) {
          get().loadConversationMessages(id);
        }
      },

      addMessage: (message) => {
        const id = crypto.randomUUID();
        const fullMessage: Message = {
          ...message,
          id,
          timestamp: new Date(),
        };
        set((state) => {
          const sessions = state.sessions.map((session) =>
            session.id === state.activeSessionId
              ? {
                  ...session,
                  messages: [...session.messages, fullMessage],
                  updatedAt: new Date(),
                }
              : session
          );
          return { sessions };
        });
      },

      updateMessage: (messageId, updates) => {
        set((state) => {
          const sessions = state.sessions.map((session) =>
            session.id === state.activeSessionId
              ? {
                  ...session,
                  messages: session.messages.map((msg) =>
                    msg.id === messageId ? { ...msg, ...updates } : msg
                  ),
                  updatedAt: new Date(),
                }
              : session
          );
          return { sessions };
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setStreaming: (streaming) => set({ isStreaming: streaming }),
      setPhase: (phase) => set({ currentPhase: phase }),
      setCurrentToolCall: (toolCall) => set({ currentToolCall: toolCall }),

      clearSession: (id) => {
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id
              ? { ...session, messages: [], updatedAt: new Date() }
              : session
          ),
        }));
      },

      setSelectedModel: (model) => set({ selectedModel: model }),

      loadModels: async () => {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const token = typeof window !== 'undefined' ? localStorage.getItem('alfie_access_token') : null;
        if (!token) return;
        try {
          const res = await fetch(`${API_BASE}/api/models`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data = await res.json();
          const models: ModelInfo[] = (data.models || []).map((m: Record<string, unknown>) => ({
            id: m.id as string,
            name: m.name as string,
            provider: m.provider as string,
            description: (m.description as string) || '',
            maxTokens: (m.maxTokens as number) || 4096,
          }));
          set({ availableModels: models });
        } catch (e) {
          console.error('Failed to load models:', e);
        }
      },

      loadConversations: async () => {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const token = typeof window !== 'undefined' ? localStorage.getItem('alfie_access_token') : null;
        if (!token) return;
        try {
          const res = await fetch(`${API_BASE}/api/conversations?limit=100`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data = await res.json();
          const conversations: Array<{ id: string; threadId: string; title: string; createdAt: string; updatedAt: string }> = Array.isArray(data) ? data : data.conversations || [];
          if (conversations.length === 0) return;

          const threadIds = new Set(conversations.map((c) => c.threadId || c.id));
          const dbRowIds = new Set(conversations.map((c) => String(c.id)));

          set((state) => {
            const cleaned = state.sessions.filter((s) => {
              if (dbRowIds.has(String(s.id)) && !threadIds.has(String(s.id))) return false;
              return true;
            });
            const existingIds = new Set(cleaned.map((s) => s.id));
            const newSessions: Session[] = conversations
              .filter((c) => !existingIds.has(c.threadId || c.id))
              .map((c) => {
                const sessionId = c.threadId || c.id;
                _threadIdMap.set(sessionId, c.threadId || c.id);
                return {
                  id: sessionId,
                  name: c.title || 'Conversation',
                  messages: [],
                  createdAt: new Date(c.createdAt),
                  updatedAt: new Date(c.updatedAt || c.createdAt),
                  isActive: true,
                };
              });
            return { sessions: [...cleaned, ...newSessions] };
          });
        } catch (e) {
          console.error('Failed to load conversations:', e);
        }
      },

      loadConversationMessages: async (sessionId: string) => {
        const { apiFetch } = await import('./apiClient');
        const threadId = _threadIdMap.get(sessionId) || sessionId;
        try {
          const res = await apiFetch(`/api/conversations/${threadId}/messages?limit=200`);
          if (!res.ok) return;
          const data = await res.json();
          const msgs: Array<{ id: string; role: string; content: string; createdAt: string }> = data.messages || [];
          if (msgs.length === 0) return;
          set((state) => ({
            sessions: state.sessions.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    messages: msgs.map((m) => ({
                      id: m.id || crypto.randomUUID(),
                      role: m.role as 'user' | 'assistant' | 'system',
                      content: m.content,
                      timestamp: new Date(m.createdAt),
                    })),
                  }
                : session
            ),
          }));
        } catch (e) {
          console.error('Failed to load messages:', e);
        }
      },

      renameSession: (id, name) => {
        const threadId = _threadIdMap.get(id) || id;
        import('./apiClient').then(({ apiFetch }) => {
          apiFetch(`/api/conversations/${threadId}`, {
            method: 'PUT',
            body: JSON.stringify({ title: name }),
          }).catch(() => {});
        });
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id ? { ...session, name } : session
          ),
        }));
      },

      mapSessionToThread: (sessionId, threadId) => {
        _threadIdMap.set(sessionId, threadId);
      },

      getThreadId: (sessionId) => {
        return _threadIdMap.get(sessionId) || null;
      },
    }),
    {
      name: 'alfie-chat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);

type RightPanelTabType = 'tools' | 'files' | 'stats' | 'voice' | 'templates' | 'history' | 'media' | 'email' | 'notebook';
type MainViewType = 'chat' | 'playground' | 'analytics';

interface UIState {
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTabType;
  mainView: MainViewType;
  theme: 'light' | 'dark' | 'system';
  mobileMenuOpen: boolean;
  mobilePanelOpen: boolean;
  shortcutsHelpOpen: boolean;
  settingsOpen: boolean;
  searchOpen: boolean;
  
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelTab: (tab: RightPanelTabType) => void;
  setMainView: (view: MainViewType) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setMobileMenuOpen: (open: boolean) => void;
  setMobilePanelOpen: (open: boolean) => void;
  setShortcutsHelpOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  closeAllModals: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      rightPanelOpen: true,
      rightPanelTab: 'tools',
      mainView: 'chat',
      theme: 'dark',
      mobileMenuOpen: false,
      mobilePanelOpen: false,
      shortcutsHelpOpen: false,
      settingsOpen: false,
      searchOpen: false,

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
      setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
      setMainView: (view) => set({ mainView: view }),
      setTheme: (theme) => set({ theme }),
      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
      setMobilePanelOpen: (open) => set({ mobilePanelOpen: open }),
      setShortcutsHelpOpen: (open) => set({ shortcutsHelpOpen: open }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setSearchOpen: (open) => set({ searchOpen: open }),
      closeAllModals: () => set({ 
        shortcutsHelpOpen: false, 
        settingsOpen: false, 
        searchOpen: false,
        mobileMenuOpen: false,
        mobilePanelOpen: false,
      }),
    }),
    {
      name: 'alfie-ui-storage',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        rightPanelOpen: state.rightPanelOpen,
        rightPanelTab: state.rightPanelTab,
        mainView: state.mainView,
        theme: state.theme,
      }),
    }
  )
);

// System Stats Store
interface SystemState {
  stats: SystemStats;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  
  // Actions
  updateStats: (stats: Partial<SystemStats>) => void;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'connecting') => void;
}

export const useSystemStore = create<SystemState>()((set) => ({
  stats: {
    cpu: 0,
    memory: 0,
  },
  connectionStatus: 'disconnected',

  updateStats: (stats) => set((state) => ({
    stats: { ...state.stats, ...stats },
  })),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
}));

// File Browser Store
interface FileState {
  files: FileNode[];
  selectedFile: string | null;
  expandedPaths: Set<string>;
  
  // Actions
  setFiles: (files: FileNode[]) => void;
  selectFile: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
}

export const useFileStore = create<FileState>()((set) => ({
  files: [],
  selectedFile: null,
  expandedPaths: new Set(),

  setFiles: (files) => set({ files }),
  selectFile: (path) => set({ selectedFile: path }),
  toggleExpanded: (path) => set((state) => {
    const newExpanded = new Set(state.expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    return { expandedPaths: newExpanded };
  }),
}));

// ElevenLabs Voice Options
export interface VoiceOption {
  id: string;
  name: string;
  description: string;
}

export const ELEVENLABS_VOICES: VoiceOption[] = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Soft, warm female voice' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Professional female voice' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Conversational male voice' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Deep, authoritative male' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'Young, energetic male' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', description: 'Clear, professional female' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'Confident British female' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Warm British female' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Deep British male - JARVIS-like' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', description: 'Transatlantic male' },
];

// Voice Store
interface VoiceState {
  // Settings
  selectedVoiceId: string;
  speed: number; // 0.5 to 2.0
  autoPlay: boolean;
  voiceEnabled: boolean;
  
  // State
  isListening: boolean;
  isPlaying: boolean;
  currentAudioUrl: string | null;
  transcript: string;
  
  // Actions
  setSelectedVoice: (voiceId: string) => void;
  setSpeed: (speed: number) => void;
  setAutoPlay: (autoPlay: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setIsListening: (isListening: boolean) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentAudioUrl: (url: string | null) => void;
  setTranscript: (transcript: string) => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      selectedVoiceId: 'onwK4e9ZLuTAKqWW03F9',
      speed: 1.0,
      autoPlay: true,
      voiceEnabled: true,
      
      isListening: false,
      isPlaying: false,
      currentAudioUrl: null,
      transcript: '',
      
      setSelectedVoice: (voiceId) => set({ selectedVoiceId: voiceId }),
      setSpeed: (speed) => set({ speed: Math.max(0.5, Math.min(2.0, speed)) }),
      setAutoPlay: (autoPlay) => set({ autoPlay }),
      setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
      setIsListening: (isListening) => set({ isListening }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setCurrentAudioUrl: (url) => set({ currentAudioUrl: url }),
      setTranscript: (transcript) => set({ transcript }),
    }),
    {
      name: 'alfie-voice-storage',
      partialize: (state) => ({
        selectedVoiceId: state.selectedVoiceId,
        speed: state.speed,
        autoPlay: state.autoPlay,
        voiceEnabled: state.voiceEnabled,
      }),
    }
  )
);

interface TemplateState {
  templates: SessionTemplate[];
  categories: TemplateCategory[];
  selectedTemplate: SessionTemplate | null;
  selectedCategory: string | null;
  searchQuery: string;
  isLoading: boolean;
  isMarketplaceOpen: boolean;
  isEditorOpen: boolean;
  editingTemplate: SessionTemplate | null;
  variableValues: Record<string, string>;
  
  setTemplates: (templates: SessionTemplate[]) => void;
  setCategories: (categories: TemplateCategory[]) => void;
  setSelectedTemplate: (template: SessionTemplate | null) => void;
  setSelectedCategory: (category: string | null) => void;
  setSearchQuery: (query: string) => void;
  setIsLoading: (loading: boolean) => void;
  setIsMarketplaceOpen: (open: boolean) => void;
  setIsEditorOpen: (open: boolean) => void;
  setEditingTemplate: (template: SessionTemplate | null) => void;
  setVariableValue: (name: string, value: string) => void;
  resetVariableValues: () => void;
  clearSelection: () => void;
}

export const useTemplateStore = create<TemplateState>()((set) => ({
  templates: [],
  categories: [],
  selectedTemplate: null,
  selectedCategory: null,
  searchQuery: '',
  isLoading: false,
  isMarketplaceOpen: false,
  isEditorOpen: false,
  editingTemplate: null,
  variableValues: {},
  
  setTemplates: (templates) => set({ templates }),
  setCategories: (categories) => set({ categories }),
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsMarketplaceOpen: (open) => set({ isMarketplaceOpen: open }),
  setIsEditorOpen: (open) => set({ isEditorOpen: open }),
  setEditingTemplate: (template) => set({ editingTemplate: template }),
  setVariableValue: (name, value) => set((state) => ({
    variableValues: { ...state.variableValues, [name]: value }
  })),
  resetVariableValues: () => set({ variableValues: {} }),
  clearSelection: () => set({ 
    selectedTemplate: null, 
    variableValues: {},
    isEditorOpen: false,
    editingTemplate: null
  }),
}));
