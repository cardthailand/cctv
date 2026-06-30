const express = require('express');
const { requireAuth, requireChannelAccess } = require('../auth/middleware');
const { signStreamToken } = require('../services/wsTokenService');
const { logAudit } = require('../services/auditService');
const { config, getPublicWsUrl } = require('../config');

const router = express.Router();

router.get('/token', requireAuth, requireChannelAccess, async (req, res) => {
  const token = signStreamToken(req.user, req.channel);
  await logAudit({
    userId: req.user.id,
    action: 'view_live',
    resource: `channel:${req.channel}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { channel: req.channel },
  });

  res.json({
    token,
    channel: req.channel,
    wsUrl: getPublicWsUrl(req.channel),
    wsPort: config.server.wsPortBase + req.channel,
    expiresIn: config.wsToken.expirySec,
  });
});

module.exports = router;
