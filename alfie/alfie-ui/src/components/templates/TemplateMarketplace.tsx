'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  Star,
  TrendingUp,
  Clock,
  Filter,
  Code2,
  Palette,
  PenTool,
  BarChart3,
  Search as SearchIcon,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TemplateCard } from './TemplateCard';
import { TemplateEditor } from './TemplateEditor';
import { useTemplateStore, type SessionTemplate } from '@/lib/store';
import { TEMPLATE_TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/templateData';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  code: Code2,
  writing: PenTool,
  analysis: BarChart3,
  creative: Palette,
  research: SearchIcon,
  productivity: Zap,
};

export function TemplateMarketplace() {
  const {
    templates,
    categories,
    searchQuery,
    selectedCategory,
    isMarketplaceOpen,
    setTemplates,
    setCategories,
    setSelectedTemplate,
    setSearchQuery,
    setSelectedCategory,
    setIsMarketplaceOpen,
    setIsEditorOpen,
    setEditingTemplate,
  } = useTemplateStore();
  
  const [activeTab, setActiveTab] = useState('featured');
  const [featuredTemplates, setFeaturedTemplates] = useState<SessionTemplate[]>([]);

  useEffect(() => {
    if (isMarketplaceOpen) {
      setTemplates(TEMPLATE_TEMPLATES);
      setCategories(TEMPLATE_CATEGORIES);
      setFeaturedTemplates(TEMPLATE_TEMPLATES.slice(0, 6));
    }
  }, [isMarketplaceOpen, setTemplates, setCategories]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      if (selectedCategory && template.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        template.name.toLowerCase().includes(q) ||
        template.description.toLowerCase().includes(q) ||
        template.tags.some(tag => tag.toLowerCase().includes(q))
      );
    });
  }, [templates, selectedCategory, searchQuery]);

  const templatesByCategory = categories.reduce((acc, cat) => {
    acc[cat.id] = filteredTemplates.filter(t => t.category === cat.id);
    return acc;
  }, {} as Record<string, SessionTemplate[]>);

  const handleSelectTemplate = (template: SessionTemplate) => {
    setSelectedTemplate(template);
    setIsMarketplaceOpen(false);
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setIsEditorOpen(true);
  };

  const refreshTemplates = () => {
    setTemplates(TEMPLATE_TEMPLATES);
    setCategories(TEMPLATE_CATEGORIES);
    setFeaturedTemplates(TEMPLATE_TEMPLATES.slice(0, 6));
  };

  return (
    <>
      <Dialog open={isMarketplaceOpen} onOpenChange={setIsMarketplaceOpen}>
        <DialogContent className="max-w-4xl h-[80vh] p-0 gap-0">
          <DialogHeader className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">Template Marketplace</DialogTitle>
              <Button variant="default" size="sm" onClick={handleCreateNew}>
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search all templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-auto py-0">
              <TabsTrigger 
                value="featured" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Featured
              </TabsTrigger>
              <TabsTrigger 
                value="all" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                <Filter className="w-4 h-4 mr-2" />
                All Templates
              </TabsTrigger>
              <TabsTrigger 
                value="recent" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                <Clock className="w-4 h-4 mr-2" />
                Recent
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <TabsContent value="featured" className="m-0 p-4">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      Popular Templates
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {featuredTemplates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          onClick={() => handleSelectTemplate(template)}
                          onUse={() => handleSelectTemplate(template)}
                        />
                      ))}
                    </div>
                  </div>

                  {categories.map((category) => {
                    const catTemplates = templatesByCategory[category.id] || [];
                    if (catTemplates.length === 0) return null;
                    const IconComponent = CATEGORY_ICONS[category.id] || Code2;
                    
                    return (
                      <div key={category.id}>
                        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <IconComponent className="w-4 h-4" />
                          {category.name}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {catTemplates.slice(0, 3).map((template) => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              onClick={() => handleSelectTemplate(template)}
                              onUse={() => handleSelectTemplate(template)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="all" className="m-0 p-4">
                <div className="flex gap-2 mb-4 flex-wrap">
                  <Badge
                    variant={selectedCategory === null ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-accent"
                    onClick={() => setSelectedCategory(null)}
                  >
                    All
                  </Badge>
                  {categories.map((cat) => (
                    <Badge
                      key={cat.id}
                      variant={selectedCategory === cat.id ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      {cat.name} ({cat.count})
                    </Badge>
                  ))}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onClick={() => handleSelectTemplate(template)}
                      onUse={() => handleSelectTemplate(template)}
                    />
                  ))}
                </div>
                
                {filteredTemplates.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No templates found matching your search
                  </div>
                )}
              </TabsContent>

              <TabsContent value="recent" className="m-0 p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[...templates]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 12)
                    .map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onClick={() => handleSelectTemplate(template)}
                        onUse={() => handleSelectTemplate(template)}
                      />
                    ))}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      <TemplateEditor onSave={refreshTemplates} />
    </>
  );
}
