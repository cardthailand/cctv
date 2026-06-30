const { pool } = require('../db/pool');

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
    oauthProvider: row.oauth_provider,
    lastLoginAt: row.last_login_at,
  };
}

async function findByUsername(username) {
  const result = await pool.query(
    `SELECT id, email, username, password_hash, display_name, role, oauth_provider, oauth_sub,
            is_active, last_login_at
     FROM users
     WHERE username = $1
     LIMIT 1`,
    [username]
  );
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const result = await pool.query(
    `SELECT id, email, username, password_hash, display_name, role, oauth_provider, oauth_sub,
            is_active, last_login_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function findByOAuth(provider, sub) {
  const result = await pool.query(
    `SELECT id, email, username, password_hash, display_name, role, oauth_provider, oauth_sub,
            is_active, last_login_at
     FROM users
     WHERE oauth_provider = $1 AND oauth_sub = $2
     LIMIT 1`,
    [provider, sub]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(
    `SELECT id, email, username, display_name, role, oauth_provider, is_active, last_login_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return mapUser(result.rows[0]);
}

async function updateLastLogin(userId) {
  await pool.query(
    'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
    [userId]
  );
}

async function getUserChannels(userId, role) {
  if (role === 'admin' || role === 'user') {
    const { config } = require('../config');
    return config.camera.channels;
  }

  const result = await pool.query(
    'SELECT channel FROM user_channel_access WHERE user_id = $1 ORDER BY channel',
    [userId]
  );
  return result.rows.map((row) => row.channel);
}

async function upsertOAuthUser({ email, displayName, provider, sub }) {
  const existing = await findByOAuth(provider, sub);
  if (existing) {
    await pool.query(
      `UPDATE users
       SET email = COALESCE($2, email),
           display_name = COALESCE($3, display_name),
           updated_at = NOW()
       WHERE id = $1`,
      [existing.id, email, displayName]
    );
    return findById(existing.id);
  }

  const usernameBase = (email || `oauth_${sub}`).split('@')[0].slice(0, 40);
  let username = usernameBase;
  let suffix = 1;

  while (await findByUsername(username)) {
    username = `${usernameBase}_${suffix}`;
    suffix += 1;
  }

  const result = await pool.query(
    `INSERT INTO users (email, username, display_name, role, oauth_provider, oauth_sub)
     VALUES ($1, $2, $3, 'employee', $4, $5)
     RETURNING id`,
    [email, username, displayName || username, provider, sub]
  );

  return findById(result.rows[0].id);
}

async function listUsers() {
  const result = await pool.query(
    `SELECT id, email, username, display_name, role, is_active, last_login_at, created_at
     FROM users
     ORDER BY created_at DESC`
  );
  return result.rows.map(mapUser);
}

async function createUser({ username, email, passwordHash, displayName, role }) {
  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [username, email, passwordHash, displayName, role]
  );
  return findById(result.rows[0].id);
}

async function setUserChannels(userId, channels, grantedBy) {
  await pool.query('DELETE FROM user_channel_access WHERE user_id = $1', [userId]);
  for (const channel of channels) {
    await pool.query(
      `INSERT INTO user_channel_access (user_id, channel, granted_by)
       VALUES ($1, $2, $3)`,
      [userId, channel, grantedBy]
    );
  }
}

async function getAuditLogs({ limit = 100, action, username, from, to } = {}) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (action) {
    conditions.push(`a.action = $${paramIndex++}`);
    params.push(action);
  }
  if (username) {
    conditions.push(`u.username ILIKE $${paramIndex++}`);
    params.push(`%${username}%`);
  }
  if (from) {
    conditions.push(`a.created_at >= $${paramIndex++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`a.created_at <= $${paramIndex++}`);
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const result = await pool.query(
    `SELECT a.id, a.action, a.resource, a.ip_address, a.user_agent, a.metadata, a.created_at,
            u.username
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${paramIndex}`,
    params
  );
  return result.rows;
}

async function getUserChannelList(userId) {
  const result = await pool.query(
    'SELECT channel FROM user_channel_access WHERE user_id = $1 ORDER BY channel',
    [userId]
  );
  return result.rows.map((row) => row.channel);
}

async function updateUserRole(userId, role) {
  const result = await pool.query(
    `UPDATE users SET role = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [userId, role]
  );
  if (!result.rows.length) {
    throw new Error('User not found');
  }
  return findById(userId);
}

async function setUserActive(userId, isActive) {
  const result = await pool.query(
    `UPDATE users SET is_active = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [userId, isActive]
  );
  if (!result.rows.length) {
    throw new Error('User not found');
  }
  return findById(userId);
}

module.exports = {
  mapUser,
  findByUsername,
  findByEmail,
  findByOAuth,
  findById,
  updateLastLogin,
  getUserChannels,
  upsertOAuthUser,
  listUsers,
  createUser,
  setUserChannels,
  getUserChannelList,
  updateUserRole,
  setUserActive,
  getAuditLogs,
};
