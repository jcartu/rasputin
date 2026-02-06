'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Calendar,
  Clock,
  Star,
  StarOff,
  Trash2,
  Download,
  Tag,
  Filter,
  ChevronRight,
  FileText,
  Users,
  ListChecks,
  X,
  Plus,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useMeetingStore } from '@/stores/meetingStore';
import type { Meeting } from '@/types/meeting';

interface MeetingLibraryProps {
  onSelectMeeting?: (meeting: Meeting) => void;
  onNewMeeting?: () => void;
}

export function MeetingLibrary({ onSelectMeeting, onNewMeeting }: MeetingLibraryProps) {
  const {
    meetings,
    filter,
    setFilter,
    clearFilter,
    getFilteredMeetings,
    toggleFavorite,
    deleteMeeting,
    exportMeeting,
    addTag,
    removeTag,
    refreshStats,
    stats,
  } = useMeetingStore();

  const [showFilters, setShowFilters] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const filteredMeetings = useMemo(() => getFilteredMeetings(), [getFilteredMeetings]);

  const handleExport = async (meetingId: string, format: 'json' | 'txt' | 'pdf' | 'docx') => {
    try {
      const blob = await exportMeeting(meetingId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-${meetingId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const statusColors: Record<Meeting['status'], string> = {
    scheduled: 'bg-blue-500/10 text-blue-500',
    recording: 'bg-red-500/10 text-red-500',
    processing: 'bg-yellow-500/10 text-yellow-500',
    completed: 'bg-green-500/10 text-green-500',
    failed: 'bg-destructive/10 text-destructive',
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    meetings.forEach(m => {
      m.tags.forEach(t => {
        tags.add(t);
      });
    });
    return Array.from(tags);
  }, [meetings]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Meeting Library</h2>
          <Button onClick={onNewMeeting} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Meeting
          </Button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search meetings..."
              value={filter.search || ''}
              onChange={(e) => setFilter({ search: e.target.value })}
              className="pl-9"
            />
          </div>
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={filter.isFavorite ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setFilter({ isFavorite: filter.isFavorite ? undefined : true })}
                  >
                    <Star className="w-3 h-3 mr-1" />
                    Favorites
                  </Badge>
                  <Badge
                    variant={filter.hasSummary ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setFilter({ hasSummary: filter.hasSummary ? undefined : true })}
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    With Summary
                  </Badge>
                  {filter.status?.map(status => (
                    <Badge
                      key={status}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => setFilter({
                        status: filter.status?.filter(s => s !== status)
                      })}
                    >
                      {status}
                      <X className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>

                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {allTags.map(tag => (
                      <Badge
                        key={tag}
                        variant={filter.tags?.includes(tag) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => {
                          const currentTags = filter.tags || [];
                          setFilter({
                            tags: currentTags.includes(tag)
                              ? currentTags.filter(t => t !== tag)
                              : [...currentTags, tag]
                          });
                        }}
                      >
                        <Tag className="w-2.5 h-2.5 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <Button variant="ghost" size="sm" onClick={clearFilter}>
                  Clear filters
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{stats.totalMeetings} meetings</span>
          <span>{formatDuration(stats.totalDuration)} total</span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredMeetings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No meetings found</p>
              {Object.keys(filter).length > 0 && (
                <Button variant="link" onClick={clearFilter}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            filteredMeetings.map((meeting) => (
              <motion.div
                key={meeting.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  'p-4 rounded-lg border cursor-pointer transition-colors',
                  selectedMeetingId === meeting.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                )}
                onClick={() => {
                  setSelectedMeetingId(meeting.id);
                  onSelectMeeting?.(meeting);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{meeting.title}</h3>
                      <Badge className={cn('text-xs', statusColors[meeting.status])}>
                        {meeting.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(meeting.startTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(meeting.durationMs)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {meeting.speakers.length}
                      </span>
                      {meeting.summary && (
                        <span className="flex items-center gap-1">
                          <ListChecks className="w-3.5 h-3.5" />
                          {meeting.summary.actionItems.length}
                        </span>
                      )}
                    </div>
                    {meeting.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {meeting.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {meeting.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{meeting.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(meeting.id);
                          }}
                        >
                          {meeting.isFavorite ? (
                            <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                          ) : (
                            <StarOff className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {meeting.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      </TooltipContent>
                    </Tooltip>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExport(meeting.id, 'txt')}>
                          <Download className="w-4 h-4 mr-2" />
                          Export as Text
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(meeting.id, 'json')}>
                          <Download className="w-4 h-4 mr-2" />
                          Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(meeting.id, 'pdf')}>
                          <Download className="w-4 h-4 mr-2" />
                          Export as PDF
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMeeting(meeting.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface MeetingDetailProps {
  meeting: Meeting;
  onClose?: () => void;
}

export function MeetingDetail({ meeting, onClose }: MeetingDetailProps) {
  const { updateSummary, addActionItem, updateActionItem, deleteActionItem } = useMeetingStore();
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary' | 'actions'>('summary');
  const [newActionText, setNewActionText] = useState('');

  const formatTimestamp = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const handleAddAction = () => {
    if (newActionText.trim() && meeting.summary) {
      addActionItem(meeting.id, {
        text: newActionText.trim(),
        priority: 'medium',
        status: 'pending',
      });
      setNewActionText('');
    }
  };

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'transcript', label: 'Transcript', icon: FileText },
    { id: 'actions', label: 'Action Items', icon: ListChecks },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold">{meeting.title}</h2>
          <p className="text-sm text-muted-foreground">
            {new Date(meeting.startTime).toLocaleDateString()} • {meeting.speakers.length} participants
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 p-4">
        {activeTab === 'summary' && meeting.summary && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">Overview</h3>
              <p className="text-sm text-muted-foreground">{meeting.summary.overview}</p>
            </div>

            {meeting.summary.keyPoints.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Key Points</h3>
                <ul className="space-y-2">
                  {meeting.summary.keyPoints.map(point => (
                    <li key={point.id} className="flex items-start gap-2 text-sm">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {point.category}
                      </Badge>
                      <span>{point.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {meeting.summary.decisions.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Decisions</h3>
                <ul className="space-y-1">
                  {meeting.summary.decisions.map((decision) => (
                    <li key={decision} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 shrink-0 text-primary" />
                      {decision}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {meeting.summary.nextSteps.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Next Steps</h3>
                <ul className="space-y-1">
                  {meeting.summary.nextSteps.map((step) => (
                    <li key={step} className="flex items-start gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transcript' && (
          <div className="space-y-4">
            {meeting.transcript.map((segment) => {
              const speaker = meeting.speakers.find(s => s.id === segment.speakerId);
              return (
                <div key={segment.id} className="flex gap-3">
                  <div
                    className="w-1 rounded-full shrink-0"
                    style={{ backgroundColor: speaker?.color || '#888' }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-sm font-medium"
                        style={{ color: speaker?.color }}
                      >
                        {speaker?.name || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(segment.startTimeMs)}
                      </span>
                      {segment.isEdited && (
                        <Badge variant="outline" className="text-xs">edited</Badge>
                      )}
                    </div>
                    <p className="text-sm">{segment.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Add new action item..."
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
              />
              <Button onClick={handleAddAction} disabled={!newActionText.trim()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {meeting.summary?.actionItems.map(item => (
              <div
                key={item.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border',
                  item.status === 'completed' && 'bg-muted/50'
                )}
              >
                <input
                  type="checkbox"
                  checked={item.status === 'completed'}
                  onChange={(e) => updateActionItem(meeting.id, item.id, {
                    status: e.target.checked ? 'completed' : 'pending'
                  })}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className={cn(
                    'text-sm',
                    item.status === 'completed' && 'line-through text-muted-foreground'
                  )}>
                    {item.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        item.priority === 'high' && 'border-red-500 text-red-500',
                        item.priority === 'medium' && 'border-yellow-500 text-yellow-500',
                        item.priority === 'low' && 'border-green-500 text-green-500'
                      )}
                    >
                      {item.priority}
                    </Badge>
                    {item.assignee && (
                      <span className="text-xs text-muted-foreground">@{item.assignee}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deleteActionItem(meeting.id, item.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
