import * as backupService from './backupService.js';

const activeSchedules = new Map();
const retentionPolicies = new Map();

const DEFAULT_RETENTION = {
  keepDaily: 7,
  keepWeekly: 4,
  keepMonthly: 3,
  keepYearly: 1,
  minBackups: 3,
  maxBackups: 100,
  maxSizeBytes: 10 * 1024 * 1024 * 1024,
};

export function createSchedule(scheduleConfig) {
  const {
    id = `schedule-${Date.now()}`,
    name,
    cronExpression,
    intervalMs,
    types = [backupService.BackupType.FULL],
    strategy = backupService.BackupStrategy.FULL,
    encrypt = false,
    password = null,
    enabled = true,
    retentionPolicyId = null,
  } = scheduleConfig;

  if (encrypt && !password) {
    throw new Error('Password required for encrypted backups');
  }

  if (!cronExpression && !intervalMs) {
    throw new Error('Either cronExpression or intervalMs required');
  }

  const schedule = {
    id,
    name: name || `Scheduled backup ${id}`,
    cronExpression,
    intervalMs,
    types,
    strategy,
    encrypt,
    password,
    enabled,
    retentionPolicyId,
    createdAt: new Date().toISOString(),
    lastRun: null,
    nextRun: null,
    runCount: 0,
    failCount: 0,
  };

  if (intervalMs) {
    schedule.nextRun = new Date(Date.now() + intervalMs).toISOString();
  } else if (cronExpression) {
    schedule.nextRun = getNextCronRun(cronExpression).toISOString();
  }

  activeSchedules.set(id, schedule);

  if (enabled) {
    startSchedule(id);
  }

  return schedule;
}

function getNextCronRun(cronExpression) {
  const parts = cronExpression.split(' ');
  const now = new Date();
  
  if (parts.length === 5) {
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    
    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);
    
    if (minute !== '*') {
      next.setMinutes(parseInt(minute, 10));
    }
    if (hour !== '*') {
      next.setHours(parseInt(hour, 10));
    }
    
    if (next <= now) {
      if (hour !== '*' || minute !== '*') {
        next.setDate(next.getDate() + 1);
      } else {
        next.setMinutes(next.getMinutes() + 1);
      }
    }
    
    return next;
  }
  
  return new Date(now.getTime() + 60 * 60 * 1000);
}

function startSchedule(scheduleId) {
  const schedule = activeSchedules.get(scheduleId);
  if (!schedule || !schedule.enabled) return;

  if (schedule.timerId) {
    clearTimeout(schedule.timerId);
  }

  const runBackup = async () => {
    const currentSchedule = activeSchedules.get(scheduleId);
    if (!currentSchedule || !currentSchedule.enabled) return;

    console.log(`🔄 Running scheduled backup: ${currentSchedule.name}`);
    
    try {
      currentSchedule.lastRun = new Date().toISOString();
      currentSchedule.runCount++;

      await backupService.createBackup({
        types: currentSchedule.types,
        strategy: currentSchedule.strategy,
        encrypt: currentSchedule.encrypt,
        password: currentSchedule.password,
        name: `${currentSchedule.name} - Auto`,
        description: `Scheduled backup from ${currentSchedule.name}`,
      });

      console.log(`✅ Scheduled backup completed: ${currentSchedule.name}`);

      if (currentSchedule.retentionPolicyId) {
        await applyRetentionPolicy(currentSchedule.retentionPolicyId);
      }
    } catch (error) {
      console.error(`❌ Scheduled backup failed: ${currentSchedule.name}`, error);
      currentSchedule.failCount++;
    }

    if (currentSchedule.intervalMs) {
      currentSchedule.nextRun = new Date(Date.now() + currentSchedule.intervalMs).toISOString();
      currentSchedule.timerId = setTimeout(runBackup, currentSchedule.intervalMs);
    } else if (currentSchedule.cronExpression) {
      const nextRun = getNextCronRun(currentSchedule.cronExpression);
      currentSchedule.nextRun = nextRun.toISOString();
      const delay = nextRun.getTime() - Date.now();
      currentSchedule.timerId = setTimeout(runBackup, delay);
    }

    activeSchedules.set(scheduleId, currentSchedule);
  };

  let delay;
  if (schedule.intervalMs) {
    delay = schedule.intervalMs;
  } else if (schedule.cronExpression) {
    const nextRun = getNextCronRun(schedule.cronExpression);
    delay = nextRun.getTime() - Date.now();
    schedule.nextRun = nextRun.toISOString();
  }

  if (delay > 0) {
    schedule.timerId = setTimeout(runBackup, delay);
  }

  activeSchedules.set(scheduleId, schedule);
}

export function stopSchedule(scheduleId) {
  const schedule = activeSchedules.get(scheduleId);
  if (!schedule) return false;

  if (schedule.timerId) {
    clearTimeout(schedule.timerId);
    schedule.timerId = null;
  }
  
  schedule.enabled = false;
  activeSchedules.set(scheduleId, schedule);
  
  return true;
}

export function resumeSchedule(scheduleId) {
  const schedule = activeSchedules.get(scheduleId);
  if (!schedule) return false;

  schedule.enabled = true;
  activeSchedules.set(scheduleId, schedule);
  startSchedule(scheduleId);
  
  return true;
}

export function deleteSchedule(scheduleId) {
  stopSchedule(scheduleId);
  return activeSchedules.delete(scheduleId);
}

export function getSchedule(scheduleId) {
  const schedule = activeSchedules.get(scheduleId);
  if (!schedule) return null;

  const { timerId, password, ...safeSchedule } = schedule;
  return safeSchedule;
}

export function listSchedules() {
  return Array.from(activeSchedules.values()).map(schedule => {
    const { timerId, password, ...safeSchedule } = schedule;
    return safeSchedule;
  });
}

export function updateSchedule(scheduleId, updates) {
  const schedule = activeSchedules.get(scheduleId);
  if (!schedule) {
    throw new Error(`Schedule ${scheduleId} not found`);
  }

  const wasEnabled = schedule.enabled;
  
  if (wasEnabled) {
    stopSchedule(scheduleId);
  }

  const allowedUpdates = ['name', 'cronExpression', 'intervalMs', 'types', 'strategy', 'encrypt', 'password', 'enabled', 'retentionPolicyId'];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedUpdates.includes(key)) {
      schedule[key] = value;
    }
  }

  if (schedule.encrypt && !schedule.password) {
    throw new Error('Password required for encrypted backups');
  }

  if (schedule.intervalMs) {
    schedule.nextRun = new Date(Date.now() + schedule.intervalMs).toISOString();
  } else if (schedule.cronExpression) {
    schedule.nextRun = getNextCronRun(schedule.cronExpression).toISOString();
  }

  activeSchedules.set(scheduleId, schedule);

  if (schedule.enabled) {
    startSchedule(scheduleId);
  }

  const { timerId, password, ...safeSchedule } = schedule;
  return safeSchedule;
}

export function createRetentionPolicy(policyConfig) {
  const {
    id = `retention-${Date.now()}`,
    name,
    keepDaily = DEFAULT_RETENTION.keepDaily,
    keepWeekly = DEFAULT_RETENTION.keepWeekly,
    keepMonthly = DEFAULT_RETENTION.keepMonthly,
    keepYearly = DEFAULT_RETENTION.keepYearly,
    minBackups = DEFAULT_RETENTION.minBackups,
    maxBackups = DEFAULT_RETENTION.maxBackups,
    maxSizeBytes = DEFAULT_RETENTION.maxSizeBytes,
    deleteOlderThanDays = null,
    types = null,
  } = policyConfig;

  const policy = {
    id,
    name: name || `Retention policy ${id}`,
    keepDaily,
    keepWeekly,
    keepMonthly,
    keepYearly,
    minBackups,
    maxBackups,
    maxSizeBytes,
    deleteOlderThanDays,
    types,
    createdAt: new Date().toISOString(),
    lastApplied: null,
    deletedCount: 0,
  };

  retentionPolicies.set(id, policy);
  return policy;
}

export async function applyRetentionPolicy(policyId) {
  const policy = retentionPolicies.get(policyId);
  if (!policy) {
    throw new Error(`Retention policy ${policyId} not found`);
  }

  const { backups } = await backupService.listBackups({ status: backupService.BackupStatus.COMPLETED });
  
  let filtered = [...backups];
  if (policy.types) {
    filtered = filtered.filter(b => b.types?.some(t => policy.types.includes(t)));
  }

  filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const toKeep = new Set();
  const toDelete = [];

  const now = new Date();
  const dailyKept = new Map();
  const weeklyKept = new Map();
  const monthlyKept = new Map();
  const yearlyKept = new Map();

  for (const backup of filtered) {
    const date = new Date(backup.timestamp);
    const dayKey = date.toISOString().split('T')[0];
    const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    const yearKey = `${date.getFullYear()}`;

    let shouldKeep = false;

    if (!dailyKept.has(dayKey) && dailyKept.size < policy.keepDaily) {
      dailyKept.set(dayKey, backup.id);
      shouldKeep = true;
    }

    if (!weeklyKept.has(weekKey) && weeklyKept.size < policy.keepWeekly) {
      weeklyKept.set(weekKey, backup.id);
      shouldKeep = true;
    }

    if (!monthlyKept.has(monthKey) && monthlyKept.size < policy.keepMonthly) {
      monthlyKept.set(monthKey, backup.id);
      shouldKeep = true;
    }

    if (!yearlyKept.has(yearKey) && yearlyKept.size < policy.keepYearly) {
      yearlyKept.set(yearKey, backup.id);
      shouldKeep = true;
    }

    if (policy.deleteOlderThanDays) {
      const ageInDays = (now - date) / (1000 * 60 * 60 * 24);
      if (ageInDays > policy.deleteOlderThanDays) {
        shouldKeep = false;
      }
    }

    if (shouldKeep) {
      toKeep.add(backup.id);
    }
  }

  for (const backup of filtered) {
    if (!toKeep.has(backup.id)) {
      toDelete.push(backup);
    }
  }

  const keptCount = filtered.length - toDelete.length;
  if (keptCount < policy.minBackups) {
    const needToKeep = policy.minBackups - keptCount;
    toDelete.splice(0, needToKeep);
  }

  if (filtered.length - toDelete.length > policy.maxBackups) {
    const excessCount = (filtered.length - toDelete.length) - policy.maxBackups;
    const remaining = filtered.filter(b => !toDelete.find(d => d.id === b.id));
    const oldest = remaining.slice(-excessCount);
    toDelete.push(...oldest);
  }

  let totalSize = filtered
    .filter(b => !toDelete.find(d => d.id === b.id))
    .reduce((sum, b) => sum + (b.totalSize || 0), 0);

  while (totalSize > policy.maxSizeBytes && toDelete.length < filtered.length - policy.minBackups) {
    const remaining = filtered.filter(b => !toDelete.find(d => d.id === b.id));
    if (remaining.length <= policy.minBackups) break;
    
    const oldest = remaining[remaining.length - 1];
    toDelete.push(oldest);
    totalSize -= oldest.totalSize || 0;
  }

  const deleted = [];
  for (const backup of toDelete) {
    if (!toKeep.has(backup.id)) {
      try {
        await backupService.deleteBackup(backup.id);
        deleted.push(backup.id);
      } catch (error) {
        console.error(`Failed to delete backup ${backup.id}:`, error);
      }
    }
  }

  policy.lastApplied = new Date().toISOString();
  policy.deletedCount += deleted.length;
  retentionPolicies.set(policyId, policy);

  return {
    policyId,
    appliedAt: policy.lastApplied,
    backupsEvaluated: filtered.length,
    backupsDeleted: deleted.length,
    backupsKept: filtered.length - deleted.length,
    deletedIds: deleted,
  };
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function getRetentionPolicy(policyId) {
  return retentionPolicies.get(policyId) || null;
}

export function listRetentionPolicies() {
  return Array.from(retentionPolicies.values());
}

export function deleteRetentionPolicy(policyId) {
  for (const schedule of activeSchedules.values()) {
    if (schedule.retentionPolicyId === policyId) {
      schedule.retentionPolicyId = null;
    }
  }
  return retentionPolicies.delete(policyId);
}

export function updateRetentionPolicy(policyId, updates) {
  const policy = retentionPolicies.get(policyId);
  if (!policy) {
    throw new Error(`Retention policy ${policyId} not found`);
  }

  const allowedUpdates = ['name', 'keepDaily', 'keepWeekly', 'keepMonthly', 'keepYearly', 'minBackups', 'maxBackups', 'maxSizeBytes', 'deleteOlderThanDays', 'types'];
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedUpdates.includes(key)) {
      policy[key] = value;
    }
  }

  retentionPolicies.set(policyId, policy);
  return policy;
}

export function triggerBackupNow(scheduleId) {
  const schedule = activeSchedules.get(scheduleId);
  if (!schedule) {
    throw new Error(`Schedule ${scheduleId} not found`);
  }

  return backupService.createBackup({
    types: schedule.types,
    strategy: schedule.strategy,
    encrypt: schedule.encrypt,
    password: schedule.password,
    name: `${schedule.name} - Manual`,
    description: `Manual trigger from ${schedule.name}`,
  });
}

export function getSchedulerStatus() {
  const schedules = listSchedules();
  const policies = listRetentionPolicies();

  return {
    schedulesCount: schedules.length,
    activeSchedules: schedules.filter(s => s.enabled).length,
    policiesCount: policies.length,
    upcomingBackups: schedules
      .filter(s => s.enabled && s.nextRun)
      .sort((a, b) => new Date(a.nextRun) - new Date(b.nextRun))
      .slice(0, 5)
      .map(s => ({ id: s.id, name: s.name, nextRun: s.nextRun })),
  };
}

export default {
  createSchedule,
  stopSchedule,
  resumeSchedule,
  deleteSchedule,
  getSchedule,
  listSchedules,
  updateSchedule,
  createRetentionPolicy,
  applyRetentionPolicy,
  getRetentionPolicy,
  listRetentionPolicies,
  deleteRetentionPolicy,
  updateRetentionPolicy,
  triggerBackupNow,
  getSchedulerStatus,
};
