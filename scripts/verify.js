/**
 * Smoke test: โหลดโมดูลหลักและตรวจ syntax โดยไม่รัน server จริง
 */
const path = require('path');
const root = path.join(__dirname, '..');

const modules = [
  '../src/config.js',
  '../src/db/pool.js',
  '../src/auth/middleware.js',
  '../src/auth/passport.js',
  '../src/services/streamingGateway.js',
  '../src/services/wsTokenService.js',
  '../src/services/recordingWorker.js',
  '../src/services/recordingIndex.js',
  '../src/services/ollamaService.js',
  '../src/routes/auth.js',
  '../src/routes/admin.js',
  '../src/routes/stream.js',
  '../src/routes/chat.js',
  '../src/routes/recordings.js',
];

let failed = 0;
for (const mod of modules) {
  try {
    require(path.join(__dirname, mod));
    console.log(`OK ${mod}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${mod}: ${error.message}`);
  }
}

const { signStreamToken, verifyStreamToken } = require(path.join(root, 'src/services/wsTokenService'));
const token = signStreamToken({ id: 'test-user', role: 'admin' }, 1);
verifyStreamToken(token, 1);
console.log('OK WS token sign/verify');

if (failed > 0) {
  process.exit(1);
}
console.log('All module checks passed');
