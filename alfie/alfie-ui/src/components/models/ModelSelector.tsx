'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Check,
  ChevronDown,
  Star,
  Zap,
  Clock,
  DollarSign,
  Activity,
  Settings,
  Plus,
  Search,
  X,
  RefreshCw,
  Server,
  Cloud,
  Sparkles,
  Brain,
  Globe,
  Route,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Layers,
  Eye,
  Play,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useModelStore, type AIModel, type ModelProvider, type ProviderConfig } from '@/lib/models';
import { modelsApi } from '@/lib/models/api';

const providerIcons: Record<ModelProvider, React.ComponentType<{ className?: string }>> = {
  openai: Sparkles,
  anthropic: Brain,
  google: Globe,
  local: Server,
  openrouter: Route,
  custom: Cloud,
};

const providerColors: Record<ModelProvider, string> = {
  openai: 'text-emerald-500',
  anthropic: 'text-orange-500',
  google: 'text-blue-500',
  local: 'text-purple-500',
  openrouter: 'text-pink-500',
  custom: 'text-slate-500',
};

export function ModelSelector() {
  const {
    models,
    providers,
    activeModelId,
    favoriteModelIds,
    isModelSelectorOpen,
    setModelSelectorOpen,
    setActiveModel,
    toggleFavorite,
    costSummary,
    performanceSummary,
    setComparisonViewOpen,
    setMarketplaceOpen,
    setProviderSettingsOpen,
  } = useModelStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'models' | 'comparison' | 'metrics' | 'providers'>('models');
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const activeModel = models.find(m => m.id === activeModelId);

  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         model.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider = selectedProvider === 'all' || model.provider === selectedProvider;
    return matchesSearch && matchesProvider;
  });

  const favoriteModels = filteredModels.filter(m => favoriteModelIds.includes(m.id));
  const otherModels = filteredModels.filter(m => !favoriteModelIds.includes(m.id));

  useEffect(() => {
    const loadModels = async () => {
      setIsLoading(true);
      try {
        const data = await modelsApi.listModels();
        useModelStore.getState().setModels(data.models);
        useModelStore.getState().setProviders(data.providers);
      } catch {
        console.error('Failed to load models');
      } finally {
        setIsLoading(false);
      }
    };

    if (isModelSelectorOpen && models.length === 0) {
      loadModels();
    }
  }, [isModelSelectorOpen, models.length]);

  const handleSelectModel = async (model: AIModel) => {
    try {
      await modelsApi.setActiveModel(model.id);
      setActiveModel(model.id);
      setModelSelectorOpen(false);
    } catch {
      console.error('Failed to set active model');
    }
  };

  const toggleModelForComparison = (modelId: string) => {
    setSelectedForComparison(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : prev.length < 4 ? [...prev, modelId] : prev
    );
  };

  const startComparison = () => {
    if (selectedForComparison.length >= 2) {
      setComparisonViewOpen(true);
      setModelSelectorOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setModelSelectorOpen(true)}
        className="gap-2 h-9 px-3"
      >
        {activeModel ? (
          <>
            {(() => {
              const Icon = providerIcons[activeModel.provider];
              return <Icon className={cn('w-4 h-4', providerColors[activeModel.provider])} />;
            })()}
            <span className="font-medium">{activeModel.name}</span>
          </>
        ) : (
          <>
            <Bot className="w-4 h-4" />
            <span>Select Model</span>
          </>
        )}
        <ChevronDown className="w-3 h-3 opacity-50" />
      </Button>

      <Dialog open={isModelSelectorOpen} onOpenChange={setModelSelectorOpen}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold">AI Model Manager</DialogTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setMarketplaceOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Marketplace
                </Button>
                <Button variant="outline" size="sm" onClick={() => setProviderSettingsOpen(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Providers
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
            <div className="px-6 pt-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="models" className="gap-2">
                  <Bot className="w-4 h-4" />
                  Models
                </TabsTrigger>
                <TabsTrigger value="comparison" className="gap-2">
                  <Layers className="w-4 h-4" />
                  Compare
                </TabsTrigger>
                <TabsTrigger value="metrics" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Metrics
                </TabsTrigger>
                <TabsTrigger value="providers" className="gap-2">
                  <Cloud className="w-4 h-4" />
                  Providers
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="models" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
              <div className="p-6 pb-4 space-y-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search models..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedProvider === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedProvider('all')}
                    >
                      All
                    </Button>
                    {providers.filter(p => p.isEnabled).map(provider => {
                      const Icon = providerIcons[provider.id];
                      return (
                        <Button
                          key={provider.id}
                          variant={selectedProvider === provider.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedProvider(provider.id)}
                          className="gap-1"
                        >
                          <Icon className={cn('w-3 h-3', selectedProvider !== provider.id && providerColors[provider.id])} />
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 px-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6 pb-6">
                    {favoriteModels.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          Favorites
                        </h3>
                        <div className="grid gap-3">
                          {favoriteModels.map(model => (
                            <ModelCard
                              key={model.id}
                              model={model}
                              isActive={model.id === activeModelId}
                              isFavorite={true}
                              isSelectedForComparison={selectedForComparison.includes(model.id)}
                              onSelect={() => handleSelectModel(model)}
                              onToggleFavorite={() => toggleFavorite(model.id)}
                              onToggleComparison={() => toggleModelForComparison(model.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      {favoriteModels.length > 0 && (
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">All Models</h3>
                      )}
                      <div className="grid gap-3">
                        {otherModels.map(model => (
                          <ModelCard
                            key={model.id}
                            model={model}
                            isActive={model.id === activeModelId}
                            isFavorite={false}
                            isSelectedForComparison={selectedForComparison.includes(model.id)}
                            onSelect={() => handleSelectModel(model)}
                            onToggleFavorite={() => toggleFavorite(model.id)}
                            onToggleComparison={() => toggleModelForComparison(model.id)}
                          />
                        ))}
                      </div>
                    </div>

                    {filteredModels.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No models found</p>
                        <Button variant="link" onClick={() => setMarketplaceOpen(true)}>
                          Browse Marketplace
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {selectedForComparison.length > 0 && (
                <motion.div
                  initial={{ y: 100 }}
                  animate={{ y: 0 }}
                  className="p-4 border-t bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {selectedForComparison.length} selected for comparison
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedForComparison([])}>
                        Clear
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      onClick={startComparison}
                      disabled={selectedForComparison.length < 2}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Comparison
                    </Button>
                  </div>
                </motion.div>
              )}
            </TabsContent>

            <TabsContent value="comparison" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
              <ComparisonView />
            </TabsContent>

            <TabsContent value="metrics" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
              <MetricsView costSummary={costSummary} performanceSummary={performanceSummary} models={models} />
            </TabsContent>

            <TabsContent value="providers" className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden">
              <ProvidersView providers={providers} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ModelCard({
  model,
  isActive,
  isFavorite,
  isSelectedForComparison,
  onSelect,
  onToggleFavorite,
  onToggleComparison,
}: {
  model: AIModel;
  isActive: boolean;
  isFavorite: boolean;
  isSelectedForComparison: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onToggleComparison: () => void;
}) {
  const Icon = providerIcons[model.provider];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative p-4 rounded-xl border transition-all cursor-pointer',
        isActive
          ? 'border-primary bg-primary/5'
          : isSelectedForComparison
          ? 'border-blue-500 bg-blue-500/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/30'
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          'bg-gradient-to-br from-muted to-muted/50'
        )}>
          <Icon className={cn('w-5 h-5', providerColors[model.provider])} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate">{model.name}</h4>
            {isActive && (
              <Badge variant="default" className="text-xs">Active</Badge>
            )}
            {model.status === 'unavailable' && (
              <Badge variant="destructive" className="text-xs">Unavailable</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate mt-0.5">{model.description}</p>

          <div className="flex flex-wrap gap-2 mt-2">
            {model.capabilities.slice(0, 4).map(cap => (
              <Badge key={cap} variant="secondary" className="text-xs">
                {cap}
              </Badge>
            ))}
            {model.capabilities.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{model.capabilities.length - 4}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              ${model.pricing.inputPerMillion.toFixed(2)}/M in
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {model.metrics.averageLatency > 0 ? `${Math.round(model.metrics.averageLatency)}ms` : 'N/A'}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {model.metrics.tokensPerSecond > 0 ? `${Math.round(model.metrics.tokensPerSecond)} t/s` : 'N/A'}
            </span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {(model.metrics.successRate * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
          >
            <Star className={cn('w-4 h-4', isFavorite && 'fill-yellow-500 text-yellow-500')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', isSelectedForComparison && 'bg-blue-500/10 text-blue-500')}
            onClick={(e) => {
              e.stopPropagation();
              onToggleComparison();
            }}
          >
            <Layers className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isActive && (
        <div className="absolute top-3 right-3">
          <Check className="w-5 h-5 text-primary" />
        </div>
      )}
    </motion.div>
  );
}

function ComparisonView() {
  const { comparisons, activeComparisonId, startComparison, models } = useModelStore();
  const [prompt, setPrompt] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const activeComparison = comparisons.find(c => c.id === activeComparisonId);

  const handleStartComparison = () => {
    if (selectedModels.length >= 2 && prompt.trim()) {
      const comparisonId = startComparison(selectedModels, prompt);
      modelsApi.compareModels(selectedModels, prompt, (modelId, update) => {
        useModelStore.getState().updateComparisonResponse(comparisonId, modelId, update);
      });
    }
  };

  return (
    <div className="flex-1 p-6 overflow-auto">
      {!activeComparison ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Start New Comparison</h3>
            <div className="space-y-4">
              <fieldset className="border-0 p-0 m-0">
                <legend className="text-sm font-medium mb-2 block">Select Models (2-4)</legend>
                <div className="grid grid-cols-2 gap-2">
                  {models.filter(m => m.status === 'available').slice(0, 8).map(model => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        setSelectedModels(prev =>
                          prev.includes(model.id)
                            ? prev.filter(id => id !== model.id)
                            : prev.length < 4 ? [...prev, model.id] : prev
                        );
                      }}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all',
                        selectedModels.includes(model.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="font-medium text-sm">{model.name}</div>
                      <div className="text-xs text-muted-foreground">{model.provider}</div>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="comparison-prompt" className="text-sm font-medium mb-2 block">Test Prompt</label>
                <textarea
                  id="comparison-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter a prompt to test across all selected models..."
                  className="w-full h-32 p-3 rounded-lg border bg-transparent resize-none"
                />
              </div>
              <Button
                onClick={handleStartComparison}
                disabled={selectedModels.length < 2 || !prompt.trim()}
                className="w-full"
              >
                <Play className="w-4 h-4 mr-2" />
                Run Comparison
              </Button>
            </div>
          </div>

          {comparisons.filter(c => c.isSaved).length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4">Saved Comparisons</h3>
              <div className="space-y-2">
                {comparisons.filter(c => c.isSaved).map(comparison => (
                  <button
                    key={comparison.id}
                    type="button"
                    className="w-full p-4 rounded-lg border hover:bg-muted/30 cursor-pointer text-left"
                    onClick={() => useModelStore.getState().setActiveComparison(comparison.id)}
                  >
                    <div className="font-medium">{comparison.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {comparison.models.length} models compared
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <ComparisonResults comparison={activeComparison} models={models} />
      )}
    </div>
  );
}

function ComparisonResults({ comparison, models }: { comparison: NonNullable<ReturnType<typeof useModelStore.getState>['comparisons'][0]>; models: AIModel[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{comparison.name}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => useModelStore.getState().setActiveComparison(null)}
        >
          <X className="w-4 h-4 mr-2" />
          Close
        </Button>
      </div>

      <div className="p-4 rounded-lg bg-muted/30 border">
        <div className="text-sm font-medium mb-1">Prompt</div>
        <p className="text-sm text-muted-foreground">{comparison.prompt}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {comparison.responses.map(response => {
          const model = models.find(m => m.id === response.modelId);
          return (
            <div key={response.modelId} className="p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">{model?.name || 'Unknown Model'}</div>
                <Badge variant={response.status === 'complete' ? 'default' : 'secondary'}>
                  {response.status}
                </Badge>
              </div>
              <div className="text-sm whitespace-pre-wrap max-h-48 overflow-auto">
                {response.response || (response.status === 'pending' ? 'Waiting...' : 'Loading...')}
              </div>
              {response.status === 'complete' && (
                <div className="flex gap-4 mt-3 text-xs text-muted-foreground border-t pt-3">
                  <span>{response.latency}ms</span>
                  <span>{response.outputTokens} tokens</span>
                  <span>${response.cost.toFixed(4)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricsView({
  costSummary,
  performanceSummary,
  models,
}: {
  costSummary: ReturnType<typeof useModelStore.getState>['costSummary'];
  performanceSummary: ReturnType<typeof useModelStore.getState>['performanceSummary'];
  models: AIModel[];
}) {
  return (
    <div className="flex-1 p-6 overflow-auto space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Cost Tracking
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Today" value={`$${costSummary.today.toFixed(2)}`} icon={Clock} />
          <MetricCard label="This Week" value={`$${costSummary.thisWeek.toFixed(2)}`} icon={TrendingUp} />
          <MetricCard label="This Month" value={`$${costSummary.thisMonth.toFixed(2)}`} icon={BarChart3} />
          <MetricCard label="All Time" value={`$${costSummary.allTime.toFixed(2)}`} icon={DollarSign} />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Performance Metrics
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            label="Avg Latency"
            value={`${Math.round(performanceSummary.averageLatency)}ms`}
            icon={Clock}
          />
          <MetricCard
            label="P95 Latency"
            value={`${Math.round(performanceSummary.p95Latency)}ms`}
            icon={Clock}
          />
          <MetricCard
            label="Tokens/sec"
            value={`${Math.round(performanceSummary.averageTokensPerSecond)}`}
            icon={Zap}
          />
          <MetricCard
            label="Success Rate"
            value={`${(performanceSummary.successRate * 100).toFixed(1)}%`}
            icon={Activity}
          />
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-lg font-medium mb-4">Cost by Model</h3>
        <div className="space-y-2">
          {Object.entries(costSummary.byModel)
            .sort(([, a], [, b]) => b - a)
            .map(([modelId, cost]) => {
              const model = models.find(m => m.id === modelId);
              return (
                <div key={modelId} className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="font-medium">{model?.name || modelId}</span>
                  <span className="text-muted-foreground">${cost.toFixed(2)}</span>
                </div>
              );
            })}
          {Object.keys(costSummary.byModel).length === 0 && (
            <p className="text-muted-foreground text-center py-8">No usage data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="p-4 rounded-xl border bg-card">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function ProvidersView({ providers }: { providers: ProviderConfig[] }) {
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const { customEndpoints, addCustomEndpoint, removeCustomEndpoint } = useModelStore();
  const [showAddEndpoint, setShowAddEndpoint] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState({
    name: '',
    baseUrl: '',
    apiKey: '',
    provider: 'openai-compatible' as const,
  });

  const handleTestProvider = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      await modelsApi.testProvider(providerId);
    } catch {
      console.error('Provider test failed');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleAddEndpoint = () => {
    if (newEndpoint.name && newEndpoint.baseUrl) {
      addCustomEndpoint({
        ...newEndpoint,
        models: [],
        isActive: true,
      });
      setNewEndpoint({ name: '', baseUrl: '', apiKey: '', provider: 'openai-compatible' });
      setShowAddEndpoint(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-auto space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Cloud Providers</h3>
        <div className="space-y-3">
          {providers.map(provider => {
            const Icon = providerIcons[provider.id];
            return (
              <div key={provider.id} className="p-4 rounded-xl border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      'bg-gradient-to-br from-muted to-muted/50'
                    )}>
                      <Icon className={cn('w-5 h-5', providerColors[provider.id])} />
                    </div>
                    <div>
                      <div className="font-medium">{provider.name}</div>
                      <div className="text-sm text-muted-foreground">{provider.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={provider.isConfigured ? 'default' : 'secondary'}>
                      {provider.isConfigured ? 'Configured' : 'Not Configured'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestProvider(provider.id)}
                      disabled={testingProvider === provider.id}
                    >
                      {testingProvider === provider.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  <span className="font-mono">{provider.baseUrl}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Custom Endpoints</h3>
          <Button variant="outline" size="sm" onClick={() => setShowAddEndpoint(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Endpoint
          </Button>
        </div>

        {customEndpoints.length > 0 ? (
          <div className="space-y-3">
            {customEndpoints.map(endpoint => (
              <div key={endpoint.id} className="p-4 rounded-xl border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{endpoint.name}</div>
                      <div className="text-sm text-muted-foreground font-mono">{endpoint.baseUrl}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={endpoint.isActive ? 'default' : 'secondary'}>
                      {endpoint.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomEndpoint(endpoint.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No custom endpoints configured</p>
            <p className="text-sm">Add endpoints for local models or custom API providers</p>
          </div>
        )}

        <AnimatePresence>
          {showAddEndpoint && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 rounded-xl border bg-muted/30 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="endpoint-name" className="text-sm font-medium mb-2 block">Name</label>
                  <Input
                    id="endpoint-name"
                    value={newEndpoint.name}
                    onChange={(e) => setNewEndpoint(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Local Model"
                  />
                </div>
                <div>
                  <label htmlFor="endpoint-url" className="text-sm font-medium mb-2 block">Base URL</label>
                  <Input
                    id="endpoint-url"
                    value={newEndpoint.baseUrl}
                    onChange={(e) => setNewEndpoint(prev => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder="http://localhost:8001/v1"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="endpoint-apikey" className="text-sm font-medium mb-2 block">API Key (Optional)</label>
                <Input
                  id="endpoint-apikey"
                  type="password"
                  value={newEndpoint.apiKey}
                  onChange={(e) => setNewEndpoint(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowAddEndpoint(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddEndpoint}>
                  Add Endpoint
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
