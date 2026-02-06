'use client';

import { useCallback } from 'react';
import {
  Camera,
  Video,
  Images,
  ChevronDown,
  Monitor,
  AppWindow,
  Mic,
  MicOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useMediaStore, type RecordingSource } from '@/lib/mediaStore';
import { cn } from '@/lib/utils';

interface MediaToolbarProps {
  compact?: boolean;
}

export function MediaToolbar({ compact = false }: MediaToolbarProps) {
  const {
    items,
    recording,
    setRecordingPanelOpen,
    setGalleryOpen,
    setIsCapturing,
    setCapturedImage,
    setIsAnnotating,
    setRecordingState,
  } = useMediaStore();

  const captureScreenshot = useCallback(async () => {
    try {
      setIsCapturing(true);
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        setCapturedImage(dataUrl);
        setIsAnnotating(true);
      }

      stream.getTracks().forEach((track) => track.stop());
      video.remove();
      canvas.remove();
    } catch (error) {
      console.error('Screenshot capture failed:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [setIsCapturing, setCapturedImage, setIsAnnotating]);

  const startQuickRecording = useCallback(async (source: RecordingSource) => {
    setRecordingState({ source, hasAudio: true });
    setRecordingPanelOpen(true);
  }, [setRecordingState, setRecordingPanelOpen]);

  const screenshotCount = items.filter((i) => i.type === 'screenshot').length;
  const recordingCount = items.filter((i) => i.type === 'recording').length;

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={captureScreenshot}
                className="rounded-xl min-w-touch min-h-touch"
              >
                <Camera className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Take screenshot</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRecordingPanelOpen(true)}
                className="rounded-xl min-w-touch min-h-touch"
              >
                <Video className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start recording</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 rounded-xl"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Capture</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
                {items.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                    {items.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Capture screen or record</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={captureScreenshot} className="gap-3">
            <Camera className="w-4 h-4 text-primary" />
            <div className="flex-1">
              <p className="font-medium">Screenshot</p>
              <p className="text-xs text-muted-foreground">Capture & annotate</p>
            </div>
            <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Ctrl+Shift+S</kbd>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-3">
              <Video className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <p className="font-medium">Record Screen</p>
                <p className="text-xs text-muted-foreground">With audio support</p>
              </div>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-48">
                <DropdownMenuItem onClick={() => startQuickRecording('screen')} className="gap-3">
                  <Monitor className="w-4 h-4" />
                  <span>Entire Screen</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => startQuickRecording('window')} className="gap-3">
                  <AppWindow className="w-4 h-4" />
                  <span>Window</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => startQuickRecording('tab')} className="gap-3">
                  <Monitor className="w-4 h-4" />
                  <span>Browser Tab</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setRecordingPanelOpen(true)} className="gap-3">
                  <Video className="w-4 h-4" />
                  <span>Advanced Options...</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem 
            onClick={() => setGalleryOpen(true)} 
            className="gap-3"
            disabled={items.length === 0}
          >
            <Images className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">Media Gallery</p>
              <p className="text-xs text-muted-foreground">
                {screenshotCount} screenshot{screenshotCount !== 1 ? 's' : ''}, {recordingCount} recording{recordingCount !== 1 ? 's' : ''}
              </p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
