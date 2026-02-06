import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  Star,
  Download,
  GitFork,
  TrendingUp,
  Eye,
  Filter,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Copy,
  Heart,
  MessageSquare,
  Clock,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketplacePrompt {
  id: number;
  title: string;
  description: string;
  content: string;
  author: {
    name: string;
    avatar?: string;
    verified: boolean;
  };
  category: string;
  tags: string[];
  rating: number;
  reviewCount: number;
  downloadCount: number;
  forkCount: number;
  price: number;
  isFeatured: boolean;
  createdAt: string;
}

const MOCK_MARKETPLACE_PROMPTS: MarketplacePrompt[] = [
  {
    id: 1,
    title: "Advanced Code Reviewer Pro",
    description: "Comprehensive code review with security analysis, performance optimization, and best practices suggestions. Works with 50+ programming languages.",
    content: "You are an expert code reviewer. Analyze the following {{language}} code...",
    author: { name: "Alex Chen", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex", verified: true },
    category: "Development",
    tags: ["code-review", "security", "performance", "best-practices"],
    rating: 4.9,
    reviewCount: 128,
    downloadCount: 3500,
    forkCount: 245,
    price: 0,
    isFeatured: true,
    createdAt: "2024-01-10",
  },
  {
    id: 2,
    title: "Marketing Copy Generator",
    description: "Create compelling marketing copy for ads, landing pages, and social media posts. Includes A/B testing variations.",
    content: "Generate marketing copy for {{product}} targeting {{audience}}...",
    author: { name: "Sarah Miller", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah", verified: true },
    category: "Marketing",
    tags: ["marketing", "copywriting", "ads", "social-media"],
    rating: 4.7,
    reviewCount: 89,
    downloadCount: 2100,
    forkCount: 156,
    price: 0,
    isFeatured: true,
    createdAt: "2024-01-15",
  },
  {
    id: 3,
    title: "Data Analysis Assistant",
    description: "Analyze datasets and generate insights with statistical summaries, visualizations, and actionable recommendations.",
    content: "Analyze the following data: {{data}}...",
    author: { name: "Dr. James Wong", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=james", verified: false },
    category: "Analysis",
    tags: ["data", "analytics", "statistics", "insights"],
    rating: 4.5,
    reviewCount: 45,
    downloadCount: 890,
    forkCount: 67,
    price: 0,
    isFeatured: false,
    createdAt: "2024-01-20",
  },
  {
    id: 4,
    title: "Creative Story Writer",
    description: "Generate creative stories, narratives, and fiction in multiple genres with customizable style and tone.",
    content: "Write a {{genre}} story about {{premise}}...",
    author: { name: "Emma Davis", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=emma", verified: true },
    category: "Creative",
    tags: ["creative-writing", "fiction", "stories", "narrative"],
    rating: 4.8,
    reviewCount: 67,
    downloadCount: 1560,
    forkCount: 98,
    price: 0,
    isFeatured: false,
    createdAt: "2024-01-25",
  },
  {
    id: 5,
    title: "Technical Documentation Generator",
    description: "Create professional technical documentation including API docs, user guides, and system architecture descriptions.",
    content: "Generate documentation for {{system}} including {{sections}}...",
    author: { name: "Mike Johnson", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike", verified: false },
    category: "Development",
    tags: ["documentation", "technical-writing", "api-docs"],
    rating: 4.6,
    reviewCount: 34,
    downloadCount: 720,
    forkCount: 45,
    price: 0,
    isFeatured: false,
    createdAt: "2024-02-01",
  },
];

const CATEGORIES = ["All", "Development", "Marketing", "Analysis", "Creative", "Communication"];

export function PromptMarketplace({ className }: { className?: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("popular");
  const [selectedPrompt, setSelectedPrompt] = useState<MarketplacePrompt | null>(null);

  const featuredPrompts = useMemo(
    () => MOCK_MARKETPLACE_PROMPTS.filter((p) => p.isFeatured),
    []
  );

  const filteredPrompts = useMemo(() => {
    let filtered = MOCK_MARKETPLACE_PROMPTS;

    if (selectedCategory !== "All") {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    switch (sortBy) {
      case "popular":
        filtered = [...filtered].sort((a, b) => b.downloadCount - a.downloadCount);
        break;
      case "rating":
        filtered = [...filtered].sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        filtered = [...filtered].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    return filtered;
  }, [selectedCategory, searchQuery, sortBy]);

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "h-3 w-3",
              star <= rating ? "text-amber-400 fill-amber-400" : "text-zinc-600"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            Prompt Marketplace
          </h2>
          <p className="text-sm text-zinc-500 mt-1">Discover and use community prompts</p>
        </div>
      </div>

      {featuredPrompts.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-400" />
            Featured Prompts
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {featuredPrompts.map((prompt) => (
              <Card
                key={prompt.id}
                className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border-cyan-500/30 hover:border-cyan-500/50 transition-all cursor-pointer group"
                onClick={() => setSelectedPrompt(prompt)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12 border-2 border-cyan-500/30">
                      <AvatarImage src={prompt.author.avatar} />
                      <AvatarFallback>{prompt.author.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white group-hover:text-cyan-400 transition-colors truncate">
                          {prompt.title}
                        </h4>
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Featured</Badge>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{prompt.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          {renderStars(prompt.rating)}
                          <span className="ml-1">{prompt.rating}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          {prompt.downloadCount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800"
          />
        </div>

        <div className="flex items-center gap-2">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "h-8 px-3",
                selectedCategory === cat && "bg-cyan-500/10 text-cyan-400"
              )}
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1 border border-zinc-800 rounded-lg bg-zinc-900 p-1">
          {["popular", "rating", "newest"].map((sort) => (
            <Button
              key={sort}
              variant="ghost"
              size="sm"
              onClick={() => setSortBy(sort)}
              className={cn(
                "h-7 px-2 text-xs capitalize",
                sortBy === sort && "bg-cyan-500/10 text-cyan-400"
              )}
            >
              {sort}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-400px)]">
        <div className="grid grid-cols-3 gap-4">
          {filteredPrompts.map((prompt) => (
            <Card
              key={prompt.id}
              className="bg-zinc-900/50 border-zinc-800 hover:border-cyan-500/30 transition-all cursor-pointer group"
              onClick={() => setSelectedPrompt(prompt)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={prompt.author.avatar} />
                      <AvatarFallback>{prompt.author.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-sm text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                        {prompt.title}
                      </CardTitle>
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        {prompt.author.name}
                        {prompt.author.verified && (
                          <Badge variant="secondary" className="h-3 px-1 text-[10px]">PRO</Badge>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
                <CardDescription className="text-xs mt-2 line-clamp-2">
                  {prompt.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1 mb-3">
                  <Badge variant="outline" className="text-xs bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                    {prompt.category}
                  </Badge>
                  {prompt.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-1">
                    {renderStars(prompt.rating)}
                    <span className="ml-1">{prompt.rating}</span>
                    <span className="text-zinc-600">({prompt.reviewCount})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5">
                      <Download className="h-3 w-3" />
                      {prompt.downloadCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <GitFork className="h-3 w-3" />
                      {prompt.forkCount}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={!!selectedPrompt} onOpenChange={() => setSelectedPrompt(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {selectedPrompt && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedPrompt.author.avatar} />
                    <AvatarFallback>{selectedPrompt.author.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <DialogTitle className="text-xl">{selectedPrompt.title}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1 text-sm text-zinc-400">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {selectedPrompt.author.name}
                      </span>
                      {selectedPrompt.author.verified && (
                        <Badge variant="secondary" className="text-xs">Verified</Badge>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {selectedPrompt.createdAt}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-auto py-4 space-y-4">
                <DialogDescription className="text-base">
                  {selectedPrompt.description}
                </DialogDescription>

                <div className="flex items-center gap-4 p-4 bg-zinc-900 rounded-lg">
                  <div className="flex-1 flex items-center gap-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {renderStars(selectedPrompt.rating)}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        {selectedPrompt.rating} ({selectedPrompt.reviewCount} reviews)
                      </p>
                    </div>
                    <div className="h-8 w-px bg-zinc-800" />
                    <div className="text-center">
                      <p className="text-lg font-semibold text-white">{selectedPrompt.downloadCount.toLocaleString()}</p>
                      <p className="text-xs text-zinc-500">Downloads</p>
                    </div>
                    <div className="h-8 w-px bg-zinc-800" />
                    <div className="text-center">
                      <p className="text-lg font-semibold text-white">{selectedPrompt.forkCount}</p>
                      <p className="text-xs text-zinc-500">Forks</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedPrompt.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-zinc-300">Preview</h4>
                  <div className="bg-zinc-900 rounded-lg p-4 font-mono text-sm text-zinc-400 max-h-48 overflow-auto">
                    {selectedPrompt.content}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Heart className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="outline" size="sm">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Reviews
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <GitFork className="h-4 w-4 mr-2" />
                    Fork
                  </Button>
                  <Button className="bg-cyan-600 hover:bg-cyan-700">
                    <Download className="h-4 w-4 mr-2" />
                    Use This Prompt
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PromptMarketplace;
