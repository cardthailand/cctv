const http = require('http');
const WebSocket = require('ws');
const Stream = require('node-rtsp-stream');
const { config, getRtspUrl } = require('../config');
const { verifyStreamToken } = require('./wsTokenService');
const logger = require('../utils/logger');

const INTERNAL_WS_OFFSET = 1000;
const streams = new Map();
const proxyServers = new Map();

function pipeSockets(client, upstream) {
  client.on('message', (data, isBinary) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data, { binary: isBinary });
    }
  });
  upstream.on('message', (data, isBinary) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data, { binary: isBinary });
    }
  });
  client.on('close', () => upstream.close());
  upstream.on('close', () => client.close());
  upstream.on('error', () => client.close());
  client.on('error', () => upstream.close());
}

function startWsAuthProxy(channel, attempt = 0) {
  if (proxyServers.has(channel)) {
    return;
  }

  const publicPort = config.server.wsPortBase + channel;
  const internalPort = config.server.wsPortBase + INTERNAL_WS_OFFSET + channel;

  const server = http.createServer();
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (clientWs, req) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${publicPort}`);
    const token = url.searchParams.get('token');

    if (!token) {
      clientWs.close(4001, 'Missing token');
      return;
    }

    try {
      verifyStreamToken(token, channel);
    } catch (error) {
      logger.warn(`WS auth rejected ch${channel}`, { message: error.message });
      clientWs.close(4001, 'Unauthorized');
      return;
    }

    const upstream = new WebSocket(`ws://127.0.0.1:${internalPort}`);
    upstream.on('open', () => pipeSockets(clientWs, upstream));
    upstream.on('error', () => clientWs.close(1011, 'Upstream error'));
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempt < 5) {
      logger.warn(`Port ${publicPort} busy ch${channel}, retry ${attempt + 1}/5`);
      setTimeout(() => startWsAuthProxy(channel, attempt + 1), 1500);
      return;
    }
    logger.error(`WS proxy failed ch${channel}`, {
      message: error.message,
      code: error.code,
    });
  });

  server.listen(publicPort, () => {
    proxyServers.set(channel, { server, wss });
    logger.info(`WS auth proxy channel ${channel}`, { publicPort, internalPort });
  });
}

function startChannelStream(channel) {
  if (streams.has(channel)) {
    return;
  }

  const internalPort = config.server.wsPortBase + INTERNAL_WS_OFFSET + channel;
  const stream = new Stream({
    name: `cam${channel}`,
    streamUrl: getRtspUrl(channel, 1),
    wsPort: internalPort,
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
  logger.info(`Started internal live stream channel ${channel}`, { internalPort });
}

function startStreaming() {
  for (const channel of config.camera.channels) {
    startChannelStream(channel);
    startWsAuthProxy(channel);
  }
}

function stopStreaming() {
  for (const [channel, entry] of proxyServers.entries()) {
    try {
      const { server, wss } = entry;
      for (const client of wss.clients) {
        client.terminate();
      }
      wss.close();
      server.close();
    } catch (error) {
      logger.warn(`Failed closing WS proxy ch${channel}`, { message: error.message });
    }
    proxyServers.delete(channel);
  }

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
