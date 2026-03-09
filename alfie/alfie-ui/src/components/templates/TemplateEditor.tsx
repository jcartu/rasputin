'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTemplateStore, type TemplateVariable } from '@/lib/store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const CATEGORIES = [
  { id: 'code', name: 'Code' },
  { id: 'writing', name: 'Writing' },
  { id: 'analysis', name: 'Analysis' },
  { id: 'creative', name: 'Creative' },
  { id: 'research', name: 'Research' },
  { id: 'productivity', name: 'Productivity' },
  { id: 'custom', name: 'Custom' },
];

const ICONS = [
  'code-2',
  'search',
  'pen-tool',
  'bar-chart-3',
  'palette',
  'zap',
  'lightbulb',
  'bug',
  'layout',
  'graduation-cap',
  'server',
  'file-text',
];

interface TemplateEditorProps {
  onSave?: () => void;
}

export function TemplateEditor({ onSave }: TemplateEditorProps) {
  const {
    isEditorOpen,
    editingTemplate,
    setIsEditorOpen,
    setEditingTemplate,
  } = useTemplateStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('custom');
  const [icon, setIcon] = useState('file-text');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingTemplate) {
      setName(editingTemplate.name);
      setDescription(editingTemplate.description);
      setCategory(editingTemplate.category);
      setIcon(editingTemplate.icon);
      setSystemPrompt(editingTemplate.systemPrompt);
      setInitialMessage(editingTemplate.initialMessage);
      setTags(editingTemplate.tags);
      setVariables(editingTemplate.variables);
    } else {
      setName('');
      setDescription('');
      setCategory('custom');
      setIcon('file-text');
      setSystemPrompt('');
      setInitialMessage('');
      setTags([]);
      setVariables([]);
    }
  }, [editingTemplate]);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleAddVariable = () => {
    setVariables([
      ...variables,
      { name: '', description: '', required: false, default: '' }
    ]);
  };

  const handleUpdateVariable = (index: number, field: keyof TemplateVariable, value: string | boolean) => {
    const newVariables = [...variables];
    newVariables[index] = { ...newVariables[index], [field]: value };
    setVariables(newVariables);
  };

  const handleRemoveVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name || !systemPrompt) return;
    
    setIsSaving(true);
    try {
      const payload = {
        name,
        description,
        category,
        icon,
        systemPrompt,
        initialMessage,
        tags,
        variables: variables.filter(v => v.name),
        author: 'User',
      };
      
      if (editingTemplate && !editingTemplate.isBuiltIn) {
        await fetch(`${API_BASE}/api/templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${API_BASE}/api/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      
      setIsEditorOpen(false);
      setEditingTemplate(null);
      onSave?.();
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setIsEditorOpen(false);
    setEditingTemplate(null);
  };

  return (
    <Dialog open={isEditorOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>
            {editingTemplate ? 'Edit Template' : 'Create New Template'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-140px)]">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="My Template"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={category} 
                  onValueChange={setCategory}
                  options={CATEGORIES.map(cat => ({ value: cat.id, label: cat.name }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="A brief description of what this template does"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <Select 
                value={icon} 
                onValueChange={setIcon}
                options={ICONS.map(iconName => ({ value: iconName, label: iconName }))}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt *</Label>
              <Textarea
                id="systemPrompt"
                placeholder="You are a helpful assistant that..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{VARIABLE_NAME}}'} syntax for variables
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="initialMessage">Initial Message</Label>
              <Textarea
                id="initialMessage"
                placeholder="The first message to start the conversation..."
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                rows={3}
                className="font-mono text-sm"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Variables</Label>
                <Button variant="outline" size="sm" onClick={handleAddVariable}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Variable
                </Button>
              </div>
              
              {variables.map((variable, index) => (
                <div key={`var-${variable.name || index}`} className="p-3 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <Input
                      placeholder="VARIABLE_NAME"
                      value={variable.name}
                      onChange={(e) => handleUpdateVariable(index, 'name', e.target.value.toUpperCase().replace(/\s/g, '_'))}
                      className="font-mono text-sm w-48"
                    />
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`required-${index}`} className="text-sm">Required</Label>
                      <Switch
                        id={`required-${index}`}
                        checked={variable.required}
                        onCheckedChange={(checked) => handleUpdateVariable(index, 'required', checked)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveVariable(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Description"
                      value={variable.description}
                      onChange={(e) => handleUpdateVariable(index, 'description', e.target.value)}
                    />
                    <Input
                      placeholder="Default value"
                      value={variable.default}
                      onChange={(e) => handleUpdateVariable(index, 'default', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                />
                <Button variant="outline" onClick={handleAddTag}>
                  Add
                </Button>
              </div>
              <div className="flex gap-1 flex-wrap mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X 
                      className="w-3 h-3 cursor-pointer" 
                      onClick={() => handleRemoveTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name || !systemPrompt || isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
