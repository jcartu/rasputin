import { create } from 'zustand';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('alfie_access_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export interface AgentStep {
  type: 'thinking' | 'tool_call' | 'tool_result';
  tool?: string;
  input?: unknown;
  output?: string;
  thinking?: string;
  success?: boolean;
  iteration: number;
}

export interface AgentTask {
  id: string;
  status: string;
  input: string;
  output: string | null;
  error: string | null;
  progress: number;
  iteration: number;
  maxIterations: number;
  steps: AgentStep[];
  createdAt: Date;
}

interface AgentState {
  activeTask: AgentTask | null;
  taskHistory: AgentTask[];
  isRunning: boolean;
  startTask: (input: string) => Promise<void>;
  cancelTask: () => Promise<void>;
  handleProgress: (data: Record<string, unknown>) => void;
  handleCompleted: (data: Record<string, unknown>) => void;
  handleFailed: (data: Record<string, unknown>) => void;
  clearTask: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  activeTask: null,
  taskHistory: [],
  isRunning: false,

  startTask: async (input: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/agent/run`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ task: input }),
      });
      if (!res.ok) throw new Error('Failed to start task');
      const data = await res.json();
      set({
        activeTask: {
          id: data.taskId,
          status: 'pending',
          input,
          output: null,
          error: null,
          progress: 0,
          iteration: 0,
          maxIterations: 30,
          steps: [],
          createdAt: new Date(),
        },
        isRunning: true,
      });
    } catch (e) {
      console.error('Failed to start agent task:', e);
    }
  },

  cancelTask: async () => {
    const task = get().activeTask;
    if (!task) return;
    try {
      await fetch(`${API_BASE}/api/agent/${task.id}/cancel`, {
        method: 'POST',
        headers: authHeaders(),
      });
      set((s) => ({
        activeTask: s.activeTask ? { ...s.activeTask, status: 'cancelled' } : null,
        isRunning: false,
      }));
    } catch (e) {
      console.error('Failed to cancel task:', e);
    }
  },

  handleProgress: (data) => {
    set((s) => {
      if (!s.activeTask || s.activeTask.id !== data.taskId) return s;
      const steps = [...s.activeTask.steps];
      if (data.status === 'thinking' && data.content) {
        steps.push({ type: 'thinking', thinking: data.content as string, iteration: (data.iteration as number) || 0 });
      }
      if (data.status === 'acting' && data.tool) {
        steps.push({ type: 'tool_call', tool: data.tool as string, input: data.input, iteration: (data.iteration as number) || 0 });
      }
      if (data.status === 'observing' && data.tool) {
        steps.push({ type: 'tool_result', tool: data.tool as string, output: data.result as string, success: data.success as boolean, iteration: (data.iteration as number) || 0 });
      }
      return {
        activeTask: {
          ...s.activeTask,
          status: (data.status as string) || s.activeTask.status,
          progress: (data.progress as number) ?? s.activeTask.progress,
          iteration: (data.iteration as number) ?? s.activeTask.iteration,
          steps,
        },
      };
    });
  },

  handleCompleted: (data) => {
    set((s) => {
      const completed = s.activeTask ? { ...s.activeTask, status: 'completed', output: (data.output as string) || null, progress: 100 } : null;
      return {
        activeTask: completed,
        isRunning: false,
        taskHistory: completed ? [completed, ...s.taskHistory] : s.taskHistory,
      };
    });
  },

  handleFailed: (data) => {
    set((s) => ({
      activeTask: s.activeTask ? { ...s.activeTask, status: 'failed', error: (data.error as string) || 'Unknown error' } : null,
      isRunning: false,
    }));
  },

  clearTask: () => set({ activeTask: null, isRunning: false }),
}));
