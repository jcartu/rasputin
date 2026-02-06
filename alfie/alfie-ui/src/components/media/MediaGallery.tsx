'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Image as ImageIcon,
  Video,
  Play,
  Pause,
  Download,
  Copy,
  Trash2,
  X,
  Clock,
  Maximize2,
  Volume2,
  VolumeX,
  Check,
  Share2,
  Link,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useMediaStore, formatDuration, downloadMedia, copyToClipboard, type MediaItem } from '@/lib/mediaStore';
import { cn } from '@/lib/utils';

export function MediaGallery() {
  const { items, selectedItemId, selectItem, removeItem } = useMediaStore();
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (item: MediaItem) => {
    const success = await copyToClipboard(item);
    if (success) {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleShare = async (item: MediaItem) => {
    if (navigator.share) {
      try {
        const response = await fetch(item.url);
        const blob = await response.blob();
        const file = new File([blob], `${item.name}.${item.type === 'screenshot' ? 'png' : 'webm'}`, {
          type: item.type === 'screenshot' ? 'image/png' : 'video/webm',
        });
        await navigator.share({
          title: item.name,
          files: [file],
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    }
  };

  const screenshots = items.filter((item) => item.type === 'screenshot');
  const recordings = items.filter((item) => item.type === 'recording');

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            Media Gallery
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {items.length} item{items.length !== 1 ? 's' : ''} captured
          </p>
        </div>

        <ScrollArea className="flex-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground/60 font-medium">
                No captures yet
              </p>
              <p className="text-xs text-muted-foreground/40 mt-1">
                Take a screenshot or start recording
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {screenshots.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <ImageIcon className="w-3.5 h-3.5" />
                    SCREENSHOTS ({screenshots.length})
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {screenshots.map((item) => (
                      <MediaThumbnail
                        key={item.id}
                        item={item}
                        isSelected={selectedItemId === item.id}
                        onSelect={() => selectItem(item.id)}
                        onPreview={() => setPreviewItem(item)}
                        onCopy={() => handleCopy(item)}
                        onDownload={() => downloadMedia(item)}
                        onShare={() => handleShare(item)}
                        onDelete={() => removeItem(item.id)}
                        isCopied={copiedId === item.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {recordings.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <Video className="w-3.5 h-3.5" />
                    RECORDINGS ({recordings.length})
                  </h4>
                  <div className="space-y-2">
                    {recordings.map((item) => (
                      <MediaThumbnail
                        key={item.id}
                        item={item}
                        isSelected={selectedItemId === item.id}
                        onSelect={() => selectItem(item.id)}
                        onPreview={() => setPreviewItem(item)}
                        onCopy={() => handleCopy(item)}
                        onDownload={() => downloadMedia(item)}
                        onShare={() => handleShare(item)}
                        onDelete={() => removeItem(item.id)}
                        isCopied={copiedId === item.id}
                        isCompact={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <MediaPreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      </div>
    </TooltipProvider>
  );
}

interface MediaThumbnailProps {
  item: MediaItem;
  isSelected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
  isCopied: boolean;
  isCompact?: boolean;
}

function MediaThumbnail({
  item,
  isSelected,
  onSelect,
  onPreview,
  onCopy,
  onDownload,
  onShare,
  onDelete,
  isCopied,
  isCompact = true,
}: MediaThumbnailProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        'group relative rounded-lg overflow-hidden border transition-all cursor-pointer',
        isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border hover:border-primary/50',
        !isCompact && 'flex items-center gap-3 p-2'
      )}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn(
        'relative overflow-hidden bg-muted',
        isCompact ? 'aspect-video' : 'w-20 h-14 rounded-md flex-shrink-0'
      )}>
        <img
          src={item.thumbnail}
          alt={item.name}
          className="w-full h-full object-cover"
        />
        {item.type === 'recording' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="w-6 h-6 text-white drop-shadow-lg" />
          </div>
        )}
        {item.type === 'recording' && item.duration && (
          <Badge 
            variant="secondary" 
            className="absolute bottom-1 right-1 text-[10px] px-1 py-0 bg-black/60 text-white border-0"
          >
            {formatDuration(item.duration)}
          </Badge>
        )}
      </div>

      {!isCompact && (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{format(new Date(item.createdAt), 'MMM d, HH:mm')}</span>
            {item.hasAudio && <Volume2 className="w-3 h-3 text-primary" />}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              'absolute bg-gradient-to-t from-black/80 via-black/40 to-transparent',
              isCompact ? 'inset-0' : 'right-0 top-0 bottom-0 w-24 bg-gradient-to-l'
            )}
          >
            <div className={cn(
              'absolute flex items-center gap-1',
              isCompact ? 'bottom-1 left-1 right-1 justify-center' : 'right-2 top-1/2 -translate-y-1/2'
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview();
                    }}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Preview</TooltipContent>
              </Tooltip>

              {item.type === 'screenshot' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopy();
                      }}
                    >
                      {isCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isCopied ? 'Copied!' : 'Copy'}</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload();
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download</TooltipContent>
              </Tooltip>

              {'share' in navigator && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 bg-white/10 hover:bg-white/20 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare();
                      }}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 bg-white/10 hover:bg-red-500/50 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface MediaPreviewModalProps {
  item: MediaItem | null;
  onClose: () => void;
}

function MediaPreviewModal({ item, onClose }: MediaPreviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
        <div className="relative">
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
            {item.type === 'recording' && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="bg-black/50 hover:bg-black/70 text-white border-0"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              size="icon"
              className="bg-black/50 hover:bg-black/70 text-white border-0"
              onClick={() => downloadMedia(item)}
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="bg-black/50 hover:bg-black/70 text-white border-0"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {item.type === 'screenshot' ? (
            <img
              src={item.url}
              alt={item.name}
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          ) : (
            <div className="relative">
              <video
                src={item.url}
                className="w-full h-auto max-h-[80vh]"
                controls
                autoPlay
                muted={isMuted}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <h3 className="text-white font-medium">{item.name}</h3>
            <p className="text-white/60 text-sm">
              {format(new Date(item.createdAt), 'MMMM d, yyyy at HH:mm')}
              {item.type === 'recording' && item.duration && ` - ${formatDuration(item.duration)}`}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
