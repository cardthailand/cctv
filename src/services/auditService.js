const { pool } = require('../db/pool');

async function logAudit({
  userId = null,
  action,
  resource = null,
  ipAddress = null,
  userAgent = null,
  metadata = {},
}) {
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, resource, ip_address, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, action, resource, ipAddress, userAgent, JSON.stringify(metadata)]
  );
}

async function logLoginAttempt(identifier, ipAddress, success) {
  await pool.query(
    `INSERT INTO login_attempts (identifier, ip_address, success)
     VALUES ($1, $2, $3)`,
    [identifier, ipAddress, success]
  );
}

async function countRecentFailedAttempts(identifier, minutes = 15) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM login_attempts
     WHERE identifier = $1
       AND success = false
       AND created_at > NOW() - ($2 || ' minutes')::interval`,
    [identifier, String(minutes)]
  );
  return result.rows[0].count;
}

module.exports = {
  logAudit,
  logLoginAttempt,
  countRecentFailedAttempts,
};
