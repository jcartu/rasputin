import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  NotebookDocument,
  NotebookCell,
  NotebookState,
  CellState,
  KernelStatus,
  KernelInfo,
  AvailableKernel,
  CellOutput,
  CellType,
  createCell,
  createNotebook,
  parseNotebook,
  serializeNotebook,
  sessionToNotebook,
  SessionMessage,
} from './types';

interface NotebookStoreState {
  // Notebooks
  notebooks: Record<string, NotebookState>;
  activeNotebookId: string | null;
  
  // Kernels
  availableKernels: AvailableKernel[];
  runningKernels: Record<string, KernelInfo>;
  
  // UI State
  isKernelPanelOpen: boolean;
  isNotebookListOpen: boolean;
  showLineNumbers: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  
  // Actions - Notebook Management
  createNotebook: (name?: string, path?: string) => string;
  openNotebook: (id: string, document: NotebookDocument, path: string, name: string) => void;
  closeNotebook: (id: string) => void;
  setActiveNotebook: (id: string | null) => void;
  saveNotebook: (id: string) => NotebookDocument | null;
  renameNotebook: (id: string, name: string) => void;
  importNotebook: (content: string, name: string, path: string) => string;
  exportNotebook: (id: string) => string | null;
  
  // Actions - Cell Management
  addCell: (notebookId: string, type: CellType, index?: number) => string;
  deleteCell: (notebookId: string, cellId: string) => void;
  duplicateCell: (notebookId: string, cellId: string) => string | null;
  moveCell: (notebookId: string, cellId: string, direction: 'up' | 'down') => void;
  updateCellSource: (notebookId: string, cellId: string, source: string) => void;
  updateCellType: (notebookId: string, cellId: string, type: CellType) => void;
  mergeCells: (notebookId: string, cellIds: string[]) => void;
  splitCell: (notebookId: string, cellId: string, position: number) => void;
  clearCellOutputs: (notebookId: string, cellId: string) => void;
  clearAllOutputs: (notebookId: string) => void;
  
  // Actions - Cell Selection
  setActiveCell: (notebookId: string, cellId: string | null) => void;
  selectCell: (notebookId: string, cellId: string, addToSelection?: boolean) => void;
  selectAllCells: (notebookId: string) => void;
  clearSelection: (notebookId: string) => void;
  
  // Actions - Cell State
  setCellEditing: (notebookId: string, cellId: string, isEditing: boolean) => void;
  setCellFocused: (notebookId: string, cellId: string, isFocused: boolean) => void;
  setCellCollapsed: (notebookId: string, cellId: string, isCollapsed: boolean) => void;
  toggleCellOutput: (notebookId: string, cellId: string) => void;
  
  // Actions - Execution
  queueCellExecution: (notebookId: string, cellId: string) => void;
  queueAllCells: (notebookId: string) => void;
  cancelExecution: (notebookId: string) => void;
  setCellExecuting: (notebookId: string, cellId: string, isExecuting: boolean) => void;
  setCellOutputs: (notebookId: string, cellId: string, outputs: CellOutput[]) => void;
  appendCellOutput: (notebookId: string, cellId: string, output: CellOutput) => void;
  setCellExecutionCount: (notebookId: string, cellId: string, count: number | null) => void;
  dequeueCell: (notebookId: string) => string | null;
  
  // Actions - Kernel Management
  setAvailableKernels: (kernels: AvailableKernel[]) => void;
  setKernelInfo: (kernelId: string, info: KernelInfo) => void;
  removeKernel: (kernelId: string) => void;
  setNotebookKernel: (notebookId: string, kernelId: string | null) => void;
  setKernelStatus: (notebookId: string, status: KernelStatus) => void;
  
  // Actions - UI
  setKernelPanelOpen: (open: boolean) => void;
  setNotebookListOpen: (open: boolean) => void;
  setShowLineNumbers: (show: boolean) => void;
  setAutoSave: (enabled: boolean) => void;
  
  // Actions - Session Conversion
  convertSessionToNotebook: (messages: SessionMessage[], sessionName: string, sessionId: string) => string;
  
  // Helpers
  getActiveNotebook: () => NotebookState | null;
  getNotebookCells: (notebookId: string) => NotebookCell[];
  getCellState: (notebookId: string, cellId: string) => CellState;
  getNextExecutableCell: (notebookId: string, afterCellId?: string) => string | null;
}

const defaultCellState: CellState = {
  isEditing: false,
  isFocused: false,
  isExecuting: false,
  isCollapsed: false,
  showOutput: true,
};

export const useNotebookStore = create<NotebookStoreState>()(
  persist(
    (set, get) => ({
      notebooks: {},
      activeNotebookId: null,
      availableKernels: [],
      runningKernels: {},
      isKernelPanelOpen: false,
      isNotebookListOpen: false,
      showLineNumbers: true,
      autoSave: true,
      autoSaveInterval: 30000,

      // Notebook Management
      createNotebook: (name = 'Untitled', path = '') => {
        const id = crypto.randomUUID();
        const document = createNotebook(name);
        const notebookState: NotebookState = {
          id,
          name,
          path: path || `/notebooks/${name}.ipynb`,
          document,
          isDirty: true,
          lastSaved: null,
          kernelId: null,
          kernelStatus: 'unknown',
          activeCellId: document.cells[0]?.id || null,
          selectedCellIds: [],
          cellStates: {},
          executionQueue: [],
        };
        
        set((state) => ({
          notebooks: { ...state.notebooks, [id]: notebookState },
          activeNotebookId: id,
        }));
        
        return id;
      },

      openNotebook: (id, document, path, name) => {
        const notebookState: NotebookState = {
          id,
          name,
          path,
          document,
          isDirty: false,
          lastSaved: new Date(),
          kernelId: null,
          kernelStatus: 'unknown',
          activeCellId: document.cells[0]?.id || null,
          selectedCellIds: [],
          cellStates: {},
          executionQueue: [],
        };
        
        set((state) => ({
          notebooks: { ...state.notebooks, [id]: notebookState },
          activeNotebookId: id,
        }));
      },

      closeNotebook: (id) => {
        set((state) => {
          const { [id]: _, ...rest } = state.notebooks;
          const newActiveId = state.activeNotebookId === id
            ? Object.keys(rest)[0] || null
            : state.activeNotebookId;
          return { notebooks: rest, activeNotebookId: newActiveId };
        });
      },

      setActiveNotebook: (id) => set({ activeNotebookId: id }),

      saveNotebook: (id) => {
        const notebook = get().notebooks[id];
        if (!notebook) return null;
        
        set((state) => ({
          notebooks: {
            ...state.notebooks,
            [id]: { ...notebook, isDirty: false, lastSaved: new Date() },
          },
        }));
        
        return notebook.document;
      },

      renameNotebook: (id, name) => {
        set((state) => {
          const notebook = state.notebooks[id];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [id]: {
                ...notebook,
                name,
                isDirty: true,
                document: {
                  ...notebook.document,
                  metadata: { ...notebook.document.metadata, title: name },
                },
              },
            },
          };
        });
      },

      importNotebook: (content, name, path) => {
        const id = crypto.randomUUID();
        const document = parseNotebook(content);
        
        const notebookState: NotebookState = {
          id,
          name,
          path,
          document,
          isDirty: false,
          lastSaved: new Date(),
          kernelId: null,
          kernelStatus: 'unknown',
          activeCellId: document.cells[0]?.id || null,
          selectedCellIds: [],
          cellStates: {},
          executionQueue: [],
        };
        
        set((state) => ({
          notebooks: { ...state.notebooks, [id]: notebookState },
          activeNotebookId: id,
        }));
        
        return id;
      },

      exportNotebook: (id) => {
        const notebook = get().notebooks[id];
        if (!notebook) return null;
        return serializeNotebook(notebook.document);
      },

      // Cell Management
      addCell: (notebookId, type, index) => {
        const cell = createCell(type);
        
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const cells = [...notebook.document.cells];
          const insertIndex = index !== undefined ? index : cells.length;
          cells.splice(insertIndex, 0, cell);
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
                activeCellId: cell.id,
              },
            },
          };
        });
        
        return cell.id;
      },

      deleteCell: (notebookId, cellId) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook || notebook.document.cells.length <= 1) return state;
          
          const cellIndex = notebook.document.cells.findIndex(c => c.id === cellId);
          if (cellIndex === -1) return state;
          
          const cells = notebook.document.cells.filter(c => c.id !== cellId);
          const newActiveCellId = notebook.activeCellId === cellId
            ? cells[Math.min(cellIndex, cells.length - 1)]?.id || null
            : notebook.activeCellId;
          
          const { [cellId]: _, ...cellStates } = notebook.cellStates;
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
                activeCellId: newActiveCellId,
                selectedCellIds: notebook.selectedCellIds.filter(id => id !== cellId),
                cellStates,
                executionQueue: notebook.executionQueue.filter(id => id !== cellId),
              },
            },
          };
        });
      },

      duplicateCell: (notebookId, cellId) => {
        const state = get();
        const notebook = state.notebooks[notebookId];
        if (!notebook) return null;
        
        const cellIndex = notebook.document.cells.findIndex(c => c.id === cellId);
        if (cellIndex === -1) return null;
        
        const originalCell = notebook.document.cells[cellIndex];
        const newCell: NotebookCell = {
          ...originalCell,
          id: crypto.randomUUID(),
          outputs: originalCell.cell_type === 'code' ? [] : undefined,
          execution_count: null,
        };
        
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const cells = [...notebook.document.cells];
          cells.splice(cellIndex + 1, 0, newCell);
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
                activeCellId: newCell.id,
              },
            },
          };
        });
        
        return newCell.id;
      },

      moveCell: (notebookId, cellId, direction) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const cells = [...notebook.document.cells];
          const index = cells.findIndex(c => c.id === cellId);
          if (index === -1) return state;
          
          const newIndex = direction === 'up' ? index - 1 : index + 1;
          if (newIndex < 0 || newIndex >= cells.length) return state;
          
          [cells[index], cells[newIndex]] = [cells[newIndex], cells[index]];
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
              },
            },
          };
        });
      },

      updateCellSource: (notebookId, cellId, source) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const cells = notebook.document.cells.map(cell =>
            cell.id === cellId ? { ...cell, source } : cell
          );
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
              },
            },
          };
        });
      },

      updateCellType: (notebookId, cellId, type) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const cells = notebook.document.cells.map(cell =>
            cell.id === cellId
              ? {
                  ...cell,
                  cell_type: type,
                  outputs: type === 'code' ? [] : undefined,
                  execution_count: type === 'code' ? null : undefined,
                }
              : cell
          );
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
              },
            },
          };
        });
      },

      mergeCells: (notebookId, cellIds) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook || cellIds.length < 2) return state;
          
          const cells = notebook.document.cells;
          const mergeCells = cellIds
            .map(id => cells.find(c => c.id === id))
            .filter(Boolean) as NotebookCell[];
          
          if (mergeCells.length < 2) return state;
          
          const firstCell = mergeCells[0];
          const mergedSource = mergeCells.map(c => c.source).join('\n\n');
          const mergedCell: NotebookCell = {
            ...firstCell,
            source: mergedSource,
            outputs: firstCell.cell_type === 'code' ? [] : undefined,
            execution_count: null,
          };
          
          const otherIds = cellIds.slice(1);
          const newCells = cells
            .filter(c => !otherIds.includes(c.id))
            .map(c => (c.id === firstCell.id ? mergedCell : c));
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells: newCells },
                activeCellId: firstCell.id,
                selectedCellIds: [firstCell.id],
              },
            },
          };
        });
      },

      splitCell: (notebookId, cellId, position) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const cellIndex = notebook.document.cells.findIndex(c => c.id === cellId);
          if (cellIndex === -1) return state;
          
          const cell = notebook.document.cells[cellIndex];
          const firstPart = cell.source.slice(0, position);
          const secondPart = cell.source.slice(position);
          
          const firstCell: NotebookCell = { ...cell, source: firstPart };
          const secondCell = createCell(cell.cell_type, secondPart);
          
          const cells = [...notebook.document.cells];
          cells.splice(cellIndex, 1, firstCell, secondCell);
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
                activeCellId: secondCell.id,
              },
            },
          };
        });
      },

      clearCellOutputs: (notebookId, cellId) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const cells = notebook.document.cells.map(cell =>
            cell.id === cellId && cell.cell_type === 'code'
              ? { ...cell, outputs: [], execution_count: null }
              : cell
          );
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
              },
            },
          };
        });
      },

      clearAllOutputs: (notebookId) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const cells = notebook.document.cells.map(cell =>
            cell.cell_type === 'code'
              ? { ...cell, outputs: [], execution_count: null }
              : cell
          );
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
              },
            },
          };
        });
      },

      // Cell Selection
      setActiveCell: (notebookId, cellId) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: { ...notebook, activeCellId: cellId },
            },
          };
        });
      },

      selectCell: (notebookId, cellId, addToSelection = false) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const selectedCellIds = addToSelection
            ? notebook.selectedCellIds.includes(cellId)
              ? notebook.selectedCellIds.filter(id => id !== cellId)
              : [...notebook.selectedCellIds, cellId]
            : [cellId];
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: { ...notebook, selectedCellIds, activeCellId: cellId },
            },
          };
        });
      },

      selectAllCells: (notebookId) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                selectedCellIds: notebook.document.cells.map(c => c.id),
              },
            },
          };
        });
      },

      clearSelection: (notebookId) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: { ...notebook, selectedCellIds: [] },
            },
          };
        });
      },

      // Cell State
      setCellEditing: (notebookId, cellId, isEditing) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                cellStates: {
                  ...notebook.cellStates,
                  [cellId]: { ...get().getCellState(notebookId, cellId), isEditing },
                },
              },
            },
          };
        });
      },

      setCellFocused: (notebookId, cellId, isFocused) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                cellStates: {
                  ...notebook.cellStates,
                  [cellId]: { ...get().getCellState(notebookId, cellId), isFocused },
                },
              },
            },
          };
        });
      },

      setCellCollapsed: (notebookId, cellId, isCollapsed) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                cellStates: {
                  ...notebook.cellStates,
                  [cellId]: { ...get().getCellState(notebookId, cellId), isCollapsed },
                },
              },
            },
          };
        });
      },

      toggleCellOutput: (notebookId, cellId) => {
        const currentState = get().getCellState(notebookId, cellId);
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                cellStates: {
                  ...notebook.cellStates,
                  [cellId]: { ...currentState, showOutput: !currentState.showOutput },
                },
              },
            },
          };
        });
      },

      // Execution
      queueCellExecution: (notebookId, cellId) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          if (notebook.executionQueue.includes(cellId)) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                executionQueue: [...notebook.executionQueue, cellId],
              },
            },
          };
        });
      },

      queueAllCells: (notebookId) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          const codeCellIds = notebook.document.cells
            .filter(c => c.cell_type === 'code')
            .map(c => c.id);
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: { ...notebook, executionQueue: codeCellIds },
            },
          };
        });
      },

      cancelExecution: (notebookId) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          // Clear execution state from all cells
          const cellStates = { ...notebook.cellStates };
          for (const cellId of notebook.executionQueue) {
            if (cellStates[cellId]) {
              cellStates[cellId] = { ...cellStates[cellId], isExecuting: false };
            }
          }
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: { ...notebook, executionQueue: [], cellStates },
            },
          };
        });
      },

      setCellExecuting: (notebookId, cellId, isExecuting) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                cellStates: {
                  ...notebook.cellStates,
                  [cellId]: { ...get().getCellState(notebookId, cellId), isExecuting },
                },
              },
            },
          };
        });
      },

      setCellOutputs: (notebookId, cellId, outputs) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const cells = notebook.document.cells.map(cell =>
            cell.id === cellId ? { ...cell, outputs } : cell
          );
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
              },
            },
          };
        });
      },

      appendCellOutput: (notebookId, cellId, output) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const cells = notebook.document.cells.map(cell =>
            cell.id === cellId
              ? { ...cell, outputs: [...(cell.outputs || []), output] }
              : cell
          );
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
              },
            },
          };
        });
      },

      setCellExecutionCount: (notebookId, cellId, count) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          
          const cells = notebook.document.cells.map(cell =>
            cell.id === cellId ? { ...cell, execution_count: count } : cell
          );
          
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: {
                ...notebook,
                isDirty: true,
                document: { ...notebook.document, cells },
              },
            },
          };
        });
      },

      dequeueCell: (notebookId) => {
        const notebook = get().notebooks[notebookId];
        if (!notebook || notebook.executionQueue.length === 0) return null;
        
        const [cellId, ...rest] = notebook.executionQueue;
        set((state) => ({
          notebooks: {
            ...state.notebooks,
            [notebookId]: { ...notebook, executionQueue: rest },
          },
        }));
        
        return cellId;
      },

      // Kernel Management
      setAvailableKernels: (kernels) => set({ availableKernels: kernels }),

      setKernelInfo: (kernelId, info) => {
        set((state) => ({
          runningKernels: { ...state.runningKernels, [kernelId]: info },
        }));
      },

      removeKernel: (kernelId) => {
        set((state) => {
          const { [kernelId]: _, ...rest } = state.runningKernels;
          return { runningKernels: rest };
        });
      },

      setNotebookKernel: (notebookId, kernelId) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: { ...notebook, kernelId },
            },
          };
        });
      },

      setKernelStatus: (notebookId, status) => {
        set((state) => {
          const notebook = state.notebooks[notebookId];
          if (!notebook) return state;
          return {
            notebooks: {
              ...state.notebooks,
              [notebookId]: { ...notebook, kernelStatus: status },
            },
          };
        });
      },

      // UI
      setKernelPanelOpen: (open) => set({ isKernelPanelOpen: open }),
      setNotebookListOpen: (open) => set({ isNotebookListOpen: open }),
      setShowLineNumbers: (show) => set({ showLineNumbers: show }),
      setAutoSave: (enabled) => set({ autoSave: enabled }),

      // Session Conversion
      convertSessionToNotebook: (messages, sessionName, sessionId) => {
        const id = sessionId;
        const document = sessionToNotebook(messages, sessionName);
        
        const notebookState: NotebookState = {
          id,
          name: `${sessionName} (Notebook)`,
          path: `/notebooks/${sessionName.replace(/[^a-zA-Z0-9]/g, '_')}.ipynb`,
          document,
          isDirty: true,
          lastSaved: null,
          kernelId: null,
          kernelStatus: 'unknown',
          activeCellId: document.cells[0]?.id || null,
          selectedCellIds: [],
          cellStates: {},
          executionQueue: [],
        };
        
        set((state) => ({
          notebooks: { ...state.notebooks, [id]: notebookState },
          activeNotebookId: id,
        }));
        
        return id;
      },

      // Helpers
      getActiveNotebook: () => {
        const state = get();
        return state.activeNotebookId ? state.notebooks[state.activeNotebookId] : null;
      },

      getNotebookCells: (notebookId) => {
        const notebook = get().notebooks[notebookId];
        return notebook?.document.cells || [];
      },

      getCellState: (notebookId, cellId) => {
        const notebook = get().notebooks[notebookId];
        return notebook?.cellStates[cellId] || { ...defaultCellState };
      },

      getNextExecutableCell: (notebookId, afterCellId) => {
        const notebook = get().notebooks[notebookId];
        if (!notebook) return null;
        
        const cells = notebook.document.cells;
        const startIndex = afterCellId
          ? cells.findIndex(c => c.id === afterCellId) + 1
          : 0;
        
        for (let i = startIndex; i < cells.length; i++) {
          if (cells[i].cell_type === 'code') {
            return cells[i].id;
          }
        }
        
        return null;
      },
    }),
    {
      name: 'alfie-notebook-storage',
      partialize: (state) => ({
        showLineNumbers: state.showLineNumbers,
        autoSave: state.autoSave,
        autoSaveInterval: state.autoSaveInterval,
      }),
    }
  )
);
