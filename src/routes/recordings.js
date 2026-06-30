const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../auth/middleware');
const recordingIndex = require('../services/recordingIndex');
const { logAudit } = require('../services/auditService');

const router = express.Router();

function hasChannelAccess(user, channel) {
  return user.channels.includes(channel);
}

router.get('/search', requireAuth, (req, res) => {
  const channel = req.query.channel ? parseInt(req.query.channel, 10) : null;
  if (channel && !hasChannelAccess(req.user, channel)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงช่องนี้' });
  }

  const results = recordingIndex.searchRecordings({
    channel,
    startTime: req.query.from,
    endTime: req.query.to,
    allowedChannels: req.user.channels,
  });

  res.json({ results });
});

router.get('/at-time', requireAuth, (req, res) => {
  const channel = parseInt(req.query.channel, 10);
  const datetime = req.query.datetime;
  if (!channel || !datetime) {
    return res.status(400).json({ error: 'ต้องระบุ channel และ datetime' });
  }
  if (!hasChannelAccess(req.user, channel)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงช่องนี้' });
  }

  const result = recordingIndex.findRecordingAtTime({
    channel,
    datetime,
    allowedChannels: req.user.channels,
  });

  res.json({ result });
});

router.get('/file/:fileName', requireAuth, async (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const parsed = recordingIndex.parseFileName?.(fileName);
  const match = fileName.match(/^ch(\d+)_/);
  const channel = parsed?.channel || (match ? parseInt(match[1], 10) : null);

  if (!channel || !hasChannelAccess(req.user, channel)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงไฟล์นี้' });
  }

  const filePath = recordingIndex.getRecordingPath(fileName);
  if (!filePath) {
    return res.status(404).json({ error: 'ไม่พบไฟล์' });
  }

  await logAudit({
    userId: req.user.id,
    action: 'view_playback',
    resource: fileName,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: { channel, seekSeconds: req.query.seek || 0 },
  });

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });
    return stream.pipe(res);
  }

  res.writeHead(200, {
    'Content-Length': fileSize,
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
  });
  return fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
