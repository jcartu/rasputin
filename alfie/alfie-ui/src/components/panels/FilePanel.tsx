'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  FileCode, 
  FileJson, 
  ChevronRight,
  RefreshCw,
  Search,
  GitCompare,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFileStore, type FileNode } from '@/lib/store';
import { useWebSocket } from '@/lib/websocket';
import { useDiffViewerStore } from '@/lib/diff-viewer';
import { DiffViewer } from '@/components/diff-viewer';
import { cn } from '@/lib/utils';

export function FilePanel() {
  const { files, selectedFile, expandedPaths, selectFile, toggleExpanded } = useFileStore();
  const { requestFileTree, isConnected } = useWebSocket();
  const { isOpen, closeDiffViewer, openDiffViewer } = useDiffViewerStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [diffContent, setDiffContent] = useState<{ old: string; new: string; path: string } | null>(null);

  useEffect(() => {
    if (isConnected && files.length === 0) {
      requestFileTree();
    }
  }, [isConnected, files.length, requestFileTree]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    requestFileTree();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const filterFiles = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query) return nodes;
    
    return nodes.reduce<FileNode[]>((acc, node) => {
      if (node.name.toLowerCase().includes(query.toLowerCase())) {
        acc.push(node);
      } else if (node.children) {
        const filtered = filterFiles(node.children, query);
        if (filtered.length > 0) {
          acc.push({ ...node, children: filtered, expanded: true });
        }
      }
      return acc;
    }, []);
  };

  const handleCompareToggle = (path: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(path)) {
        return prev.filter(p => p !== path);
      }
      if (prev.length >= 2) {
        return [prev[1], path];
      }
      return [...prev, path];
    });
  };

  const handleStartCompare = () => {
    if (selectedForCompare.length === 2) {
      setDiffContent({
        old: `File: ${selectedForCompare[0]}\n\nThis is a placeholder for the old file content.\nIn a real implementation, this would load the actual file content.`,
        new: `File: ${selectedForCompare[1]}\n\nThis is a placeholder for the new file content.\nIn a real implementation, this would load the actual file content.`,
        path: selectedForCompare[1],
      });
      setShowDiffDialog(true);
    }
  };

  const handleExitCompareMode = () => {
    setCompareMode(false);
    setSelectedForCompare([]);
  };

  const filteredFiles = filterFiles(files, searchQuery);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Folder className="w-4 h-4 text-primary" />
            Workspace
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant={compareMode ? "secondary" : "ghost"}
              size="icon"
              className="w-8 h-8"
              onClick={() => compareMode ? handleExitCompareMode() : setCompareMode(true)}
              title={compareMode ? "Exit compare mode" : "Compare files"}
            >
              {compareMode ? (
                <X className="w-4 h-4" />
              ) : (
                <GitCompare className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={handleRefresh}
              disabled={!isConnected}
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {compareMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-2 rounded-lg bg-primary/10 border border-primary/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-primary">Compare Mode</span>
              <Badge variant="outline" className="text-xs">
                {selectedForCompare.length}/2 selected
              </Badge>
            </div>
            {selectedForCompare.length === 2 && (
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleStartCompare}
              >
                <GitCompare className="w-3 h-3 mr-1" />
                Compare Files
              </Button>
            )}
          </motion.div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {files.length === 0 
                  ? 'Connect to view workspace files'
                  : 'No files match your search'}
              </p>
            </div>
          ) : (
            <FileTree
              nodes={filteredFiles}
              selectedFile={selectedFile}
              expandedPaths={expandedPaths}
              onSelect={selectFile}
              onToggle={toggleExpanded}
              depth={0}
              compareMode={compareMode}
              selectedForCompare={selectedForCompare}
              onCompareToggle={handleCompareToggle}
            />
          )}
        </div>
      </ScrollArea>

      <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
        <DialogContent className="max-w-6xl h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>File Diff Viewer</DialogTitle>
          </DialogHeader>
          {diffContent && (
            <DiffViewer
              oldContent={diffContent.old}
              newContent={diffContent.new}
              filePath={diffContent.path}
              onClose={() => setShowDiffDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FileTreeProps {
  nodes: FileNode[];
  selectedFile: string | null;
  expandedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  depth: number;
  compareMode?: boolean;
  selectedForCompare?: string[];
  onCompareToggle?: (path: string) => void;
}

function FileTree({ 
  nodes, 
  selectedFile, 
  expandedPaths, 
  onSelect, 
  onToggle, 
  depth,
  compareMode,
  selectedForCompare,
  onCompareToggle,
}: FileTreeProps) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          selectedFile={selectedFile}
          expandedPaths={expandedPaths}
          onSelect={onSelect}
          onToggle={onToggle}
          depth={depth}
          compareMode={compareMode}
          selectedForCompare={selectedForCompare}
          onCompareToggle={onCompareToggle}
        />
      ))}
    </div>
  );
}

interface FileTreeNodeProps {
  node: FileNode;
  selectedFile: string | null;
  expandedPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  depth: number;
  compareMode?: boolean;
  selectedForCompare?: string[];
  onCompareToggle?: (path: string) => void;
}

function FileTreeNode({ 
  node, 
  selectedFile, 
  expandedPaths, 
  onSelect, 
  onToggle, 
  depth,
  compareMode,
  selectedForCompare,
  onCompareToggle,
}: FileTreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path) || node.expanded;
  const isSelected = selectedFile === node.path;
  const isDirectory = node.type === 'directory';

  const handleClick = () => {
    if (isDirectory) {
      onToggle(node.path);
    } else {
      onSelect(node.path);
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return FileCode;
      case 'json':
        return FileJson;
      default:
        return FileText;
    }
  };

  const FileIcon = isDirectory 
    ? (isExpanded ? FolderOpen : Folder)
    : getFileIcon(node.name);

  const isSelectedForCompare = selectedForCompare?.includes(node.path);

  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCompareToggle && !isDirectory) {
      onCompareToggle(node.path);
    }
  };

  return (
    <div>
      <motion.button
        type="button"
        onClick={compareMode && !isDirectory ? handleCompareClick : handleClick}
        className={cn(
          'w-full flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors text-left',
          isSelected && !compareMode
            ? 'bg-primary/10 text-primary'
            : isSelectedForCompare
            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30'
            : 'hover:bg-muted/50 text-foreground'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
      >
        {compareMode && !isDirectory ? (
          isSelectedForCompare ? (
            <CheckSquare className="w-4 h-4 text-green-500 flex-shrink-0" />
          ) : (
            <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )
        ) : isDirectory ? (
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </motion.span>
        ) : null}
        <FileIcon className={cn(
          'w-4 h-4 flex-shrink-0',
          isDirectory ? 'text-amber-500' : 'text-muted-foreground'
        )} />
        <span className="truncate flex-1">{node.name}</span>
        {isSelectedForCompare && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-green-500/50 text-green-600">
            {selectedForCompare?.indexOf(node.path) === 0 ? 'Old' : 'New'}
          </Badge>
        )}
      </motion.button>

      <AnimatePresence>
        {isDirectory && isExpanded && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <FileTree
              nodes={node.children}
              selectedFile={selectedFile}
              expandedPaths={expandedPaths}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
              compareMode={compareMode}
              selectedForCompare={selectedForCompare}
              onCompareToggle={onCompareToggle}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
