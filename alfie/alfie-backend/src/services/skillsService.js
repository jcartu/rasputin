import pg from 'pg';
const { Pool } = pg;
let pool;
function getDatabaseUrl() { return process.env.DATABASE_URL || ''; }
async function getPool() {
  if (!pool) pool = new Pool({ connectionString: getDatabaseUrl() });
  return pool;
}

export async function initialize() {
  const db = await getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100) DEFAULT 'general',
      task_template TEXT NOT NULL,
      variables JSONB DEFAULT '[]'::jsonb,
      model VARCHAR(100),
      is_public BOOLEAN DEFAULT false,
      use_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_skills_user ON skills(user_id);
    CREATE INDEX IF NOT EXISTS idx_skills_public ON skills(is_public) WHERE is_public = true;
    CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
  `);
}

export async function createSkill(userId, { name, description, category, taskTemplate, variables, model, isPublic }) {
  const db = await getPool();
  const result = await db.query(
    `INSERT INTO skills (user_id, name, description, category, task_template, variables, model, is_public)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [userId, name, description || null, category || 'general', taskTemplate, JSON.stringify(variables || []), model || null, isPublic || false]
  );
  return result.rows[0];
}

export async function listSkills(userId, { category, includePublic = true } = {}) {
  const db = await getPool();
  let query = 'SELECT * FROM skills WHERE (user_id = $1';
  const params = [userId];
  if (includePublic) query += ' OR is_public = true';
  query += ')';
  if (category) { query += ` AND category = $${params.length + 1}`; params.push(category); }
  query += ' ORDER BY use_count DESC, created_at DESC';
  const result = await db.query(query, params);
  return result.rows;
}

export async function getSkill(skillId) {
  const db = await getPool();
  const result = await db.query('SELECT * FROM skills WHERE id = $1', [skillId]);
  return result.rows[0] || null;
}

export async function useSkill(skillId, variables = {}) {
  const db = await getPool();
  const skill = await getSkill(skillId);
  if (!skill) throw new Error('Skill not found');
  
  let taskInput = skill.task_template;
  for (const [key, value] of Object.entries(variables)) {
    taskInput = taskInput.replaceAll(`{{${key}}}`, value);
  }
  
  await db.query('UPDATE skills SET use_count = use_count + 1 WHERE id = $1', [skillId]);
  return { taskInput, model: skill.model };
}

export async function deleteSkill(userId, skillId) {
  const db = await getPool();
  const result = await db.query('DELETE FROM skills WHERE id = $1 AND user_id = $2', [skillId, userId]);
  return result.rowCount > 0;
}

export async function updateSkill(userId, skillId, updates) {
  const db = await getPool();
  const fields = [];
  const values = [];
  let idx = 1;
  for (const [key, value] of Object.entries(updates)) {
    if (['name', 'description', 'category', 'task_template', 'model', 'is_public'].includes(key)) {
      const col = key === 'taskTemplate' ? 'task_template' : key === 'isPublic' ? 'is_public' : key;
      fields.push(`${col} = $${idx}`);
      values.push(value);
      idx++;
    }
  }
  if (updates.variables) { fields.push(`variables = $${idx}`); values.push(JSON.stringify(updates.variables)); idx++; }
  if (!fields.length) throw new Error('No valid updates');
  values.push(skillId, userId);
  const result = await db.query(
    `UPDATE skills SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}
