'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Webhook,
  Plus,
  Trash2,
  Edit2,
  Play,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  Clock,
  Activity,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Filter,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useWebhookStore, type Webhook as WebhookType, type WebhookLog, type WebhookEvent, type WebhookStats } from '@/lib/webhookStore';
import { webhookApi } from '@/lib/webhookApi';

export function WebhookManager() {
  const {
    webhooks,
    selectedWebhook,
    logs,
    events,
    stats,
    isLoading,
    isCreating,
    isTesting,
    error,
    logsTotal,
    setWebhooks,
    setSelectedWebhook,
    setLogs,
    appendLogs,
    setEvents,
    setStats,
    setLoading,
    setCreating,
    setTesting,
    setError,
    updateWebhookInList,
    removeWebhookFromList,
  } = useWebhookStore();

  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [webhooksRes, eventsRes] = await Promise.all([
        webhookApi.list(),
        webhookApi.getEventTypes(),
      ]);
      setWebhooks(webhooksRes.webhooks);
      setEvents(eventsRes.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, [setWebhooks, setEvents, setLoading, setError]);

  const loadWebhookDetails = useCallback(async (webhook: WebhookType) => {
    setSelectedWebhook(webhook);
    try {
      const [logsRes, statsRes] = await Promise.all([
        webhookApi.getLogs(webhook.id, { limit: 20 }),
        webhookApi.getStats(webhook.id),
      ]);
      setLogs(logsRes.logs, logsRes.total);
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhook details');
    }
  }, [setSelectedWebhook, setLogs, setStats, setError]);

  useEffect(() => {
    loadWebhooks();
  }, [loadWebhooks]);

  const handleTestWebhook = async () => {
    if (!selectedWebhook) return;
    setTesting(true);
    try {
      const result = await webhookApi.test(selectedWebhook.id);
      if (result.success) {
        loadWebhookDetails(selectedWebhook);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await webhookApi.delete(id);
      removeWebhookFromList(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    }
  };

  const handleToggleEnabled = async (webhook: WebhookType) => {
    try {
      const updated = await webhookApi.update(webhook.id, { enabled: !webhook.enabled });
      updateWebhookInList(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle webhook');
    }
  };

  const handleCopySecret = async () => {
    if (!selectedWebhook) return;
    try {
      const result = await webhookApi.regenerateSecret(selectedWebhook.id);
      await navigator.clipboard.writeText(result.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to copy secret');
    }
  };

  const handleRetryDelivery = async (logId: string) => {
    try {
      await webhookApi.retryDelivery(logId);
      if (selectedWebhook) {
        loadWebhookDetails(selectedWebhook);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry delivery');
    }
  };

  const loadMoreLogs = async () => {
    if (!selectedWebhook || logs.length >= logsTotal) return;
    try {
      const res = await webhookApi.getLogs(selectedWebhook.id, {
        limit: 20,
        offset: logs.length,
      });
      appendLogs(res.logs, res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more logs');
    }
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Webhook className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Webhooks</h2>
              <p className="text-sm text-muted-foreground">Manage event notifications</p>
            </div>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Webhook
          </Button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search webhooks..." className="pl-9" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : webhooks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Webhook className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No webhooks configured</p>
                  <p className="text-xs mt-1">Click "Add Webhook" to get started</p>
                </div>
              ) : (
                webhooks.map((webhook) => (
                  <WebhookListItem
                    key={webhook.id}
                    webhook={webhook}
                    isSelected={selectedWebhook?.id === webhook.id}
                    onClick={() => loadWebhookDetails(webhook)}
                    onToggle={() => handleToggleEnabled(webhook)}
                    onDelete={() => handleDeleteWebhook(webhook.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedWebhook ? (
            <WebhookDetail
              webhook={selectedWebhook}
              logs={logs}
              stats={stats}
              events={events}
              isTesting={isTesting}
              showSecret={showSecret}
              copiedSecret={copiedSecret}
              onTest={handleTestWebhook}
              onEdit={() => setEditDialogOpen(true)}
              onToggleSecret={() => setShowSecret(!showSecret)}
              onCopySecret={handleCopySecret}
              onRetryDelivery={handleRetryDelivery}
              onLoadMore={loadMoreLogs}
              hasMoreLogs={logs.length < logsTotal}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Webhook className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Select a webhook to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateWebhookDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        events={events}
        isCreating={isCreating}
        setCreating={setCreating}
        onSuccess={(webhook) => {
          setWebhooks([...webhooks, webhook]);
          setCreateDialogOpen(false);
        }}
      />

      {selectedWebhook && (
        <EditWebhookDialog
          isOpen={isEditDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          webhook={selectedWebhook}
          events={events}
          onSuccess={(webhook) => {
            updateWebhookInList(webhook);
            setEditDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}

function WebhookListItem({
  webhook,
  isSelected,
  onClick,
  onToggle,
  onDelete,
}: {
  webhook: WebhookType;
  isSelected: boolean;
  onClick: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-all',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-accent/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{webhook.name}</h3>
            {!webhook.enabled && (
              <Badge variant="secondary" className="text-[10px] px-1.5">
                Disabled
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{webhook.url}</p>
          <div className="flex items-center gap-1 mt-2">
            {webhook.events.slice(0, 2).map((event) => (
              <Badge key={event} variant="outline" className="text-[10px] px-1.5">
                {event.split('.')[1]}
              </Badge>
            ))}
            {webhook.events.length > 2 && (
              <Badge variant="outline" className="text-[10px] px-1.5">
                +{webhook.events.length - 2}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Switch
            checked={webhook.enabled}
            onCheckedChange={(checked) => {
              onToggle();
            }}
            onClick={(e) => e.stopPropagation()}
            className="scale-75"
          />
        </div>
      </div>
    </motion.div>
  );
}

function WebhookDetail({
  webhook,
  logs,
  stats,
  events,
  isTesting,
  showSecret,
  copiedSecret,
  onTest,
  onEdit,
  onToggleSecret,
  onCopySecret,
  onRetryDelivery,
  onLoadMore,
  hasMoreLogs,
}: {
  webhook: WebhookType;
  logs: WebhookLog[];
  stats: WebhookStats | null;
  events: WebhookEvent[];
  isTesting: boolean;
  showSecret: boolean;
  copiedSecret: boolean;
  onTest: () => void;
  onEdit: () => void;
  onToggleSecret: () => void;
  onCopySecret: () => void;
  onRetryDelivery: (logId: string) => void;
  onLoadMore: () => void;
  hasMoreLogs: boolean;
}) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{webhook.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{webhook.description || 'No description'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit2 className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onTest}
              disabled={isTesting || !webhook.enabled}
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-1" />
              )}
              Test
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Total Deliveries"
            value={stats?.total ?? 0}
            icon={Activity}
          />
          <StatCard
            label="Success Rate"
            value={`${stats?.successRate ?? 0}%`}
            icon={Check}
            variant={stats && stats.successRate >= 90 ? 'success' : stats && stats.successRate >= 70 ? 'warning' : 'error'}
          />
          <StatCard
            label="Failed"
            value={stats?.failed ?? 0}
            icon={AlertCircle}
            variant={stats && stats.failed > 0 ? 'error' : 'default'}
          />
          <StatCard
            label="Avg Response"
            value={stats?.avgResponseTime ? `${stats.avgResponseTime}ms` : 'N/A'}
            icon={Clock}
          />
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Configuration</h4>
          <div className="grid gap-3">
            <div className="p-3 rounded-lg border border-border bg-card/50">
              <Label className="text-xs text-muted-foreground">Endpoint URL</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm flex-1 truncate">{webhook.url}</code>
                <a href={webhook.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </a>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card/50">
              <Label className="text-xs text-muted-foreground">Signing Secret</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm flex-1 font-mono">
                  {showSecret ? webhook.secret : '••••••••••••••••••••'}
                </code>
                <button type="button" onClick={onToggleSecret} className="text-muted-foreground hover:text-foreground">
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button type="button" onClick={onCopySecret} className="text-muted-foreground hover:text-foreground">
                  {copiedSecret ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Click copy to regenerate and copy a new secret
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card/50">
              <Label className="text-xs text-muted-foreground">Subscribed Events</Label>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {webhook.events.map((event) => (
                  <Badge key={event} variant="secondary" className="text-xs">
                    {event}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-border bg-card/50">
                <Label className="text-xs text-muted-foreground">Retry Count</Label>
                <p className="text-sm mt-1">{webhook.retryCount} attempts</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card/50">
                <Label className="text-xs text-muted-foreground">Retry Delay</Label>
                <p className="text-sm mt-1">{webhook.retryDelay}ms</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-card/50">
                <Label className="text-xs text-muted-foreground">Timeout</Label>
                <p className="text-sm mt-1">{webhook.timeout}ms</p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Recent Deliveries</h4>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              Filter
            </Button>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No delivery logs yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <LogEntry key={log.id} log={log} onRetry={() => onRetryDelivery(log.id)} />
              ))}
              {hasMoreLogs && (
                <Button variant="ghost" size="sm" className="w-full" onClick={onLoadMore}>
                  Load more
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) {
  const colorClasses = {
    default: 'text-muted-foreground',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500',
  };

  return (
    <div className="p-3 rounded-lg border border-border bg-card/50">
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', colorClasses[variant])} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={cn('text-xl font-semibold mt-1', colorClasses[variant])}>{value}</p>
    </div>
  );
}

function LogEntry({ log, onRetry }: { log: WebhookLog; onRetry: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    success: { color: 'text-green-500', bg: 'bg-green-500/10', label: 'Success' },
    failed: { color: 'text-red-500', bg: 'bg-red-500/10', label: 'Failed' },
    pending: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Pending' },
    retrying: { color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Retrying' },
  };

  const config = statusConfig[log.status];

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full p-3 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={cn('w-2 h-2 rounded-full', config.bg, config.color.replace('text-', 'bg-'))} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {log.eventType}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(log.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
        <Badge className={cn('text-[10px]', config.bg, config.color)}>{config.label}</Badge>
        {log.statusCode && (
          <span className="text-xs text-muted-foreground">HTTP {log.statusCode}</span>
        )}
        <ChevronRight className={cn('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border"
          >
            <div className="p-3 space-y-3 text-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Event ID</Label>
                <code className="block text-xs mt-1 font-mono">{log.eventId}</code>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Payload</Label>
                <pre className="mt-1 p-2 rounded bg-muted text-xs overflow-auto max-h-40">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </div>

              {log.response && (
                <div>
                  <Label className="text-xs text-muted-foreground">Response</Label>
                  <pre className="mt-1 p-2 rounded bg-muted text-xs overflow-auto max-h-20">
                    {log.response}
                  </pre>
                </div>
              )}

              {log.error && (
                <div>
                  <Label className="text-xs text-muted-foreground text-red-500">Error</Label>
                  <p className="mt-1 text-red-500">{log.error}</p>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Attempts: {log.attempts}</span>
                {log.deliveredAt && (
                  <span>Delivered: {new Date(log.deliveredAt).toLocaleString()}</span>
                )}
              </div>

              {log.status === 'failed' && (
                <Button size="sm" variant="outline" onClick={onRetry} className="w-full">
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Retry Delivery
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CreateWebhookDialog({
  isOpen,
  onClose,
  events,
  isCreating,
  setCreating,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  events: WebhookEvent[];
  isCreating: boolean;
  setCreating: (creating: boolean) => void;
  onSuccess: (webhook: WebhookType) => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !url.trim()) {
      setError('Name and URL are required');
      return;
    }

    try {
      new URL(url);
    } catch {
      setError('Invalid URL format');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const webhook = await webhookApi.create({
        name: name.trim(),
        url: url.trim(),
        description: description.trim(),
        events: selectedEvents,
      });
      onSuccess(webhook);
      setName('');
      setUrl('');
      setDescription('');
      setSelectedEvents([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  const eventsByCategory = events.reduce<Record<string, WebhookEvent[]>>((acc, event) => {
    if (!acc[event.category]) acc[event.category] = [];
    acc[event.category].push(event);
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Webhook</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My Webhook"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Endpoint URL</Label>
            <Input
              id="url"
              placeholder="https://example.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="What this webhook does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Events to Subscribe</Label>
            <div className="max-h-48 overflow-y-auto border border-border rounded-lg p-3 space-y-3">
              {Object.entries(eventsByCategory).map(([category, categoryEvents]) => (
                <div key={category}>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    {category}
                  </p>
                  <div className="space-y-1">
                    {categoryEvents.map((event) => (
                      <label
                        key={event.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(event.id)}
                          onChange={() => toggleEvent(event.id)}
                          className="rounded"
                        />
                        <span className="text-sm">{event.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            Create Webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditWebhookDialog({
  isOpen,
  onClose,
  webhook,
  events,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  webhook: WebhookType;
  events: WebhookEvent[];
  onSuccess: (webhook: WebhookType) => void;
}) {
  const [name, setName] = useState(webhook.name);
  const [url, setUrl] = useState(webhook.url);
  const [description, setDescription] = useState(webhook.description);
  const [selectedEvents, setSelectedEvents] = useState<string[]>(webhook.events);
  const [retryCount, setRetryCount] = useState(webhook.retryCount.toString());
  const [retryDelay, setRetryDelay] = useState(webhook.retryDelay.toString());
  const [timeout, setTimeout] = useState(webhook.timeout.toString());
  const [isUpdating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(webhook.name);
    setUrl(webhook.url);
    setDescription(webhook.description);
    setSelectedEvents(webhook.events);
    setRetryCount(webhook.retryCount.toString());
    setRetryDelay(webhook.retryDelay.toString());
    setTimeout(webhook.timeout.toString());
  }, [webhook]);

  const handleUpdate = async () => {
    if (!name.trim() || !url.trim()) {
      setError('Name and URL are required');
      return;
    }

    try {
      new URL(url);
    } catch {
      setError('Invalid URL format');
      return;
    }

    setUpdating(true);
    setError(null);

    try {
      const updated = await webhookApi.update(webhook.id, {
        name: name.trim(),
        url: url.trim(),
        description: description.trim(),
        events: selectedEvents,
        retryCount: parseInt(retryCount) || 3,
        retryDelay: parseInt(retryDelay) || 1000,
        timeout: parseInt(timeout) || 30000,
      });
      onSuccess(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    } finally {
      setUpdating(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  const eventsByCategory = events.reduce<Record<string, WebhookEvent[]>>((acc, event) => {
    if (!acc[event.category]) acc[event.category] = [];
    acc[event.category].push(event);
    return acc;
  }, {});

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Webhook</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-url">Endpoint URL</Label>
            <Input
              id="edit-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Input
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Events</Label>
            <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-3 space-y-3">
              {Object.entries(eventsByCategory).map(([category, categoryEvents]) => (
                <div key={category}>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    {category}
                  </p>
                  <div className="space-y-1">
                    {categoryEvents.map((event) => (
                      <label
                        key={event.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEvents.includes(event.id)}
                          onChange={() => toggleEvent(event.id)}
                          className="rounded"
                        />
                        <span className="text-sm">{event.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="retry-count">Retry Count</Label>
              <Input
                id="retry-count"
                type="number"
                min="0"
                max="10"
                value={retryCount}
                onChange={(e) => setRetryCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retry-delay">Retry Delay (ms)</Label>
              <Input
                id="retry-delay"
                type="number"
                min="100"
                value={retryDelay}
                onChange={(e) => setRetryDelay(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (ms)</Label>
              <Input
                id="timeout"
                type="number"
                min="1000"
                value={timeout}
                onChange={(e) => setTimeout(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
