'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  MessageSquare,
  FolderOpen,
  FileText,
  Brain,
  Clock,
  Command,
  ArrowUp,
  ArrowDown,
  CornerDownLeft,
  Loader2,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/lib/store';

interface SearchResult {
  type: 'session' | 'message' | 'file' | 'memory';
  id: string;
  title: string;
  subtitle: string;
  excerpt: string;
  score: number;
  timestamp: string | null;
  data: Record<string, unknown>;
}

interface SearchState {
  isOpen: boolean;
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  selectedIndex: number;
  history: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MAX_HISTORY = 10;
const STORAGE_KEY = 'alfie-search-history';

const typeConfig = {
  session: { icon: FolderOpen, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  message: { icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  file: { icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  memory: { icon: Brain, color: 'text-purple-500', bg: 'bg-purple-500/10' },
};

function highlightText(text: string) {
  if (!text) return text;
  const parts = text.split(/(<<|>>)/);
  const result: (string | JSX.Element)[] = [];
  let isHighlight = false;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '<<') {
      isHighlight = true;
    } else if (parts[i] === '>>') {
      isHighlight = false;
    } else if (parts[i]) {
      result.push(
        isHighlight ? (
          <mark key={i} className="bg-primary/30 text-foreground px-0.5 rounded">
            {parts[i]}
          </mark>
        ) : (
          parts[i]
        )
      );
    }
  }
  return result;
}

export function SearchPanel() {
  const [state, setState] = useState<SearchState>({
    isOpen: false,
    query: '',
    results: [],
    isLoading: false,
    selectedIndex: 0,
    history: [],
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { setActiveSession } = useChatStore();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setState(s => ({ ...s, history: JSON.parse(saved) }));
      }
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const saveHistory = useCallback((newHistory: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const addToHistory = useCallback((query: string) => {
    if (!query.trim()) return;
    setState(s => {
      const filtered = s.history.filter(h => h !== query);
      const newHistory = [query, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(newHistory);
      return { ...s, history: newHistory };
    });
  }, [saveHistory]);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setState(s => ({ ...s, results: [], isLoading: false }));
      return;
    }

    setState(s => ({ ...s, isLoading: true }));

    try {
      const response = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 30 }),
      });

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setState(s => ({
        ...s,
        results: data.results || [],
        isLoading: false,
        selectedIndex: 0,
      }));
    } catch (error) {
      console.error('Search error:', error);
      setState(s => ({ ...s, results: [], isLoading: false }));
    }
  }, []);

  const handleQueryChange = useCallback((value: string) => {
    setState(s => ({ ...s, query: value }));

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 200);
  }, [performSearch]);

  const handleResultClick = useCallback((result: SearchResult) => {
    addToHistory(state.query);
    
    switch (result.type) {
      case 'session':
        if (result.data.sessionId) {
          setActiveSession(result.data.sessionId as string);
        }
        break;
      case 'message':
        if (result.data.sessionId) {
          setActiveSession(result.data.sessionId as string);
        }
        break;
      case 'file':
        console.log('Open file:', result.data.path);
        break;
      case 'memory':
        console.log('Show memory:', result.data);
        break;
    }

    setState(s => ({ ...s, isOpen: false, query: '' }));
  }, [state.query, addToHistory, setActiveSession]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setState(s => ({
          ...s,
          selectedIndex: Math.min(s.selectedIndex + 1, s.results.length - 1),
        }));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setState(s => ({
          ...s,
          selectedIndex: Math.max(s.selectedIndex - 1, 0),
        }));
        break;
      case 'Enter':
        e.preventDefault();
        if (state.results[state.selectedIndex]) {
          handleResultClick(state.results[state.selectedIndex]);
        }
        break;
      case 'Escape':
        setState(s => ({ ...s, isOpen: false }));
        break;
    }
  }, [state.results, state.selectedIndex, handleResultClick]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setState(s => ({ ...s, isOpen: true }));
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.isOpen]);

  const showHistory = !state.query && state.history.length > 0;
  const showResults = state.query && state.results.length > 0;
  const showEmpty = state.query && !state.isLoading && state.results.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setState(s => ({ ...s, isOpen: true }))}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-lg border border-border/50 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-background rounded border border-border">
          <Command className="w-3 h-3" />K
        </kbd>
      </button>

      <Dialog open={state.isOpen} onOpenChange={(open) => setState(s => ({ ...s, isOpen: open }))}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
          <div className="flex items-center border-b border-border px-4">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={state.query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search sessions, messages, files, and memories..."
              className="flex-1 h-14 px-3 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base"
            />
            {state.isLoading ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            ) : state.query ? (
              <button
                type="button"
                onClick={() => handleQueryChange('')}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            ) : null}
          </div>

          <ScrollArea className="max-h-[400px]">
            <div className="p-2">
              <AnimatePresence mode="wait">
                {showHistory && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-1"
                  >
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Recent Searches
                    </div>
                    {state.history.map((item) => (
                      <button
                        type="button"
                        key={`history-${item}`}
                        onClick={() => handleQueryChange(item)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                      >
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{item}</span>
                      </button>
                    ))}
                  </motion.div>
                )}

                {showResults && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-1"
                  >
                    {state.results.map((result, idx) => {
                      const config = typeConfig[result.type];
                      const Icon = config.icon;
                      const isSelected = idx === state.selectedIndex;

                      return (
                        <motion.button
                          key={result.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => handleResultClick(result)}
                          className={cn(
                            'w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-colors',
                            isSelected ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-muted'
                          )}
                        >
                          <div className={cn('p-2 rounded-lg', config.bg)}>
                            <Icon className={cn('w-4 h-4', config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {result.title}
                              </span>
                              <Badge variant="outline" className="text-xs capitalize">
                                {result.type}
                              </Badge>
                              {result.score >= 0.9 && (
                                <Badge className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                  Best match
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {result.subtitle}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {highlightText(result.excerpt)}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}

                {showEmpty && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-12 text-center"
                  >
                    <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No results found for &quot;{state.query}&quot;</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Try a different search term
                    </p>
                  </motion.div>
                )}

                {!state.query && !showHistory && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-12 text-center"
                  >
                    <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      Search across sessions, messages, files, and 438K memories
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>

          <div className="border-t border-border px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <ArrowUp className="w-3 h-3" />
                <ArrowDown className="w-3 h-3" />
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="w-3 h-3" />
                Select
              </span>
              <span className="flex items-center gap-1">
                <span className="font-mono">Esc</span>
                Close
              </span>
            </div>
            {state.results.length > 0 && (
              <span>{state.results.length} results</span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SearchPanel;
