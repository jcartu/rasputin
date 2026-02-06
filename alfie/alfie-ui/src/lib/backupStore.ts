import { create } from 'zustand';

export type BackupType = 'database' | 'files' | 'configurations' | 'sessions' | 'full';
export type BackupStrategy = 'full' | 'incremental' | 'differential';
export type BackupStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface BackupComponent {
  type: BackupType;
  path: string;
  size: number;
  checksum: string;
  encrypted: boolean;
}

export interface Backup {
  id: string;
  name: string;
  description?: string;
  timestamp: string;
  strategy: BackupStrategy;
  status: BackupStatus;
  encrypted: boolean;
  types: BackupType[];
  components: BackupComponent[];
  totalSize: number;
  duration: number;
  error?: string;
}

export interface BackupSchedule {
  id: string;
  name: string;
  cronExpression?: string;
  intervalMs?: number;
  types: BackupType[];
  strategy: BackupStrategy;
  encrypt: boolean;
  enabled: boolean;
  retentionPolicyId?: string;
  createdAt: string;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  failCount: number;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  keepYearly: number;
  minBackups: number;
  maxBackups: number;
  maxSizeBytes: number;
  deleteOlderThanDays?: number;
  types?: BackupType[];
  createdAt: string;
  lastApplied?: string;
  deletedCount: number;
}

export interface BackupStatistics {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  totalSize: number;
  totalSizeFormatted: string;
  avgDuration: number;
  oldestBackup?: string;
  newestBackup?: string;
}

export interface PointInTimeOption {
  id: string;
  name: string;
  timestamp: string;
  types: BackupType[];
  strategy: BackupStrategy;
  encrypted: boolean;
  totalSize: number;
}

interface BackupState {
  backups: Backup[];
  schedules: BackupSchedule[];
  policies: RetentionPolicy[];
  statistics: BackupStatistics | null;
  pointInTimeOptions: PointInTimeOption[];
  
  isLoading: boolean;
  isCreatingBackup: boolean;
  isRestoring: boolean;
  error: string | null;
  
  selectedBackupId: string | null;
  restoreDialogOpen: boolean;
  createDialogOpen: boolean;
  scheduleDialogOpen: boolean;
  
  setBackups: (backups: Backup[]) => void;
  setSchedules: (schedules: BackupSchedule[]) => void;
  setPolicies: (policies: RetentionPolicy[]) => void;
  setStatistics: (stats: BackupStatistics | null) => void;
  setPointInTimeOptions: (options: PointInTimeOption[]) => void;
  
  setIsLoading: (loading: boolean) => void;
  setIsCreatingBackup: (creating: boolean) => void;
  setIsRestoring: (restoring: boolean) => void;
  setError: (error: string | null) => void;
  
  setSelectedBackupId: (id: string | null) => void;
  setRestoreDialogOpen: (open: boolean) => void;
  setCreateDialogOpen: (open: boolean) => void;
  setScheduleDialogOpen: (open: boolean) => void;
  
  addBackup: (backup: Backup) => void;
  updateBackup: (id: string, updates: Partial<Backup>) => void;
  removeBackup: (id: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const useBackupStore = create<BackupState>()((set) => ({
  backups: [],
  schedules: [],
  policies: [],
  statistics: null,
  pointInTimeOptions: [],
  
  isLoading: false,
  isCreatingBackup: false,
  isRestoring: false,
  error: null,
  
  selectedBackupId: null,
  restoreDialogOpen: false,
  createDialogOpen: false,
  scheduleDialogOpen: false,
  
  setBackups: (backups) => set({ backups }),
  setSchedules: (schedules) => set({ schedules }),
  setPolicies: (policies) => set({ policies }),
  setStatistics: (statistics) => set({ statistics }),
  setPointInTimeOptions: (pointInTimeOptions) => set({ pointInTimeOptions }),
  
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsCreatingBackup: (isCreatingBackup) => set({ isCreatingBackup }),
  setIsRestoring: (isRestoring) => set({ isRestoring }),
  setError: (error) => set({ error }),
  
  setSelectedBackupId: (selectedBackupId) => set({ selectedBackupId }),
  setRestoreDialogOpen: (restoreDialogOpen) => set({ restoreDialogOpen }),
  setCreateDialogOpen: (createDialogOpen) => set({ createDialogOpen }),
  setScheduleDialogOpen: (scheduleDialogOpen) => set({ scheduleDialogOpen }),
  
  addBackup: (backup) => set((state) => ({ backups: [backup, ...state.backups] })),
  updateBackup: (id, updates) => set((state) => ({
    backups: state.backups.map(b => b.id === id ? { ...b, ...updates } : b)
  })),
  removeBackup: (id) => set((state) => ({
    backups: state.backups.filter(b => b.id !== id)
  })),
}));

export async function fetchBackups(options?: { type?: BackupType; status?: BackupStatus; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.type) params.set('type', options.type);
  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', options.limit.toString());
  
  const response = await fetch(`${API_BASE}/api/backup/list?${params}`);
  if (!response.ok) throw new Error('Failed to fetch backups');
  return response.json();
}

export async function fetchStatistics() {
  const response = await fetch(`${API_BASE}/api/backup/statistics`);
  if (!response.ok) throw new Error('Failed to fetch statistics');
  return response.json();
}

export async function fetchPointInTimeOptions(type?: BackupType) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  
  const response = await fetch(`${API_BASE}/api/backup/point-in-time?${params}`);
  if (!response.ok) throw new Error('Failed to fetch point-in-time options');
  return response.json();
}

export async function createBackup(options: {
  types?: BackupType[];
  strategy?: BackupStrategy;
  encrypt?: boolean;
  password?: string;
  name?: string;
  description?: string;
}) {
  const response = await fetch(`${API_BASE}/api/backup/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to create backup');
  }
  return response.json();
}

export async function restoreBackup(backupId: string, options: {
  password?: string;
  targetDir?: string;
  dryRun?: boolean;
  components?: BackupType[];
}) {
  const response = await fetch(`${API_BASE}/api/backup/${backupId}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to restore backup');
  }
  return response.json();
}

export async function deleteBackup(backupId: string) {
  const response = await fetch(`${API_BASE}/api/backup/${backupId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete backup');
  return response.json();
}

export async function verifyBackup(backupId: string) {
  const response = await fetch(`${API_BASE}/api/backup/${backupId}/verify`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to verify backup');
  return response.json();
}

export async function fetchSchedules() {
  const response = await fetch(`${API_BASE}/api/backup/schedules/list`);
  if (!response.ok) throw new Error('Failed to fetch schedules');
  return response.json();
}

export async function createSchedule(config: Partial<BackupSchedule> & { password?: string }) {
  const response = await fetch(`${API_BASE}/api/backup/schedules/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to create schedule');
  }
  return response.json();
}

export async function toggleSchedule(scheduleId: string, enabled: boolean) {
  const endpoint = enabled ? 'resume' : 'stop';
  const response = await fetch(`${API_BASE}/api/backup/schedules/${scheduleId}/${endpoint}`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Failed to ${endpoint} schedule`);
  return response.json();
}

export async function triggerSchedule(scheduleId: string) {
  const response = await fetch(`${API_BASE}/api/backup/schedules/${scheduleId}/trigger`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to trigger backup');
  return response.json();
}

export async function deleteSchedule(scheduleId: string) {
  const response = await fetch(`${API_BASE}/api/backup/schedules/${scheduleId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete schedule');
  return response.json();
}

export async function fetchPolicies() {
  const response = await fetch(`${API_BASE}/api/backup/retention/list`);
  if (!response.ok) throw new Error('Failed to fetch retention policies');
  return response.json();
}

export async function createPolicy(config: Partial<RetentionPolicy>) {
  const response = await fetch(`${API_BASE}/api/backup/retention/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to create retention policy');
  }
  return response.json();
}

export async function applyPolicy(policyId: string) {
  const response = await fetch(`${API_BASE}/api/backup/retention/${policyId}/apply`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to apply retention policy');
  return response.json();
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
