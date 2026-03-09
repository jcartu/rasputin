'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Play, Edit, Trash2, Sparkles, Code, BookOpen,
  PenTool, Database, Lightbulb, Globe, Loader2, Eye, EyeOff, Zap, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiClient';

interface SkillVariable {
  name: string;
  description?: string;
  default?: string;
}

interface Skill {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: string;
  task_template: string;
  variables: SkillVariable[];
  model: string;
  is_public: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'general', label: 'General', icon: Globe },
  { id: 'code', label: 'Code', icon: Code },
  { id: 'research', label: 'Research', icon: BookOpen },
  { id: 'writing', label: 'Writing', icon: PenTool },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'creative', label: 'Creative', icon: Lightbulb },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  category: 'general',
  taskTemplate: '',
  variables: [] as SkillVariable[],
  model: '',
  isPublic: false,
};

export function SkillsPanel() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [editOpen, setEditOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [runOpen, setRunOpen] = useState(false);
  const [runningSkill, setRunningSkill] = useState<Skill | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [runResult, setRunResult] = useState<{ taskId: string } | null>(null);
  const [running, setRunning] = useState(false);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/skills?includePublic=true');
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch (e) {
      console.error('Failed to load skills:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  const filtered = skills.filter((s) => {
    if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const openCreate = useCallback(() => {
    setEditingSkill(null);
    setForm(EMPTY_FORM);
    setEditOpen(true);
  }, []);

  const openEdit = useCallback((skill: Skill) => {
    setEditingSkill(skill);
    setForm({
      name: skill.name,
      description: skill.description || '',
      category: skill.category || 'general',
      taskTemplate: skill.task_template,
      variables: skill.variables || [],
      model: skill.model || '',
      isPublic: skill.is_public,
    });
    setEditOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name || !form.taskTemplate) return;
    setSaving(true);
    try {
      const body = JSON.stringify({
        name: form.name,
        description: form.description,
        category: form.category,
        taskTemplate: form.taskTemplate,
        variables: form.variables,
        model: form.model || undefined,
        isPublic: form.isPublic,
      });
      const res = editingSkill
        ? await apiFetch(`/api/skills/${editingSkill.id}`, { method: 'PUT', body })
        : await apiFetch('/api/skills', { method: 'POST', body });
      if (res.ok) {
        setEditOpen(false);
        loadSkills();
      }
    } catch (e) {
      console.error('Failed to save skill:', e);
    } finally {
      setSaving(false);
    }
  }, [form, editingSkill, loadSkills]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/api/skills/${id}`, { method: 'DELETE' });
      if (res.ok) loadSkills();
    } catch (e) {
      console.error('Failed to delete skill:', e);
    }
  }, [loadSkills]);

  const openRun = useCallback((skill: Skill) => {
    setRunningSkill(skill);
    setRunResult(null);
    const defaults: Record<string, string> = {};
    (skill.variables || []).forEach((v) => {
      defaults[v.name] = v.default || '';
    });
    setVariableValues(defaults);
    setRunOpen(true);
  }, []);

  const handleRun = useCallback(async () => {
    if (!runningSkill) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await apiFetch(`/api/skills/${runningSkill.id}/run`, {
        method: 'POST',
        body: JSON.stringify({ variables: variableValues }),
      });
      if (res.ok) {
        const data = await res.json();
        setRunResult({ taskId: data.taskId });
      }
    } catch (e) {
      console.error('Failed to run skill:', e);
    } finally {
      setRunning(false);
    }
  }, [runningSkill, variableValues]);

  const addVariable = useCallback(() => {
    setForm((f) => ({
      ...f,
      variables: [...f.variables, { name: '', description: '', default: '' }],
    }));
  }, []);

  const removeVariable = useCallback((idx: number) => {
    setForm((f) => ({
      ...f,
      variables: f.variables.filter((_, i) => i !== idx),
    }));
  }, []);

  const updateVariable = useCallback((idx: number, field: keyof SkillVariable, value: string) => {
    setForm((f) => ({
      ...f,
      variables: f.variables.map((v, i) => i === idx ? { ...v, [field]: value } : v),
    }));
  }, []);

  const getCategoryIcon = (cat: string) => {
    const found = CATEGORIES.find((c) => c.id === cat);
    return found ? found.icon : Globe;
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Skills Marketplace</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and run reusable AI skill templates
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New Skill
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/30"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'gap-1.5 text-xs',
                    selectedCategory === cat.id && 'bg-primary text-primary-foreground'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Sparkles className="w-12 h-12 mb-4 opacity-30" />
              <p className="font-medium">No skills found</p>
              <p className="text-sm mt-1">Create your first skill to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((skill) => {
                const CatIcon = getCategoryIcon(skill.category);
                return (
                  <div
                    key={skill.id}
                    className="group rounded-xl border border-border/50 bg-card/50 p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <CatIcon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{skill.name}</h3>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {skill.is_public ? (
                          <Badge variant="secondary" className="text-[10px]">
                            <Eye className="w-3 h-3 mr-1" />Public
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            <EyeOff className="w-3 h-3 mr-1" />Private
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                      {skill.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="secondary" className="text-[10px]">{skill.category}</Badge>
                      {skill.variables?.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {skill.variables.length} variable{skill.variables.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        <Zap className="w-3 h-3 inline mr-0.5" />{skill.use_count || 0} runs
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 gap-1.5" onClick={() => openRun(skill)}>
                        <Play className="w-3.5 h-3.5" />
                        Run
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(skill)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(skill.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSkill ? 'Edit Skill' : 'Create Skill'}</DialogTitle>
            <DialogDescription>
              {editingSkill ? 'Update your skill template.' : 'Create a reusable AI skill with variable placeholders.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="skill-name">Name</Label>
                <Input
                  id="skill-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="My Skill"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  options={CATEGORIES.filter((c) => c.id !== 'all').map((c) => ({ value: c.id, label: c.label }))}
                  placeholder="Select category"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-desc">Description</Label>
              <Input
                id="skill-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What does this skill do?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-template">Task Template</Label>
              <Textarea
                id="skill-template"
                value={form.taskTemplate}
                onChange={(e) => setForm((f) => ({ ...f, taskTemplate: e.target.value }))}
                placeholder={'Write a {{language}} function that {{description}}'}
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {'Use {{variableName}} for dynamic placeholders'}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Variables</Label>
                <Button size="sm" variant="outline" onClick={addVariable} className="gap-1 h-7">
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
              {form.variables.map((v, i) => (
                <div key={`var-${v.name || i}`} className="flex gap-2 items-start">
                  <Input
                    placeholder="name"
                    value={v.name}
                    onChange={(e) => updateVariable(i, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="description"
                    value={v.description || ''}
                    onChange={(e) => updateVariable(i, 'description', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="default"
                    value={v.default || ''}
                    onChange={(e) => updateVariable(i, 'default', e.target.value)}
                    className="w-28"
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeVariable(i)} className="h-9 w-9 shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="skill-model">Model (optional)</Label>
                <Input
                  id="skill-model"
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="claude-opus-4-20250514"
                />
              </div>
              <div className="flex items-center gap-3 pt-7">
                <Switch
                  id="skill-public"
                  checked={form.isPublic}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, isPublic: c }))}
                />
                <Label htmlFor="skill-public">Public skill</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.taskTemplate}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingSkill ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Run: {runningSkill?.name}</DialogTitle>
            <DialogDescription>
              Fill in the variables below and run this skill.
            </DialogDescription>
          </DialogHeader>
          {runningSkill && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Template</p>
                <p className="text-sm font-mono whitespace-pre-wrap">{runningSkill.task_template}</p>
              </div>
              {(runningSkill.variables || []).length > 0 && (
                <div className="space-y-3">
                  {runningSkill.variables.map((v) => (
                    <div key={v.name} className="space-y-1.5">
                      <Label>{v.name}</Label>
                      {v.description && (
                        <p className="text-xs text-muted-foreground">{v.description}</p>
                      )}
                      <Input
                        value={variableValues[v.name] || ''}
                        onChange={(e) =>
                          setVariableValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                        }
                        placeholder={v.default || `Enter ${v.name}`}
                      />
                    </div>
                  ))}
                </div>
              )}
              {runResult && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                  <p className="text-sm text-green-400 font-medium">Task queued successfully</p>
                  <p className="text-xs text-muted-foreground mt-1">Task ID: {runResult.taskId}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunOpen(false)}>Close</Button>
            <Button onClick={handleRun} disabled={running || !!runResult} className="gap-2">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
