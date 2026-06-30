const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { config } = require('../config');
const logger = require('../utils/logger');

const processes = new Map();

function ensureRecordDir() {
  fs.mkdirSync(config.recording.dir, { recursive: true });
}

function startChannelRecording(channel) {
  if (processes.has(`rec-${channel}`)) {
    return;
  }

  const rtspUrl = require('../config').getRtspUrl(channel, 0);
  const outputPattern = path.join(
    config.recording.dir,
    `ch${channel}_%Y-%m-%d_%H-%M-%S.mp4`
  );

  const args = [
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-c', 'copy',
    '-f', 'segment',
    '-segment_time', String(config.recording.segmentSeconds),
    '-strftime', '1',
    '-reset_timestamps', '1',
    outputPattern,
  ];

  const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });

  ffmpeg.stderr.on('data', () => {
    // ffmpeg logs are verbose; ignore in normal operation
  });

  ffmpeg.on('exit', (code) => {
    logger.warn(`Recording ffmpeg exited ch${channel}`, { code });
    processes.delete(`rec-${channel}`);
    setTimeout(() => startChannelRecording(channel), 5000);
  });

  processes.set(`rec-${channel}`, ffmpeg);
  logger.info(`Started recording channel ${channel}`);
}

function startRecording() {
  ensureRecordDir();
  for (const channel of config.camera.channels) {
    startChannelRecording(channel);
  }
}

function stopRecording() {
  for (const [key, proc] of processes.entries()) {
    if (key.startsWith('rec-')) {
      proc.kill('SIGTERM');
      processes.delete(key);
    }
  }
}

module.exports = {
  startRecording,
  stopRecording,
};
