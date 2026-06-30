function timestamp() {
  return new Date().toISOString();
}

function log(level, message, meta) {
  const line = meta
    ? `[${timestamp()}] [${level}] ${message} ${JSON.stringify(meta)}`
    : `[${timestamp()}] [${level}] ${message}`;
  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  info: (message, meta) => log('INFO', message, meta),
  warn: (message, meta) => log('WARN', message, meta),
  error: (message, meta) => log('ERROR', message, meta),
};
