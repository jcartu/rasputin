'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, FolderOpen, Edit, Trash2, MessageSquare,
  ArrowLeft, Loader2, FileText, Link, Unlink, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiClient';
import { useChatStore } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';

interface ProjectConversation {
  project_id: string;
  conversation_thread_id: string;
}

interface Project {
  id: string;
  userId?: string;
  user_id?: string;
  name: string;
  description: string;
  instructions: string;
  knowledgeBase?: Record<string, unknown>;
  knowledge_base?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  conversations?: ProjectConversation[];
  conversationCount?: number;
}

export function ProjectsPanel() {
  const sessions = useChatStore((s) => s.sessions);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState({ name: '', description: '', instructions: '' });
  const [saving, setSaving] = useState(false);

  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [addConvoOpen, setAddConvoOpen] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/projects?limit=50&offset=0');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await apiFetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailProject(data);
      }
    } catch (e) {
      console.error('Failed to load project detail:', e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const filtered = projects.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
  });

  const openCreate = useCallback(() => {
    setEditingProject(null);
    setForm({ name: '', description: '', instructions: '' });
    setEditOpen(true);
  }, []);

  const openEdit = useCallback((project: Project) => {
    setEditingProject(project);
    setForm({
      name: project.name,
      description: project.description || '',
      instructions: project.instructions || '',
    });
    setEditOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const body = JSON.stringify({
        name: form.name,
        description: form.description,
        instructions: form.instructions,
      });
      const res = editingProject
        ? await apiFetch(`/api/projects/${editingProject.id}`, { method: 'PUT', body })
        : await apiFetch('/api/projects', { method: 'POST', body });
      if (res.ok) {
        setEditOpen(false);
        loadProjects();
        if (editingProject && detailProject?.id === editingProject.id) {
          loadDetail(editingProject.id);
        }
      }
    } catch (e) {
      console.error('Failed to save project:', e);
    } finally {
      setSaving(false);
    }
  }, [form, editingProject, loadProjects, detailProject, loadDetail]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (detailProject?.id === id) setDetailProject(null);
        loadProjects();
      }
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  }, [loadProjects, detailProject]);

  const handleAddConversation = useCallback(async (threadId: string) => {
    if (!detailProject) return;
    try {
      const res = await apiFetch(`/api/projects/${detailProject.id}/conversations`, {
        method: 'POST',
        body: JSON.stringify({ threadId }),
      });
      if (res.ok) {
        setAddConvoOpen(false);
        loadDetail(detailProject.id);
      }
    } catch (e) {
      console.error('Failed to add conversation:', e);
    }
  }, [detailProject, loadDetail]);

  const handleRemoveConversation = useCallback(async (threadId: string) => {
    if (!detailProject) return;
    try {
      const res = await apiFetch(`/api/projects/${detailProject.id}/conversations/${threadId}`, {
        method: 'DELETE',
      });
      if (res.ok) loadDetail(detailProject.id);
    } catch (e) {
      console.error('Failed to remove conversation:', e);
    }
  }, [detailProject, loadDetail]);

  const assignedThreadIds = new Set(
    (detailProject?.conversations || []).map((c) => c.conversation_thread_id)
  );
  const availableSessions = sessions.filter((s) => !assignedThreadIds.has(s.id));

  if (detailProject) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 mb-3 -ml-2"
            onClick={() => setDetailProject(null)}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{detailProject.name}</h1>
              {detailProject.description && (
                <p className="text-sm text-muted-foreground mt-1">{detailProject.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(detailProject)}>
                <Edit className="w-4 h-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => handleDelete(detailProject.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {detailProject.instructions && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  System Instructions
                </h3>
                <div className="rounded-lg bg-muted/30 border border-border/50 p-4">
                  <p className="text-sm whitespace-pre-wrap">{detailProject.instructions}</p>
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Conversations ({detailProject.conversations?.length || 0})
                </h3>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddConvoOpen(true)}>
                  <Link className="w-3.5 h-3.5" />
                  Add Conversation
                </Button>
              </div>
              {detailLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (detailProject.conversations || []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No conversations assigned</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(detailProject.conversations || []).map((conv) => {
                    const session = sessions.find((s) => s.id === conv.conversation_thread_id);
                    return (
                      <div
                        key={conv.conversation_thread_id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/30"
                      >
                        <div className="flex items-center gap-3">
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{session?.name || conv.conversation_thread_id}</p>
                            {session && (
                              <p className="text-xs text-muted-foreground">
                                {session.messages.length} messages
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveConversation(conv.conversation_thread_id)}
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <Dialog open={addConvoOpen} onOpenChange={setAddConvoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Conversation</DialogTitle>
              <DialogDescription>
                Select a conversation to assign to this project.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1">
                {availableSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No unassigned conversations available
                  </p>
                ) : (
                  availableSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 text-left transition-colors"
                      onClick={() => handleAddConversation(session.id)}
                    >
                      <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{session.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {session.messages.length} messages
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingProject ? 'Edit Project' : 'Create Project'}</DialogTitle>
              <DialogDescription>
                {editingProject ? 'Update project details.' : 'Create a new project workspace.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  id="project-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="My Project"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-desc">Description</Label>
                <Textarea
                  id="project-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What is this project about?"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-instructions">System Instructions</Label>
                <Textarea
                  id="project-instructions"
                  value={form.instructions}
                  onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                  placeholder="Custom system prompt for conversations in this project..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  These instructions override the default system prompt for conversations in this project.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.name}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingProject ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organize conversations into workspaces with shared instructions
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/30"
          />
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
              <FolderOpen className="w-12 h-12 mb-4 opacity-30" />
              <p className="font-medium">No projects yet</p>
              <p className="text-sm mt-1">Create your first project to organize conversations</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((project) => (
                <button
                  type="button"
                  key={project.id}
                  className="group rounded-xl border border-border/50 bg-card/50 p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 cursor-pointer text-left w-full"
                  onClick={() => loadDetail(project.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FolderOpen className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-sm">{project.name}</h3>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {project.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-2">
                    {project.instructions && (
                      <Badge variant="secondary" className="text-[10px]">
                        <FileText className="w-3 h-3 mr-1" />Custom Prompt
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {(() => {
                        const ts = project.createdAt || project.created_at;
                        if (!ts) return 'recently';
                        try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); }
                        catch { return 'recently'; }
                      })()}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3" role="toolbar" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => loadDetail(project.id)}>
                      <FolderOpen className="w-3.5 h-3.5" />
                      Open
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(project)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(project.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Create Project'}</DialogTitle>
            <DialogDescription>
              {editingProject ? 'Update project details.' : 'Create a new project workspace.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="My Project"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-desc">Description</Label>
              <Textarea
                id="project-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What is this project about?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-instructions">System Instructions</Label>
              <Textarea
                id="project-instructions"
                value={form.instructions}
                onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                placeholder="Custom system prompt for conversations in this project..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                These instructions override the default system prompt for conversations in this project.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingProject ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
