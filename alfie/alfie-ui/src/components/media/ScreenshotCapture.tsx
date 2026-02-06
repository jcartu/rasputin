'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  X,
  Check,
  Download,
  Copy,
  Undo2,
  Redo2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useMediaStore, copyToClipboard, downloadMedia, type Annotation } from '@/lib/mediaStore';
import { cn } from '@/lib/utils';
import { AnnotationToolbar } from './AnnotationToolbar';

export function ScreenshotCapture() {
  const {
    isCapturing,
    capturedImage,
    isAnnotating,
    currentAnnotations,
    setIsCapturing,
    setCapturedImage,
    setIsAnnotating,
    clearAnnotations,
    addItem,
  } = useMediaStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const captureScreen = useCallback(async () => {
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
        setImageDimensions({ width: video.videoWidth, height: video.videoHeight });
        setIsAnnotating(true);
      }

      for (const track of stream.getTracks()) {
        track.stop();
      }
      video.remove();
      canvas.remove();
    } catch (error) {
      console.error('Screenshot capture failed:', error);
    } finally {
      setIsCapturing(false);
    }
  }, [setIsCapturing, setCapturedImage, setIsAnnotating]);

  const handleClose = useCallback(() => {
    setCapturedImage(null);
    setIsAnnotating(false);
    clearAnnotations();
    setHistory([[]]);
    setHistoryIndex(0);
  }, [setCapturedImage, setIsAnnotating, clearAnnotations]);

  const handleSave = useCallback(async () => {
    if (!capturedImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    
    addItem({
      type: 'screenshot',
      name: `Screenshot ${new Date().toLocaleTimeString()}`,
      thumbnail: dataUrl,
      url: dataUrl,
      width: imageDimensions.width,
      height: imageDimensions.height,
      annotations: [...currentAnnotations],
    });

    handleClose();
  }, [capturedImage, currentAnnotations, addItem, imageDimensions, handleClose]);

  const handleCopy = useCallback(async () => {
    if (!canvasRef.current) return;
    
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const tempItem = {
      id: 'temp',
      type: 'screenshot' as const,
      name: 'temp',
      thumbnail: dataUrl,
      url: dataUrl,
      width: imageDimensions.width,
      height: imageDimensions.height,
      createdAt: new Date(),
    };
    
    await copyToClipboard(tempItem);
  }, [imageDimensions]);

  const handleDownload = useCallback(() => {
    if (!canvasRef.current) return;
    
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `screenshot-${Date.now()}.png`;
    link.click();
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  }, [historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  }, [historyIndex, history.length]);

  const handleClear = useCallback(() => {
    clearAnnotations();
    setHistory([[]]);
    setHistoryIndex(0);
  }, [clearAnnotations]);

  return (
    <>
      <Dialog open={isAnnotating && !!capturedImage} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto p-0 overflow-hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                <span className="font-medium">Edit Screenshot</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleUndo}
                  disabled={historyIndex === 0}
                  title="Undo"
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRedo}
                  disabled={historyIndex === history.length - 1}
                  title="Redo"
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy to clipboard">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleDownload} title="Download">
                  <Download className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <X className="w-4 h-4" />
                </Button>
                <Button onClick={handleSave}>
                  <Check className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>

            <AnnotationToolbar />

            <div className="flex-1 overflow-auto p-4 bg-muted/30">
              <AnnotationCanvas
                ref={canvasRef}
                image={capturedImage}
                width={imageDimensions.width}
                height={imageDimensions.height}
                annotations={history[historyIndex] || []}
                onAnnotationsChange={(newAnnotations) => {
                  const newHistory = history.slice(0, historyIndex + 1);
                  newHistory.push(newAnnotations);
                  setHistory(newHistory);
                  setHistoryIndex(newHistory.length - 1);
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AnimatePresence>
        {isCapturing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/50 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="text-lg font-medium">Select area to capture...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

interface AnnotationCanvasProps {
  image: string | null;
  width: number;
  height: number;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
}

import { forwardRef, useImperativeHandle } from 'react';

const AnnotationCanvas = forwardRef<HTMLCanvasElement, AnnotationCanvasProps>(
  function AnnotationCanvas({ image, width, height, annotations, onAnnotationsChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
    const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
    
    const {
      activeTool,
      activeColor,
      activeStrokeWidth,
      activeFontSize,
    } = useMediaStore();

    useImperativeHandle(ref, () => canvasRef.current!, []);

    const scale = Math.min(
      (window.innerWidth * 0.9 - 48) / width,
      (window.innerHeight * 0.9 - 200) / height,
      1
    );

    const drawAnnotation = useCallback((ctx: CanvasRenderingContext2D, annotation: Annotation) => {
      ctx.strokeStyle = annotation.color;
      ctx.fillStyle = annotation.color;
      ctx.lineWidth = annotation.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      switch (annotation.tool) {
        case 'pen':
        case 'highlighter':
          if (annotation.tool === 'highlighter') {
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = annotation.strokeWidth * 3;
          }
          if (annotation.points && annotation.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
            for (let i = 1; i < annotation.points.length; i++) {
              ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
            }
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          break;

        case 'arrow':
          if (annotation.start && annotation.end) {
            const dx = annotation.end.x - annotation.start.x;
            const dy = annotation.end.y - annotation.start.y;
            const angle = Math.atan2(dy, dx);
            const headLength = 15;

            ctx.beginPath();
            ctx.moveTo(annotation.start.x, annotation.start.y);
            ctx.lineTo(annotation.end.x, annotation.end.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(annotation.end.x, annotation.end.y);
            ctx.lineTo(
              annotation.end.x - headLength * Math.cos(angle - Math.PI / 6),
              annotation.end.y - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              annotation.end.x - headLength * Math.cos(angle + Math.PI / 6),
              annotation.end.y - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
          }
          break;

        case 'rectangle':
          if (annotation.start && annotation.end) {
            ctx.strokeRect(
              annotation.start.x,
              annotation.start.y,
              annotation.end.x - annotation.start.x,
              annotation.end.y - annotation.start.y
            );
          }
          break;

        case 'ellipse':
          if (annotation.start && annotation.end) {
            const centerX = (annotation.start.x + annotation.end.x) / 2;
            const centerY = (annotation.start.y + annotation.end.y) / 2;
            const radiusX = Math.abs(annotation.end.x - annotation.start.x) / 2;
            const radiusY = Math.abs(annotation.end.y - annotation.start.y) / 2;
            
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;

        case 'text':
          if (annotation.start && annotation.text) {
            ctx.font = `${annotation.fontSize || 16}px sans-serif`;
            ctx.fillText(annotation.text, annotation.start.x, annotation.start.y);
          }
          break;

        case 'blur':
          if (annotation.start && annotation.end) {
            const x = Math.min(annotation.start.x, annotation.end.x);
            const y = Math.min(annotation.start.y, annotation.end.y);
            const w = Math.abs(annotation.end.x - annotation.start.x);
            const h = Math.abs(annotation.end.y - annotation.start.y);
            
            if (w > 0 && h > 0) {
              const imageData = ctx.getImageData(x, y, w, h);
              const pixelSize = 10;
              
              for (let py = 0; py < h; py += pixelSize) {
                for (let px = 0; px < w; px += pixelSize) {
                  let r = 0, g = 0, b = 0, count = 0;
                  
                  for (let dy = 0; dy < pixelSize && py + dy < h; dy++) {
                    for (let dx = 0; dx < pixelSize && px + dx < w; dx++) {
                      const i = ((py + dy) * w + (px + dx)) * 4;
                      r += imageData.data[i];
                      g += imageData.data[i + 1];
                      b += imageData.data[i + 2];
                      count++;
                    }
                  }
                  
                  r = Math.floor(r / count);
                  g = Math.floor(g / count);
                  b = Math.floor(b / count);
                  
                  for (let dy = 0; dy < pixelSize && py + dy < h; dy++) {
                    for (let dx = 0; dx < pixelSize && px + dx < w; dx++) {
                      const i = ((py + dy) * w + (px + dx)) * 4;
                      imageData.data[i] = r;
                      imageData.data[i + 1] = g;
                      imageData.data[i + 2] = b;
                    }
                  }
                }
              }
              
              ctx.putImageData(imageData, x, y);
            }
          }
          break;
      }
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !image) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        for (const annotation of annotations) {
          drawAnnotation(ctx, annotation);
        }
      };
      img.src = image;
    }, [image, annotations, drawAnnotation]);

    const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (activeTool === 'select') return;
      
      const coords = getCanvasCoords(e);
      setIsDrawing(true);
      setStartPoint(coords);
      
      if (activeTool === 'pen' || activeTool === 'highlighter') {
        setCurrentPath([coords]);
      }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || activeTool === 'select') return;
      
      const coords = getCanvasCoords(e);
      
      if (activeTool === 'pen' || activeTool === 'highlighter') {
        setCurrentPath([...currentPath, coords]);
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx || !image) return;

        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          annotations.forEach((annotation) => {
            drawAnnotation(ctx, annotation);
          });
          
          const tempAnnotation: Annotation = {
            id: 'temp',
            tool: activeTool,
            color: activeColor,
            strokeWidth: activeStrokeWidth,
            points: [...currentPath, coords],
          };
          drawAnnotation(ctx, tempAnnotation);
        };
        img.src = image;
      }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || activeTool === 'select') return;
      
      const coords = getCanvasCoords(e);
      setIsDrawing(false);

      let newAnnotation: Annotation | null = null;

      if (activeTool === 'pen' || activeTool === 'highlighter') {
        if (currentPath.length > 1) {
          newAnnotation = {
            id: crypto.randomUUID(),
            tool: activeTool,
            color: activeColor,
            strokeWidth: activeStrokeWidth,
            points: [...currentPath, coords],
          };
        }
      } else if (activeTool === 'text') {
        const text = prompt('Enter text:');
        if (text && startPoint) {
          newAnnotation = {
            id: crypto.randomUUID(),
            tool: activeTool,
            color: activeColor,
            strokeWidth: activeStrokeWidth,
            fontSize: activeFontSize,
            start: startPoint,
            text,
          };
        }
      } else if (startPoint) {
        newAnnotation = {
          id: crypto.randomUUID(),
          tool: activeTool,
          color: activeColor,
          strokeWidth: activeStrokeWidth,
          start: startPoint,
          end: coords,
        };
      }

      if (newAnnotation) {
        onAnnotationsChange([...annotations, newAnnotation]);
      }

      setCurrentPath([]);
      setStartPoint(null);
    };

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: width * scale,
          height: height * scale,
          cursor: activeTool === 'select' ? 'default' : 'crosshair',
        }}
        className="border border-border rounded-lg shadow-lg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing) {
            setIsDrawing(false);
            setCurrentPath([]);
            setStartPoint(null);
          }
        }}
      />
    );
  }
);
