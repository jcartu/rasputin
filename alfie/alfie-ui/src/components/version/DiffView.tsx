'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GitCompare, 
  Plus, 
  Minus, 
  Edit3, 
  ArrowRight,
  X,
  Clock,
  User,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { 
  useVersionControl, 
  Snapshot,
  VersionDiff,
  DiffChange,
  ContentDiff as ContentDiffType,
} from '@/lib/version-control';
import { Message } from '@/lib/store';
import { format } from 'date-fns';

interface DiffViewProps {
  sessionId: string;
  onClose?: () => void;
}

export function DiffView({ sessionId, onClose }: DiffViewProps) {
  const selectedSnapshotId = useVersionControl(state => state.selectedSnapshotId);
  const comparisonSnapshotId = useVersionControl(state => state.comparisonSnapshotId);
  const compareSnapshots = useVersionControl(state => state.compareSnapshots);
  const getSnapshot = useVersionControl(state => state.getSnapshot);
  const toggleComparing = useVersionControl(state => state.toggleComparing);
  const selectSnapshot = useVersionControl(state => state.selectSnapshot);
  const setComparisonSnapshot = useVersionControl(state => state.setComparisonSnapshot);
  
  const diff = useMemo(() => {
    if (!selectedSnapshotId || !comparisonSnapshotId) return null;
    return compareSnapshots(selectedSnapshotId, comparisonSnapshotId);
  }, [selectedSnapshotId, comparisonSnapshotId, compareSnapshots]);
  
  const snapshotA = useMemo(() => {
    return selectedSnapshotId ? getSnapshot(selectedSnapshotId) : undefined;
  }, [selectedSnapshotId, getSnapshot]);
  
  const snapshotB = useMemo(() => {
    return comparisonSnapshotId ? getSnapshot(comparisonSnapshotId) : undefined;
  }, [comparisonSnapshotId, getSnapshot]);
  
  const handleClose = () => {
    toggleComparing(false);
    selectSnapshot(null);
    setComparisonSnapshot(null);
    onClose?.();
  };
  
  if (!selectedSnapshotId || !comparisonSnapshotId || !diff || !snapshotA || !snapshotB) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Compare Versions</h3>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <GitCompare className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">
              Select two snapshots to compare their differences
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Version Comparison</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <SnapshotBadge snapshotData={snapshotA} variant="removed" />
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <SnapshotBadge snapshotData={snapshotB} variant="added" />
        </div>
        
        <DiffSummary summary={diff.summary} />
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <AnimatePresence>
            {diff.changes.map((change) => (
              <motion.div
                key={`${change.path}-${change.messageId || 'root'}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <DiffChangeItem change={change} />
              </motion.div>
            ))}
          </AnimatePresence>
          
          {diff.changes.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No differences found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface SnapshotBadgeProps {
  snapshotData: Snapshot;
  variant: 'added' | 'removed';
}

function SnapshotBadge({ snapshotData, variant }: SnapshotBadgeProps) {
  return (
    <div className={cn(
      'flex-1 p-2 rounded-md border',
      variant === 'removed' 
        ? 'bg-red-500/10 border-red-500/30' 
        : 'bg-green-500/10 border-green-500/30'
    )}>
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium truncate">{snapshotData.label}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        {format(new Date(snapshotData.timestamp), 'MMM d, h:mm a')}
      </p>
    </div>
  );
}

interface DiffSummaryProps {
  summary: VersionDiff['summary'];
}

function DiffSummary({ summary }: DiffSummaryProps) {
  return (
    <div className="flex items-center gap-4 mt-3">
      {summary.messagesAdded > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">
            +{summary.messagesAdded} added
          </span>
        </div>
      )}
      {summary.messagesRemoved > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs text-muted-foreground">
            -{summary.messagesRemoved} removed
          </span>
        </div>
      )}
      {summary.messagesModified > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-xs text-muted-foreground">
            ~{summary.messagesModified} modified
          </span>
        </div>
      )}
      {summary.totalChanges === 0 && (
        <span className="text-xs text-muted-foreground">No changes</span>
      )}
    </div>
  );
}

interface DiffChangeItemProps {
  change: DiffChange;
}

function DiffChangeItem({ change }: DiffChangeItemProps) {
  const isMessageChange = change.path.startsWith('messages/');
  
  const icon = {
    added: Plus,
    removed: Minus,
    modified: Edit3,
  }[change.type];
  const Icon = icon;
  
  const colors = {
    added: 'border-green-500/30 bg-green-500/5',
    removed: 'border-red-500/30 bg-red-500/5',
    modified: 'border-yellow-500/30 bg-yellow-500/5',
  };
  
  const iconColors = {
    added: 'text-green-500 bg-green-500/20',
    removed: 'text-red-500 bg-red-500/20',
    modified: 'text-yellow-500 bg-yellow-500/20',
  };
  
  if (isMessageChange && (change.type === 'added' || change.type === 'removed')) {
    const message = (change.type === 'added' ? change.newValue : change.oldValue) as Message;
    return (
      <div className={cn('rounded-lg border p-3', colors[change.type])}>
        <div className="flex items-start gap-3">
          <div className={cn('p-1.5 rounded-md', iconColors[change.type])}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">
                {change.type === 'added' ? 'Added' : 'Removed'}
              </Badge>
              <span className="text-xs text-muted-foreground">Message</span>
            </div>
            <MessagePreview message={message} />
          </div>
        </div>
      </div>
    );
  }
  
  if (change.type === 'modified' && change.contentDiff) {
    return (
      <div className={cn('rounded-lg border p-3', colors[change.type])}>
        <div className="flex items-start gap-3">
          <div className={cn('p-1.5 rounded-md', iconColors[change.type])}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs">Modified</Badge>
              <span className="text-xs text-muted-foreground">
                {isMessageChange ? 'Message content' : change.path}
              </span>
            </div>
            <ContentDiffDisplay diff={change.contentDiff} />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn('rounded-lg border p-3', colors[change.type])}>
      <div className="flex items-start gap-3">
        <div className={cn('p-1.5 rounded-md', iconColors[change.type])}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs capitalize">
              {change.type}
            </Badge>
            <span className="text-xs text-muted-foreground">{change.path}</span>
          </div>
          {change.oldValue && (
            <div className="text-sm line-through text-muted-foreground">
              {String(change.oldValue)}
            </div>
          )}
          {change.newValue && (
            <div className="text-sm">
              {String(change.newValue)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MessagePreviewProps {
  message: Message;
}

function MessagePreview({ message }: MessagePreviewProps) {
  const RoleIcon = message.role === 'user' ? User : Bot;
  
  return (
    <div className="rounded-md border border-border bg-card/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <RoleIcon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium capitalize">{message.role}</span>
        {message.timestamp && (
          <span className="text-xs text-muted-foreground">
            {format(new Date(message.timestamp), 'h:mm a')}
          </span>
        )}
      </div>
      <p className="text-sm line-clamp-4">{message.content}</p>
    </div>
  );
}

interface ContentDiffDisplayProps {
  diff: ContentDiffType[];
}

function ContentDiffDisplay({ diff }: ContentDiffDisplayProps) {
  return (
    <div className="rounded-md border border-border bg-card/50 p-3 font-mono text-sm">
      {diff.map((part, idx) => (
        <span
          key={`${part.type}-${idx}-${part.value.substring(0, 10)}`}
          className={cn(
            part.type === 'insert' && 'bg-green-500/30 text-green-200',
            part.type === 'delete' && 'bg-red-500/30 text-red-200 line-through',
          )}
        >
          {part.value}
        </span>
      ))}
    </div>
  );
}

export function CompactDiffView({ 
  snapshotIdA, 
  snapshotIdB 
}: { 
  snapshotIdA: string; 
  snapshotIdB: string;
}) {
  const compareSnapshots = useVersionControl(state => state.compareSnapshots);
  
  const diff = useMemo(() => {
    return compareSnapshots(snapshotIdA, snapshotIdB);
  }, [snapshotIdA, snapshotIdB, compareSnapshots]);
  
  if (!diff) return null;
  
  return (
    <div className="space-y-2">
      <DiffSummary summary={diff.summary} />
      <Separator />
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {diff.changes.slice(0, 5).map((change) => (
          <DiffChangeItem key={`${change.path}-${change.messageId || 'root'}`} change={change} />
        ))}
        {diff.changes.length > 5 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            +{diff.changes.length - 5} more changes
          </p>
        )}
      </div>
    </div>
  );
}
