import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'ko' | 'pt' | 'ru' | 'ar';
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface GeneralPreferences {
  theme: ThemeMode;
  language: Language;
  timezone: string;
  dateFormat: '12h' | '24h';
  reducedMotion: boolean;
}

export interface ChatPreferences {
  model: string;
  temperature: number;
  maxTokens: number;
  streamResponses: boolean;
  showThinking: boolean;
  codeHighlighting: boolean;
  autoScroll: boolean;
}

export interface VoicePreferences {
  enabled: boolean;
  ttsVoice: TTSVoice;
  ttsSpeed: number;
  ttsVolume: number;
  sttEnabled: boolean;
  autoListen: boolean;
}

export interface NotificationPreferences {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  newMessage: boolean;
  taskComplete: boolean;
  errors: boolean;
}

export interface PrivacyPreferences {
  saveHistory: boolean;
  shareAnalytics: boolean;
  showOnlineStatus: boolean;
  clearOnExit: boolean;
}

export interface AdvancedPreferences {
  developerMode: boolean;
  showDebugInfo: boolean;
  experimentalFeatures: boolean;
  apiEndpoint: string;
  customSystemPrompt: string;
  maxContextLength: number;
  requestTimeout: number;
}

export interface UserPreferences {
  general: GeneralPreferences;
  chat: ChatPreferences;
  voice: VoicePreferences;
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
  advanced: AdvancedPreferences;
}

const defaultPreferences: UserPreferences = {
  general: {
    theme: 'dark',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dateFormat: '12h',
    reducedMotion: false,
  },
  chat: {
    model: 'claude-3-opus',
    temperature: 0.7,
    maxTokens: 4096,
    streamResponses: true,
    showThinking: true,
    codeHighlighting: true,
    autoScroll: true,
  },
  voice: {
    enabled: false,
    ttsVoice: 'nova',
    ttsSpeed: 1.0,
    ttsVolume: 0.8,
    sttEnabled: false,
    autoListen: false,
  },
  notifications: {
    enabled: true,
    sound: true,
    desktop: true,
    newMessage: true,
    taskComplete: true,
    errors: true,
  },
  privacy: {
    saveHistory: true,
    shareAnalytics: false,
    showOnlineStatus: true,
    clearOnExit: false,
  },
  advanced: {
    developerMode: false,
    showDebugInfo: false,
    experimentalFeatures: false,
    apiEndpoint: '',
    customSystemPrompt: '',
    maxContextLength: 128000,
    requestTimeout: 60,
  },
};

interface PreferencesState extends UserPreferences {
  updateGeneral: (updates: Partial<GeneralPreferences>) => void;
  updateChat: (updates: Partial<ChatPreferences>) => void;
  updateVoice: (updates: Partial<VoicePreferences>) => void;
  updateNotifications: (updates: Partial<NotificationPreferences>) => void;
  updatePrivacy: (updates: Partial<PrivacyPreferences>) => void;
  updateAdvanced: (updates: Partial<AdvancedPreferences>) => void;
  resetToDefaults: () => void;
  exportSettings: () => string;
  importSettings: (json: string) => boolean;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      ...defaultPreferences,

      updateGeneral: (updates) =>
        set((state) => ({
          general: { ...state.general, ...updates },
        })),

      updateChat: (updates) =>
        set((state) => ({
          chat: { ...state.chat, ...updates },
        })),

      updateVoice: (updates) =>
        set((state) => ({
          voice: { ...state.voice, ...updates },
        })),

      updateNotifications: (updates) =>
        set((state) => ({
          notifications: { ...state.notifications, ...updates },
        })),

      updatePrivacy: (updates) =>
        set((state) => ({
          privacy: { ...state.privacy, ...updates },
        })),

      updateAdvanced: (updates) =>
        set((state) => ({
          advanced: { ...state.advanced, ...updates },
        })),

      resetToDefaults: () =>
        set(defaultPreferences),

      exportSettings: () => {
        const state = get();
        const settings: UserPreferences = {
          general: state.general,
          chat: state.chat,
          voice: state.voice,
          notifications: state.notifications,
          privacy: state.privacy,
          advanced: state.advanced,
        };
        return JSON.stringify(settings, null, 2);
      },

      importSettings: (json: string) => {
        try {
          const settings = JSON.parse(json) as Partial<UserPreferences>;
          set((state) => ({
            general: { ...state.general, ...settings.general },
            chat: { ...state.chat, ...settings.chat },
            voice: { ...state.voice, ...settings.voice },
            notifications: { ...state.notifications, ...settings.notifications },
            privacy: { ...state.privacy, ...settings.privacy },
            advanced: { ...state.advanced, ...settings.advanced },
          }));
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'alfie-preferences',
    }
  )
);

export const availableModels = [
  { value: 'claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'llama-3-70b', label: 'Llama 3 70B' },
  { value: 'llama-3-8b', label: 'Llama 3 8B' },
  { value: 'mixtral-8x7b', label: 'Mixtral 8x7B' },
];

export const availableLanguages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'ko', label: '한국어' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'ar', label: 'العربية' },
];

export const availableVoices = [
  { value: 'alloy', label: 'Alloy (Neutral)' },
  { value: 'echo', label: 'Echo (Male)' },
  { value: 'fable', label: 'Fable (British)' },
  { value: 'onyx', label: 'Onyx (Deep)' },
  { value: 'nova', label: 'Nova (Female)' },
  { value: 'shimmer', label: 'Shimmer (Soft)' },
];

export const commonTimezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
];
