import { create } from 'zustand';

export type ResearchQuery = {
  id: string;
  query: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
};

interface ResearchState {
  queries: ResearchQuery[];
  isResearching: boolean;
  synthesis: string | null;
  startResearch: (mainQuery: string) => ResearchQuery[];
  updateQuery: (id: string, updates: Partial<ResearchQuery>) => void;
  completeSynthesis: (text: string) => void;
  clearResearch: () => void;
}

const extractTopic = (input: string): string => {
  return input
    .replace(/^\s*\/research\s+/i, '')
    .replace(/^(research|compare|analyze|analysis|investigate|explore|study)\b\s*/i, '')
    .replace(/^(about|between|of)\b\s*/i, '')
    .trim();
};

const buildSubQueries = (mainQuery: string): string[] => {
  const cleaned = mainQuery.trim();
  const lowered = cleaned.toLowerCase();

  if (lowered.startsWith('compare')) {
    const match = cleaned.match(/compare\s+(.+?)\s+(?:and|vs\.?|versus)\s+(.+)/i);
    if (match) {
      const first = match[1].trim();
      const second = match[2].trim();
      return [
        `What is ${first}?`,
        `What is ${second}?`,
        `Key differences between ${first} and ${second}`,
        `Pros and cons of ${first} vs ${second}`,
      ];
    }
  }

  if (lowered.startsWith('research')) {
    const topic = extractTopic(cleaned) || cleaned;
    return [
      `Overview of ${topic}`,
      `Key features of ${topic}`,
      `Recent developments in ${topic}`,
      `Expert opinions on ${topic}`,
    ];
  }

  const topic = extractTopic(cleaned) || cleaned;
  return [
    `Background on ${topic}`,
    `Key aspects of ${topic}`,
    `Analysis of ${topic}`,
  ];
};

export const useResearchStore = create<ResearchState>()((set) => ({
  queries: [],
  isResearching: false,
  synthesis: null,

  startResearch: (mainQuery) => {
    const subQueries = buildSubQueries(mainQuery);
    const queries: ResearchQuery[] = subQueries.map((query) => ({
      id: crypto.randomUUID(),
      query,
      status: 'pending',
    }));
    set({ queries, isResearching: true, synthesis: null });
    return queries;
  },

  updateQuery: (id, updates) => {
    set((state) => ({
      queries: state.queries.map((query) =>
        query.id === id ? { ...query, ...updates } : query
      ),
    }));
  },

  completeSynthesis: (text) => set({ synthesis: text }),

  clearResearch: () => set({ queries: [], isResearching: false, synthesis: null }),
}));
