require('dotenv').config();
const express = require('express');
const path = require('path');
const passport = require('passport');
const { config } = require('./config');
const { createSessionMiddleware } = require('./auth/session');
const { configurePassport } = require('./auth/passport');
const { requireAuth } = require('./auth/middleware');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const streamRoutes = require('./routes/stream');
const chatRoutes = require('./routes/chat');
const recordingsRoutes = require('./routes/recordings');

const recordingWorker = require('./services/recordingWorker');
const streamingGateway = require('./services/streamingGateway');
const storageCleanup = require('./services/storageCleanup');
const recordingIndex = require('./services/recordingIndex');

const app = express();

app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(createSessionMiddleware());
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/recordings', recordingsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.redirect('/login.html');
});

app.get('/index.html', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/admin.html', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send('Forbidden');
  }
  return res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.use(express.static(path.join(__dirname, '../public'), {
  index: false,
}));

app.use((error, _req, res, _next) => {
  logger.error('Unhandled error', { message: error.message });
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
});

function shutdown() {
  logger.info('Shutting down...');
  recordingWorker.stopRecording();
  streamingGateway.stopStreaming();
  storageCleanup.stopCleanup();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function start() {
  recordingIndex.scanRecordings(true);
  recordingWorker.startRecording();
  streamingGateway.startStreaming();
  storageCleanup.startCleanup();

  app.listen(config.server.httpPort, () => {
    logger.info(`CCTV Web Client running on ${config.server.appUrl}`);
  });
}

start();
