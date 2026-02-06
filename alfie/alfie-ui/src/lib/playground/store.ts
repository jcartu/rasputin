import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  HttpMethod,
  KeyValuePair,
  AuthConfig,
  RequestBody,
  ApiRequest,
  ApiResponse,
  RequestCollection,
  Environment,
  WebSocketConnection,
  WebSocketMessage,
} from './types';

interface PlaygroundState {
  // Current request state
  currentRequest: ApiRequest;
  currentResponse: ApiResponse | null;
  isLoading: boolean;
  error: string | null;

  // Saved data
  savedRequests: ApiRequest[];
  collections: RequestCollection[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  history: Array<{ request: ApiRequest; response: ApiResponse; timestamp: string }>;

  // WebSocket state
  wsConnections: WebSocketConnection[];
  activeWsConnectionId: string | null;

  // UI state
  activeTab: 'params' | 'headers' | 'body' | 'auth';
  responseTab: 'body' | 'headers' | 'cookies' | 'timeline';
  codeLanguage: 'curl' | 'javascript' | 'python' | 'go' | 'rust';
  showCodeGenerator: boolean;
  showCollections: boolean;
  viewMode: 'rest' | 'websocket';

  // Actions
  setCurrentRequest: (request: Partial<ApiRequest>) => void;
  setMethod: (method: HttpMethod) => void;
  setUrl: (url: string) => void;
  addHeader: (header?: Partial<KeyValuePair>) => void;
  updateHeader: (id: string, updates: Partial<KeyValuePair>) => void;
  removeHeader: (id: string) => void;
  addQueryParam: (param?: Partial<KeyValuePair>) => void;
  updateQueryParam: (id: string, updates: Partial<KeyValuePair>) => void;
  removeQueryParam: (id: string) => void;
  setBody: (body: Partial<RequestBody>) => void;
  setAuth: (auth: Partial<AuthConfig>) => void;
  
  // Response actions
  setResponse: (response: ApiResponse | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Saved requests actions
  saveRequest: (name?: string) => string;
  loadRequest: (id: string) => void;
  updateSavedRequest: (id: string, updates: Partial<ApiRequest>) => void;
  deleteSavedRequest: (id: string) => void;
  duplicateRequest: (id: string) => string;

  // Collections actions
  createCollection: (name: string, description?: string) => string;
  updateCollection: (id: string, updates: Partial<RequestCollection>) => void;
  deleteCollection: (id: string) => void;
  addToCollection: (collectionId: string, requestId: string) => void;
  removeFromCollection: (collectionId: string, requestId: string) => void;

  // Environment actions
  createEnvironment: (name: string) => string;
  updateEnvironment: (id: string, updates: Partial<Environment>) => void;
  deleteEnvironment: (id: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  resolveVariables: (text: string) => string;

  // History actions
  addToHistory: (request: ApiRequest, response: ApiResponse) => void;
  clearHistory: () => void;

  // WebSocket actions
  createWsConnection: (url: string, protocols?: string[]) => string;
  updateWsConnection: (id: string, updates: Partial<WebSocketConnection>) => void;
  deleteWsConnection: (id: string) => void;
  setActiveWsConnection: (id: string | null) => void;
  addWsMessage: (connectionId: string, message: Omit<WebSocketMessage, 'id' | 'timestamp'>) => void;
  clearWsMessages: (connectionId: string) => void;

  // UI actions
  setActiveTab: (tab: 'params' | 'headers' | 'body' | 'auth') => void;
  setResponseTab: (tab: 'body' | 'headers' | 'cookies' | 'timeline') => void;
  setCodeLanguage: (language: 'curl' | 'javascript' | 'python' | 'go' | 'rust') => void;
  setShowCodeGenerator: (show: boolean) => void;
  setShowCollections: (show: boolean) => void;
  setViewMode: (mode: 'rest' | 'websocket') => void;
  reset: () => void;
}

const createEmptyRequest = (): ApiRequest => ({
  id: crypto.randomUUID(),
  name: 'New Request',
  method: 'GET',
  url: '',
  headers: [
    { id: crypto.randomUUID(), key: 'Content-Type', value: 'application/json', enabled: true },
  ],
  queryParams: [],
  body: { type: 'none', content: '' },
  auth: { type: 'none' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createKeyValuePair = (data?: Partial<KeyValuePair>): KeyValuePair => ({
  id: crypto.randomUUID(),
  key: '',
  value: '',
  enabled: true,
  ...data,
});

export const usePlaygroundStore = create<PlaygroundState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentRequest: createEmptyRequest(),
      currentResponse: null,
      isLoading: false,
      error: null,
      savedRequests: [],
      collections: [],
      environments: [
        {
          id: 'default',
          name: 'Default',
          variables: [
            { id: '1', key: 'BASE_URL', value: 'http://localhost:8080', enabled: true },
            { id: '2', key: 'API_KEY', value: '', enabled: true },
          ],
          isActive: true,
        },
      ],
      activeEnvironmentId: 'default',
      history: [],
      wsConnections: [],
      activeWsConnectionId: null,
      activeTab: 'params',
      responseTab: 'body',
      codeLanguage: 'curl',
      showCodeGenerator: false,
      showCollections: true,
      viewMode: 'rest',

      // Current request actions
      setCurrentRequest: (request) =>
        set((state) => ({
          currentRequest: {
            ...state.currentRequest,
            ...request,
            updatedAt: new Date().toISOString(),
          },
        })),

      setMethod: (method) =>
        set((state) => ({
          currentRequest: { ...state.currentRequest, method, updatedAt: new Date().toISOString() },
        })),

      setUrl: (url) =>
        set((state) => ({
          currentRequest: { ...state.currentRequest, url, updatedAt: new Date().toISOString() },
        })),

      addHeader: (header) =>
        set((state) => ({
          currentRequest: {
            ...state.currentRequest,
            headers: [...state.currentRequest.headers, createKeyValuePair(header)],
            updatedAt: new Date().toISOString(),
          },
        })),

      updateHeader: (id, updates) =>
        set((state) => ({
          currentRequest: {
            ...state.currentRequest,
            headers: state.currentRequest.headers.map((h) =>
              h.id === id ? { ...h, ...updates } : h
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      removeHeader: (id) =>
        set((state) => ({
          currentRequest: {
            ...state.currentRequest,
            headers: state.currentRequest.headers.filter((h) => h.id !== id),
            updatedAt: new Date().toISOString(),
          },
        })),

      addQueryParam: (param) =>
        set((state) => ({
          currentRequest: {
            ...state.currentRequest,
            queryParams: [...state.currentRequest.queryParams, createKeyValuePair(param)],
            updatedAt: new Date().toISOString(),
          },
        })),

      updateQueryParam: (id, updates) =>
        set((state) => ({
          currentRequest: {
            ...state.currentRequest,
            queryParams: state.currentRequest.queryParams.map((p) =>
              p.id === id ? { ...p, ...updates } : p
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      removeQueryParam: (id) =>
        set((state) => ({
          currentRequest: {
            ...state.currentRequest,
            queryParams: state.currentRequest.queryParams.filter((p) => p.id !== id),
            updatedAt: new Date().toISOString(),
          },
        })),

      setBody: (body) =>
        set((state) => ({
          currentRequest: {
            ...state.currentRequest,
            body: { ...state.currentRequest.body, ...body },
            updatedAt: new Date().toISOString(),
          },
        })),

      setAuth: (auth) =>
        set((state) => ({
          currentRequest: {
            ...state.currentRequest,
            auth: { ...state.currentRequest.auth, ...auth },
            updatedAt: new Date().toISOString(),
          },
        })),

      // Response actions
      setResponse: (response) => set({ currentResponse: response }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      // Saved requests actions
      saveRequest: (name) => {
        const state = get();
        const id = crypto.randomUUID();
        const request: ApiRequest = {
          ...state.currentRequest,
          id,
          name: name || state.currentRequest.name || 'Untitled Request',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set({ savedRequests: [...state.savedRequests, request] });
        return id;
      },

      loadRequest: (id) => {
        const request = get().savedRequests.find((r) => r.id === id);
        if (request) {
          set({ currentRequest: { ...request }, currentResponse: null, error: null });
        }
      },

      updateSavedRequest: (id, updates) =>
        set((state) => ({
          savedRequests: state.savedRequests.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
          ),
        })),

      deleteSavedRequest: (id) =>
        set((state) => ({
          savedRequests: state.savedRequests.filter((r) => r.id !== id),
          collections: state.collections.map((c) => ({
            ...c,
            requests: c.requests.filter((rid) => rid !== id),
          })),
        })),

      duplicateRequest: (id) => {
        const state = get();
        const original = state.savedRequests.find((r) => r.id === id);
        if (!original) return '';
        const newId = crypto.randomUUID();
        const duplicate: ApiRequest = {
          ...original,
          id: newId,
          name: `${original.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set({ savedRequests: [...state.savedRequests, duplicate] });
        return newId;
      },

      // Collections actions
      createCollection: (name, description) => {
        const id = crypto.randomUUID();
        const collection: RequestCollection = {
          id,
          name,
          description,
          requests: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ collections: [...state.collections, collection] }));
        return id;
      },

      updateCollection: (id, updates) =>
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
          ),
        })),

      deleteCollection: (id) =>
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== id),
        })),

      addToCollection: (collectionId, requestId) =>
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId && !c.requests.includes(requestId)
              ? { ...c, requests: [...c.requests, requestId], updatedAt: new Date().toISOString() }
              : c
          ),
        })),

      removeFromCollection: (collectionId, requestId) =>
        set((state) => ({
          collections: state.collections.map((c) =>
            c.id === collectionId
              ? { ...c, requests: c.requests.filter((id) => id !== requestId), updatedAt: new Date().toISOString() }
              : c
          ),
        })),

      // Environment actions
      createEnvironment: (name) => {
        const id = crypto.randomUUID();
        const environment: Environment = {
          id,
          name,
          variables: [],
          isActive: false,
        };
        set((state) => ({ environments: [...state.environments, environment] }));
        return id;
      },

      updateEnvironment: (id, updates) =>
        set((state) => ({
          environments: state.environments.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        })),

      deleteEnvironment: (id) =>
        set((state) => ({
          environments: state.environments.filter((e) => e.id !== id),
          activeEnvironmentId: state.activeEnvironmentId === id ? null : state.activeEnvironmentId,
        })),

      setActiveEnvironment: (id) =>
        set((state) => ({
          activeEnvironmentId: id,
          environments: state.environments.map((e) => ({
            ...e,
            isActive: e.id === id,
          })),
        })),

      resolveVariables: (text) => {
        const state = get();
        const env = state.environments.find((e) => e.id === state.activeEnvironmentId);
        if (!env) return text;

        let resolved = text;
        env.variables
          .filter((v) => v.enabled)
          .forEach((v) => {
            const pattern = new RegExp(`\\{\\{${v.key}\\}\\}`, 'g');
            resolved = resolved.replace(pattern, v.value);
          });
        return resolved;
      },

      // History actions
      addToHistory: (request, response) =>
        set((state) => ({
          history: [
            { request, response, timestamp: new Date().toISOString() },
            ...state.history.slice(0, 99), // Keep last 100 items
          ],
        })),

      clearHistory: () => set({ history: [] }),

      // WebSocket actions
      createWsConnection: (url, protocols) => {
        const id = crypto.randomUUID();
        const connection: WebSocketConnection = {
          id,
          url,
          status: 'disconnected',
          messages: [],
          protocols,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          wsConnections: [...state.wsConnections, connection],
          activeWsConnectionId: id,
        }));
        return id;
      },

      updateWsConnection: (id, updates) =>
        set((state) => ({
          wsConnections: state.wsConnections.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      deleteWsConnection: (id) =>
        set((state) => ({
          wsConnections: state.wsConnections.filter((c) => c.id !== id),
          activeWsConnectionId:
            state.activeWsConnectionId === id ? null : state.activeWsConnectionId,
        })),

      setActiveWsConnection: (id) => set({ activeWsConnectionId: id }),

      addWsMessage: (connectionId, message) =>
        set((state) => ({
          wsConnections: state.wsConnections.map((c) =>
            c.id === connectionId
              ? {
                  ...c,
                  messages: [
                    ...c.messages,
                    {
                      ...message,
                      id: crypto.randomUUID(),
                      timestamp: new Date().toISOString(),
                    },
                  ],
                }
              : c
          ),
        })),

      clearWsMessages: (connectionId) =>
        set((state) => ({
          wsConnections: state.wsConnections.map((c) =>
            c.id === connectionId ? { ...c, messages: [] } : c
          ),
        })),

      // UI actions
      setActiveTab: (tab) => set({ activeTab: tab }),
      setResponseTab: (tab) => set({ responseTab: tab }),
      setCodeLanguage: (language) => set({ codeLanguage: language }),
      setShowCodeGenerator: (show) => set({ showCodeGenerator: show }),
      setShowCollections: (show) => set({ showCollections: show }),
      setViewMode: (mode) => set({ viewMode: mode }),
      reset: () =>
        set({
          currentRequest: createEmptyRequest(),
          currentResponse: null,
          error: null,
          isLoading: false,
        }),
    }),
    {
      name: 'alfie-playground-storage',
      partialize: (state) => ({
        savedRequests: state.savedRequests,
        collections: state.collections,
        environments: state.environments,
        activeEnvironmentId: state.activeEnvironmentId,
        history: state.history.slice(0, 50), // Only persist last 50 history items
        codeLanguage: state.codeLanguage,
        showCollections: state.showCollections,
      }),
    }
  )
);
