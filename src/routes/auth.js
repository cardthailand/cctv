const express = require('express');
const passport = require('passport');
const {
  logAudit,
  logLoginAttempt,
  countRecentFailedAttempts,
} = require('../services/auditService');
const userService = require('../services/userService');
const { isGoogleOAuthEnabled } = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

function getClientMeta(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'ยังไม่ได้เข้าสู่ระบบ' });
  }
  return res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      displayName: req.user.displayName,
      role: req.user.role,
      channels: req.user.channels,
    },
    googleOAuthEnabled: isGoogleOAuthEnabled(),
  });
});

router.post('/login', async (req, res, next) => {
  const identifier = req.body?.username;

  let failedCount = 0;
  try {
    failedCount = await countRecentFailedAttempts(identifier);
  } catch (error) {
    logger.error('Database unavailable during login', { message: error.message });
    return res.status(503).json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
  }

  if (failedCount >= 5) {
    return res.status(429).json({ error: 'ลองเข้าสู่ระบบมากเกินไป กรุณารอ 15 นาที' });
  }

  passport.authenticate('local', async (error, user, info) => {
    if (error) return next(error);
    if (!user) {
      try {
        await logLoginAttempt(identifier, req.ip, false);
        await logAudit({
          action: 'login_failed',
          ...getClientMeta(req),
          metadata: { reason: 'invalid_credentials', identifier },
        });
      } catch (auditError) {
        logger.warn('Audit log failed on login_failed', { message: auditError.message });
      }
      return res.status(401).json({ error: info?.message || 'เข้าสู่ระบบไม่สำเร็จ' });
    }

    req.logIn(user, async (loginError) => {
      if (loginError) return next(loginError);
      try {
        await userService.updateLastLogin(user.id);
        await logLoginAttempt(identifier, req.ip, true);
        await logAudit({
          userId: user.id,
          action: 'login',
          ...getClientMeta(req),
          metadata: { method: 'local' },
        });
      } catch (auditError) {
        logger.warn('Audit log failed on login', { message: auditError.message });
      }
      return res.json({ success: true, user });
    });
  })(req, res, next);
});

router.post('/logout', async (req, res, next) => {
  const userId = req.user?.id;
  req.logout(async (error) => {
    if (error) return next(error);
    if (userId) {
      await logAudit({
        userId,
        action: 'logout',
        ...getClientMeta(req),
      });
    }
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

if (isGoogleOAuthEnabled()) {
  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  router.get(
    '/google/callback',
    passport.authenticate('google', {
      failureRedirect: '/login.html?error=oauth',
    }),
    async (req, res) => {
      await userService.updateLastLogin(req.user.id);
      await logAudit({
        userId: req.user.id,
        action: 'oauth_login',
        ...getClientMeta(req),
        metadata: { provider: 'google' },
      });
      res.redirect('/index.html');
    }
  );
}

module.exports = router;
