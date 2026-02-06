'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  X,
  Check,
  MoreHorizontal,
  Trash2,
  Edit2,
  CheckCircle,
  Circle,
  Reply,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useDiffViewerStore } from '@/lib/diff-viewer';
import type { DiffComment } from '@/lib/diff-viewer';
import { format } from 'date-fns';

interface DiffCommentsProps {
  filePath: string;
  className?: string;
}

export function DiffComments({ filePath, className }: DiffCommentsProps) {
  const { getCommentsForFile, resolveComment, unresolveComment, deleteComment } =
    useDiffViewerStore();
  const comments = getCommentsForFile(filePath);
  const [showResolved, setShowResolved] = useState(false);

  const unresolvedComments = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);

  if (comments.length === 0) return null;

  return (
    <div className={cn('border-t border-border', className)}>
      <div className="p-3 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            Comments ({unresolvedComments.length})
          </span>
          {resolvedComments.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {resolvedComments.length} resolved
            </Badge>
          )}
        </div>
        {resolvedComments.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowResolved(!showResolved)}
          >
            {showResolved ? 'Hide resolved' : 'Show resolved'}
          </Button>
        )}
      </div>

      <ScrollArea className="max-h-64">
        <div className="p-2 space-y-2">
          <AnimatePresence>
            {unresolvedComments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                onResolve={() => resolveComment(comment.id)}
                onDelete={() => deleteComment(comment.id)}
              />
            ))}
            {showResolved &&
              resolvedComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  onUnresolve={() => unresolveComment(comment.id)}
                  onDelete={() => deleteComment(comment.id)}
                  isResolved
                />
              ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}

interface CommentCardProps {
  comment: DiffComment;
  onResolve?: () => void;
  onUnresolve?: () => void;
  onDelete: () => void;
  isResolved?: boolean;
}

function CommentCard({ comment, onResolve, onUnresolve, onDelete, isResolved }: CommentCardProps) {
  const { addReply, updateComment } = useDiffViewerStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const handleSaveEdit = () => {
    updateComment(comment.id, editContent);
    setIsEditing(false);
  };

  const handleAddReply = () => {
    if (replyContent.trim()) {
      addReply(comment.id, replyContent, 'You');
      setReplyContent('');
      setIsReplying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'rounded-lg border p-3 transition-colors',
        isResolved
          ? 'bg-muted/30 border-border/50 opacity-70'
          : 'bg-card border-border'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={comment.authorAvatar} />
          <AvatarFallback className="text-xs">
            {comment.author.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{comment.author}</span>
              <span className="text-xs text-muted-foreground">
                Line {comment.lineNumber} ({comment.side})
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {isResolved ? (
                  <DropdownMenuItem onClick={onUnresolve}>
                    <Circle className="w-4 h-4 mr-2" />
                    Unresolve
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onResolve}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Resolve
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] text-sm"
              />
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/90">{comment.content}</p>
          )}

          {comment.replies.length > 0 && (
            <div className="mt-3 space-y-2 border-l-2 border-border pl-3">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="text-sm">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-xs">{reply.author}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(reply.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <p className="text-foreground/80">{reply.content}</p>
                </div>
              ))}
            </div>
          )}

          {!isResolved && (
            <div className="mt-2">
              {isReplying ? (
                <div className="space-y-2">
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Write a reply..."
                    className="min-h-[50px] text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-7"
                      onClick={handleAddReply}
                      disabled={!replyContent.trim()}
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Reply
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      onClick={() => {
                        setIsReplying(false);
                        setReplyContent('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-muted-foreground"
                  onClick={() => setIsReplying(true)}
                >
                  <Reply className="w-3 h-3 mr-1" />
                  Reply
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface AddCommentProps {
  filePath: string;
  lineNumber: number;
  side: 'old' | 'new';
  onClose: () => void;
}

export function AddCommentForm({ filePath, lineNumber, side, onClose }: AddCommentProps) {
  const { addComment } = useDiffViewerStore();
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (content.trim()) {
      addComment(filePath, lineNumber, side, content, 'You');
      setContent('');
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute z-50 w-80 p-3 rounded-lg border border-border bg-card shadow-lg"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">
          Add comment (Line {lineNumber}, {side})
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a comment..."
        className="min-h-[80px] text-sm mb-2"
        autoFocus
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!content.trim()}>
          <Send className="w-3.5 h-3.5 mr-1" />
          Comment
        </Button>
      </div>
    </motion.div>
  );
}
