const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[process.env.LOG_LEVEL || 'info'] || 20;

function log(level, scope, message, meta) {
  if (LEVELS[level] < threshold) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(meta ? { meta } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

function createLogger(scope) {
  return {
    debug: (msg, meta) => log('debug', scope, msg, meta),
    info: (msg, meta) => log('info', scope, msg, meta),
    warn: (msg, meta) => log('warn', scope, msg, meta),
    error: (msg, meta) => log('error', scope, msg, meta),
  };
}

module.exports = { createLogger };
