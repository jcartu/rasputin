import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType = 'info' | 'warning' | 'error' | 'success';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  dismissed: boolean;
  expiresAt?: string;
  actions?: NotificationAction[];
  data?: Record<string, unknown>;
}

export interface ToastNotification extends Notification {
  duration: number;
  showProgress: boolean;
}

export interface DoNotDisturbSchedule {
  start: number;
  end: number;
}

export interface NotificationPreferences {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  toastEnabled: boolean;
  toastDuration: number;
  soundVolume: number;
  doNotDisturb: boolean;
  doNotDisturbUntil: string | null;
  doNotDisturbSchedule: DoNotDisturbSchedule | null;
  mutedTypes: NotificationType[];
}

interface NotificationState {
  notifications: Notification[];
  toasts: ToastNotification[];
  preferences: NotificationPreferences;
  desktopPermission: NotificationPermission;
  centerOpen: boolean;
  preferencesOpen: boolean;

  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'dismissed'>) => string;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  
  showToast: (notification: Omit<Notification, 'id' | 'createdAt' | 'read' | 'dismissed'>, duration?: number) => string;
  removeToast: (id: string) => void;
  
  updatePreferences: (updates: Partial<NotificationPreferences>) => void;
  enableDoNotDisturb: (durationMinutes?: number) => void;
  disableDoNotDisturb: () => void;
  setDoNotDisturbSchedule: (start: number, end: number) => void;
  clearDoNotDisturbSchedule: () => void;
  
  requestDesktopPermission: () => Promise<NotificationPermission>;
  setDesktopPermission: (permission: NotificationPermission) => void;
  
  setCenterOpen: (open: boolean) => void;
  setPreferencesOpen: (open: boolean) => void;
  
  getUnreadCount: () => number;
  isDoNotDisturbActive: () => boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  desktopEnabled: true,
  toastEnabled: true,
  toastDuration: 5000,
  soundVolume: 0.5,
  doNotDisturb: false,
  doNotDisturbUntil: null,
  doNotDisturbSchedule: null,
  mutedTypes: [],
};

const NOTIFICATION_SOUNDS: Record<NotificationType, string> = {
  info: '/sounds/notification-info.mp3',
  warning: '/sounds/notification-warning.mp3',
  error: '/sounds/notification-error.mp3',
  success: '/sounds/notification-success.mp3',
};

let audioContext: AudioContext | null = null;
const audioBuffers: Map<string, AudioBuffer> = new Map();

async function initAudio() {
  if (typeof window === 'undefined') return;
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
}

async function loadSound(url: string): Promise<AudioBuffer | null> {
  if (typeof window === 'undefined') return null;
  
  if (audioBuffers.has(url)) {
    return audioBuffers.get(url)!;
  }
  
  try {
    await initAudio();
    if (!audioContext) return null;
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    audioBuffers.set(url, audioBuffer);
    return audioBuffer;
  } catch {
    return null;
  }
}

async function playSound(type: NotificationType, volume: number) {
  if (typeof window === 'undefined') return;
  
  try {
    await initAudio();
    if (!audioContext) return;
    
    const url = NOTIFICATION_SOUNDS[type];
    let buffer = await loadSound(url);
    
    if (!buffer) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      const frequencies: Record<NotificationType, number> = {
        info: 440,
        warning: 523,
        error: 330,
        success: 659,
      };
      
      oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      return;
    }
    
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = buffer;
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0);
  } catch {
  }
}

async function showDesktopNotification(
  title: string,
  message: string,
  type: NotificationType
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  
  const iconMap: Record<NotificationType, string> = {
    info: '/icons/notification-info.png',
    warning: '/icons/notification-warning.png',
    error: '/icons/notification-error.png',
    success: '/icons/notification-success.png',
  };
  
  try {
    new Notification(title, {
      body: message,
      icon: iconMap[type],
      tag: `alfie-${type}-${Date.now()}`,
    });
  } catch {
  }
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      toasts: [],
      preferences: DEFAULT_PREFERENCES,
      desktopPermission: typeof window !== 'undefined' && 'Notification' in window 
        ? Notification.permission 
        : 'denied',
      centerOpen: false,
      preferencesOpen: false,

      addNotification: (notificationData) => {
        const id = crypto.randomUUID();
        const notification: Notification = {
          ...notificationData,
          id,
          createdAt: new Date().toISOString(),
          read: false,
          dismissed: false,
        };
        
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 100),
        }));
        
        const { preferences, isDoNotDisturbActive } = get();
        const isDND = isDoNotDisturbActive();
        
        if (!preferences.mutedTypes.includes(notification.type)) {
          const canAlert = !isDND || notification.priority === 'urgent';
          
          if (canAlert) {
            if (preferences.soundEnabled) {
              playSound(notification.type, preferences.soundVolume);
            }
            
            if (preferences.desktopEnabled && get().desktopPermission === 'granted') {
              showDesktopNotification(notification.title, notification.message, notification.type);
            }
            
            if (preferences.toastEnabled) {
              get().showToast(notificationData, preferences.toastDuration);
            }
          }
        }
        
        return id;
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      dismissNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, dismissed: true } : n
          ),
        }));
      },

      clearAll: () => {
        set({ notifications: [] });
      },

      showToast: (notificationData, duration) => {
        const id = crypto.randomUUID();
        const { preferences } = get();
        const toastDuration = duration ?? preferences.toastDuration;
        
        const toast: ToastNotification = {
          ...notificationData,
          id,
          createdAt: new Date().toISOString(),
          read: false,
          dismissed: false,
          duration: toastDuration,
          showProgress: true,
        };
        
        set((state) => ({
          toasts: [...state.toasts, toast],
        }));
        
        setTimeout(() => {
          get().removeToast(id);
        }, toastDuration);
        
        return id;
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },

      updatePreferences: (updates) => {
        set((state) => ({
          preferences: { ...state.preferences, ...updates },
        }));
      },

      enableDoNotDisturb: (durationMinutes) => {
        const updates: Partial<NotificationPreferences> = { doNotDisturb: true };
        
        if (durationMinutes) {
          const until = new Date();
          until.setMinutes(until.getMinutes() + durationMinutes);
          updates.doNotDisturbUntil = until.toISOString();
        } else {
          updates.doNotDisturbUntil = null;
        }
        
        set((state) => ({
          preferences: { ...state.preferences, ...updates },
        }));
      },

      disableDoNotDisturb: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            doNotDisturb: false,
            doNotDisturbUntil: null,
          },
        }));
      },

      setDoNotDisturbSchedule: (start, end) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            doNotDisturbSchedule: { start, end },
          },
        }));
      },

      clearDoNotDisturbSchedule: () => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            doNotDisturbSchedule: null,
          },
        }));
      },

      requestDesktopPermission: async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
          return 'denied';
        }
        
        const permission = await Notification.requestPermission();
        set({ desktopPermission: permission });
        return permission;
      },

      setDesktopPermission: (permission) => {
        set({ desktopPermission: permission });
      },

      setCenterOpen: (open) => {
        set({ centerOpen: open });
      },

      setPreferencesOpen: (open) => {
        set({ preferencesOpen: open });
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.read && !n.dismissed).length;
      },

      isDoNotDisturbActive: () => {
        const { preferences } = get();
        
        if (!preferences.doNotDisturb && !preferences.doNotDisturbSchedule) {
          return false;
        }
        
        if (preferences.doNotDisturbUntil) {
          const until = new Date(preferences.doNotDisturbUntil);
          if (until > new Date()) return true;
          
          set((state) => ({
            preferences: {
              ...state.preferences,
              doNotDisturb: false,
              doNotDisturbUntil: null,
            },
          }));
          return false;
        }
        
        if (preferences.doNotDisturbSchedule) {
          const now = new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const { start, end } = preferences.doNotDisturbSchedule;
          
          if (start <= end) {
            return currentMinutes >= start && currentMinutes < end;
          }
          return currentMinutes >= start || currentMinutes < end;
        }
        
        return preferences.doNotDisturb;
      },
    }),
    {
      name: 'alfie-notification-storage',
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 50),
        preferences: state.preferences,
      }),
    }
  )
);

export function notify(
  type: NotificationType,
  title: string,
  message: string,
  options: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'message' | 'createdAt' | 'read' | 'dismissed'>> = {}
): string {
  return useNotificationStore.getState().addNotification({
    type,
    title,
    message,
    priority: options.priority ?? 'normal',
    ...options,
  });
}

export const notifyInfo = (title: string, message: string, options = {}) => 
  notify('info', title, message, options);

export const notifyWarning = (title: string, message: string, options = {}) => 
  notify('warning', title, message, options);

export const notifyError = (title: string, message: string, options = {}) => 
  notify('error', title, message, options);

export const notifySuccess = (title: string, message: string, options = {}) => 
  notify('success', title, message, options);
