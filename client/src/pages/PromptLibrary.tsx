import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PromptEditor } from "@/components/PromptEditor";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Grid3X3,
  List,
  Star,
  Copy,
  Trash2,
  Share2,
  Play,
  BarChart3,
  Clock,
  DollarSign,
  TrendingUp,
  Filter,
  Sparkles,
  BookOpen,
  Store,
  Heart,
  MoreHorizontal,
  ChevronRight,
  Zap,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Prompt {
  id: number;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  usageCount: number;
  avgSuccessRate: number;
  avgCost: number;
  isTemplate: boolean;
  isPublic: boolean;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

const MOCK_PROMPTS: Prompt[] = [
  {
    id: 1,
    title: "Code Review Assistant",
    description: "Analyze code for bugs, performance issues, and best practices",
    content: "Review the following {{language}} code and provide feedback on:\n1. Potential bugs\n2. Performance optimizations\n3. Best practices\n4. Security concerns\n\nCode:\n```\n{{code}}\n```",
    category: "Development",
    tags: ["code", "review", "best-practices"],
    usageCount: 156,
    avgSuccessRate: 94,
    avgCost: 0.02,
    isTemplate: true,
    isPublic: true,
    isFavorite: true,
    createdAt: "2024-01-15",
    updatedAt: "2024-02-01",
  },
  {
    id: 2,
    title: "Content Summarizer",
    description: "Summarize long documents into concise key points",
    content: "Summarize the following {{content_type}} into {{summary_length}} bullet points:\n\n{{content}}\n\nFocus on: {{focus_areas}}",
    category: "Writing",
    tags: ["summarize", "content", "writing"],
    usageCount: 89,
    avgSuccessRate: 91,
    avgCost: 0.01,
    isTemplate: true,
    isPublic: false,
    isFavorite: false,
    createdAt: "2024-01-20",
    updatedAt: "2024-01-25",
  },
  {
    id: 3,
    title: "SQL Query Generator",
    description: "Generate SQL queries from natural language descriptions",
    content: "Generate a {{dialect}} SQL query for the following request:\n\n{{description}}\n\nDatabase schema:\n{{schema}}\n\nReturn only the SQL query without explanation.",
    category: "Development",
    tags: ["sql", "database", "query"],
    usageCount: 234,
    avgSuccessRate: 88,
    avgCost: 0.015,
    isTemplate: true,
    isPublic: true,
    isFavorite: true,
    createdAt: "2024-01-10",
    updatedAt: "2024-02-05",
  },
  {
    id: 4,
    title: "Email Composer",
    description: "Draft professional emails based on context",
    content: "Write a {{tone}} email to {{recipient}} about:\n\n{{subject}}\n\nKey points to include:\n{{key_points}}\n\nSign off as: {{sender_name}}",
    category: "Communication",
    tags: ["email", "professional", "communication"],
    usageCount: 67,
    avgSuccessRate: 96,
    avgCost: 0.008,
    isTemplate: true,
    isPublic: false,
    isFavorite: false,
    createdAt: "2024-02-01",
    updatedAt: "2024-02-03",
  },
];

const CATEGORIES = ["All", "Development", "Writing", "Communication", "Analysis", "Creative"];

export default function PromptLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("my-prompts");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [newPrompt, setNewPrompt] = useState({ title: "", description: "", content: "", category: "Development" });

  const filteredPrompts = useMemo(() => {
    let filtered = MOCK_PROMPTS;
    
    if (activeTab === "favorites") {
      filtered = filtered.filter((p) => p.isFavorite);
    } else if (activeTab === "templates") {
      filtered = filtered.filter((p) => p.isTemplate);
    }
    
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
      case "most-used":
        filtered = [...filtered].sort((a, b) => b.usageCount - a.usageCount);
        break;
      case "highest-success":
        filtered = [...filtered].sort((a, b) => b.avgSuccessRate - a.avgSuccessRate);
        break;
      case "newest":
      default:
        filtered = [...filtered].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }
    
    return filtered;
  }, [activeTab, selectedCategory, searchQuery, sortBy]);

  const stats = useMemo(() => ({
    totalPrompts: MOCK_PROMPTS.length,
    totalRuns: MOCK_PROMPTS.reduce((acc, p) => acc + p.usageCount, 0),
    avgSuccessRate: Math.round(MOCK_PROMPTS.reduce((acc, p) => acc + p.avgSuccessRate, 0) / MOCK_PROMPTS.length),
    totalCost: MOCK_PROMPTS.reduce((acc, p) => acc + p.avgCost * p.usageCount, 0).toFixed(2),
  }), []);

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-cyan-400" />
              Prompt Library
            </h1>
            <p className="text-zinc-400 mt-1">Manage, test, and optimize your prompts</p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-cyan-600 hover:bg-cyan-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Prompt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Create New Prompt</DialogTitle>
                <DialogDescription>
                  Build a reusable prompt with variables for dynamic content
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-auto space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={newPrompt.title}
                      onChange={(e) => setNewPrompt({ ...newPrompt, title: e.target.value })}
                      placeholder="My Awesome Prompt"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={newPrompt.category}
                      onValueChange={(v) => setNewPrompt({ ...newPrompt, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newPrompt.description}
                    onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                    placeholder="What does this prompt do?"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prompt Content</Label>
                  <div className="h-[300px]">
                    <PromptEditor
                      value={newPrompt.content}
                      onChange={(v) => setNewPrompt({ ...newPrompt, content: v })}
                      showVariablePanel={true}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  Create Prompt
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Prompts", value: stats.totalPrompts, icon: FileText, color: "cyan" },
            { label: "Total Runs", value: stats.totalRuns, icon: Play, color: "green" },
            { label: "Avg Success Rate", value: `${stats.avgSuccessRate}%`, icon: TrendingUp, color: "purple" },
            { label: "Total Cost", value: `$${stats.totalCost}`, icon: DollarSign, color: "amber" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">{stat.label}</p>
                    <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                  </div>
                  <div className={cn("p-3 rounded-xl", `bg-${stat.color}-500/10`)}>
                    <stat.icon className={cn("h-5 w-5", `text-${stat.color}-400`)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-zinc-900 border border-zinc-800">
              <TabsTrigger value="my-prompts" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <BookOpen className="h-4 w-4 mr-2" />
                My Prompts
              </TabsTrigger>
              <TabsTrigger value="templates" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <FileText className="h-4 w-4 mr-2" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="marketplace" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <Store className="h-4 w-4 mr-2" />
                Marketplace
              </TabsTrigger>
              <TabsTrigger value="favorites" className="data-[state=active]:bg-cyan-500/10 data-[state=active]:text-cyan-400">
                <Heart className="h-4 w-4 mr-2" />
                Favorites
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64 bg-zinc-900 border-zinc-800"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-36 bg-zinc-900 border-zinc-800">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="most-used">Most Used</SelectItem>
                  <SelectItem value="highest-success">Highest Success</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center border border-zinc-800 rounded-lg bg-zinc-900 p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={cn("h-8 w-8 p-0", viewMode === "grid" && "bg-cyan-500/10 text-cyan-400")}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className={cn("h-8 w-8 p-0", viewMode === "list" && "bg-cyan-500/10 text-cyan-400")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <TabsContent value={activeTab} className="flex-1 m-0">
            <ScrollArea className="h-[calc(100vh-380px)]">
              {filteredPrompts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                  <Sparkles className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg">No prompts found</p>
                  <p className="text-sm mt-1">Try adjusting your filters or create a new prompt</p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {filteredPrompts.map((prompt) => (
                      <motion.div
                        key={prompt.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card
                          className="bg-zinc-900/50 border-zinc-800 hover:border-cyan-500/30 transition-all cursor-pointer group"
                          onClick={() => setSelectedPrompt(prompt)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-base text-white group-hover:text-cyan-400 transition-colors">
                                  {prompt.title}
                                </CardTitle>
                                <CardDescription className="text-sm mt-1 line-clamp-2">
                                  {prompt.description}
                                </CardDescription>
                              </div>
                              {prompt.isFavorite && (
                                <Star className="h-4 w-4 text-amber-400 fill-amber-400 flex-shrink-0" />
                              )}
                            </div>
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
                              <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Play className="h-3 w-3" />
                                  {prompt.usageCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  {prompt.avgSuccessRate}%
                                </span>
                              </div>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {prompt.avgCost.toFixed(3)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPrompts.map((prompt) => (
                    <Card
                      key={prompt.id}
                      className="bg-zinc-900/50 border-zinc-800 hover:border-cyan-500/30 transition-all cursor-pointer"
                      onClick={() => setSelectedPrompt(prompt)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-cyan-500/10">
                              <FileText className="h-5 w-5 text-cyan-400" />
                            </div>
                            <div>
                              <h3 className="font-medium text-white">{prompt.title}</h3>
                              <p className="text-sm text-zinc-500 line-clamp-1">{prompt.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm text-zinc-500">
                            <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                              {prompt.category}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <Play className="h-4 w-4" />
                              {prompt.usageCount}
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4" />
                              {prompt.avgSuccessRate}%
                            </span>
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedPrompt} onOpenChange={() => setSelectedPrompt(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {selectedPrompt && (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <DialogTitle className="text-xl">{selectedPrompt.title}</DialogTitle>
                      <DialogDescription className="mt-1">
                        {selectedPrompt.description}
                      </DialogDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </Button>
                      <Button variant="outline" size="sm">
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                      <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700">
                        <Play className="h-4 w-4 mr-2" />
                        Run
                      </Button>
                    </div>
                  </div>
                </DialogHeader>
                <div className="flex-1 overflow-auto py-4">
                  <div className="h-[400px]">
                    <PromptEditor
                      value={selectedPrompt.content}
                      onChange={() => {}}
                      showVariablePanel={true}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4 text-sm text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Updated {selectedPrompt.updatedAt}
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart3 className="h-4 w-4" />
                      {selectedPrompt.usageCount} runs
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
