import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActivityEventType =
  | 'tool'
  | 'api'
  | 'file'
  | 'search'
  | 'model'
  | 'memory'
  | 'websocket'
  | 'thinking'
  | 'background';

export type ActivityStatus = 'running' | 'success' | 'error';

export type ThinkingPhase = 'think' | 'act' | 'observe';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  timestamp: Date;
  status: ActivityStatus;
  title: string;
  description?: string;
  duration?: number;
  details?: Record<string, unknown>;
  toolName?: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  responseTime?: number;
  filePath?: string;
  operation?: 'read' | 'write' | 'delete';
  query?: string;
  resultsCount?: number;
  modelName?: string;
  tokensUsed?: number;
  memoriesFound?: number;
  phase?: ThinkingPhase;
  taskId?: string;
}

export interface ActivityFilter {
  types: ActivityEventType[];
  status?: ActivityStatus;
  searchQuery?: string;
}

interface ActivityState {
  events: ActivityEvent[];
  isVisible: boolean;
  isCollapsed: boolean;
  position: { x: number; y: number };
  filter: ActivityFilter;
  maxEvents: number;

  addEvent: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => string;
  updateEvent: (id: string, updates: Partial<ActivityEvent>) => void;
  completeEvent: (id: string, status: ActivityStatus, duration?: number, details?: Record<string, unknown>) => void;
  clearEvents: () => void;
  removeEvent: (id: string) => void;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  setPosition: (position: { x: number; y: number }) => void;
  setFilter: (filter: Partial<ActivityFilter>) => void;
  resetFilter: () => void;
  exportLog: () => string;
  getFilteredEvents: () => ActivityEvent[];
}

const DEFAULT_FILTER: ActivityFilter = {
  types: ['tool', 'api', 'file', 'search', 'model', 'memory', 'websocket', 'thinking', 'background'],
  status: undefined,
  searchQuery: '',
};

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      events: [],
      isVisible: false,
      isCollapsed: false,
      position: { x: -1, y: -1 },
      filter: DEFAULT_FILTER,
      maxEvents: 50,

      addEvent: (eventData) => {
        const id = crypto.randomUUID();
        const event: ActivityEvent = {
          ...eventData,
          id,
          timestamp: new Date(),
        };
        
        set((state) => {
          const newEvents = [event, ...state.events].slice(0, state.maxEvents);
          return { events: newEvents };
        });
        
        return id;
      },

      updateEvent: (id, updates) => {
        set((state) => ({
          events: state.events.map((event) =>
            event.id === id ? { ...event, ...updates } : event
          ),
        }));
      },

      completeEvent: (id, status, duration, details) => {
        set((state) => ({
          events: state.events.map((event) =>
            event.id === id
              ? { ...event, status, duration, details: { ...event.details, ...details } }
              : event
          ),
        }));
      },

      clearEvents: () => set({ events: [] }),

      removeEvent: (id) => {
        set((state) => ({
          events: state.events.filter((event) => event.id !== id),
        }));
      },

      setVisible: (visible) => set({ isVisible: visible }),
      toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),

      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),

      setPosition: (position) => set({ position }),

      setFilter: (filter) => {
        set((state) => ({
          filter: { ...state.filter, ...filter },
        }));
      },

      resetFilter: () => set({ filter: DEFAULT_FILTER }),

      exportLog: () => {
        const { events } = get();
        const exportData = events.map((event) => ({
          timestamp: event.timestamp.toISOString(),
          type: event.type,
          status: event.status,
          title: event.title,
          description: event.description,
          duration: event.duration,
          details: event.details,
        }));
        return JSON.stringify(exportData, null, 2);
      },

      getFilteredEvents: () => {
        const { events, filter } = get();
        return events.filter((event) => {
          if (!filter.types.includes(event.type)) return false;
          if (filter.status && event.status !== filter.status) return false;
          if (filter.searchQuery) {
            const query = filter.searchQuery.toLowerCase();
            const matchesTitle = event.title.toLowerCase().includes(query);
            const matchesDescription = event.description?.toLowerCase().includes(query);
            if (!matchesTitle && !matchesDescription) return false;
          }
          
          return true;
        });
      },
    }),
    {
      name: 'alfie-activity-storage',
      partialize: (state) => ({
        isVisible: state.isVisible,
        isCollapsed: state.isCollapsed,
        position: state.position,
        filter: state.filter,
      }),
    }
  )
);

export const activityEmitter = {
  tool: (name: string, status: ActivityStatus = 'running') => {
    return useActivityStore.getState().addEvent({
      type: 'tool',
      status,
      title: `Tool: ${name}`,
      toolName: name,
    });
  },

  api: (endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET', status: ActivityStatus = 'running') => {
    return useActivityStore.getState().addEvent({
      type: 'api',
      status,
      title: `${method} ${endpoint}`,
      endpoint,
      method,
    });
  },

  file: (path: string, operation: 'read' | 'write' | 'delete', status: ActivityStatus = 'running') => {
    const opLabel = operation.charAt(0).toUpperCase() + operation.slice(1);
    return useActivityStore.getState().addEvent({
      type: 'file',
      status,
      title: `${opLabel}: ${path.split('/').pop()}`,
      description: path,
      filePath: path,
      operation,
    });
  },

  search: (query: string, status: ActivityStatus = 'running') => {
    return useActivityStore.getState().addEvent({
      type: 'search',
      status,
      title: `Search: "${query.slice(0, 30)}${query.length > 30 ? '...' : ''}"`,
      query,
    });
  },

  model: (modelName: string, status: ActivityStatus = 'running') => {
    return useActivityStore.getState().addEvent({
      type: 'model',
      status,
      title: `Model: ${modelName}`,
      modelName,
    });
  },

  memory: (query: string, status: ActivityStatus = 'running') => {
    return useActivityStore.getState().addEvent({
      type: 'memory',
      status,
      title: `Memory lookup`,
      description: query.slice(0, 50),
      query,
    });
  },

  websocket: (eventName: string, status: ActivityStatus = 'success') => {
    return useActivityStore.getState().addEvent({
      type: 'websocket',
      status,
      title: `WS: ${eventName}`,
    });
  },

  thinking: (phase: ThinkingPhase) => {
    const phaseLabels: Record<ThinkingPhase, string> = {
      think: 'Thinking...',
      act: 'Acting...',
      observe: 'Observing...',
    };
    return useActivityStore.getState().addEvent({
      type: 'thinking',
      status: 'running',
      title: phaseLabels[phase],
      phase,
    });
  },

  background: (taskName: string, status: ActivityStatus = 'running') => {
    return useActivityStore.getState().addEvent({
      type: 'background',
      status,
      title: `Background: ${taskName}`,
    });
  },

  complete: (id: string, status: ActivityStatus = 'success', duration?: number, details?: Record<string, unknown>) => {
    useActivityStore.getState().completeEvent(id, status, duration, details);
  },
};
