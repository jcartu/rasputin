import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_BACKUP_DIR = path.join(__dirname, '.test-backups');

process.env.BACKUP_DIR = TEST_BACKUP_DIR;
process.env.WORKSPACE_ROOT = __dirname;

const backupService = await import('../src/services/backupService.js');
const scheduler = await import('../src/services/scheduler.js');

describe('Backup Service', () => {
  beforeEach(async () => {
    await fs.rm(TEST_BACKUP_DIR, { recursive: true, force: true });
    await backupService.initialize();
  });

  afterEach(async () => {
    await fs.rm(TEST_BACKUP_DIR, { recursive: true, force: true });
  });

  describe('initialize()', () => {
    it('should create backup directories', async () => {
      const result = await backupService.initialize();
      assert.strictEqual(result.success, true);
      
      const dirs = ['database', 'files', 'configurations', 'sessions', 'full'];
      for (const dir of dirs) {
        const dirPath = path.join(TEST_BACKUP_DIR, dir);
        const stat = await fs.stat(dirPath);
        assert.strictEqual(stat.isDirectory(), true);
      }
    });
  });

  describe('createBackup()', () => {
    it('should create a full backup', async () => {
      const backup = await backupService.createBackup({
        types: [backupService.BackupType.FULL],
        strategy: backupService.BackupStrategy.FULL,
        name: 'Test Backup',
      });

      assert.ok(backup.id);
      assert.strictEqual(backup.name, 'Test Backup');
      assert.strictEqual(backup.strategy, 'full');
      assert.strictEqual(backup.status, 'completed');
      assert.ok(backup.components.length > 0);
    });

    it('should create an encrypted backup', async () => {
      const backup = await backupService.createBackup({
        types: [backupService.BackupType.CONFIGURATIONS],
        strategy: backupService.BackupStrategy.FULL,
        encrypt: true,
        password: 'test-password-123',
        name: 'Encrypted Backup',
      });

      assert.strictEqual(backup.encrypted, true);
      assert.strictEqual(backup.status, 'completed');
    });

    it('should fail without password when encryption is enabled', async () => {
      await assert.rejects(
        backupService.createBackup({
          types: [backupService.BackupType.FULL],
          encrypt: true,
        }),
        /Password required/
      );
    });

    it('should create incremental backup', async () => {
      const fullBackup = await backupService.createBackup({
        types: [backupService.BackupType.FILES],
        strategy: backupService.BackupStrategy.FULL,
      });

      const incrementalBackup = await backupService.createBackup({
        types: [backupService.BackupType.FILES],
        strategy: backupService.BackupStrategy.INCREMENTAL,
      });

      assert.strictEqual(incrementalBackup.strategy, 'incremental');
      assert.strictEqual(incrementalBackup.status, 'completed');
    });

    it('should create differential backup', async () => {
      const fullBackup = await backupService.createBackup({
        types: [backupService.BackupType.DATABASE],
        strategy: backupService.BackupStrategy.FULL,
      });

      const differentialBackup = await backupService.createBackup({
        types: [backupService.BackupType.DATABASE],
        strategy: backupService.BackupStrategy.DIFFERENTIAL,
      });

      assert.strictEqual(differentialBackup.strategy, 'differential');
    });
  });

  describe('listBackups()', () => {
    it('should list all backups', async () => {
      await backupService.createBackup({ name: 'Backup 1' });
      await backupService.createBackup({ name: 'Backup 2' });

      const result = await backupService.listBackups();
      
      assert.ok(result.backups.length >= 2);
      assert.ok(result.total >= 2);
    });

    it('should filter by status', async () => {
      await backupService.createBackup({ name: 'Completed Backup' });

      const result = await backupService.listBackups({ status: 'completed' });
      
      assert.ok(result.backups.every(b => b.status === 'completed'));
    });

    it('should respect limit and offset', async () => {
      await backupService.createBackup({ name: 'Backup 1' });
      await backupService.createBackup({ name: 'Backup 2' });
      await backupService.createBackup({ name: 'Backup 3' });

      const result = await backupService.listBackups({ limit: 2, offset: 0 });
      
      assert.strictEqual(result.backups.length, 2);
    });
  });

  describe('getBackup()', () => {
    it('should return backup by id', async () => {
      const created = await backupService.createBackup({ name: 'Test' });
      const backup = await backupService.getBackup(created.id);

      assert.strictEqual(backup.id, created.id);
      assert.strictEqual(backup.name, 'Test');
    });

    it('should throw for non-existent backup', async () => {
      await assert.rejects(
        backupService.getBackup('non-existent-id'),
        /not found/
      );
    });
  });

  describe('verifyBackup()', () => {
    it('should verify backup integrity', async () => {
      const backup = await backupService.createBackup({ name: 'Verify Test' });
      const result = await backupService.verifyBackup(backup.id);

      assert.strictEqual(result.backupId, backup.id);
      assert.ok('valid' in result);
      assert.ok(result.components.length > 0);
    });
  });

  describe('restoreBackup()', () => {
    it('should perform dry run restore', async () => {
      const backup = await backupService.createBackup({
        types: [backupService.BackupType.CONFIGURATIONS],
      });

      const result = await backupService.restoreBackup(backup.id, {
        dryRun: true,
      });

      assert.strictEqual(result.dryRun, true);
      assert.ok(result.items);
    });

    it('should require password for encrypted backup restore', async () => {
      const backup = await backupService.createBackup({
        types: [backupService.BackupType.CONFIGURATIONS],
        encrypt: true,
        password: 'test-password',
      });

      await assert.rejects(
        backupService.restoreBackup(backup.id, {}),
        /Password required/
      );
    });
  });

  describe('deleteBackup()', () => {
    it('should delete backup', async () => {
      const backup = await backupService.createBackup({ name: 'To Delete' });
      const result = await backupService.deleteBackup(backup.id);

      assert.strictEqual(result.deleted, true);
      
      await assert.rejects(
        backupService.getBackup(backup.id),
        /not found/
      );
    });
  });

  describe('getStatistics()', () => {
    it('should return backup statistics', async () => {
      await backupService.createBackup({ name: 'Stats Test' });
      
      const stats = await backupService.getStatistics();

      assert.ok('total' in stats);
      assert.ok('completed' in stats);
      assert.ok('failed' in stats);
      assert.ok('totalSize' in stats);
      assert.ok('totalSizeFormatted' in stats);
    });
  });

  describe('getPointInTimeOptions()', () => {
    it('should return point-in-time recovery options', async () => {
      await backupService.createBackup({ name: 'PIT Test' });
      
      const options = await backupService.getPointInTimeOptions();

      assert.ok(Array.isArray(options));
      assert.ok(options.length > 0);
      assert.ok(options[0].id);
      assert.ok(options[0].timestamp);
    });
  });

  describe('encryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const originalData = { message: 'secret data', count: 42 };
      const password = 'strong-password';

      const encrypted = backupService.encryptBackup(originalData, password);
      assert.strictEqual(encrypted.encrypted, true);
      assert.strictEqual(encrypted.algorithm, 'AES-256');

      const decrypted = backupService.decryptBackup(encrypted, password);
      assert.deepStrictEqual(decrypted, originalData);
    });

    it('should fail decryption with wrong password', () => {
      const data = { secret: 'value' };
      const encrypted = backupService.encryptBackup(data, 'correct-password');

      try {
        const result = backupService.decryptBackup(encrypted, 'wrong-password');
        assert.notDeepStrictEqual(result, data, 'Decryption should produce different data with wrong password');
      } catch (error) {
        assert.ok(error.message.includes('Decryption failed') || error.message.includes('Malformed'));
      }
    });
  });
});

describe('Backup Scheduler', () => {
  beforeEach(() => {
    const schedules = scheduler.listSchedules();
    for (const schedule of schedules) {
      scheduler.deleteSchedule(schedule.id);
    }
    const policies = scheduler.listRetentionPolicies();
    for (const policy of policies) {
      scheduler.deleteRetentionPolicy(policy.id);
    }
  });

  afterEach(() => {
    const schedules = scheduler.listSchedules();
    for (const schedule of schedules) {
      scheduler.deleteSchedule(schedule.id);
    }
    const policies = scheduler.listRetentionPolicies();
    for (const policy of policies) {
      scheduler.deleteRetentionPolicy(policy.id);
    }
  });

  describe('createSchedule()', () => {
    it('should create a schedule with interval', () => {
      const schedule = scheduler.createSchedule({
        name: 'Hourly Backup',
        intervalMs: 60 * 60 * 1000,
        types: [backupService.BackupType.DATABASE],
        strategy: backupService.BackupStrategy.INCREMENTAL,
      });

      assert.ok(schedule.id);
      assert.strictEqual(schedule.name, 'Hourly Backup');
      assert.strictEqual(schedule.intervalMs, 3600000);
      assert.strictEqual(schedule.enabled, true);
      assert.ok(schedule.nextRun);
    });

    it('should require interval or cron expression', () => {
      assert.throws(
        () => scheduler.createSchedule({ name: 'Invalid' }),
        /cronExpression or intervalMs required/
      );
    });

    it('should require password when encryption is enabled', () => {
      assert.throws(
        () => scheduler.createSchedule({
          name: 'Encrypted',
          intervalMs: 3600000,
          encrypt: true,
        }),
        /Password required/
      );
    });
  });

  describe('listSchedules()', () => {
    it('should list all schedules', () => {
      scheduler.createSchedule({ name: 'Schedule 1', intervalMs: 3600000 });
      scheduler.createSchedule({ name: 'Schedule 2', intervalMs: 7200000 });

      const schedules = scheduler.listSchedules();
      
      assert.ok(schedules.length >= 2);
      assert.ok(schedules.every(s => !s.password));
    });
  });

  describe('stopSchedule() and resumeSchedule()', () => {
    it('should stop and resume schedule', () => {
      const schedule = scheduler.createSchedule({
        name: 'Toggle Test',
        intervalMs: 3600000,
      });

      assert.strictEqual(schedule.enabled, true);

      const stopped = scheduler.stopSchedule(schedule.id);
      assert.strictEqual(stopped, true);
      
      const stoppedSchedule = scheduler.getSchedule(schedule.id);
      assert.strictEqual(stoppedSchedule.enabled, false);

      const resumed = scheduler.resumeSchedule(schedule.id);
      assert.strictEqual(resumed, true);
      
      const resumedSchedule = scheduler.getSchedule(schedule.id);
      assert.strictEqual(resumedSchedule.enabled, true);
    });
  });

  describe('updateSchedule()', () => {
    it('should update schedule properties', () => {
      const schedule = scheduler.createSchedule({
        name: 'Original Name',
        intervalMs: 3600000,
      });

      const updated = scheduler.updateSchedule(schedule.id, {
        name: 'Updated Name',
        intervalMs: 7200000,
      });

      assert.strictEqual(updated.name, 'Updated Name');
      assert.strictEqual(updated.intervalMs, 7200000);
    });
  });

  describe('deleteSchedule()', () => {
    it('should delete schedule', () => {
      const schedule = scheduler.createSchedule({
        name: 'To Delete',
        intervalMs: 3600000,
      });

      const deleted = scheduler.deleteSchedule(schedule.id);
      assert.strictEqual(deleted, true);

      const found = scheduler.getSchedule(schedule.id);
      assert.strictEqual(found, null);
    });
  });

  describe('Retention Policies', () => {
    it('should create retention policy', () => {
      const policy = scheduler.createRetentionPolicy({
        name: 'Test Policy',
        keepDaily: 7,
        keepWeekly: 4,
        keepMonthly: 3,
      });

      assert.ok(policy.id);
      assert.strictEqual(policy.name, 'Test Policy');
      assert.strictEqual(policy.keepDaily, 7);
      assert.strictEqual(policy.keepWeekly, 4);
      assert.strictEqual(policy.keepMonthly, 3);
    });

    it('should list retention policies', () => {
      scheduler.createRetentionPolicy({ name: 'Policy 1' });
      scheduler.createRetentionPolicy({ name: 'Policy 2' });

      const policies = scheduler.listRetentionPolicies();
      assert.ok(policies.length >= 2);
    });

    it('should update retention policy', () => {
      const policy = scheduler.createRetentionPolicy({
        name: 'Original',
        keepDaily: 7,
      });

      const updated = scheduler.updateRetentionPolicy(policy.id, {
        name: 'Updated',
        keepDaily: 14,
      });

      assert.strictEqual(updated.name, 'Updated');
      assert.strictEqual(updated.keepDaily, 14);
    });

    it('should delete retention policy', () => {
      const policy = scheduler.createRetentionPolicy({ name: 'To Delete' });
      
      const deleted = scheduler.deleteRetentionPolicy(policy.id);
      assert.strictEqual(deleted, true);

      const found = scheduler.getRetentionPolicy(policy.id);
      assert.strictEqual(found, null);
    });
  });

  describe('getSchedulerStatus()', () => {
    it('should return scheduler status', () => {
      scheduler.createSchedule({ name: 'Active', intervalMs: 3600000 });
      
      const status = scheduler.getSchedulerStatus();

      assert.ok('schedulesCount' in status);
      assert.ok('activeSchedules' in status);
      assert.ok('policiesCount' in status);
      assert.ok('upcomingBackups' in status);
    });
  });
});

console.log('Running backup tests...');
