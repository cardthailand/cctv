const fs = require('fs');
const path = require('path');
const { config } = require('../config');
const logger = require('../utils/logger');

let intervalId = null;

function cleanupOldRecordings() {
  const retentionMs = config.recording.retentionDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (!fs.existsSync(config.recording.dir)) {
    return;
  }

  const files = fs.readdirSync(config.recording.dir);
  let removed = 0;

  for (const file of files) {
    if (!file.endsWith('.mp4')) continue;
    const filePath = path.join(config.recording.dir, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > retentionMs) {
      fs.unlinkSync(filePath);
      removed += 1;
    }
  }

  if (removed > 0) {
    logger.info(`Storage cleanup removed ${removed} file(s)`);
  }
}

function startCleanup() {
  cleanupOldRecordings();
  const hours = config.recording.cleanupIntervalHours;
  intervalId = setInterval(cleanupOldRecordings, hours * 60 * 60 * 1000);
}

function stopCleanup() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

module.exports = {
  startCleanup,
  stopCleanup,
  cleanupOldRecordings,
};
