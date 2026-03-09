'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import {
  Plus,
  Play,
  Save,
  Download,
  Upload,
  FileCode,
  FileText,
  Trash2,
  MoreHorizontal,
  ChevronDown,
  FolderOpen,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeCell } from './CodeCell';
import { MarkdownCell } from './MarkdownCell';
import { KernelSelector } from './KernelSelector';
import { useNotebookStore } from '@/lib/notebook/store';
import { useChatStore } from '@/lib/store';
import type { NotebookListItem } from '@/lib/notebook/types';

export const NotebookPanel = memo(function NotebookPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notebookList, setNotebookList] = useState<NotebookListItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const {
    notebooks,
    activeNotebookId,
    showLineNumbers,
    createNotebook,
    closeNotebook,
    setActiveNotebook,
    saveNotebook,
    exportNotebook,
    importNotebook,
    addCell,
    queueCellExecution,
    queueAllCells,
    cancelExecution,
    setCellExecuting,
    setCellOutputs,
    appendCellOutput,
    setCellExecutionCount,
    setNotebookKernel,
    setKernelStatus,
    clearAllOutputs,
    convertSessionToNotebook,
    getCellState,
  } = useNotebookStore();

  const { sessions, activeSessionId } = useChatStore();
  const activeNotebook = activeNotebookId ? notebooks[activeNotebookId] : null;

   const fetchNotebookList = useCallback(async () => {
     setIsLoadingList(true);
     try {
       const response = await fetch(`${API_BASE}/api/notebooks`);
      if (response.ok) {
        const data = await response.json();
        setNotebookList(data);
      }
    } catch (err) {
      console.error('Failed to fetch notebooks:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchNotebookList();
  }, [fetchNotebookList]);

  const handleCreateNotebook = useCallback(() => {
    createNotebook();
  }, [createNotebook]);

   const handleOpenNotebook = useCallback(async (item: NotebookListItem) => {
     try {
       const response = await fetch(`${API_BASE}/api/notebooks/${item.name}`);
      if (response.ok) {
        const document = await response.json();
        const id = crypto.randomUUID();
        useNotebookStore.getState().openNotebook(id, document, item.path, item.name);
      }
    } catch (err) {
      console.error('Failed to open notebook:', err);
    }
  }, []);

  const handleSaveNotebook = useCallback(async () => {
    if (!activeNotebook) return;
    
    const document = saveNotebook(activeNotebook.id);
    if (!document) return;

     try {
       await fetch(`${API_BASE}/api/notebooks/${activeNotebook.name}`, {
         method: 'PUT',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ content: document }),
       });
    } catch (err) {
      console.error('Failed to save notebook:', err);
    }
  }, [activeNotebook, saveNotebook]);

  const handleExportNotebook = useCallback(() => {
    if (!activeNotebook) return;
    
    const content = exportNotebook(activeNotebook.id);
    if (!content) return;

    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNotebook.name}.ipynb`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeNotebook, exportNotebook]);

  const handleImportNotebook = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const name = file.name.replace('.ipynb', '');
      
       const response = await fetch(`${API_BASE}/api/notebooks/import`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ content, name }),
       });

      if (response.ok) {
        const data = await response.json();
        importNotebook(JSON.stringify(data.content), data.name, data.path);
        fetchNotebookList();
      }
    } catch (err) {
      console.error('Failed to import notebook:', err);
    }

    e.target.value = '';
  }, [importNotebook, fetchNotebookList]);

  const handleConvertSession = useCallback(async () => {
    if (!activeSessionId) return;
    
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;

     try {
       const response = await fetch(`${API_BASE}/api/notebooks/from-session`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           messages: session.messages.map(m => ({
             role: m.role,
             content: m.content,
           })),
           sessionName: session.name,
           sessionId: session.id,
         }),
       });

      if (response.ok) {
        const data = await response.json();
        convertSessionToNotebook(
          session.messages.map(m => ({ role: m.role, content: m.content })),
          session.name,
          data.name
        );
        fetchNotebookList();
      }
    } catch (err) {
      console.error('Failed to convert session:', err);
    }
  }, [activeSessionId, sessions, convertSessionToNotebook, fetchNotebookList]);

  const handleAddCodeCell = useCallback(() => {
    if (!activeNotebook) return;
    addCell(activeNotebook.id, 'code');
  }, [activeNotebook, addCell]);

  const handleAddMarkdownCell = useCallback(() => {
    if (!activeNotebook) return;
    addCell(activeNotebook.id, 'markdown');
  }, [activeNotebook, addCell]);

  const handleClearAllOutputs = useCallback(() => {
    if (!activeNotebook) return;
    clearAllOutputs(activeNotebook.id);
  }, [activeNotebook, clearAllOutputs]);

  const handleStartKernel = useCallback(async (specName: string) => {
    if (!activeNotebook) return;

     try {
       const response = await fetch(`${API_BASE}/api/notebooks/kernels`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ name: specName }),
       });

      if (response.ok) {
        const kernel = await response.json();
        setNotebookKernel(activeNotebook.id, kernel.id);
        setKernelStatus(activeNotebook.id, kernel.status);
      }
    } catch (err) {
      console.error('Failed to start kernel:', err);
    }
  }, [activeNotebook, setNotebookKernel, setKernelStatus]);

  const handleStopKernel = useCallback(async () => {
    if (!activeNotebook?.kernelId) return;

     try {
       await fetch(`${API_BASE}/api/notebooks/kernels/${activeNotebook.kernelId}`, {
         method: 'DELETE',
       });
      setNotebookKernel(activeNotebook.id, null);
      setKernelStatus(activeNotebook.id, 'unknown');
    } catch (err) {
      console.error('Failed to stop kernel:', err);
    }
  }, [activeNotebook, setNotebookKernel, setKernelStatus]);

  const handleRestartKernel = useCallback(async () => {
    if (!activeNotebook?.kernelId) return;

     setKernelStatus(activeNotebook.id, 'restarting');
     try {
       const response = await fetch(`${API_BASE}/api/notebooks/kernels/${activeNotebook.kernelId}/restart`, {
         method: 'POST',
       });

      if (response.ok) {
        const kernel = await response.json();
        setKernelStatus(activeNotebook.id, kernel.status);
      }
    } catch (err) {
      console.error('Failed to restart kernel:', err);
      setKernelStatus(activeNotebook.id, 'dead');
    }
  }, [activeNotebook, setKernelStatus]);

  const handleInterruptKernel = useCallback(async () => {
    if (!activeNotebook?.kernelId) return;

     try {
       await fetch(`${API_BASE}/api/notebooks/kernels/${activeNotebook.kernelId}/interrupt`, {
         method: 'POST',
       });
      cancelExecution(activeNotebook.id);
    } catch (err) {
      console.error('Failed to interrupt kernel:', err);
    }
  }, [activeNotebook, cancelExecution]);

  const executeCell = useCallback(async (cellId: string) => {
    if (!activeNotebook?.kernelId) {
      console.warn('No kernel connected');
      return;
    }

    const cell = activeNotebook.document.cells.find(c => c.id === cellId);
    if (!cell || cell.cell_type !== 'code') return;

    setCellExecuting(activeNotebook.id, cellId, true);
    setCellOutputs(activeNotebook.id, cellId, []);
    setKernelStatus(activeNotebook.id, 'busy');

     try {
       const response = await fetch(`${API_BASE}/api/notebooks/kernels/${activeNotebook.kernelId}/execute`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ code: cell.source, cellId }),
       });

      if (response.ok) {
        const result = await response.json();
        setCellOutputs(activeNotebook.id, cellId, result.outputs);
        setCellExecutionCount(activeNotebook.id, cellId, result.executionCount);
      }
    } catch (err) {
      console.error('Failed to execute cell:', err);
      appendCellOutput(activeNotebook.id, cellId, {
        output_type: 'error',
        ename: 'ExecutionError',
        evalue: String(err),
        traceback: [String(err)],
      });
    } finally {
      setCellExecuting(activeNotebook.id, cellId, false);
      setKernelStatus(activeNotebook.id, 'idle');
    }
  }, [activeNotebook, setCellExecuting, setCellOutputs, setCellExecutionCount, appendCellOutput, setKernelStatus]);

  const processExecutionQueue = useCallback(async (notebookId: string) => {
    const notebook = useNotebookStore.getState().notebooks[notebookId];
    if (!notebook) return;

    for (const cellId of notebook.executionQueue) {
      const currentNotebook = useNotebookStore.getState().notebooks[notebookId];
      if (!currentNotebook || currentNotebook.executionQueue.length === 0) break;
      
      await executeCell(cellId);
      useNotebookStore.getState().dequeueCell(notebookId);
    }
  }, [executeCell]);

  const handleRunAll = useCallback(() => {
    if (!activeNotebook) return;
    queueAllCells(activeNotebook.id);
    processExecutionQueue(activeNotebook.id);
  }, [activeNotebook, queueAllCells, processExecutionQueue]);

  const handleCellExecute = useCallback((cellId: string) => {
    if (!activeNotebook) return;
    queueCellExecution(activeNotebook.id, cellId);
    processExecutionQueue(activeNotebook.id);
  }, [activeNotebook, queueCellExecution, processExecutionQueue]);

  if (!activeNotebook) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Notebooks
            </h2>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={handleCreateNotebook}>
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
              <Button size="sm" variant="ghost" onClick={handleImportNotebook}>
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
            </div>
          </div>
          
          {activeSessionId && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={handleConvertSession}
            >
              <FileCode className="h-4 w-4 mr-2" />
              Convert Current Session to Notebook
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {isLoadingList ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : notebookList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notebooks yet</p>
            ) : (
              notebookList.map((item) => (
                <button
                  type="button"
                  key={item.path}
                  className="w-full text-left p-2 rounded hover:bg-muted/50 transition-colors"
                  onClick={() => handleOpenNotebook(item)}
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-orange-500" />
                    <span className="text-sm truncate">{item.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(item.lastModified).toLocaleDateString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        <input
          ref={fileInputRef}
          type="file"
          accept=".ipynb"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2">
                  <FolderOpen className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{activeNotebook.name}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {Object.values(notebooks).map((nb) => (
                  <DropdownMenuItem
                    key={nb.id}
                    onClick={() => setActiveNotebook(nb.id)}
                    className={nb.id === activeNotebookId ? 'bg-muted' : ''}
                  >
                    <FileCode className="h-4 w-4 mr-2" />
                    {nb.name}
                    {nb.isDirty && <span className="ml-1 text-yellow-500">*</span>}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCreateNotebook}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Notebook
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => closeNotebook(activeNotebook.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Close
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {activeNotebook.isDirty && (
              <span className="text-xs text-yellow-500">Unsaved</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveNotebook}>
              <Save className="h-3 w-3" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Cell
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={handleAddCodeCell}>
                      <FileCode className="h-4 w-4 mr-2" />
                      Code
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleAddMarkdownCell}>
                      <FileText className="h-4 w-4 mr-2" />
                      Markdown
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={handleRunAll}>
                  <Play className="h-4 w-4 mr-2" />
                  Run All Cells
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearAllOutputs}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All Outputs
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportNotebook}>
                  <Download className="h-4 w-4 mr-2" />
                  Download .ipynb
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <KernelSelector
            notebookId={activeNotebook.id}
            onStartKernel={handleStartKernel}
            onStopKernel={handleStopKernel}
            onRestartKernel={handleRestartKernel}
            onInterruptKernel={handleInterruptKernel}
          />
          
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7" onClick={handleAddCodeCell}>
              <Plus className="h-3 w-3 mr-1" />
              Code
            </Button>
            <Button size="sm" variant="outline" className="h-7" onClick={handleAddMarkdownCell}>
              <Plus className="h-3 w-3 mr-1" />
              MD
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {activeNotebook.document.cells.map((cell) => {
            const cellState = getCellState(activeNotebook.id, cell.id);
            const isActive = activeNotebook.activeCellId === cell.id;
            const isSelected = activeNotebook.selectedCellIds.includes(cell.id);

            if (cell.cell_type === 'code') {
              return (
                <CodeCell
                  key={cell.id}
                  notebookId={activeNotebook.id}
                  cell={cell}
                  cellState={cellState}
                  isActive={isActive}
                  isSelected={isSelected}
                  onExecute={() => handleCellExecute(cell.id)}
                  showLineNumbers={showLineNumbers}
                />
              );
            }

            if (cell.cell_type === 'markdown') {
              return (
                <MarkdownCell
                  key={cell.id}
                  notebookId={activeNotebook.id}
                  cell={cell}
                  cellState={cellState}
                  isActive={isActive}
                  isSelected={isSelected}
                />
              );
            }

            return null;
          })}

          <button
            type="button"
            className="w-full py-3 border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            onClick={handleAddCodeCell}
          >
            <Plus className="h-4 w-4 inline mr-2" />
            Add Cell
          </button>
        </div>
      </ScrollArea>

      <input
        ref={fileInputRef}
        type="file"
        accept=".ipynb"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
});
