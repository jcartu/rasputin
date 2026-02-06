import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DiffViewMode,
  FileDiff,
  DiffComment,
  MergeConflict,
  DiffViewerConfig,
  DiffCommentReply,
  DEFAULT_DIFF_CONFIG,
} from './types';
import { DEFAULT_DIFF_CONFIG as defaultConfig } from './types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

interface DiffViewerState {
  isOpen: boolean;
  currentFiles: FileDiff[];
  selectedFileId: string | null;
  comments: DiffComment[];
  conflicts: MergeConflict[];
  config: DiffViewerConfig;
  collapsedHunks: Set<string>;
  highlightedLines: { fileId: string; lineNumber: number; side: 'old' | 'new' }[];

  openDiffViewer: (files: FileDiff[]) => void;
  closeDiffViewer: () => void;
  selectFile: (fileId: string | null) => void;
  setFiles: (files: FileDiff[]) => void;

  setViewMode: (mode: DiffViewMode) => void;
  updateConfig: (config: Partial<DiffViewerConfig>) => void;

  toggleHunkCollapse: (hunkId: string) => void;
  collapseAllHunks: () => void;
  expandAllHunks: () => void;

  addComment: (
    filePath: string,
    lineNumber: number,
    side: 'old' | 'new',
    content: string,
    author: string
  ) => DiffComment;
  updateComment: (commentId: string, content: string) => void;
  deleteComment: (commentId: string) => void;
  resolveComment: (commentId: string) => void;
  unresolveComment: (commentId: string) => void;
  addReply: (commentId: string, content: string, author: string) => void;
  getCommentsForFile: (filePath: string) => DiffComment[];
  getCommentsForLine: (filePath: string, lineNumber: number, side: 'old' | 'new') => DiffComment[];

  setConflicts: (conflicts: MergeConflict[]) => void;
  resolveConflict: (
    conflictId: string,
    resolution: 'ours' | 'theirs' | 'both' | 'custom',
    customContent?: string
  ) => void;
  getConflictsForFile: (filePath: string) => MergeConflict[];

  highlightLine: (fileId: string, lineNumber: number, side: 'old' | 'new') => void;
  clearHighlightedLines: () => void;
}

export const useDiffViewerStore = create<DiffViewerState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      currentFiles: [],
      selectedFileId: null,
      comments: [],
      conflicts: [],
      config: defaultConfig,
      collapsedHunks: new Set(),
      highlightedLines: [],

      openDiffViewer: (files) =>
        set({
          isOpen: true,
          currentFiles: files,
          selectedFileId: files[0]?.id || null,
        }),

      closeDiffViewer: () =>
        set({
          isOpen: false,
          currentFiles: [],
          selectedFileId: null,
          highlightedLines: [],
        }),

      selectFile: (fileId) => set({ selectedFileId: fileId }),

      setFiles: (files) =>
        set({
          currentFiles: files,
          selectedFileId: files[0]?.id || null,
        }),

      setViewMode: (mode) =>
        set((state) => ({
          config: { ...state.config, viewMode: mode },
        })),

      updateConfig: (config) =>
        set((state) => ({
          config: { ...state.config, ...config },
        })),

      toggleHunkCollapse: (hunkId) =>
        set((state) => {
          const newCollapsed = new Set(state.collapsedHunks);
          if (newCollapsed.has(hunkId)) {
            newCollapsed.delete(hunkId);
          } else {
            newCollapsed.add(hunkId);
          }
          return { collapsedHunks: newCollapsed };
        }),

      collapseAllHunks: () =>
        set((state) => {
          const allHunkIds = new Set<string>();
          for (const file of state.currentFiles) {
            for (const hunk of file.hunks) {
              allHunkIds.add(hunk.id);
            }
          }
          return { collapsedHunks: allHunkIds };
        }),

      expandAllHunks: () => set({ collapsedHunks: new Set() }),

      addComment: (filePath, lineNumber, side, content, author) => {
        const comment: DiffComment = {
          id: generateId(),
          filePath,
          lineNumber,
          side,
          content,
          author,
          createdAt: new Date(),
          resolved: false,
          replies: [],
        };

        set((state) => ({
          comments: [...state.comments, comment],
        }));

        return comment;
      },

      updateComment: (commentId, content) =>
        set((state) => ({
          comments: state.comments.map((c) =>
            c.id === commentId ? { ...c, content, updatedAt: new Date() } : c
          ),
        })),

      deleteComment: (commentId) =>
        set((state) => ({
          comments: state.comments.filter((c) => c.id !== commentId),
        })),

      resolveComment: (commentId) =>
        set((state) => ({
          comments: state.comments.map((c) =>
            c.id === commentId ? { ...c, resolved: true } : c
          ),
        })),

      unresolveComment: (commentId) =>
        set((state) => ({
          comments: state.comments.map((c) =>
            c.id === commentId ? { ...c, resolved: false } : c
          ),
        })),

      addReply: (commentId, content, author) => {
        const reply: DiffCommentReply = {
          id: generateId(),
          content,
          author,
          createdAt: new Date(),
        };

        set((state) => ({
          comments: state.comments.map((c) =>
            c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c
          ),
        }));
      },

      getCommentsForFile: (filePath) => {
        return get().comments.filter((c) => c.filePath === filePath);
      },

      getCommentsForLine: (filePath, lineNumber, side) => {
        return get().comments.filter(
          (c) => c.filePath === filePath && c.lineNumber === lineNumber && c.side === side
        );
      },

      setConflicts: (conflicts) => set({ conflicts }),

      resolveConflict: (conflictId, resolution, customContent) =>
        set((state) => ({
          conflicts: state.conflicts.map((c) =>
            c.id === conflictId
              ? { ...c, resolution, customResolution: customContent }
              : c
          ),
        })),

      getConflictsForFile: (filePath) => {
        return get().conflicts.filter((c) => c.filePath === filePath);
      },

      highlightLine: (fileId, lineNumber, side) =>
        set((state) => ({
          highlightedLines: [...state.highlightedLines, { fileId, lineNumber, side }],
        })),

      clearHighlightedLines: () => set({ highlightedLines: [] }),
    }),
    {
      name: 'alfie-diff-viewer-storage',
      partialize: (state) => ({
        config: state.config,
        comments: state.comments,
      }),
    }
  )
);
