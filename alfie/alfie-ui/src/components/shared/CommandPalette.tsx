'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MessageSquarePlus, Sun, Cpu, BarChart3, Zap, X, Wand2, FolderOpen, Clock, ListTodo, Puzzle, Settings } from 'lucide-react';
import { useChatStore, useUIStore } from '@/lib/store';

interface Command {
  id: string;
  label: string;
  section: string;
  icon: typeof Search;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: 'new-chat', label: 'New Chat', section: 'Chat', icon: MessageSquarePlus, action: () => { useChatStore.getState().createSession('New Chat'); setOpen(false); } },
    { id: 'toggle-theme', label: 'Toggle Theme', section: 'Actions', icon: Sun, action: () => { document.documentElement.classList.toggle('dark'); const isDark = document.documentElement.classList.contains('dark'); localStorage.setItem('alfie_theme', isDark ? 'dark' : 'light'); setOpen(false); } },
    { id: 'playground', label: 'API Playground', section: 'Navigation', icon: Cpu, action: () => { useUIStore.getState().setMainView('playground'); setOpen(false); } },
    { id: 'analytics', label: 'Analytics', section: 'Navigation', icon: BarChart3, action: () => { useUIStore.getState().setMainView('analytics'); setOpen(false); } },
    { id: 'chat-view', label: 'Back to Chat', section: 'Navigation', icon: MessageSquarePlus, action: () => { useUIStore.getState().setMainView('chat'); setOpen(false); } },
    { id: 'agent-task', label: 'Run Agent Task', section: 'Actions', icon: Zap, action: () => { setOpen(false); const input = document.getElementById('chat-input') as HTMLTextAreaElement; if (input) input.focus(); } },
    { id: 'skills', label: 'Skills Marketplace', section: 'Navigation', icon: Wand2, action: () => { useUIStore.getState().setMainView('skills'); setOpen(false); } },
    { id: 'projects', label: 'Projects', section: 'Navigation', icon: FolderOpen, action: () => { useUIStore.getState().setMainView('projects'); setOpen(false); } },
    { id: 'schedules', label: 'Scheduled Tasks', section: 'Navigation', icon: Clock, action: () => { useUIStore.getState().setMainView('schedules'); setOpen(false); } },
    { id: 'tasks', label: 'Agent Tasks History', section: 'Navigation', icon: ListTodo, action: () => { useUIStore.getState().setMainView('tasks'); setOpen(false); } },
    { id: 'integrations', label: 'Integrations', section: 'Navigation', icon: Puzzle, action: () => { useUIStore.getState().setMainView('integrations'); setOpen(false); } },
    { id: 'settings', label: 'Settings', section: 'Navigation', icon: Settings, action: () => { useUIStore.getState().setMainView('settings'); setOpen(false); } },
  ];

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
      e.preventDefault();
      setOpen((o) => !o);
      setQuery('');
      setSelectedIndex(0);
    }
    if (e.key === 'Escape') setOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const handleInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[selectedIndex]) { filtered[selectedIndex].action(); }
  };

  if (!open) return null;

  const sections = [...new Set(filtered.map((c) => c.section))];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close command palette" />
      <div
        className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
      >
        <div className="flex items-center border-b border-border px-4 py-3">
          <Search className="w-4 h-4 text-muted-foreground mr-2" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleInputKey}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No commands found</p>
          )}
          {sections.map((section) => (
            <div key={section}>
              <p className="text-xs font-medium text-muted-foreground px-3 py-1.5">{section}</p>
              {filtered
                .filter((c) => c.section === section)
                .map((cmd) => {
                  const idx = filtered.indexOf(cmd);
                  return (
                    <button
                      type="button"
                      key={cmd.id}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                        idx === selectedIndex ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                      }`}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <cmd.icon className="w-4 h-4" />
                      {cmd.label}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
