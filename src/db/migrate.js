const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool } = require('./pool');
const { config } = require('../config');
const logger = require('../utils/logger');

async function runMigration(fileName) {
  const filePath = path.join(__dirname, 'migrations', fileName);
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
  logger.info(`Migration applied: ${fileName}`);
}

async function seedAdmin() {
  const existing = await pool.query(
    'SELECT id FROM users WHERE username = $1 LIMIT 1',
    [config.auth.adminUsername]
  );

  if (existing.rows.length > 0) {
    logger.info('Admin user already exists, skipping seed');
    return;
  }

  const passwordHash = await bcrypt.hash(config.auth.adminPassword, 12);
  await pool.query(
    `INSERT INTO users (email, username, password_hash, display_name, role)
     VALUES ($1, $2, $3, $4, 'admin')`,
    [
      config.auth.adminEmail,
      config.auth.adminUsername,
      passwordHash,
      'System Admin',
    ]
  );
  logger.info('Seeded default admin user', { username: config.auth.adminUsername });
}

async function migrate() {
  try {
    await runMigration('001_init.sql');
    await runMigration('002_seed_admin.sql');
    await seedAdmin();
    logger.info('Database migration completed');
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed', { message: error.message });
    process.exit(1);
  }
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate, seedAdmin };
