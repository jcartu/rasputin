'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Clock, Play, Pause, Trash2, Loader2, Calendar,
  Timer, RefreshCw, AlertCircle, CheckCircle2, Zap,
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
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/apiClient';
import { formatDistanceToNow } from 'date-fns';

interface Schedule {
  id: string;
  user_id: string;
  name: string;
  cron_expression: string;
  task_input: string;
  is_active: boolean;
  last_run_at: string | null;
  run_count: number;
  max_runs: number | null;
  created_at: string;
}

function cronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;

  if (min === '*' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return 'Every minute';
  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return `Every ${min.slice(2)} minutes`;
  }
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return 'Every hour';
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '*') return 'Every day at midnight';
  if (min === '0' && hour !== '*' && dom === '*' && mon === '*' && dow === '*') {
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Every day at ${h12}:00 ${ampm}`;
  }
  if (min === '0' && hour !== '*' && dom === '*' && mon === '*' && dow === '1-5') {
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `Weekdays at ${h12}:00 ${ampm}`;
  }
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '0') return 'Every Sunday at midnight';
  if (min === '0' && hour === '0' && dom === '*' && mon === '*' && dow === '1') return 'Every Monday at midnight';
  if (hour.startsWith('*/') && min === '0' && dom === '*' && mon === '*' && dow === '*') {
    return `Every ${hour.slice(2)} hours`;
  }
  return expr;
}

const CRON_PRESETS = [
  { label: 'Every 5 min', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily midnight', value: '0 0 * * *' },
  { label: 'Weekdays 9am', value: '0 9 * * 1-5' },
];

export function SchedulesPanel() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', cronExpression: '', taskInput: '', maxRuns: '' });
  const [saving, setSaving] = useState(false);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/schedules');
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch (e) {
      console.error('Failed to load schedules:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  const handleCreate = useCallback(async () => {
    if (!form.name || !form.cronExpression || !form.taskInput) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        cronExpression: form.cronExpression,
        taskInput: form.taskInput,
      };
      if (form.maxRuns) body.maxRuns = parseInt(form.maxRuns, 10);
      const res = await apiFetch('/api/schedules', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setCreateOpen(false);
        setForm({ name: '', cronExpression: '', taskInput: '', maxRuns: '' });
        loadSchedules();
      }
    } catch (e) {
      console.error('Failed to create schedule:', e);
    } finally {
      setSaving(false);
    }
  }, [form, loadSchedules]);

  const handleToggle = useCallback(async (id: string, current: boolean) => {
    try {
      await apiFetch(`/api/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !current }),
      });
      setSchedules((prev) =>
        prev.map((s) => s.id === id ? { ...s, is_active: !current } : s)
      );
    } catch (e) {
      console.error('Failed to toggle schedule:', e);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (res.ok) loadSchedules();
    } catch (e) {
      console.error('Failed to delete schedule:', e);
    }
  }, [loadSchedules]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Scheduled Tasks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automate recurring agent tasks with cron schedules
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Schedule
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Clock className="w-12 h-12 mb-4 opacity-30" />
              <p className="font-medium">No scheduled tasks</p>
              <p className="text-sm mt-1">Create a schedule to run agent tasks automatically</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className={cn(
                    'rounded-xl border bg-card/50 p-5 transition-all duration-200',
                    schedule.is_active
                      ? 'border-primary/30 shadow-sm shadow-primary/5'
                      : 'border-border/50 opacity-70'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{schedule.name}</h3>
                        {schedule.is_active ? (
                          <Badge variant="default" className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            <Pause className="w-3 h-3 mr-1" />Paused
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5" />
                          {cronToHuman(schedule.cron_expression)}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[10px]">
                          ({schedule.cron_expression})
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground line-clamp-1">
                        <span className="text-foreground/60">Task:</span>{' '}
                        {schedule.task_input}
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {schedule.run_count} run{schedule.run_count !== 1 ? 's' : ''}
                          {schedule.max_runs ? ` / ${schedule.max_runs} max` : ''}
                        </span>
                        {schedule.last_run_at && (
                          <span className="flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Last: {formatDistanceToNow(new Date(schedule.last_run_at), { addSuffix: true })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Created {formatDistanceToNow(new Date(schedule.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={() => handleToggle(schedule.id, schedule.is_active)}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive h-8 w-8"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Schedule</DialogTitle>
            <DialogDescription>
              Set up a recurring agent task with a cron expression.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sched-name">Name</Label>
              <Input
                id="sched-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Daily report generation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-cron">Cron Expression</Label>
              <Input
                id="sched-cron"
                value={form.cronExpression}
                onChange={(e) => setForm((f) => ({ ...f, cronExpression: e.target.value }))}
                placeholder="*/5 * * * *"
                className="font-mono"
              />
              {form.cronExpression && (
                <p className="text-xs text-primary">
                  {cronToHuman(form.cronExpression)}
                </p>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {CRON_PRESETS.map((p) => (
                  <Button
                    key={p.value}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2"
                    onClick={() => setForm((f) => ({ ...f, cronExpression: p.value }))}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-task">Task Input</Label>
              <Textarea
                id="sched-task"
                value={form.taskInput}
                onChange={(e) => setForm((f) => ({ ...f, taskInput: e.target.value }))}
                placeholder="Generate a summary of today's news about AI..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                The prompt/task that the agent will execute on each run.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-max">Max Runs (optional)</Label>
              <Input
                id="sched-max"
                type="number"
                value={form.maxRuns}
                onChange={(e) => setForm((f) => ({ ...f, maxRuns: e.target.value }))}
                placeholder="Unlimited"
                min={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !form.name || !form.cronExpression || !form.taskInput}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
