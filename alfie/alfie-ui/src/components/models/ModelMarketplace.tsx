'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Download,
  Star,
  Clock,
  DollarSign,
  Sparkles,
  Brain,
  Globe,
  Server,
  Route,
  Cloud,
  Code,
  FileText,
  BarChart,
  Eye,
  Zap,
  Check,
  ExternalLink,
  Filter,
  TrendingUp,
  Award,
  X,
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
import { useModelStore, type MarketplaceModel, type MarketplaceCategory, type ModelProvider } from '@/lib/models';
import { modelsApi } from '@/lib/models/api';

const categoryIcons: Record<MarketplaceCategory, React.ComponentType<{ className?: string }>> = {
  general: Sparkles,
  coding: Code,
  writing: FileText,
  analysis: BarChart,
  vision: Eye,
  embedding: Zap,
  specialized: Star,
};

const categoryLabels: Record<MarketplaceCategory, string> = {
  general: 'General Purpose',
  coding: 'Coding & Development',
  writing: 'Writing & Content',
  analysis: 'Analysis & Research',
  vision: 'Vision & Multimodal',
  embedding: 'Embeddings',
  specialized: 'Specialized',
};

const providerIcons: Record<ModelProvider, React.ComponentType<{ className?: string }>> = {
  openai: Sparkles,
  anthropic: Brain,
  google: Globe,
  local: Server,
  openrouter: Route,
  custom: Cloud,
};

export function ModelMarketplace() {
  const {
    marketplaceModels,
    marketplaceCategory,
    marketplaceSearch,
    isMarketplaceOpen,
    setMarketplaceModels,
    setMarketplaceCategory,
    setMarketplaceSearch,
    setMarketplaceOpen,
    installMarketplaceModel,
  } = useModelStore();

  const [selectedModel, setSelectedModel] = useState<MarketplaceModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);

  useEffect(() => {
    const loadMarketplace = async () => {
      setIsLoading(true);
      try {
        const data = await modelsApi.getMarketplace(
          marketplaceCategory !== 'all' ? marketplaceCategory : undefined,
          marketplaceSearch || undefined
        );
        setMarketplaceModels(data.models);
      } catch {
        console.error('Failed to load marketplace');
      } finally {
        setIsLoading(false);
      }
    };

    if (isMarketplaceOpen) {
      loadMarketplace();
    }
  }, [isMarketplaceOpen, marketplaceCategory, marketplaceSearch, setMarketplaceModels]);

  const handleInstall = async (model: MarketplaceModel) => {
    setInstallingId(model.id);
    try {
      await modelsApi.installModel(model.id);
      installMarketplaceModel(model.id);
    } catch {
      console.error('Failed to install model');
    } finally {
      setInstallingId(null);
    }
  };

  const featuredModels = marketplaceModels.filter(m => m.isFeatured);
  const newModels = marketplaceModels.filter(m => m.isNew);
  const filteredModels = marketplaceModels.filter(m => {
    if (marketplaceCategory !== 'all' && m.category !== marketplaceCategory) return false;
    if (marketplaceSearch) {
      const search = marketplaceSearch.toLowerCase();
      return (
        m.name.toLowerCase().includes(search) ||
        m.description.toLowerCase().includes(search) ||
        m.tags.some(t => t.toLowerCase().includes(search))
      );
    }
    return true;
  });

  return (
    <Dialog open={isMarketplaceOpen} onOpenChange={setMarketplaceOpen}>
      <DialogContent className="max-w-5xl h-[90vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">Model Marketplace</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Discover and install AI models from leading providers
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 pb-4 space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={marketplaceSearch}
                onChange={(e) => setMarketplaceSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={marketplaceCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMarketplaceCategory('all')}
              >
                All
              </Button>
              {(Object.keys(categoryIcons) as MarketplaceCategory[]).map(cat => {
                const Icon = categoryIcons[cat];
                return (
                  <Button
                    key={cat}
                    variant={marketplaceCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMarketplaceCategory(cat)}
                    className="gap-1"
                  >
                    <Icon className="w-3 h-3" />
                    <span className="hidden lg:inline">{categoryLabels[cat].split(' ')[0]}</span>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-8 pb-6">
            {featuredModels.length > 0 && marketplaceCategory === 'all' && !marketplaceSearch && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-lg font-semibold">Featured</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {featuredModels.slice(0, 4).map(model => (
                    <FeaturedModelCard
                      key={model.id}
                      model={model}
                      onSelect={() => setSelectedModel(model)}
                      onInstall={() => handleInstall(model)}
                      isInstalling={installingId === model.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {newModels.length > 0 && marketplaceCategory === 'all' && !marketplaceSearch && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-semibold">New Arrivals</h3>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  {newModels.slice(0, 6).map(model => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      onSelect={() => setSelectedModel(model)}
                      onInstall={() => handleInstall(model)}
                      isInstalling={installingId === model.id}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {marketplaceCategory === 'all' ? 'All Models' : categoryLabels[marketplaceCategory]}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {filteredModels.length} models
                </span>
              </div>
              {isLoading ? (
                <div className="grid md:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : filteredModels.length > 0 ? (
                <div className="grid md:grid-cols-3 gap-4">
                  {filteredModels.map(model => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      onSelect={() => setSelectedModel(model)}
                      onInstall={() => handleInstall(model)}
                      isInstalling={installingId === model.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No models found matching your criteria</p>
                </div>
              )}
            </section>
          </div>
        </ScrollArea>

        <AnimatePresence>
          {selectedModel && (
            <ModelDetails
              model={selectedModel}
              onClose={() => setSelectedModel(null)}
              onInstall={() => handleInstall(selectedModel)}
              isInstalling={installingId === selectedModel.id}
            />
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function FeaturedModelCard({
  model,
  onSelect,
  onInstall,
  isInstalling,
}: {
  model: MarketplaceModel;
  onSelect: () => void;
  onInstall: () => void;
  isInstalling: boolean;
}) {
  const ProviderIcon = providerIcons[model.provider];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative p-5 rounded-xl border bg-gradient-to-br from-primary/5 to-transparent hover:from-primary/10 transition-all cursor-pointer group"
      onClick={onSelect}
    >
      <div className="absolute top-3 right-3">
        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
          <Award className="w-3 h-3 mr-1" />
          Featured
        </Badge>
      </div>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <ProviderIcon className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-lg">{model.name}</h4>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{model.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          {model.rating.toFixed(1)}
        </span>
        <span className="flex items-center gap-1">
          <Download className="w-4 h-4" />
          {formatNumber(model.downloadCount)}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="w-4 h-4" />
          ${model.pricing.inputPerMillion.toFixed(2)}/M
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {model.capabilities.slice(0, 3).map(cap => (
          <Badge key={cap} variant="secondary" className="text-xs">
            {cap}
          </Badge>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onInstall();
          }}
          disabled={model.isInstalled || isInstalling}
        >
          {model.isInstalled ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Installed
            </>
          ) : isInstalling ? (
            'Installing...'
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Install
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}

function ModelCard({
  model,
  onSelect,
  onInstall,
  isInstalling,
}: {
  model: MarketplaceModel;
  onSelect: () => void;
  onInstall: () => void;
  isInstalling: boolean;
}) {
  const ProviderIcon = providerIcons[model.provider];
  const CategoryIcon = categoryIcons[model.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer group"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <ProviderIcon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-medium">{model.name}</h4>
            <p className="text-xs text-muted-foreground">{model.provider}</p>
          </div>
        </div>
        {model.isNew && (
          <Badge className="bg-green-500/10 text-green-600 text-xs">New</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
        {model.description}
      </p>

      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
          {model.rating.toFixed(1)}
        </span>
        <span className="flex items-center gap-1">
          <Download className="w-3 h-3" />
          {formatNumber(model.downloadCount)}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          ${model.pricing.inputPerMillion.toFixed(2)}/M
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <CategoryIcon className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{categoryLabels[model.category].split(' ')[0]}</span>
        </div>
        <Button
          size="sm"
          variant={model.isInstalled ? 'secondary' : 'default'}
          onClick={(e) => {
            e.stopPropagation();
            onInstall();
          }}
          disabled={model.isInstalled || isInstalling}
        >
          {model.isInstalled ? (
            <Check className="w-4 h-4" />
          ) : isInstalling ? (
            '...'
          ) : (
            <Download className="w-4 h-4" />
          )}
        </Button>
      </div>
    </motion.div>
  );
}

function ModelDetails({
  model,
  onClose,
  onInstall,
  isInstalling,
}: {
  model: MarketplaceModel;
  onClose: () => void;
  onInstall: () => void;
  isInstalling: boolean;
}) {
  const ProviderIcon = providerIcons[model.provider];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-background/95 backdrop-blur z-10"
    >
      <ScrollArea className="h-full">
        <div className="p-6 max-w-3xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6"
            onClick={onClose}
          >
            <X className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>

          <div className="flex items-start gap-6 mb-8">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <ProviderIcon className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold">{model.name}</h2>
                {model.isFeatured && (
                  <Badge className="bg-yellow-500/10 text-yellow-600">Featured</Badge>
                )}
              </div>
              <p className="text-muted-foreground">{model.description}</p>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  {model.rating.toFixed(1)} ({model.reviewCount} reviews)
                </span>
                <span className="flex items-center gap-1">
                  <Download className="w-4 h-4" />
                  {formatNumber(model.downloadCount)} downloads
                </span>
                <span>By {model.author}</span>
              </div>
            </div>
            <Button
              size="lg"
              onClick={onInstall}
              disabled={model.isInstalled || isInstalling}
            >
              {model.isInstalled ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Installed
                </>
              ) : isInstalling ? (
                'Installing...'
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Install Model
                </>
              )}
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="p-4 rounded-xl border">
              <h3 className="font-semibold mb-4">Pricing</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Input tokens</span>
                  <span className="font-mono">${model.pricing.inputPerMillion.toFixed(2)} / 1M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Output tokens</span>
                  <span className="font-mono">${model.pricing.outputPerMillion.toFixed(2)} / 1M</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border">
              <h3 className="font-semibold mb-4">Limits</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Context window</span>
                  <span className="font-mono">{formatNumber(model.limits.maxContextTokens)} tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max output</span>
                  <span className="font-mono">{formatNumber(model.limits.maxOutputTokens)} tokens</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="font-semibold mb-4">Capabilities</h3>
            <div className="flex flex-wrap gap-2">
              {model.capabilities.map(cap => (
                <Badge key={cap} variant="secondary" className="px-3 py-1">
                  {cap}
                </Badge>
              ))}
            </div>
          </div>

          {model.benchmarks && model.benchmarks.length > 0 && (
            <div className="mb-8">
              <h3 className="font-semibold mb-4">Benchmarks</h3>
              <div className="space-y-3">
                {model.benchmarks.map(benchmark => (
                  <div key={benchmark.name} className="flex items-center gap-4">
                    <span className="w-32 text-sm text-muted-foreground">{benchmark.name}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(benchmark.score / benchmark.maxScore) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono w-20 text-right">
                      {benchmark.score}/{benchmark.maxScore}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {model.longDescription && (
            <div className="mb-8">
              <h3 className="font-semibold mb-4">About</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{model.longDescription}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-8">
            {model.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          <Separator className="my-8" />

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Released {model.releaseDate}
              </span>
              <span>Updated {model.lastUpdated}</span>
            </div>
            {model.website && (
              <a
                href={model.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                Documentation
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
