'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Store, ArrowRight, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TemplateCard } from './TemplateCard';
import { TemplateVariableInput } from './TemplateVariableInput';
import { useTemplateStore, useChatStore, type SessionTemplate } from '@/lib/store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function TemplatePanel() {
  const {
    templates,
    categories,
    selectedTemplate,
    selectedCategory,
    searchQuery,
    isLoading,
    variableValues,
    setTemplates,
    setCategories,
    setSelectedTemplate,
    setSelectedCategory,
    setSearchQuery,
    setIsLoading,
    setVariableValue,
    setIsMarketplaceOpen,
    clearSelection,
  } = useTemplateStore();
  
  const { createSession, addMessage } = useChatStore();

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (selectedCategory) params.set('category', selectedCategory);
      
      const res = await fetch(`${API_BASE}/api/templates?${params}`);
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory, setTemplates, setIsLoading]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/templates/categories`);
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, [setCategories]);

  useEffect(() => {
    fetchTemplates();
    fetchCategories();
  }, [fetchTemplates, fetchCategories]);

  const handleUseTemplate = async (template: SessionTemplate) => {
    try {
      const res = await fetch(`${API_BASE}/api/templates/${template.id}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: variableValues }),
      });
      const data = await res.json();
      
      const sessionId = createSession(template.name);
      
      if (data.sessionConfig.initialMessage) {
        addMessage({
          role: 'system',
          content: data.sessionConfig.systemPrompt,
        });
        addMessage({
          role: 'user',
          content: data.sessionConfig.initialMessage,
        });
      }
      
      clearSelection();
    } catch (err) {
      console.error('Failed to use template:', err);
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (selectedCategory && t.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 px-2"
            onClick={() => setIsMarketplaceOpen(true)}
          >
            <Store className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <Badge
            variant={selectedCategory === null ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name} ({cat.count})
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      <AnimatePresence mode="wait">
        {selectedTemplate ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col"
          >
            <div className="p-3 border-b flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => clearSelection()}
              >
                <X className="w-4 h-4 mr-1" />
                Back
              </Button>
              <span className="font-medium text-sm truncate">{selectedTemplate.name}</span>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                <p className="text-sm text-muted-foreground">
                  {selectedTemplate.description}
                </p>
                
                {selectedTemplate.variables.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Configure Variables</h4>
                    {selectedTemplate.variables.map((variable) => (
                      <TemplateVariableInput
                        key={variable.name}
                        variable={variable}
                        value={variableValues[variable.name] || ''}
                        onChange={(value) => setVariableValue(variable.name, value)}
                      />
                    ))}
                  </div>
                )}
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">System Prompt Preview</h4>
                  <div className="p-2 rounded-md bg-muted/50 text-xs font-mono max-h-32 overflow-auto">
                    {selectedTemplate.systemPrompt}
                  </div>
                </div>
              </div>
            </ScrollArea>
            
            <div className="p-3 border-t">
              <Button 
                className="w-full" 
                onClick={() => handleUseTemplate(selectedTemplate)}
              >
                Start Session
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1"
          >
            <ScrollArea className="h-full">
              <div className="p-3 space-y-2">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Loading templates...
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No templates found
                  </div>
                ) : (
                  filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      variant="compact"
                      onClick={() => setSelectedTemplate(template)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
      
      <Separator />
      
      <div className="p-3">
        <Button 
          variant="outline" 
          className="w-full gap-2"
          onClick={() => {
            setIsMarketplaceOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          Create Template
        </Button>
      </div>
    </div>
  );
}
