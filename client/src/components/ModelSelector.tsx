import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Settings2, Zap, Sparkles, Brain } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { SpeedTier } from "../../../shared/rasputin";

interface ModelSelectorProps {
  speedTier: SpeedTier;
  selectedModels: string[];
  onModelsChange: (models: string[]) => void;
  disabled?: boolean;
}

const providerColors: Record<string, string> = {
  openai: "bg-green-500/20 text-green-400 border-green-500/30",
  anthropic: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  google: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  xai: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  perplexity: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  cerebras: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const tierIcons: Record<string, React.ReactNode> = {
  fast: <Zap className="h-3 w-3 text-yellow-400" />,
  normal: <Sparkles className="h-3 w-3 text-primary" />,
  max: <Brain className="h-3 w-3 text-purple-400" />,
};

export function ModelSelector({
  speedTier,
  selectedModels,
  onModelsChange,
  disabled,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [localSelection, setLocalSelection] =
    useState<string[]>(selectedModels);

  const { data: allModels } = trpc.models.list.useQuery();
  const { data: tierModels } = trpc.models.getForTier.useQuery({
    tier: speedTier,
  });

  // Reset local selection when dialog opens or tier changes
  useEffect(() => {
    if (open) {
      setLocalSelection(
        selectedModels.length > 0
          ? selectedModels
          : tierModels?.map(m => m.id) || []
      );
    }
  }, [open, tierModels, selectedModels]);

  const handleToggleModel = (modelId: string) => {
    setLocalSelection(prev => {
      if (prev.includes(modelId)) {
        // Don't allow deselecting all models
        if (prev.length <= 1) return prev;
        return prev.filter(id => id !== modelId);
      }
      return [...prev, modelId];
    });
  };

  const handleSelectAll = () => {
    if (allModels) {
      setLocalSelection(allModels.map(m => m.id));
    }
  };

  const handleSelectTierDefaults = () => {
    if (tierModels) {
      setLocalSelection(tierModels.map(m => m.id));
    }
  };

  const handleSave = () => {
    onModelsChange(localSelection);
    setOpen(false);
  };

  const activeCount =
    selectedModels.length > 0 ? selectedModels.length : tierModels?.length || 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          disabled={disabled}
        >
          <Settings2 className="h-4 w-4 mr-1" />
          <span className="text-xs">{activeCount} models</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Select AI Models
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectTierDefaults}
              className="text-xs"
            >
              {tierIcons[speedTier]}
              <span className="ml-1">Use {speedTier} defaults</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="text-xs"
            >
              Select all
            </Button>
          </div>

          {/* Model list */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
            {allModels?.map(model => (
              <div
                key={model.id}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border cursor-pointer
                  transition-colors duration-150
                  ${
                    localSelection.includes(model.id)
                      ? "bg-primary/10 border-primary/30"
                      : "bg-secondary/50 border-border hover:bg-secondary"
                  }
                `}
                onClick={() => handleToggleModel(model.id)}
              >
                <Checkbox
                  checked={localSelection.includes(model.id)}
                  onCheckedChange={() => handleToggleModel(model.id)}
                  className="pointer-events-none"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{model.name}</span>
                    {tierIcons[model.tier]}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${providerColors[model.provider] || ""}`}
                    >
                      {model.provider}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {(model.contextWindow / 1000).toFixed(0)}k context
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Selected: {localSelection.length} model
            {localSelection.length !== 1 ? "s" : ""}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90"
          >
            Save Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
