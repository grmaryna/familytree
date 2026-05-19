import { Logger, LOG_LEVELS } from './logger.js';
import { withLogAsync }       from './logdecoratorasync.js';

export function withCondition(decoratedFn, predicate) {
  async function conditional(...args) {
    const result = await decoratedFn(...args);
    if (predicate(args, result)) {
    }
    return result;
  }

  function conditionalSync(...args) {
    const shouldLog = predicate(args, undefined);
    if (!shouldLog) {
      return decoratedFn.__originalFn
        ? decoratedFn.__originalFn(...args)
        : decoratedFn(...args);
    }
    return decoratedFn(...args);
  }

  return Object.assign(conditionalSync, { async: conditional });
}

export function accessLogFormatter(entry) {
  const ts  = entry.timestamp.toISOString().slice(0, 19) + 'Z';
  const uid = entry.meta?.uid    ?? 'anonymous';
  const m   = entry.meta?.method ?? '';
  const p   = entry.meta?.path   ?? '';
  const st  = entry.meta?.status ?? '';
  const ms  = entry.meta?.ms     ?? '';
  return `[${ts}] uid:${uid} ${m} ${p} ${st} ${ms ? ms + 'ms' : ''}`.trim();
}

export function createMiddlewareLogger() {
  return new Logger({
    name:      'middleware',
    minLevel:  'INFO',
    formatter: accessLogFormatter,
  });
}

export function withRetryLog(fn, {
  maxRetries = 1,
  logger     = new Logger({ name: 'retry' }),
  label      = fn.name || 'fn',
  retryOn    = (err) => err.message.includes('401'),
} = {}) {

  return async function withRetry(...args) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const t0 = performance.now();

      try {
        const result = await fn(...args);
        const ms     = (performance.now() - t0).toFixed(1);

        if (attempt > 0) {
          logger.info(`${label} ✓ після retry #${attempt}`, { ms });
        } else {
          logger.debug(`${label} ✓`, { ms });
        }

        return result;

      } catch (err) {
        lastError    = err;
        const ms     = (performance.now() - t0).toFixed(1);

        if (attempt < maxRetries && retryOn(err)) {
          logger.warn(`${label} ✗ спроба ${attempt + 1}/${maxRetries + 1}, retry...`, {
            error: err.message, ms,
          });
          await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        } else {
          logger.error(`${label} ✗ остаточна помилка`, { ms }, err);
          throw err;
        }
      }
    }

    throw lastError;
  };
}

export async function logGroup(label, fn) {
  console.group(`[Родовід] ${label}`);
  try {
    const result = await fn();
    console.groupEnd();
    return result;
  } catch (err) {
    console.groupEnd();
    throw err;
  }
}

import { authLog, treeLog, importLog } from './logger.js';

export function decorateSaveTree(rawSaveTree) {
  return withRetryLog(
    withLogAsync(rawSaveTree, {
      level:   'INFO',
      logger:  treeLog,
      label:   'saveTree',
      logArgs: false,
      profile: true,
    }),
    {
      maxRetries: 0,
      logger:     treeLog,
      label:      'saveTree',
    }
  );
}

export function decorateDoRequest(rawDoRequest) {
  return withRetryLog(rawDoRequest, {
    maxRetries: 1,
    logger:     authLog,
    label:      '_doRequest',
    retryOn:    (err) => err.message.includes('401') || err.message.includes('HTTP 401'),
  });
}

export function decorateExportStream(rawExportFn) {
  const logged = withLogAsync(rawExportFn, {
    level:   'INFO',
    logger:  importLog,
    label:   'exportTreeStream',
    profile: true,
  });

  return function conditionalExport(treeId, callbacks) {
    importLog.debug('exportTreeStream → старт', { treeId });
    return logged(treeId, callbacks);
  };
}