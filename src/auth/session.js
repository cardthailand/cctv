const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('../db/pool');
const { config } = require('../config');

function createSessionMiddleware() {
  return session({
    store: new pgSession({
      pool,
      tableName: 'sessions',
      createTableIfMissing: false,
    }),
    secret: config.server.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  });
}

module.exports = { createSessionMiddleware };
