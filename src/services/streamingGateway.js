const Stream = require('node-rtsp-stream');
const { config, getRtspUrl } = require('../config');
const logger = require('../utils/logger');

const streams = new Map();

function startChannelStream(channel) {
  if (streams.has(channel)) {
    return;
  }

  const stream = new Stream({
    name: `cam${channel}`,
    streamUrl: getRtspUrl(channel, 1),
    wsPort: config.server.wsPortBase + channel,
    ffmpegOptions: {
      '-stats': '',
      '-r': 25,
      '-q:v': 5,
    },
  });

  stream.mpeg1Muxer?.on?.('exit', () => {
    logger.warn(`Stream ffmpeg exited ch${channel}`);
    streams.delete(channel);
    setTimeout(() => startChannelStream(channel), 5000);
  });

  streams.set(channel, stream);
  logger.info(`Started live stream gateway channel ${channel}`, {
    wsPort: config.server.wsPortBase + channel,
  });
}

function startStreaming() {
  for (const channel of config.camera.channels) {
    startChannelStream(channel);
  }
}

function stopStreaming() {
  for (const [channel, stream] of streams.entries()) {
    try {
      stream.stop();
    } catch (error) {
      logger.warn(`Failed stopping stream ch${channel}`, { message: error.message });
    }
    streams.delete(channel);
  }
}

module.exports = {
  startStreaming,
  stopStreaming,
};
