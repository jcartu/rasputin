'use client';

import { useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useChatStore, type ModelInfo } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';

const providerLabels: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  vllm: 'vLLM',
};

const providerPillStyles: Record<string, string> = {
  anthropic: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  openai: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  gemini: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  openrouter: 'border-pink-500/30 bg-pink-500/10 text-pink-300',
  vllm: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
};

const providerOrder = ['anthropic', 'openai', 'gemini', 'openrouter', 'vllm'];

export function ModelSelector() {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const availableModels = useChatStore((s) => s.availableModels);
  const loadModels = useChatStore((s) => s.loadModels);

  useEffect(() => {
    if (availableModels.length === 0) {
      void loadModels();
    }
  }, [availableModels.length, loadModels]);

  const groupedModels = useMemo<Record<string, ModelInfo[]>>(() => {
    return availableModels.reduce<Record<string, ModelInfo[]>>((acc, model) => {
      if (!acc[model.provider]) acc[model.provider] = [];
      acc[model.provider].push(model);
      return acc;
    }, {});
  }, [availableModels]);

  const activeModel = availableModels.find((model) => model.id === selectedModel);
  const triggerLabel = activeModel?.name || 'Auto';
  const triggerProvider = activeModel?.provider
    ? providerLabels[activeModel.provider] || activeModel.provider
    : 'Auto';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={!activeSessionId}
          className="h-9 gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 text-xs font-medium text-muted-foreground hover:bg-muted/40"
        >
          <span className="text-foreground/90">{triggerLabel}</span>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide',
              activeModel ? providerPillStyles[activeModel.provider] : 'border-border/50 text-muted-foreground'
            )}
          >
            {triggerProvider}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[260px]">
        <DropdownMenuRadioGroup
          value={selectedModel ?? 'auto'}
          onValueChange={(value) => setSelectedModel(value === 'auto' ? null : value)}
        >
          <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
            Auto
          </DropdownMenuLabel>
          <DropdownMenuRadioItem value="auto">
            <div className="flex w-full items-center justify-between gap-3">
              <span className="font-medium text-foreground">Auto</span>
              <span className="text-[11px] text-muted-foreground">Claude + vLLM</span>
            </div>
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {providerOrder.map((provider) => {
            const models = groupedModels[provider] || [];
            if (models.length === 0) return null;
            return (
              <div key={provider} className="py-1">
                <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                  {providerLabels[provider] || provider}
                </DropdownMenuLabel>
                {models.map((model) => (
                  <DropdownMenuRadioItem key={model.id} value={model.id} disabled={!model.available}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-sm text-foreground">
                        {model.name}
                      </span>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide',
                          providerPillStyles[model.provider] || 'border-border/50 text-muted-foreground'
                        )}
                      >
                        {providerLabels[model.provider] || model.provider}
                      </span>
                    </div>
                  </DropdownMenuRadioItem>
                ))}
              </div>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
