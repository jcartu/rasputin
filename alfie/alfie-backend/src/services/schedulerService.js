import cron from 'node-cron';
import { addAgentTask } from './queueService.js';
import pg from 'pg';

const { Pool } = pg;
let pool;

function getDatabaseUrl() { return process.env.DATABASE_URL || ''; }
async function getPool() {
  if (!pool) pool = new Pool({ connectionString: getDatabaseUrl() });
  return pool;
}

const activeJobs = new Map();

export async function createSchedule(userId, { name, cronExpression, taskInput, maxRuns = null }) {
  const db = await getPool();
  if (!cron.validate(cronExpression)) throw new Error('Invalid cron expression');
  const result = await db.query(
    `INSERT INTO scheduled_tasks (user_id, name, cron_expression, task_input, max_runs)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, name, cronExpression, taskInput, maxRuns]
  );
  const schedule = result.rows[0];
  startCronJob(schedule);
  return schedule;
}

export async function listSchedules(userId) {
  const db = await getPool();
  const result = await db.query(
    'SELECT * FROM scheduled_tasks WHERE user_id = $1 ORDER BY created_at DESC', [userId]
  );
  return result.rows;
}

export async function deleteSchedule(userId, scheduleId) {
  const db = await getPool();
  const result = await db.query(
    'DELETE FROM scheduled_tasks WHERE id = $1 AND user_id = $2', [scheduleId, userId]
  );
  const job = activeJobs.get(scheduleId);
  if (job) { job.stop(); activeJobs.delete(scheduleId); }
  return result.rowCount > 0;
}

export async function toggleSchedule(userId, scheduleId, isActive) {
  const db = await getPool();
  await db.query(
    'UPDATE scheduled_tasks SET is_active = $1 WHERE id = $2 AND user_id = $3',
    [isActive, scheduleId, userId]
  );
  const job = activeJobs.get(scheduleId);
  if (job && !isActive) { job.stop(); activeJobs.delete(scheduleId); }
  if (isActive && !job) {
    const result = await db.query('SELECT * FROM scheduled_tasks WHERE id = $1', [scheduleId]);
    if (result.rows[0]) startCronJob(result.rows[0]);
  }
}

function startCronJob(schedule) {
  if (!schedule.is_active) return;
  if (activeJobs.has(schedule.id)) return;
  
  const job = cron.schedule(schedule.cron_expression, async () => {
    try {
      const db = await getPool();
      if (schedule.max_runs && schedule.run_count >= schedule.max_runs) {
        job.stop();
        activeJobs.delete(schedule.id);
        await db.query('UPDATE scheduled_tasks SET is_active = false WHERE id = $1', [schedule.id]);
        return;
      }
      await addAgentTask(schedule.user_id, schedule.task_input, { taskType: 'scheduled' });
      await db.query(
        'UPDATE scheduled_tasks SET last_run_at = NOW(), run_count = run_count + 1 WHERE id = $1',
        [schedule.id]
      );
    } catch (err) {
      console.error(`Scheduled task ${schedule.id} failed:`, err.message);
    }
  });
  
  activeJobs.set(schedule.id, job);
}

export async function initialize() {
  const db = await getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      cron_expression VARCHAR(100) NOT NULL,
      task_input TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      last_run_at TIMESTAMP WITH TIME ZONE,
      next_run_at TIMESTAMP WITH TIME ZONE,
      run_count INTEGER DEFAULT 0,
      max_runs INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user ON scheduled_tasks(user_id);
  `);
  const result = await db.query('SELECT * FROM scheduled_tasks WHERE is_active = true');
  for (const schedule of result.rows) {
    startCronJob(schedule);
  }
  console.log(`Loaded ${result.rows.length} scheduled tasks`);
}
