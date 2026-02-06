'use client';

import { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, X, Star, TrendingUp, Clock, Filter,
  Code, Palette, BookOpen, Sparkles
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
import { Separator } from '@/components/ui/separator';
import { TemplateCard } from './TemplateCard';
import { TemplateEditor } from './TemplateEditor';
import { useTemplateStore, type SessionTemplate } from '@/lib/store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'development': Code,
  'research': BookOpen,
  'writing': Palette,
  'creativity': Sparkles,
};

export function TemplateMarketplace() {
  const {
    templates,
    categories,
    selectedTemplate,
    searchQuery,
    isMarketplaceOpen,
    isEditorOpen,
    setTemplates,
    setCategories,
    setSelectedTemplate,
    setSearchQuery,
    setIsMarketplaceOpen,
    setIsEditorOpen,
    setEditingTemplate,
  } = useTemplateStore();
  
  const [activeTab, setActiveTab] = useState('featured');
  const [featuredTemplates, setFeaturedTemplates] = useState<SessionTemplate[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const [templatesRes, categoriesRes, featuredRes] = await Promise.all([
        fetch(`${API_BASE}/api/templates`),
        fetch(`${API_BASE}/api/templates/categories`),
        fetch(`${API_BASE}/api/templates?featured=true&limit=6`),
      ]);
      
      const [templatesData, categoriesData, featuredData] = await Promise.all([
        templatesRes.json(),
        categoriesRes.json(),
        featuredRes.json(),
      ]);
      
      setTemplates(templatesData.templates || []);
      setCategories(categoriesData.categories || []);
      setFeaturedTemplates(featuredData.templates || []);
    } catch (err) {
      console.error('Failed to fetch marketplace data:', err);
    }
  }, [setTemplates, setCategories]);

  useEffect(() => {
    if (isMarketplaceOpen) {
      fetchAll();
    }
  }, [isMarketplaceOpen, fetchAll]);

  const filteredTemplates = templates.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    );
  });

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

  const handleDuplicateTemplate = async (template: SessionTemplate) => {
    try {
      await fetch(`${API_BASE}/api/templates/${template.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${template.name} (Copy)` }),
      });
      fetchAll();
    } catch (err) {
      console.error('Failed to duplicate template:', err);
    }
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
                        />
                      ))}
                    </div>
                  </div>

                  {categories.map((category) => {
                    const catTemplates = templatesByCategory[category.id] || [];
                    if (catTemplates.length === 0) return null;
                    const IconComponent = CATEGORY_ICONS[category.id] || Code;
                    
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
                  {categories.map((cat) => (
                    <Badge
                      key={cat.id}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
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
                      />
                    ))}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      <TemplateEditor onSave={fetchAll} />
    </>
  );
}
