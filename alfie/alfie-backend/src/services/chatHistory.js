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
      console.error('Unexpected error on idle chat history client', err);
    });
  }
  return pool;
}

function mapConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    threadId: row.thread_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata || {},
    messageCount: Number(row.message_count ?? 0),
  };
}

function mapMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    artifacts: row.artifacts || null,
    createdAt: row.created_at,
  };
}

export async function listConversations(userId = null, limit = 50, offset = 0) {
  try {
    const db = await getPool();
    const params = userId ? [userId, limit, offset] : [limit, offset];
    const userFilter = userId ? 'WHERE c.user_id = $1' : '';
    const limitParam = userId ? '$2' : '$1';
    const offsetParam = userId ? '$3' : '$2';
    const result = await db.query(
      `
      SELECT
        c.id,
        c.thread_id,
        c.title,
        c.created_at,
        c.updated_at,
        c.metadata,
        COUNT(m.id) AS message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      ${userFilter}
      GROUP BY c.id
      ORDER BY c.updated_at DESC NULLS LAST
      LIMIT ${limitParam} OFFSET ${offsetParam}
      `,
      params
    );
    return result.rows.map(mapConversation);
  } catch (error) {
    console.error('listConversations failed:', error);
    return { error: 'Failed to load conversations' };
  }
}

export async function getConversation(userId = null, threadId) {
  try {
    const db = await getPool();
    const params = userId ? [threadId, userId] : [threadId];
    const userFilter = userId ? 'AND user_id = $2' : '';
    const convoResult = await db.query(
      `
      SELECT id, thread_id, title, created_at, updated_at, metadata
      FROM conversations
      WHERE thread_id = $1 ${userFilter}
      LIMIT 1
      `,
      params
    );

    if (!convoResult.rows.length) {
      return null;
    }

    const conversation = mapConversation({
      ...convoResult.rows[0],
      message_count: 0,
    });

    const messagesResult = await db.query(
      `
      SELECT id, role, content, artifacts, created_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      `,
      [convoResult.rows[0].id]
    );

    return {
      ...conversation,
      messages: messagesResult.rows.map(mapMessage),
    };
  } catch (error) {
    console.error('getConversation failed:', error);
    return { error: 'Failed to load conversation' };
  }
}

export async function createConversation(userId = null, threadId, title, metadata = {}) {
  try {
    const db = await getPool();
    const params = userId
      ? [userId, threadId, title || null, metadata]
      : [threadId, title || null, metadata];
    const columns = userId
      ? 'user_id, thread_id, title, metadata, created_at, updated_at'
      : 'thread_id, title, metadata, created_at, updated_at';
    const values = userId
      ? '$1, $2, $3, $4, NOW(), NOW()'
      : '$1, $2, $3, NOW(), NOW()';
    const result = await db.query(
      `
      INSERT INTO conversations (${columns})
      VALUES (${values})
      RETURNING id, thread_id, title, created_at, updated_at, metadata
      `,
      params
    );
    return mapConversation({ ...result.rows[0], message_count: 0 });
  } catch (error) {
    console.error('createConversation failed:', error);
    return { error: 'Failed to create conversation' };
  }
}

export async function updateConversation(userId = null, threadId, { title, metadata }) {
  try {
    const updates = [];
    const values = [];
    let index = 1;

    if (title !== undefined) {
      updates.push(`title = $${index}`);
      values.push(title);
      index += 1;
    }

    if (metadata !== undefined) {
      updates.push(`metadata = $${index}`);
      values.push(metadata);
      index += 1;
    }

    if (!updates.length) {
      return { error: 'No updates provided' };
    }

    updates.push('updated_at = NOW()');
    values.push(threadId);
    const threadIdIndex = index;
    index += 1;

    let userFilter = '';
    if (userId) {
      values.push(userId);
      userFilter = ` AND user_id = $${index}`;
    }

    const db = await getPool();
    const result = await db.query(
      `
      UPDATE conversations
      SET ${updates.join(', ')}
      WHERE thread_id = $${threadIdIndex}${userFilter}
      RETURNING id, thread_id, title, created_at, updated_at, metadata
      `,
      values
    );

    if (!result.rows.length) {
      return null;
    }

    return mapConversation({ ...result.rows[0], message_count: 0 });
  } catch (error) {
    console.error('updateConversation failed:', error);
    return { error: 'Failed to update conversation' };
  }
}

export async function deleteConversation(userId = null, threadId) {
  try {
    const db = await getPool();
    const params = userId ? [threadId, userId] : [threadId];
    const userFilter = userId ? ' AND user_id = $2' : '';
    const result = await db.query(
      `DELETE FROM conversations WHERE thread_id = $1${userFilter}`,
      params
    );
    return { deleted: result.rowCount > 0 };
  } catch (error) {
    console.error('deleteConversation failed:', error);
    return { error: 'Failed to delete conversation' };
  }
}

export async function addMessage(userId = null, threadId, { role, content, artifacts = null }) {
  try {
    const db = await getPool();
    const params = userId
      ? [threadId, userId, role, content, artifacts]
      : [threadId, role, content, artifacts];
    const userFilter = userId ? ' AND user_id = $2' : '';
    const roleParam = userId ? '$3' : '$2';
    const contentParam = userId ? '$4' : '$3';
    const artifactsParam = userId ? '$5' : '$4';
    const result = await db.query(
      `
      WITH convo AS (
        SELECT id
        FROM conversations
        WHERE thread_id = $1${userFilter}
      ), inserted AS (
        INSERT INTO messages (conversation_id, role, content, artifacts, created_at)
        SELECT id, ${roleParam}, ${contentParam}, ${artifactsParam}, NOW()
        FROM convo
        RETURNING id, role, content, artifacts, created_at, conversation_id
      )
      UPDATE conversations
      SET updated_at = NOW()
      WHERE id = (SELECT conversation_id FROM inserted)
      RETURNING (SELECT id FROM inserted) AS message_id
      `,
      params
    );

    if (!result.rows.length || !result.rows[0].message_id) {
      return null;
    }

    const messageResult = await db.query(
      `
      SELECT id, role, content, artifacts, created_at
      FROM messages
      WHERE id = $1
      `,
      [result.rows[0].message_id]
    );

    return mapMessage(messageResult.rows[0]);
  } catch (error) {
    console.error('addMessage failed:', error);
    return { error: 'Failed to add message' };
  }
}

export async function getMessages(userId = null, threadId, limit = 100, offset = 0) {
  try {
    const db = await getPool();
    const params = userId ? [threadId, userId, limit, offset] : [threadId, limit, offset];
    const userFilter = userId ? ' AND c.user_id = $2' : '';
    const limitParam = userId ? '$3' : '$2';
    const offsetParam = userId ? '$4' : '$3';
    const result = await db.query(
      `
      SELECT m.id, m.role, m.content, m.artifacts, m.created_at
      FROM messages m
      INNER JOIN conversations c ON c.id = m.conversation_id
      WHERE c.thread_id = $1${userFilter}
      ORDER BY m.created_at ASC
      LIMIT ${limitParam} OFFSET ${offsetParam}
      `,
      params
    );
    return result.rows.map(mapMessage);
  } catch (error) {
    console.error('getMessages failed:', error);
    return { error: 'Failed to load messages' };
  }
}

export async function searchConversations(userId = null, query, limit = 20) {
  try {
    const db = await getPool();
    const params = userId ? [query, userId, limit] : [query, limit];
    const userFilter = userId ? ' AND c.user_id = $2' : '';
    const limitParam = userId ? '$3' : '$2';
    const result = await db.query(
      `
      WITH convo_messages AS (
        SELECT conversation_id,
               string_agg(content, ' ') AS content,
               COUNT(*) AS message_count
        FROM messages
        GROUP BY conversation_id
      )
      SELECT
        c.id,
        c.thread_id,
        c.title,
        c.created_at,
        c.updated_at,
        c.metadata,
        COALESCE(cm.message_count, 0) AS message_count
      FROM conversations c
      LEFT JOIN convo_messages cm ON cm.conversation_id = c.id
      WHERE to_tsvector('english', COALESCE(c.title, '') || ' ' || COALESCE(cm.content, ''))
        @@ plainto_tsquery('english', $1)${userFilter}
      ORDER BY c.updated_at DESC NULLS LAST
      LIMIT ${limitParam}
      `,
      params
    );
    return result.rows.map(mapConversation);
  } catch (error) {
    console.error('searchConversations failed:', error);
    return { error: 'Failed to search conversations' };
  }
}

export default {
  getPool,
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  addMessage,
  getMessages,
  searchConversations,
};
