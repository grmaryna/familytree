import { Logger, LOG_LEVELS } from './logger.js';

export function withLog(fn, {
  level     = 'INFO',
  logger    = new Logger({ name: 'decorator' }),
  label     = fn.name || 'anonymous',
  logArgs   = true,
  logResult = true,
  profile   = true,
} = {}) {

  if (!(level in LOG_LEVELS)) {
    throw new Error(`withLog: невідомий рівень "${level}"`);
  }

  function decorated(...args) {
    const t0 = profile ? performance.now() : null;

    if (level === 'ERROR') {
      try {
        const result = fn(...args);
        return result;
      } catch (err) {
        logger.error(`${label} кинув виняток`, { args: _serializeArgs(args, logArgs) }, err);
        throw err;
      }
    }

    try {
      const result  = fn(...args);
      const elapsed = profile ? `${(performance.now() - t0).toFixed(2)}ms` : null;

      const meta = {};
      if (logArgs)   meta.args   = _serializeArgs(args, logArgs);
      if (logResult) meta.result = _serializeResult(result);
      if (elapsed)   meta.time   = elapsed;

      logger[level.toLowerCase()](`${label}()`, meta);
      return result;
    } catch (err) {
      logger.error(`${label} кинув виняток`, { args: _serializeArgs(args, logArgs) }, err);
      throw err;
    }
  }

  Object.defineProperty(decorated, 'name', { value: `logged(${label})` });

  return decorated;
}

function _serializeArgs(args, enabled) {
  if (!enabled) return '[приховано]';
  try {
    return args.map(a =>
      typeof a === 'string' && a.length > 80 ? a.slice(0, 77) + '…' : a
    );
  } catch { return '[не серіалізується]'; }
}

function _serializeResult(result) {
  if (result === null || result === undefined) return result;
  if (typeof result === 'string' && result.length > 80) return result.slice(0, 77) + '…';
  if (Array.isArray(result)) return `Array(${result.length})`;
  if (typeof result === 'object') return `{${Object.keys(result).join(', ')}}`;
  return result;
}

import { Logger }                              from './logger.js';
import { initials, formatYears, buildSvgPath } from './memoize.js';

const memoLog = new Logger({ name: 'memoUtils', minLevel: 'DEBUG' });

export const loggedInitials = withLog(initials, {
  level:  'DEBUG',
  logger: memoLog,
  label:  'initials',
  profile: true,
});

export const loggedFormatYears = withLog(formatYears, {
  level:  'ERROR',
  logger: memoLog,
  label:  'formatYears',
});

export const loggedBuildSvgPath = withLog(buildSvgPath, {
  level:     'INFO',
  logger:    memoLog,
  label:     'buildSvgPath',
  logResult: false,
  profile:   true,
});