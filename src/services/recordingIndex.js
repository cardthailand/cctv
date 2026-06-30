const fs = require('fs');
const path = require('path');
const { config } = require('../config');

const FILE_PATTERN = /^ch(\d+)_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.mp4$/;
let cache = [];
let lastScan = 0;

function parseFileName(fileName) {
  const match = fileName.match(FILE_PATTERN);
  if (!match) return null;

  const channel = parseInt(match[1], 10);
  const start = new Date(`${match[2]}T${match[3].replace(/-/g, ':')}`);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + config.recording.segmentSeconds * 1000);
  return { channel, fileName, start, end };
}

function scanRecordings(force = false) {
  const now = Date.now();
  if (!force && now - lastScan < 5 * 60 * 1000) {
    return cache;
  }

  if (!fs.existsSync(config.recording.dir)) {
    cache = [];
    lastScan = now;
    return cache;
  }

  const files = fs.readdirSync(config.recording.dir);
  cache = files
    .map(parseFileName)
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  lastScan = now;
  return cache;
}

function filterByChannels(items, channels) {
  const allowed = new Set(channels);
  return items.filter((item) => allowed.has(item.channel));
}

function searchRecordings({ channel, startTime, endTime, allowedChannels }) {
  const items = filterByChannels(scanRecordings(), allowedChannels);
  const start = startTime ? new Date(startTime) : null;
  const end = endTime ? new Date(endTime) : null;

  return items.filter((item) => {
    if (channel && item.channel !== channel) return false;
    if (start && item.end < start) return false;
    if (end && item.start > end) return false;
    return true;
  });
}

function findRecordingAtTime({ channel, datetime, allowedChannels }) {
  const target = new Date(datetime);
  const items = filterByChannels(scanRecordings(), allowedChannels)
    .filter((item) => item.channel === channel);

  const match = items.find((item) => target >= item.start && target < item.end);
  if (!match) return null;

  const seekSeconds = Math.floor((target - match.start) / 1000);
  return {
    fileName: match.fileName,
    channel: match.channel,
    start: match.start.toISOString(),
    end: match.end.toISOString(),
    seekSeconds,
  };
}

function listSummary({ channel, date, allowedChannels }) {
  let items = filterByChannels(scanRecordings(), allowedChannels);
  if (channel) items = items.filter((item) => item.channel === channel);
  if (date) {
    items = items.filter((item) => item.start.toISOString().slice(0, 10) === date);
  }

  return items.map((item) => ({
    fileName: item.fileName,
    channel: item.channel,
    start: item.start.toISOString(),
    end: item.end.toISOString(),
  }));
}

function getRecordingPath(fileName) {
  const base = path.basename(fileName);
  const fullPath = path.join(config.recording.dir, base);
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}

module.exports = {
  parseFileName,
  scanRecordings,
  searchRecordings,
  findRecordingAtTime,
  listSummary,
  getRecordingPath,
};
