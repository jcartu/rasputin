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
      console.error('Unexpected error on idle project service client', err);
    });
  }
  return pool;
}

function mapProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    knowledgeBase: row.knowledge_base || [],
    settings: row.settings || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function initialize() {
  const db = await getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      instructions TEXT,
      knowledge_base JSONB DEFAULT '[]'::jsonb,
      settings JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_conversations (
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      conversation_thread_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (project_id, conversation_thread_id)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_project_conversations_thread ON project_conversations(conversation_thread_id)`);
}

export async function createProject(userId, { name, description, instructions, knowledgeBase, settings }) {
  try {
    const db = await getPool();
    const result = await db.query(
      `
      INSERT INTO projects (user_id, name, description, instructions, knowledge_base, settings, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *
      `,
      [userId, name, description || null, instructions || null, JSON.stringify(knowledgeBase || []), JSON.stringify(settings || {})]
    );
    return mapProject(result.rows[0]);
  } catch (error) {
    console.error('createProject failed:', error);
    return { error: 'Failed to create project' };
  }
}

export async function listProjects(userId, limit = 50, offset = 0) {
  try {
    const db = await getPool();
    const result = await db.query(
      `
      SELECT p.*, COUNT(pc.conversation_thread_id) AS conversation_count
      FROM projects p
      LEFT JOIN project_conversations pc ON pc.project_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id
      ORDER BY p.updated_at DESC NULLS LAST
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );
    return result.rows.map(row => ({
      ...mapProject(row),
      conversationCount: Number(row.conversation_count ?? 0),
    }));
  } catch (error) {
    console.error('listProjects failed:', error);
    return { error: 'Failed to list projects' };
  }
}

export async function getProject(userId, projectId) {
  try {
    const db = await getPool();
    const result = await db.query(
      `
      SELECT * FROM projects
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [projectId, userId]
    );
    if (!result.rows.length) {
      return null;
    }
    return mapProject(result.rows[0]);
  } catch (error) {
    console.error('getProject failed:', error);
    return { error: 'Failed to get project' };
  }
}

export async function updateProject(userId, projectId, { name, description, instructions, knowledgeBase, settings }) {
  try {
    const updates = [];
    const values = [];
    let index = 1;

    if (name !== undefined) {
      updates.push(`name = $${index}`);
      values.push(name);
      index += 1;
    }

    if (description !== undefined) {
      updates.push(`description = $${index}`);
      values.push(description);
      index += 1;
    }

    if (instructions !== undefined) {
      updates.push(`instructions = $${index}`);
      values.push(instructions);
      index += 1;
    }

    if (knowledgeBase !== undefined) {
      updates.push(`knowledge_base = $${index}`);
      values.push(JSON.stringify(knowledgeBase));
      index += 1;
    }

    if (settings !== undefined) {
      updates.push(`settings = $${index}`);
      values.push(JSON.stringify(settings));
      index += 1;
    }

    if (!updates.length) {
      return { error: 'No updates provided' };
    }

    updates.push('updated_at = NOW()');
    values.push(projectId);
    const projectIdIndex = index;
    index += 1;
    values.push(userId);
    const userIdIndex = index;

    const db = await getPool();
    const result = await db.query(
      `
      UPDATE projects
      SET ${updates.join(', ')}
      WHERE id = $${projectIdIndex} AND user_id = $${userIdIndex}
      RETURNING *
      `,
      values
    );

    if (!result.rows.length) {
      return null;
    }

    return mapProject(result.rows[0]);
  } catch (error) {
    console.error('updateProject failed:', error);
    return { error: 'Failed to update project' };
  }
}

export async function deleteProject(userId, projectId) {
  try {
    const db = await getPool();
    const result = await db.query(
      `DELETE FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    return { deleted: result.rowCount > 0 };
  } catch (error) {
    console.error('deleteProject failed:', error);
    return { error: 'Failed to delete project' };
  }
}

export async function addConversation(userId, projectId, threadId) {
  try {
    const db = await getPool();
    const projectCheck = await db.query(
      `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    if (!projectCheck.rows.length) {
      return null;
    }
    await db.query(
      `
      INSERT INTO project_conversations (project_id, conversation_thread_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (project_id, conversation_thread_id) DO NOTHING
      `,
      [projectId, threadId]
    );
    await db.query(
      `UPDATE projects SET updated_at = NOW() WHERE id = $1`,
      [projectId]
    );
    return { added: true, projectId, threadId };
  } catch (error) {
    console.error('addConversation failed:', error);
    return { error: 'Failed to add conversation to project' };
  }
}

export async function removeConversation(userId, projectId, threadId) {
  try {
    const db = await getPool();
    const projectCheck = await db.query(
      `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    if (!projectCheck.rows.length) {
      return null;
    }
    const result = await db.query(
      `DELETE FROM project_conversations WHERE project_id = $1 AND conversation_thread_id = $2`,
      [projectId, threadId]
    );
    return { removed: result.rowCount > 0 };
  } catch (error) {
    console.error('removeConversation failed:', error);
    return { error: 'Failed to remove conversation from project' };
  }
}

export async function getProjectConversations(userId, projectId, limit = 100, offset = 0) {
  try {
    const db = await getPool();
    const projectCheck = await db.query(
      `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    if (!projectCheck.rows.length) {
      return null;
    }
    const result = await db.query(
      `
      SELECT conversation_thread_id, created_at
      FROM project_conversations
      WHERE project_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [projectId, limit, offset]
    );
    return result.rows.map(row => ({
      threadId: row.conversation_thread_id,
      addedAt: row.created_at,
    }));
  } catch (error) {
    console.error('getProjectConversations failed:', error);
    return { error: 'Failed to get project conversations' };
  }
}

export default {
  getPool,
  initialize,
  createProject,
  listProjects,
  getProject,
  updateProject,
  deleteProject,
  addConversation,
  removeConversation,
  getProjectConversations,
};
