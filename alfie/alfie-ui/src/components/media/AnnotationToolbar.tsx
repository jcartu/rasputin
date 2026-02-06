'use client';

import {
  MousePointer2,
  Pencil,
  Highlighter,
  ArrowUpRight,
  Square,
  Circle,
  Type,
  Sparkles,
  Minus,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { useMediaStore, type AnnotationTool } from '@/lib/mediaStore';
import { cn } from '@/lib/utils';

const tools: { id: AnnotationTool; label: string; icon: typeof Pencil }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'pen', label: 'Pen', icon: Pencil },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { id: 'rectangle', label: 'Rectangle', icon: Square },
  { id: 'ellipse', label: 'Ellipse', icon: Circle },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'blur', label: 'Blur', icon: Sparkles },
];

const colors = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#000000',
  '#ffffff',
];

export function AnnotationToolbar() {
  const {
    activeTool,
    activeColor,
    activeStrokeWidth,
    setActiveTool,
    setActiveColor,
    setActiveStrokeWidth,
  } = useMediaStore();

  return (
    <TooltipProvider>
      <div className="flex items-center gap-4 p-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
          {tools.map((tool) => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveTool(tool.id)}
                  className={cn(
                    'w-8 h-8 rounded-md',
                    activeTool === tool.id && 'bg-primary/10 text-primary'
                  )}
                >
                  <tool.icon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{tool.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="w-px h-8 bg-border" />

        <div className="flex items-center gap-1">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setActiveColor(color)}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                activeColor === color ? 'border-primary scale-110' : 'border-transparent',
                color === '#ffffff' && 'border-border'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="w-px h-8 bg-border" />

        <div className="flex items-center gap-2 min-w-[140px]">
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={() => setActiveStrokeWidth(Math.max(1, activeStrokeWidth - 1))}
          >
            <Minus className="w-3 h-3" />
          </Button>
          <Slider
            value={activeStrokeWidth}
            onValueChange={setActiveStrokeWidth}
            min={1}
            max={20}
            step={1}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6"
            onClick={() => setActiveStrokeWidth(Math.min(20, activeStrokeWidth + 1))}
          >
            <Plus className="w-3 h-3" />
          </Button>
          <span className="text-xs text-muted-foreground w-6 text-center">{activeStrokeWidth}</span>
        </div>
      </div>
    </TooltipProvider>
  );
}
