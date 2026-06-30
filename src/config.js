require('dotenv').config();
const path = require('path');

const channels = (process.env.CHANNELS || '1,2,3,4')
  .split(',')
  .map((value) => parseInt(value.trim(), 10))
  .filter((value) => Number.isInteger(value) && value > 0);

const config = {
  camera: {
    ip: process.env.CAMERA_IP || '192.168.2.27',
    user: process.env.CAMERA_USER || 'admin',
    password: process.env.CAMERA_PASSWORD || '',
    port: parseInt(process.env.CAMERA_PORT || '554', 10),
    channels,
  },
  server: {
    httpPort: parseInt(process.env.HTTP_PORT || '3000', 10),
    wsPortBase: parseInt(process.env.WS_PORT_BASE || '9000', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
    useDirectWsPort: process.env.USE_DIRECT_WS_PORT !== 'false',
  },
  recording: {
    dir: path.resolve(process.env.RECORD_DIR || './recordings'),
    segmentSeconds: parseInt(process.env.SEGMENT_SECONDS || '3600', 10),
    retentionDays: parseInt(process.env.RETENTION_DAYS || '30', 10),
    cleanupIntervalHours: parseInt(process.env.CLEANUP_INTERVAL_HOURS || '6', 10),
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'cctv_db',
    user: process.env.DB_USER || 'cctv_db',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
  },
  auth: {
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'change_me_on_first_run',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl:
        process.env.GOOGLE_CALLBACK_URL ||
        'http://localhost:3000/api/auth/google/callback',
    },
  },
  ollama: {
    host: process.env.OLLAMA_HOST || 'https://ollama.com',
    apiKey: process.env.OLLAMA_API_KEY || '',
    model: process.env.OLLAMA_MODEL || 'glm-5.1:cloud',
  },
  wsToken: {
    secret: process.env.WS_TOKEN_SECRET || 'dev-ws-token-secret-change-me',
    expirySec: parseInt(process.env.WS_TOKEN_EXPIRY_SEC || '300', 10),
  },
};

function getRtspUrl(channel, streamType = 1) {
  const { ip, user, password, port } = config.camera;
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `rtsp://${auth}@${ip}:${port}/avstream/channel=${channel}/stream=${streamType}.sdp`;
}

function isGoogleOAuthEnabled() {
  return Boolean(config.auth.google.clientId && config.auth.google.clientSecret);
}

function getPublicWsUrl(channel) {
  const app = new URL(config.server.appUrl);
  const protocol = app.protocol === 'https:' ? 'wss:' : 'ws:';
  if (config.server.useDirectWsPort) {
    const port = config.server.wsPortBase + channel;
    return `${protocol}//${app.hostname}:${port}`;
  }
  return `${protocol}//${app.host}/ws/cam${channel}`;
}

module.exports = {
  config,
  getRtspUrl,
  getPublicWsUrl,
  isGoogleOAuthEnabled,
};
