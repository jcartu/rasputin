'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { Play, Square, RefreshCw, Power, Circle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useNotebookStore } from '@/lib/notebook/store';
import type { KernelStatus, AvailableKernel } from '@/lib/notebook/types';

interface KernelSelectorProps {
  notebookId: string;
  onStartKernel: (specName: string) => Promise<void>;
  onStopKernel: () => Promise<void>;
  onRestartKernel: () => Promise<void>;
  onInterruptKernel: () => Promise<void>;
}

const statusConfig: Record<KernelStatus, { color: string; label: string; icon: typeof Circle }> = {
  unknown: { color: 'text-muted-foreground', label: 'Unknown', icon: Circle },
  starting: { color: 'text-yellow-500', label: 'Starting...', icon: Loader2 },
  idle: { color: 'text-green-500', label: 'Idle', icon: Circle },
  busy: { color: 'text-yellow-500', label: 'Busy', icon: Circle },
  terminating: { color: 'text-orange-500', label: 'Stopping...', icon: Loader2 },
  restarting: { color: 'text-yellow-500', label: 'Restarting...', icon: Loader2 },
  autorestarting: { color: 'text-yellow-500', label: 'Auto-restarting...', icon: Loader2 },
  dead: { color: 'text-red-500', label: 'Dead', icon: Circle },
};

export const KernelSelector = memo(function KernelSelector({
  notebookId,
  onStartKernel,
  onStopKernel,
  onRestartKernel,
  onInterruptKernel,
}: KernelSelectorProps) {
  const { notebooks, availableKernels, setAvailableKernels } = useNotebookStore();
  const notebook = notebooks[notebookId];
  const [isLoading, setIsLoading] = useState(false);

  const kernelStatus = notebook?.kernelStatus || 'unknown';
  const hasKernel = notebook?.kernelId !== null;
  const config = statusConfig[kernelStatus];
  const StatusIcon = config.icon;

  useEffect(() => {
    async function fetchKernels() {
      try {
        const response = await fetch('/api/notebooks/kernels');
        if (response.ok) {
          const data = await response.json();
          setAvailableKernels(data.kernelspecs || []);
        }
      } catch (err) {
        console.error('Failed to fetch kernel specs:', err);
      }
    }
    
    if (availableKernels.length === 0) {
      fetchKernels();
    }
  }, [availableKernels.length, setAvailableKernels]);

  const handleStartKernel = useCallback(async (specName: string) => {
    setIsLoading(true);
    try {
      await onStartKernel(specName);
    } finally {
      setIsLoading(false);
    }
  }, [onStartKernel]);

  const handleStopKernel = useCallback(async () => {
    setIsLoading(true);
    try {
      await onStopKernel();
    } finally {
      setIsLoading(false);
    }
  }, [onStopKernel]);

  const handleRestartKernel = useCallback(async () => {
    setIsLoading(true);
    try {
      await onRestartKernel();
    } finally {
      setIsLoading(false);
    }
  }, [onRestartKernel]);

  const handleInterruptKernel = useCallback(async () => {
    try {
      await onInterruptKernel();
    } catch (err) {
      console.error('Failed to interrupt kernel:', err);
    }
  }, [onInterruptKernel]);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <StatusIcon 
            className={`w-3 h-3 ${config.color} ${
              kernelStatus === 'starting' || kernelStatus === 'restarting' || kernelStatus === 'terminating' 
                ? 'animate-spin' 
                : kernelStatus === 'busy' 
                  ? 'animate-pulse fill-current' 
                  : 'fill-current'
            }`} 
          />
          <span className={`text-xs ${config.color}`}>
            {config.label}
          </span>
        </div>

        {!hasKernel ? (
          <Select
            onValueChange={handleStartKernel}
            disabled={isLoading}
            placeholder="Select Kernel"
            className="w-[140px] h-7 text-xs"
            options={
              availableKernels.length > 0
                ? availableKernels.map((kernel) => ({
                    value: kernel.name,
                    label: kernel.spec.display_name,
                  }))
                : [{ value: 'python3', label: 'Python 3' }]
            }
          />
        ) : (
          <div className="flex items-center gap-1">
            {kernelStatus === 'busy' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-yellow-500 hover:text-yellow-400"
                    onClick={handleInterruptKernel}
                  >
                    <Square className="h-3 w-3 fill-current" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Interrupt Kernel</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={handleRestartKernel}
                  disabled={isLoading || kernelStatus === 'dead'}
                >
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restart Kernel</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={handleStopKernel}
                  disabled={isLoading}
                >
                  <Power className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Shutdown Kernel</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
});
