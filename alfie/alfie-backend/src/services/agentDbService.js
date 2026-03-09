import pg from 'pg';

const { Pool } = pg;

let pool;

function getDatabaseUrl() {
  return process.env.DATABASE_URL || '';
}

function getPoolMax() {
  return parseInt(process.env.DB_POOL_MAX, 10) || 10;
}

function getIdleTimeout() {
  return parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000;
}

function getConnectionTimeout() {
  return parseInt(process.env.DB_CONNECT_TIMEOUT, 10) || 2000;
}

export async function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: getPoolMax(),
      idleTimeoutMillis: getIdleTimeout(),
      connectionTimeoutMillis: getConnectionTimeout(),
    });
    pool.on('error', (err) => {
      console.error('Unexpected error on idle agent db client', err);
    });
  }
  return pool;
}

function buildMetadata(options = {}) {
  const metadata = { ...(options.metadata || {}) };
  if (options.jobId) {
    metadata.jobId = options.jobId;
  }
  return metadata;
}

export async function createTask(userId, input, options = {}) {
  const db = await getPool();
  const metadata = buildMetadata(options);
  const result = await db.query(
    `
    INSERT INTO agent_tasks (
      user_id,
      status,
      task_type,
      input,
      output,
      error,
      progress,
      current_step,
      max_steps,
      model,
      metadata,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    RETURNING *
    `,
    [
      userId,
      options.status || 'pending',
      options.taskType || 'general',
      input,
      options.output || null,
      options.error || null,
      options.progress ?? 0,
      options.current_step ?? 0,
      options.maxSteps || 30,
      options.model || null,
      metadata,
    ]
  );
  return result.rows[0];
}

export async function getTask(taskId) {
  const db = await getPool();
  const result = await db.query('SELECT * FROM agent_tasks WHERE id = $1', [taskId]);
  return result.rows[0] || null;
}

export async function getTasksByUser(userId, limit = 50, offset = 0) {
  const db = await getPool();
  const result = await db.query(
    `
    SELECT *
    FROM agent_tasks
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
    `,
    [userId, limit, offset]
  );
  return result.rows;
}

export async function updateTaskStatus(taskId, status, extras = {}) {
  const db = await getPool();
  const updates = ['status = $1', 'updated_at = NOW()'];
  const values = [status];
  let index = 2;

  const allowedFields = new Set([
    'output',
    'error',
    'progress',
    'current_step',
    'completed_at',
    'started_at',
    'max_steps',
    'model',
    'metadata',
  ]);

  for (const [key, value] of Object.entries(extras)) {
    if (!allowedFields.has(key) || value === undefined) {
      continue;
    }
    updates.push(`${key} = $${index}`);
    values.push(value);
    index += 1;
  }

  values.push(taskId);

  const result = await db.query(
    `UPDATE agent_tasks SET ${updates.join(', ')} WHERE id = $${index} RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

export async function addStep(taskId, stepData = {}) {
  const db = await getPool();
  const {
    type = null,
    tool_name = null,
    tool_input = null,
    tool_output = null,
    thinking = null,
    tokens_used = null,
    duration_ms = null,
    status = 'completed',
    error = null,
  } = stepData;

  const result = await db.query(
    `
    WITH next_step AS (
      SELECT COALESCE(MAX(step_number), 0) + 1 AS step_number
      FROM agent_steps
      WHERE task_id = $1
    )
    INSERT INTO agent_steps (
      task_id,
      step_number,
      type,
      tool_name,
      tool_input,
      tool_output,
      thinking,
      tokens_used,
      duration_ms,
      status,
      error,
      created_at
    )
    SELECT
      $1,
      next_step.step_number,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      NOW()
    FROM next_step
    RETURNING *
    `,
    [
      taskId,
      type,
      tool_name,
      tool_input,
      tool_output,
      thinking,
      tokens_used,
      duration_ms,
      status,
      error,
    ]
  );

  return result.rows[0];
}

export async function getSteps(taskId) {
  const db = await getPool();
  const result = await db.query(
    `
    SELECT *
    FROM agent_steps
    WHERE task_id = $1
    ORDER BY step_number ASC
    `,
    [taskId]
  );
  return result.rows;
}

export async function cancelTask(taskId) {
  return updateTaskStatus(taskId, 'cancelled', { completed_at: new Date() });
}

export default {
  getPool,
  createTask,
  getTask,
  getTasksByUser,
  updateTaskStatus,
  addStep,
  getSteps,
  cancelTask,
};
