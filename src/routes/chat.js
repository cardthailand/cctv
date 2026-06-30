const express = require('express');
const { requireAuth, canUseAiChat } = require('../auth/middleware');
const { runChat } = require('../services/ollamaService');
const { logAudit } = require('../services/auditService');

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  if (!canUseAiChat(req.user)) {
    return res.status(403).json({ error: 'พนักงานไม่มีสิทธิ์ใช้ AI Chat' });
  }

  const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
  if (!messages.length) {
    return res.status(400).json({ error: 'ต้องส่ง messages' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  await logAudit({
    userId: req.user.id,
    action: 'chat_query',
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { messageCount: messages.length },
  });

  try {
    await runChat({
      messages,
      allowedChannels: req.user.channels,
      onEvent: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
    });
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  }

  res.end();
});

module.exports = router;
