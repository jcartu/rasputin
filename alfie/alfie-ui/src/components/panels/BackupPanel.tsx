'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  Plus,
  RefreshCw,
  Clock,
  Shield,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Calendar,
  Play,
  Lock,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  useBackupStore,
  fetchBackups,
  fetchStatistics,
  fetchPointInTimeOptions,
  createBackup,
  restoreBackup,
  deleteBackup,
  verifyBackup,
  fetchSchedules,
  createSchedule,
  toggleSchedule,
  triggerSchedule,
  deleteSchedule as deleteScheduleApi,
  formatBytes,
  formatDuration,
  BackupType,
  BackupStrategy,
  Backup,
  BackupSchedule,
  PointInTimeOption,
} from '@/lib/backupStore';

const STRATEGY_OPTIONS = [
  { value: 'full', label: 'Full Backup' },
  { value: 'incremental', label: 'Incremental' },
  { value: 'differential', label: 'Differential' },
];

const TYPE_OPTIONS = [
  { value: 'full', label: 'Everything' },
  { value: 'database', label: 'Database Only' },
  { value: 'files', label: 'Files Only' },
  { value: 'configurations', label: 'Configurations Only' },
];

const INTERVAL_OPTIONS = [
  { value: '1', label: 'Every hour' },
  { value: '6', label: 'Every 6 hours' },
  { value: '12', label: 'Every 12 hours' },
  { value: '24', label: 'Daily' },
  { value: '168', label: 'Weekly' },
];

interface CreateFormState {
  name: string;
  types: BackupType[];
  strategy: BackupStrategy;
  encrypt: boolean;
  password: string;
}

interface ScheduleFormState {
  name: string;
  intervalHours: number;
  types: BackupType[];
  strategy: BackupStrategy;
  encrypt: boolean;
  password: string;
}

interface RestoreFormState {
  password: string;
  dryRun: boolean;
}

export function BackupPanel() {
  const {
    backups,
    schedules,
    statistics,
    pointInTimeOptions,
    isLoading,
    isCreatingBackup,
    isRestoring,
    error,
    selectedBackupId,
    restoreDialogOpen,
    createDialogOpen,
    scheduleDialogOpen,
    setBackups,
    setSchedules,
    setStatistics,
    setPointInTimeOptions,
    setIsLoading,
    setIsCreatingBackup,
    setIsRestoring,
    setError,
    setSelectedBackupId,
    setRestoreDialogOpen,
    setCreateDialogOpen,
    setScheduleDialogOpen,
    addBackup,
    removeBackup,
  } = useBackupStore();

  const [activeTab, setActiveTab] = useState<'backups' | 'schedules' | 'restore'>('backups');
  const [createForm, setCreateForm] = useState<CreateFormState>({
    name: '',
    types: ['full'],
    strategy: 'full',
    encrypt: false,
    password: '',
  });
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    name: '',
    intervalHours: 24,
    types: ['full'],
    strategy: 'full',
    encrypt: false,
    password: '',
  });
  const [restoreForm, setRestoreForm] = useState<RestoreFormState>({
    password: '',
    dryRun: true,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [backupsData, statsData, schedulesData, pitData] = await Promise.all([
        fetchBackups({ limit: 50 }),
        fetchStatistics(),
        fetchSchedules(),
        fetchPointInTimeOptions(),
      ]);
      setBackups(backupsData.backups || []);
      setStatistics(statsData);
      setSchedules(schedulesData.schedules || []);
      setPointInTimeOptions(pitData.options || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [setBackups, setStatistics, setSchedules, setPointInTimeOptions, setIsLoading, setError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setError(null);
    try {
      const result = await createBackup({
        name: createForm.name || undefined,
        types: createForm.types,
        strategy: createForm.strategy,
        encrypt: createForm.encrypt,
        password: createForm.encrypt ? createForm.password : undefined,
      });
      addBackup(result.backup);
      setCreateDialogOpen(false);
      setCreateForm({ name: '', types: ['full'], strategy: 'full', encrypt: false, password: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackupId) return;
    setIsRestoring(true);
    setError(null);
    try {
      const result = await restoreBackup(selectedBackupId, {
        password: restoreForm.password || undefined,
        dryRun: restoreForm.dryRun,
      });
      if (restoreForm.dryRun) {
        alert(`Dry run complete. Would restore ${result.itemCount} items.`);
      } else {
        alert(`Restore complete. Restored ${result.itemCount} items.`);
      }
      setRestoreDialogOpen(false);
      setRestoreForm({ password: '', dryRun: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) return;
    try {
      await deleteBackup(id);
      removeBackup(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup');
    }
  };

  const handleVerifyBackup = async (id: string) => {
    try {
      const result = await verifyBackup(id);
      alert(result.valid ? 'Backup is valid!' : 'Backup verification failed!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify backup');
    }
  };

  const handleCreateSchedule = async () => {
    try {
      await createSchedule({
        name: scheduleForm.name || undefined,
        intervalMs: scheduleForm.intervalHours * 60 * 60 * 1000,
        types: scheduleForm.types,
        strategy: scheduleForm.strategy,
        encrypt: scheduleForm.encrypt,
        password: scheduleForm.encrypt ? scheduleForm.password : undefined,
        enabled: true,
      });
      setScheduleDialogOpen(false);
      setScheduleForm({ name: '', intervalHours: 24, types: ['full'], strategy: 'full', encrypt: false, password: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    }
  };

  const handleToggleSchedule = async (id: string, enabled: boolean) => {
    try {
      await toggleSchedule(id, enabled);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle schedule');
    }
  };

  const handleTriggerSchedule = async (id: string) => {
    try {
      const result = await triggerSchedule(id);
      addBackup(result.backup);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger backup');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      await deleteScheduleApi(id);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'in_progress': return <RefreshCw className="w-4 h-4 text-primary animate-spin" />;
      default: return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Archive className="w-4 h-4 text-primary" />
            Backup & Restore
          </h3>
          <Button variant="ghost" size="icon" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
        {statistics && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-card border border-border">
              <p className="text-muted-foreground">Total</p>
              <p className="font-bold">{statistics.completed}</p>
            </div>
            <div className="p-2 rounded-lg bg-card border border-border">
              <p className="text-muted-foreground">Size</p>
              <p className="font-bold">{statistics.totalSizeFormatted}</p>
            </div>
            <div className="p-2 rounded-lg bg-card border border-border">
              <p className="text-muted-foreground">Failed</p>
              <p className="font-bold text-destructive">{statistics.failed}</p>
            </div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col">
        <TabsList className="w-full rounded-none border-b border-border bg-transparent p-1 h-auto">
          <TabsTrigger value="backups" className="flex-1 text-xs">Backups</TabsTrigger>
          <TabsTrigger value="schedules" className="flex-1 text-xs">Schedules</TabsTrigger>
          <TabsTrigger value="restore" className="flex-1 text-xs">Restore</TabsTrigger>
        </TabsList>

        <TabsContent value="backups" className="flex-1 m-0 flex flex-col">
          <div className="p-2 border-b border-border">
            <Button size="sm" className="w-full" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Backup
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              <AnimatePresence>
                {backups.map((backup) => (
                  <BackupItem
                    key={backup.id}
                    backup={backup}
                    onRestore={() => {
                      setSelectedBackupId(backup.id);
                      setRestoreDialogOpen(true);
                    }}
                    onDelete={() => handleDeleteBackup(backup.id)}
                    onVerify={() => handleVerifyBackup(backup.id)}
                    getStatusIcon={getStatusIcon}
                  />
                ))}
              </AnimatePresence>
              {backups.length === 0 && !isLoading && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No backups yet. Create your first backup!
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="schedules" className="flex-1 m-0 flex flex-col">
          <div className="p-2 border-b border-border">
            <Button size="sm" className="w-full" onClick={() => setScheduleDialogOpen(true)}>
              <Calendar className="w-4 h-4 mr-2" />
              New Schedule
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {schedules.map((schedule) => (
                <ScheduleItem
                  key={schedule.id}
                  schedule={schedule}
                  onToggle={(enabled) => handleToggleSchedule(schedule.id, enabled)}
                  onTrigger={() => handleTriggerSchedule(schedule.id)}
                  onDelete={() => handleDeleteSchedule(schedule.id)}
                />
              ))}
              {schedules.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  No scheduled backups. Create a schedule for automatic backups!
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="restore" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Point-in-Time Recovery</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Select a backup to restore your data to a specific point in time.
                </p>
                <div className="space-y-2">
                  {pointInTimeOptions.slice(0, 10).map((option) => (
                    <PointInTimeItem
                      key={option.id}
                      option={option}
                      onSelect={() => {
                        setSelectedBackupId(option.id);
                        setRestoreDialogOpen(true);
                      }}
                    />
                  ))}
                  {pointInTimeOptions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No restore points available. Create a backup first!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {error && (
        <div className="p-2 bg-destructive/10 border-t border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <CreateBackupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        form={createForm}
        setForm={setCreateForm}
        onSubmit={handleCreateBackup}
        isLoading={isCreatingBackup}
      />

      <CreateScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        form={scheduleForm}
        setForm={setScheduleForm}
        onSubmit={handleCreateSchedule}
      />

      <RestoreDialog
        open={restoreDialogOpen}
        onOpenChange={setRestoreDialogOpen}
        form={restoreForm}
        setForm={setRestoreForm}
        backup={backups.find(b => b.id === selectedBackupId) || pointInTimeOptions.find(o => o.id === selectedBackupId)}
        onSubmit={handleRestore}
        isLoading={isRestoring}
      />
    </div>
  );
}

function BackupItem({
  backup,
  onRestore,
  onDelete,
  onVerify,
  getStatusIcon,
}: {
  backup: Backup;
  onRestore: () => void;
  onDelete: () => void;
  onVerify: () => void;
  getStatusIcon: (status: string) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-3 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <button type="button" onClick={() => setExpanded(!expanded)} className="mt-0.5">
            <ChevronRight className={cn('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {getStatusIcon(backup.status)}
              <span className="text-sm font-medium truncate">{backup.name}</span>
              {backup.encrypted && <Lock className="w-3 h-3 text-amber-500" />}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {new Date(backup.timestamp).toLocaleString()}
              </span>
              <Badge variant="outline" className="text-xs py-0 h-5">
                {backup.strategy}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRestore}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Size:</span>
                  <span className="ml-1 font-medium">{formatBytes(backup.totalSize)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="ml-1 font-medium">{formatDuration(backup.duration)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {backup.types.map((type) => (
                  <Badge key={type} variant="secondary" className="text-xs py-0 h-5">
                    {type}
                  </Badge>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={onVerify}>
                <Shield className="w-3 h-3 mr-1" />
                Verify Integrity
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ScheduleItem({
  schedule,
  onToggle,
  onTrigger,
  onDelete,
}: {
  schedule: BackupSchedule;
  onToggle: (enabled: boolean) => void;
  onTrigger: () => void;
  onDelete: () => void;
}) {
  const intervalHours = schedule.intervalMs ? Math.round(schedule.intervalMs / (60 * 60 * 1000)) : null;

  return (
    <div className="p-3 rounded-lg border border-border bg-card/50">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{schedule.name}</span>
            {schedule.enabled ? (
              <Badge variant="default" className="text-xs py-0 h-5 bg-emerald-500">Active</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs py-0 h-5">Paused</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {intervalHours ? `Every ${intervalHours}h` : schedule.cronExpression || 'Custom'}
            {schedule.nextRun && (
              <span>• Next: {new Date(schedule.nextRun).toLocaleString()}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>Runs: {schedule.runCount}</span>
            {schedule.failCount > 0 && (
              <span className="text-destructive">Fails: {schedule.failCount}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Switch
            checked={schedule.enabled}
            onCheckedChange={onToggle}
            className="scale-75"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onTrigger}>
            <Play className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PointInTimeItem({
  option,
  onSelect,
}: {
  option: PointInTimeOption;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full p-3 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{option.name}</span>
          {option.encrypted && <Lock className="w-3 h-3 text-amber-500" />}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <span>{new Date(option.timestamp).toLocaleString()}</span>
        <span>•</span>
        <span>{formatBytes(option.totalSize)}</span>
      </div>
    </button>
  );
}

function CreateBackupDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CreateFormState;
  setForm: React.Dispatch<React.SetStateAction<CreateFormState>>;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Backup</DialogTitle>
          <DialogDescription>
            Create a new backup of your data with customizable options.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="backup-name">Name (optional)</Label>
            <Input
              id="backup-name"
              placeholder="My backup"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Strategy</Label>
            <Select
              value={form.strategy}
              onValueChange={(v) => setForm(f => ({ ...f, strategy: v as BackupStrategy }))}
              options={STRATEGY_OPTIONS}
            />
          </div>
          <div className="space-y-2">
            <Label>What to backup</Label>
            <Select
              value={form.types[0]}
              onValueChange={(v) => setForm(f => ({ ...f, types: [v as BackupType] }))}
              options={TYPE_OPTIONS}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Encryption</Label>
              <p className="text-xs text-muted-foreground">Protect backup with password</p>
            </div>
            <Switch
              checked={form.encrypt}
              onCheckedChange={(checked) => setForm(f => ({ ...f, encrypt: checked }))}
            />
          </div>
          {form.encrypt && (
            <div className="space-y-2">
              <Label htmlFor="backup-password">Password</Label>
              <Input
                id="backup-password"
                type="password"
                placeholder="Enter password"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isLoading || (form.encrypt && !form.password)}>
            {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
            Create Backup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateScheduleDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ScheduleFormState;
  setForm: React.Dispatch<React.SetStateAction<ScheduleFormState>>;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Backup Schedule</DialogTitle>
          <DialogDescription>
            Set up automatic backups on a regular schedule.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-name">Name (optional)</Label>
            <Input
              id="schedule-name"
              placeholder="Daily backup"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Backup Interval</Label>
            <Select
              value={form.intervalHours.toString()}
              onValueChange={(v) => setForm(f => ({ ...f, intervalHours: parseInt(v) }))}
              options={INTERVAL_OPTIONS}
            />
          </div>
          <div className="space-y-2">
            <Label>Strategy</Label>
            <Select
              value={form.strategy}
              onValueChange={(v) => setForm(f => ({ ...f, strategy: v as BackupStrategy }))}
              options={STRATEGY_OPTIONS}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Encryption</Label>
              <p className="text-xs text-muted-foreground">Protect backups with password</p>
            </div>
            <Switch
              checked={form.encrypt}
              onCheckedChange={(checked) => setForm(f => ({ ...f, encrypt: checked }))}
            />
          </div>
          {form.encrypt && (
            <div className="space-y-2">
              <Label htmlFor="schedule-password">Password</Label>
              <Input
                id="schedule-password"
                type="password"
                placeholder="Enter password"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={form.encrypt && !form.password}>
            <Calendar className="w-4 h-4 mr-2" />
            Create Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestoreDialog({
  open,
  onOpenChange,
  form,
  setForm,
  backup,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: RestoreFormState;
  setForm: React.Dispatch<React.SetStateAction<RestoreFormState>>;
  backup: Backup | PointInTimeOption | undefined;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  const isEncrypted = backup && 'encrypted' in backup && backup.encrypted;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restore Backup</DialogTitle>
          <DialogDescription>
            Restore your data from this backup point.
          </DialogDescription>
        </DialogHeader>
        {backup && (
          <div className="py-4 space-y-4">
            <div className="p-3 rounded-lg border border-border bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-medium">{backup.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(backup.timestamp).toLocaleString()}
              </p>
              {'totalSize' in backup && (
                <p className="text-xs text-muted-foreground">
                  Size: {formatBytes(backup.totalSize)}
                </p>
              )}
            </div>

            {isEncrypted && (
              <div className="space-y-2">
                <Label htmlFor="restore-password">
                  <Lock className="w-3 h-3 inline mr-1" />
                  Password Required
                </Label>
                <Input
                  id="restore-password"
                  type="password"
                  placeholder="Enter backup password"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Dry Run</Label>
                <p className="text-xs text-muted-foreground">Preview what would be restored</p>
              </div>
              <Switch
                checked={form.dryRun}
                onCheckedChange={(checked) => setForm(f => ({ ...f, dryRun: checked }))}
              />
            </div>

            {!form.dryRun && (
              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  Warning: This will overwrite existing files. Make sure you have a current backup.
                </p>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onSubmit}
            disabled={isLoading || (isEncrypted && !form.password)}
            variant={form.dryRun ? 'default' : 'destructive'}
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4 mr-2" />
            )}
            {form.dryRun ? 'Preview Restore' : 'Restore Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
