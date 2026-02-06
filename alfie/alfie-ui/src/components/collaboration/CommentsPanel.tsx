'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
  MessageSquare, 
  Send, 
  Check, 
  MoreHorizontal, 
  Trash2, 
  Edit2,
  CheckCircle2,
  Circle,
  Reply,
  SmilePlus
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useCollaborationStore, 
  type Comment,
  PermissionLevel 
} from '@/lib/collaboration';

interface CommentsPanelProps {
  className?: string;
}

export function CommentsPanel({ className }: CommentsPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    comments,
    activeCommentId,
    localUser,
    permission,
    addComment,
    updateComment,
    deleteComment,
    resolveComment,
    unresolveComment,
    addReaction,
    setActiveComment,
  } = useCollaborationStore();

  const canComment = permission >= PermissionLevel.COMMENT;

  const filteredComments = comments.filter(c => {
    if (c.parentId) return false;
    if (filter === 'open') return !c.resolved;
    if (filter === 'resolved') return c.resolved;
    return true;
  });

  const getCommentReplies = (commentId: string) => 
    comments.filter(c => c.parentId === commentId);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !canComment) return;
    
    try {
      await addComment(newComment.trim());
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim() || !canComment) return;
    
    try {
      await addComment(replyContent.trim(), { parentId });
      setReplyContent('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to add reply:', error);
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) return;
    
    try {
      await updateComment(commentId, editContent.trim());
      setEditingId(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const handleToggleResolved = async (comment: Comment) => {
    try {
      if (comment.resolved) {
        await unresolveComment(comment.id);
      } else {
        await resolveComment(comment.id);
      }
    } catch (error) {
      console.error('Failed to toggle resolved:', error);
    }
  };

  const handleReaction = async (commentId: string, reaction: string) => {
    try {
      await addReaction(commentId, reaction);
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const reactions = ['👍', '❤️', '😄', '🎉', '🤔', '👀'];

  return (
    <div className={`flex flex-col h-full bg-background ${className || ''}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Comments
            {comments.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {comments.filter(c => !c.parentId && !c.resolved).length}
              </Badge>
            )}
          </h3>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredComments.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-muted-foreground"
              >
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No comments yet</p>
                {canComment && <p className="text-sm">Be the first to add a comment</p>}
              </motion.div>
            ) : (
              filteredComments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  replies={getCommentReplies(comment.id)}
                  isActive={activeCommentId === comment.id}
                  isEditing={editingId === comment.id}
                  editContent={editContent}
                  isReplying={replyingTo === comment.id}
                  replyContent={replyContent}
                  canComment={canComment}
                  localUserId={localUser?.id}
                  reactions={reactions}
                  onSelect={() => setActiveComment(comment.id)}
                  onStartEdit={() => {
                    setEditingId(comment.id);
                    setEditContent(comment.content);
                  }}
                  onCancelEdit={() => {
                    setEditingId(null);
                    setEditContent('');
                  }}
                  onEditChange={setEditContent}
                  onSaveEdit={() => handleUpdateComment(comment.id)}
                  onDelete={() => handleDeleteComment(comment.id)}
                  onToggleResolved={() => handleToggleResolved(comment)}
                  onStartReply={() => setReplyingTo(comment.id)}
                  onCancelReply={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                  onReplyChange={setReplyContent}
                  onSubmitReply={() => handleSubmitReply(comment.id)}
                  onReaction={(reaction) => handleReaction(comment.id, reaction)}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {canComment && (
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmitComment();
                }
              }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-muted-foreground">
              ⌘/Ctrl + Enter to send
            </span>
            <Button 
              size="sm" 
              onClick={handleSubmitComment}
              disabled={!newComment.trim()}
            >
              <Send className="w-4 h-4 mr-1" />
              Comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  replies: Comment[];
  isActive: boolean;
  isEditing: boolean;
  editContent: string;
  isReplying: boolean;
  replyContent: string;
  canComment: boolean;
  localUserId?: string;
  reactions: string[];
  onSelect: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (value: string) => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onToggleResolved: () => void;
  onStartReply: () => void;
  onCancelReply: () => void;
  onReplyChange: (value: string) => void;
  onSubmitReply: () => void;
  onReaction: (reaction: string) => void;
}

function CommentItem({
  comment,
  replies,
  isActive,
  isEditing,
  editContent,
  isReplying,
  replyContent,
  canComment,
  localUserId,
  reactions,
  onSelect,
  onStartEdit,
  onCancelEdit,
  onEditChange,
  onSaveEdit,
  onDelete,
  onToggleResolved,
  onStartReply,
  onCancelReply,
  onReplyChange,
  onSubmitReply,
  onReaction,
}: CommentItemProps) {
  const isOwner = comment.userId === localUserId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-lg border transition-colors ${
        isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
      } ${comment.resolved ? 'opacity-60' : ''}`}
      onClick={onSelect}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6">
              <AvatarImage src={comment.userAvatar} />
              <AvatarFallback className="text-xs">
                {comment.userName?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className="text-sm font-medium">{comment.userName || 'User'}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {format(new Date(comment.createdAt), 'MMM d, h:mm a')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {canComment && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleResolved();
                }}
              >
                {comment.resolved ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwner && (
                  <DropdownMenuItem onClick={onStartEdit}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canComment && (
                  <DropdownMenuItem onClick={onStartReply}>
                    <Reply className="w-4 h-4 mr-2" />
                    Reply
                  </DropdownMenuItem>
                )}
                {isOwner && (
                  <DropdownMenuItem 
                    onClick={onDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => onEditChange(e.target.value)}
              className="min-h-[60px]"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSaveEdit}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm whitespace-pre-wrap">{comment.content}</p>
        )}

        {comment.lineNumber && (
          <div className="mt-2 text-xs text-muted-foreground">
            Line {comment.lineNumber}
          </div>
        )}

        {Object.keys(comment.reactions).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(comment.reactions).map(([reaction, users]) => (
              <button
                type="button"
                key={reaction}
                onClick={() => onReaction(reaction)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                  users.includes(localUserId || '')
                    ? 'bg-primary/20 border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {reaction} {users.length}
              </button>
            ))}
          </div>
        )}

        {canComment && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 mt-2">
                <SmilePlus className="w-3 h-3 mr-1" />
                React
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <div className="flex gap-1 p-1">
                {reactions.map(r => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => onReaction(r)}
                    className="p-1 hover:bg-muted rounded"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {replies.length > 0 && (
        <div className="border-t border-border bg-muted/30">
          {replies.map(reply => (
            <div key={reply.id} className="p-3 border-b last:border-b-0 border-border/50">
              <div className="flex items-center gap-2">
                <Avatar className="w-5 h-5">
                  <AvatarFallback className="text-[10px]">
                    {reply.userName?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">{reply.userName}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(reply.createdAt), 'MMM d')}
                </span>
              </div>
              <p className="mt-1 text-sm pl-7">{reply.content}</p>
            </div>
          ))}
        </div>
      )}

      {isReplying && (
        <div className="p-3 border-t border-border bg-muted/30">
          <Textarea
            value={replyContent}
            onChange={(e) => onReplyChange(e.target.value)}
            placeholder="Write a reply..."
            className="min-h-[60px]"
            autoFocus
          />
          <div className="flex gap-2 justify-end mt-2">
            <Button size="sm" variant="ghost" onClick={onCancelReply}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSubmitReply} disabled={!replyContent.trim()}>
              Reply
            </Button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default CommentsPanel;
