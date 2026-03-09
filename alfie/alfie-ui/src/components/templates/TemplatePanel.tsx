'use client';

import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Store, ArrowRight, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TemplateCard } from './TemplateCard';
import { TemplateVariableInput } from './TemplateVariableInput';
import { useTemplateStore, useChatStore, useUIStore, type SessionTemplate } from '@/lib/store';
import { TEMPLATE_TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/templateData';

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
    setSelectedCategory,
    setSearchQuery,
    setIsLoading,
    setVariableValue,
    setIsMarketplaceOpen,
    clearSelection,
  } = useTemplateStore();
  
  const { createSession, addMessage } = useChatStore();
  const setPendingInput = useUIStore((state) => state.setPendingInput);

  useEffect(() => {
    setIsLoading(true);
    setTemplates(TEMPLATE_TEMPLATES);
    setCategories(TEMPLATE_CATEGORIES);
    setIsLoading(false);
  }, [setTemplates, setCategories, setIsLoading]);

  const applyVariables = useMemo(
    () => (template: SessionTemplate) => {
      let filledMessage = template.initialMessage;
      template.variables.forEach((variable) => {
        const placeholder = `{${variable.name}}`;
        const value = variableValues[variable.name] || variable.default || placeholder;
        filledMessage = filledMessage.split(placeholder).join(value);
      });
      return filledMessage;
    },
    [variableValues]
  );

  const handleInsertTemplate = (template: SessionTemplate) => {
    const filledMessage = applyVariables(template);
    setPendingInput(filledMessage);
  };

  const handleStartSession = (template: SessionTemplate) => {
    const filledMessage = applyVariables(template);
    createSession(template.name);
    if (template.systemPrompt) {
      addMessage({
        role: 'system',
        content: template.systemPrompt,
      });
    }
    addMessage({
      role: 'user',
      content: filledMessage,
    });
    clearSelection();
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
                onClick={() => handleStartSession(selectedTemplate)}
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
                  (searchQuery || selectedCategory)
                    ? filteredTemplates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          variant="compact"
                          onClick={() => handleInsertTemplate(template)}
                          onUse={() => handleStartSession(template)}
                        />
                      ))
                    : categories.map((category) => {
                        const templatesInCategory = filteredTemplates.filter(
                          (template) => template.category === category.id
                        );
                        if (templatesInCategory.length === 0) return null;
                        return (
                          <div key={category.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {category.name}
                              </span>
                              <Badge variant="secondary" className="text-[10px]">
                                {templatesInCategory.length}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {templatesInCategory.map((template) => (
                                <TemplateCard
                                  key={template.id}
                                  template={template}
                                  variant="compact"
                                  onClick={() => handleInsertTemplate(template)}
                                  onUse={() => handleStartSession(template)}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })
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
