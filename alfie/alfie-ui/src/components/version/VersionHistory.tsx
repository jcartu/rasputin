'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, 
  GitBranch, 
  RotateCcw, 
  Eye,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  GitCompare,
  Clock,
  MessageSquare,
  Tag,
  MoreVertical
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  useVersionControl, 
  Snapshot, 
  Branch 
} from '@/lib/version-control';
import { useChatStore } from '@/lib/store';
import { formatDistanceToNow, format } from 'date-fns';

interface VersionHistoryProps {
  sessionId: string;
  onRollback?: (sessionState: { messages: unknown[]; name: string }) => void;
}

export function VersionHistory({ sessionId, onRollback }: VersionHistoryProps) {
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set(['main']));
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranchDialog, setShowNewBranchDialog] = useState(false);
  const [branchFromSnapshot, setBranchFromSnapshot] = useState<string | null>(null);
  
  const {
    getSessionSnapshots,
    getBranches,
    getActiveBranch,
    setActiveBranch,
    createBranch,
    deleteBranch,
    deleteSnapshot,
    rollbackToSnapshot,
    selectSnapshot,
    setComparisonSnapshot,
    toggleComparing,
    selectedSnapshotId,
    comparisonSnapshotId,
    isComparing,
  } = useVersionControl();
  
  const { sessions } = useChatStore();
  const currentSession = sessions.find(s => s.id === sessionId);
  
  const branches = getBranches(sessionId);
  const activeBranch = getActiveBranch(sessionId);
  
  const toggleBranchExpanded = (branchId: string) => {
    setExpandedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchId)) {
        next.delete(branchId);
      } else {
        next.add(branchId);
      }
      return next;
    });
  };
  
  const handleCreateBranch = () => {
    if (!newBranchName.trim()) return;
    createBranch(sessionId, newBranchName.trim(), branchFromSnapshot || undefined);
    setNewBranchName('');
    setBranchFromSnapshot(null);
    setShowNewBranchDialog(false);
  };
  
  const handleRollback = (snapshotId: string) => {
    const restored = rollbackToSnapshot(snapshotId);
    if (restored && onRollback) {
      onRollback({
        messages: restored.messages,
        name: restored.name,
      });
    }
  };
  
  const handleCompare = (snapshotId: string) => {
    if (!isComparing) {
      selectSnapshot(snapshotId);
      toggleComparing(true);
    } else if (!comparisonSnapshotId) {
      setComparisonSnapshot(snapshotId);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Version History</h3>
          </div>
          <Dialog open={showNewBranchDialog} onOpenChange={setShowNewBranchDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="w-3 h-3" />
                Branch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Branch</DialogTitle>
                <DialogDescription>
                  Create a new timeline branch from the current state or a specific snapshot.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="branch-name">Branch Name</Label>
                  <Input
                    id="branch-name"
                    placeholder="feature/experiment"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewBranchDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateBranch} disabled={!newBranchName.trim()}>
                  Create Branch
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {isComparing && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
            <GitCompare className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary">
              {comparisonSnapshotId ? 'Comparing snapshots' : 'Select second snapshot to compare'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 px-2"
              onClick={() => {
                toggleComparing(false);
                selectSnapshot(null);
                setComparisonSnapshot(null);
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2">
          {branches.length === 0 ? (
            <EmptyState onCreateSnapshot={() => {
              if (currentSession) {
                const { createSnapshot } = useVersionControl.getState();
                createSnapshot(sessionId, currentSession, 'manual', 'Initial snapshot');
              }
            }} />
          ) : (
            <div className="space-y-2">
              {branches.map((branch) => (
                <BranchSection
                  key={branch.id}
                  branch={branch}
                  isActive={activeBranch?.id === branch.id}
                  isExpanded={expandedBranches.has(branch.id)}
                  snapshots={getSessionSnapshots(sessionId, branch.id)}
                  selectedSnapshotId={selectedSnapshotId}
                  comparisonSnapshotId={comparisonSnapshotId}
                  isComparing={isComparing}
                  onToggleExpand={() => toggleBranchExpanded(branch.id)}
                  onActivate={() => setActiveBranch(sessionId, branch.id)}
                  onDelete={() => deleteBranch(branch.id)}
                  onSnapshotSelect={selectSnapshot}
                  onSnapshotDelete={deleteSnapshot}
                  onSnapshotRollback={handleRollback}
                  onSnapshotCompare={handleCompare}
                  onBranchFromSnapshot={(snapshotId) => {
                    setBranchFromSnapshot(snapshotId);
                    setShowNewBranchDialog(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface BranchSectionProps {
  branch: Branch;
  isActive: boolean;
  isExpanded: boolean;
  snapshots: Snapshot[];
  selectedSnapshotId: string | null;
  comparisonSnapshotId: string | null;
  isComparing: boolean;
  onToggleExpand: () => void;
  onActivate: () => void;
  onDelete: () => void;
  onSnapshotSelect: (id: string | null) => void;
  onSnapshotDelete: (id: string) => void;
  onSnapshotRollback: (id: string) => void;
  onSnapshotCompare: (id: string) => void;
  onBranchFromSnapshot: (id: string) => void;
}

function BranchSection({
  branch,
  isActive,
  isExpanded,
  snapshots,
  selectedSnapshotId,
  comparisonSnapshotId,
  isComparing,
  onToggleExpand,
  onActivate,
  onDelete,
  onSnapshotSelect,
  onSnapshotDelete,
  onSnapshotRollback,
  onSnapshotCompare,
  onBranchFromSnapshot,
}: BranchSectionProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpand}
        className={cn(
          'w-full flex items-center gap-2 p-3 hover:bg-muted/50 transition-colors',
          isActive && 'bg-primary/5'
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: branch.color }}
        />
        <GitBranch className="w-4 h-4" style={{ color: branch.color }} />
        <span className="font-medium text-sm flex-1 text-left">{branch.name}</span>
        {isActive && (
          <Badge variant="secondary" className="text-xs">
            active
          </Badge>
        )}
        <Badge variant="outline" className="text-xs">
          {snapshots.length}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isActive && (
              <DropdownMenuItem onClick={onActivate}>
                Switch to branch
              </DropdownMenuItem>
            )}
            {!branch.isDefault && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete branch
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative pl-6 pr-3 pb-3">
              <div 
                className="absolute left-6 top-0 bottom-3 w-0.5 rounded-full"
                style={{ backgroundColor: `${branch.color}30` }}
              />
              
              {snapshots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No snapshots yet
                </p>
              ) : (
                <div className="space-y-1">
                  {snapshots.map((snapshot, index) => (
                    <SnapshotItem
                      key={snapshot.id}
                      snapshot={snapshot}
                      branchColor={branch.color}
                      isSelected={selectedSnapshotId === snapshot.id}
                      isComparisonTarget={comparisonSnapshotId === snapshot.id}
                      isComparing={isComparing}
                      isLatest={index === 0}
                      onSelect={() => onSnapshotSelect(snapshot.id)}
                      onDelete={() => onSnapshotDelete(snapshot.id)}
                      onRollback={() => onSnapshotRollback(snapshot.id)}
                      onCompare={() => onSnapshotCompare(snapshot.id)}
                      onBranchFrom={() => onBranchFromSnapshot(snapshot.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SnapshotItemProps {
  snapshot: Snapshot;
  branchColor: string;
  isSelected: boolean;
  isComparisonTarget: boolean;
  isComparing: boolean;
  isLatest: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRollback: () => void;
  onCompare: () => void;
  onBranchFrom: () => void;
}

function SnapshotItem({
  snapshot,
  branchColor,
  isSelected,
  isComparisonTarget,
  isComparing,
  isLatest,
  onSelect,
  onDelete,
  onRollback,
  onCompare,
  onBranchFrom,
}: SnapshotItemProps) {
  const typeIcons = {
    auto: Clock,
    manual: Tag,
    branch: GitBranch,
    merge: GitCompare,
  };
  const TypeIcon = typeIcons[snapshot.type];
  
  const timeAgo = formatDistanceToNow(new Date(snapshot.timestamp), { addSuffix: true });
  const fullTime = format(new Date(snapshot.timestamp), 'MMM d, yyyy h:mm a');
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'relative group flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors',
        isSelected && 'bg-primary/10 border border-primary/30',
        isComparisonTarget && 'bg-accent/10 border border-accent/30',
        !isSelected && !isComparisonTarget && 'hover:bg-muted/50'
      )}
      onClick={isComparing ? onCompare : onSelect}
    >
      <div className="relative z-10 mt-1">
        <div 
          className={cn(
            'w-3 h-3 rounded-full border-2 transition-colors',
            isLatest ? 'bg-white' : 'bg-card'
          )}
          style={{ 
            borderColor: branchColor,
            boxShadow: isLatest ? `0 0 8px ${branchColor}` : undefined
          }}
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <TypeIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-medium truncate">{snapshot.label}</span>
          {isLatest && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              HEAD
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground" title={fullTime}>
            {timeAgo}
          </span>
          <span className="text-xs text-muted-foreground/60">
            <MessageSquare className="w-3 h-3 inline mr-1" />
            {snapshot.sessionState.messages.length}
          </span>
        </div>
        
        {snapshot.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {snapshot.description}
          </p>
        )}
      </div>
      
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); onRollback(); }}
          title="Restore this version"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); onCompare(); }}
          title="Compare"
        >
          <GitCompare className="w-3.5 h-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSelect}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onBranchFrom}>
              <GitBranch className="w-4 h-4 mr-2" />
              Branch from here
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete snapshot
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

interface EmptyStateProps {
  onCreateSnapshot: () => void;
}

function EmptyState({ onCreateSnapshot }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
        <History className="w-8 h-8 text-primary" />
      </div>
      <h4 className="font-medium mb-2">No Version History</h4>
      <p className="text-sm text-muted-foreground mb-4 max-w-[240px]">
        Create your first snapshot to start tracking session history like Time Machine.
      </p>
      <Button onClick={onCreateSnapshot} className="gap-2">
        <Plus className="w-4 h-4" />
        Create Snapshot
      </Button>
    </motion.div>
  );
}
