import { Logger } from './logger.js';

export function jsonFormatter(entry) {
  return JSON.stringify({
    ts:      entry.timestamp.toISOString(),
    level:   entry.level,
    name:    entry.name,
    message: entry.message,
    meta:    entry.meta,
  });
}

const LS_KEY     = 'rodo:logs';
const LS_MAX     = 200;

export function localStorageTransport(entry) {
  if (entry.level !== 'WARN' && entry.level !== 'ERROR') return;

  let logs = [];
  try {
    logs = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch { logs = []; }

  logs.push({
    ts:      entry.timestamp.toISOString(),
    level:   entry.level,
    name:    entry.name,
    message: entry.message,
    meta:    entry.meta,
  });

  if (logs.length > LS_MAX) logs = logs.slice(-LS_MAX);

  try {
    localStorage.setItem(LS_KEY, JSON.stringify(logs));
  } catch (e) {
    localStorage.removeItem(LS_KEY);
  }
}

export function readStoredLogs() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch { return []; }
}

export function clearStoredLogs() {
  localStorage.removeItem(LS_KEY);
}

export function createRemoteTransport({
  endpoint      = 'http://localhost:4000/api/logs',
  flushInterval = 5_000,
  minLevel      = 'ERROR',
  getToken      = async () => null,
} = {}) {
  const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 99 };
  const minPriority = LEVELS[minLevel] ?? 3;

  const batch = [];
  let   timer = null;

  async function flush() {
    if (batch.length === 0) return;
    const toSend = batch.splice(0);

    try {
      const token   = await getToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch(endpoint, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ logs: toSend }),
      });
    } catch {
    }
  }

  timer = setInterval(flush, flushInterval);

  window.addEventListener('beforeunload', () => {
    clearInterval(timer);
    if (batch.length > 0) {
      const token = null;
      navigator.sendBeacon?.(endpoint + '/beacon', JSON.stringify({ logs: batch }));
    }
  });

  return function remoteTransport(entry) {
    const { LOG_LEVELS: L } = { LOG_LEVELS: { DEBUG:0, INFO:1, WARN:2, ERROR:3, NONE:99 } };
    if ((L[entry.level] ?? 0) < minPriority) return;

    batch.push({
      ts:      entry.timestamp.toISOString(),
      level:   entry.level,
      name:    entry.name,
      message: entry.message,
      meta:    entry.meta,
    });
  };
}

export async function createLogger({
  name,
  minLevel   = 'INFO',
  remote     = false,
  structured = false,
  getToken   = async () => null,
} = {}) {
  const logger = new Logger({
    name,
    minLevel,
    formatter: structured ? jsonFormatter : undefined,
  });

  logger.addTransport(localStorageTransport);

  if (remote) {
    const remoteT = await createRemoteTransport({ getToken });
    logger.addTransport(remoteT);
  }

  return logger;
}