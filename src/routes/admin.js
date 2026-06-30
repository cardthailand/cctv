const express = require('express');
const bcrypt = require('bcrypt');
const { requireAuth, requireRole } = require('../auth/middleware');
const userService = require('../services/userService');
const { logAudit } = require('../services/auditService');
const { config } = require('../config');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/users', async (_req, res, next) => {
  try {
    const users = await userService.listUsers();
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

router.post('/users', async (req, res, next) => {
  try {
    const { username, email, password, displayName, role, channels = [] } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'ต้องระบุ username, password, role' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userService.createUser({
      username,
      email,
      passwordHash,
      displayName: displayName || username,
      role,
    });

    if (role === 'employee' && Array.isArray(channels) && channels.length) {
      await userService.setUserChannels(user.id, channels, req.user.id);
    }

    await logAudit({
      userId: req.user.id,
      action: 'admin_create_user',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { targetUserId: user.id, role },
    });

    res.status(201).json({ user });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'username หรือ email ซ้ำ' });
    }
    next(error);
  }
});

router.put('/users/:id/channels', async (req, res, next) => {
  try {
    const channels = Array.isArray(req.body.channels) ? req.body.channels : [];
    await userService.setUserChannels(req.params.id, channels, req.user.id);
    await logAudit({
      userId: req.user.id,
      action: 'admin_grant_channel',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      metadata: { targetUserId: req.params.id, channels },
    });
    res.json({ success: true, channels });
  } catch (error) {
    next(error);
  }
});

router.get('/audit-logs', async (_req, res, next) => {
  try {
    const logs = await userService.getAuditLogs(200);
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

router.get('/config/channels', (_req, res) => {
  res.json({ channels: config.camera.channels });
});

module.exports = router;
