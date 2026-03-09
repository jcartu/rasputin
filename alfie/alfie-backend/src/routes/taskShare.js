import { Router } from 'express';
import crypto from 'crypto';
import pg from 'pg';

const router = Router();

function getDatabaseUrl() {
  return process.env.DATABASE_URL;
}

function getPool() {
  return new pg.Pool({ connectionString: getDatabaseUrl() });
}

// POST /api/agent/:taskId/share — Create a share link (requires auth)
router.post('/:taskId/share', async (req, res) => {
  const pool = getPool();
  try {
    const { taskId } = req.params;
    const userId = req.auth?.user?.id;

    const taskResult = await pool.query(
      'SELECT id, user_id FROM agent_tasks WHERE id = $1',
      [taskId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (taskResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to share this task' });
    }

    // Check if already shared
    const existingShare = await pool.query(
      'SELECT share_token FROM shared_tasks WHERE task_id = $1 AND is_active = true',
      [taskId]
    );

    if (existingShare.rows.length > 0) {
      return res.json({
        token: existingShare.rows[0].share_token,
        url: `/share/task/${existingShare.rows[0].share_token}`,
      });
    }

    // Create new share
    const shareToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      'INSERT INTO shared_tasks (task_id, share_token, created_by, expires_at) VALUES ($1, $2, $3, $4)',
      [taskId, shareToken, userId, expiresAt]
    );

    res.json({
      token: shareToken,
      url: `/share/task/${shareToken}`,
      expiresAt,
    });
  } catch (error) {
    console.error('Error sharing task:', error);
    res.status(500).json({ error: 'Failed to share task' });
  } finally {
    await pool.end();
  }
});

// GET /api/shared/task/:token — Get shared task data (PUBLIC, no auth needed)
router.get('/task/:token', async (req, res) => {
  const pool = getPool();
  try {
    const { token } = req.params;

    // Find the share record
    const shareResult = await pool.query(
      'SELECT s.*, t.status, t.task_type, t.input, t.output, t.error, t.progress, t.current_step, t.max_steps, t.model, t.metadata as task_metadata, t.created_at as task_created_at, t.completed_at as task_completed_at FROM shared_tasks s JOIN agent_tasks t ON s.task_id = t.id WHERE s.share_token = $1 AND s.is_active = true',
      [token]
    );

    if (shareResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shared task not found or expired' });
    }

    const share = shareResult.rows[0];

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    // Increment view count
    await pool.query(
      'UPDATE shared_tasks SET view_count = view_count + 1 WHERE id = $1',
      [share.id]
    );

    // Get task steps
    const stepsResult = await pool.query(
      'SELECT step_number, type, tool_name, tool_input, tool_output, thinking, tokens_used, duration_ms, status, error, created_at FROM agent_steps WHERE task_id = $1 ORDER BY step_number ASC',
      [share.task_id]
    );

    res.json({
      task: {
        status: share.status,
        taskType: share.task_type,
        input: share.input,
        output: share.output,
        error: share.error,
        progress: share.progress,
        currentStep: share.current_step,
        maxSteps: share.max_steps,
        model: share.model,
        metadata: share.task_metadata,
        createdAt: share.task_created_at,
        completedAt: share.task_completed_at,
      },
      steps: stepsResult.rows.map(step => ({
        stepNumber: step.step_number,
        type: step.type,
        toolName: step.tool_name,
        toolInput: step.tool_input,
        toolOutput: step.tool_output,
        thinking: step.thinking,
        tokensUsed: step.tokens_used,
        durationMs: step.duration_ms,
        status: step.status,
        error: step.error,
        createdAt: step.created_at,
      })),
      share: {
        createdAt: share.created_at,
        expiresAt: share.expires_at,
        viewCount: share.view_count + 1,
      },
    });
  } catch (error) {
    console.error('Error fetching shared task:', error);
    res.status(500).json({ error: 'Failed to fetch shared task' });
  } finally {
    await pool.end();
  }
});

// DELETE /api/agent/:taskId/share — Revoke a share (requires auth)
router.delete('/:taskId/share', async (req, res) => {
  const pool = getPool();
  try {
    const { taskId } = req.params;
    const userId = req.auth?.user?.id;

    const result = await pool.query(
      'UPDATE shared_tasks SET is_active = false WHERE task_id = $1 AND created_by = $2',
      [taskId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Share not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking share:', error);
    res.status(500).json({ error: 'Failed to revoke share' });
  } finally {
    await pool.end();
  }
});

export default router;
