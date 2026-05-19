import { Logger, LOG_LEVELS } from './logger.js';

export { withLog, loggedInitials, loggedFormatYears, loggedBuildSvgPath } from './logdecorator.js';

export function withLogAsync(fn, {
  level     = 'INFO',
  logger    = new Logger({ name: 'async' }),
  label     = fn.name || 'anonymous',
  logArgs   = true,
  logResult = true,
  profile   = true,
} = {}) {

  if (!(level in LOG_LEVELS)) {
    throw new Error(`withLogAsync: невідомий рівень "${level}"`);
  }

  async function decorated(...args) {
    const t0   = profile ? performance.now() : null;
    const meta = {};
    if (logArgs) meta.args = _serializeArgs(args);

    if (level === 'ERROR') {
      try {
        return await fn(...args);
      } catch (err) {
        logger.error(`${label} відхилено`, meta, err);
        throw err;
      }
    }

    if (level === 'DEBUG') {
      logger.debug(`${label} → запуск`, meta);
    }

    try {
      const result  = await fn(...args);
      const elapsed = profile ? `${(performance.now() - t0).toFixed(1)}ms` : null;

      const resolveMeta = { ...meta };
      if (logResult) resolveMeta.result = _serializeResult(result);
      if (elapsed)   resolveMeta.time   = elapsed;

      logger[level.toLowerCase()](`${label} ✓`, resolveMeta);
      return result;

    } catch (err) {
      const elapsed = profile ? `${(performance.now() - t0).toFixed(1)}ms` : null;
      logger.error(`${label} ✗`, { ...meta, time: elapsed }, err);
      throw err;
    }
  }

  Object.defineProperty(decorated, 'name', { value: `loggedAsync(${label})` });
  return decorated;
}

import { authLog, importLog } from './logger.js';

export function decorateAuthRequest(rawRequestFn) {
  return withLogAsync(rawRequestFn, {
    level:     'INFO',
    logger:    authLog,
    label:     'authproxy.request',
    logArgs:   true,
    logResult: false,
    profile:   true,
  });
}

export function decorateImportExport(exportFn, importFn) {
  const loggedExport = withLogAsync(exportFn, {
    level:     'INFO',
    logger:    importLog,
    label:     'exportTreeStream',
    logArgs:   true,
    logResult: false,
    profile:   true,
  });

  const loggedImport = withLogAsync(importFn, {
    level:   'INFO',
    logger:  importLog,
    label:   'importTreeStream',
    logArgs: true,
    profile: true,
  });

  return { loggedExport, loggedImport };
}

function _serializeArgs(args) {
  try {
    return args.map(a => {
      if (typeof a === 'function') return `[Function: ${a.name || 'fn'}]`;
      if (typeof a === 'string' && a.length > 80) return a.slice(0, 77) + '…';
      if (a instanceof Blob || a instanceof File) return `[${a.constructor.name}: ${a.size}b]`;
      return a;
    });
  } catch { return '[не серіалізується]'; }
}

function _serializeResult(result) {
  if (result === null || result === undefined) return result;
  if (typeof result === 'string' && result.length > 80) return result.slice(0, 77) + '…';
  if (Array.isArray(result)) return `Array(${result.length})`;
  if (typeof result === 'object') return `{${Object.keys(result).slice(0, 5).join(', ')}}`;
  return result;
}