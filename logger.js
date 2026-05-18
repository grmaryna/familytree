export const LOG_LEVELS = Object.freeze({
  DEBUG: 0,
  INFO:  1,
  WARN:  2,
  ERROR: 3,
  NONE:  99,
});

function defaultFormatter(entry) {
  const ts      = entry.timestamp.toISOString();
  const lvlPad  = entry.level.padEnd(5);
  const ns      = entry.name ? `[${entry.name}] ` : '';
  const metaStr = entry.meta && Object.keys(entry.meta).length
    ? ' ' + JSON.stringify(entry.meta)
    : '';
  return `[${ts}] [${lvlPad}] ${ns}${entry.message}${metaStr}`;
}

export class Logger {

  constructor({ name = '', minLevel = 'INFO', formatter = null } = {}) {
    this.name      = name;
    this.minLevel  = minLevel;
    this.formatter = formatter ?? defaultFormatter;

    this._transports = [consoleTransport];
  }

  debug(message, meta = {}) { this._log('DEBUG', message, meta); }

  info(message, meta = {}) { this._log('INFO', message, meta); }

  warn(message, meta = {}) { this._log('WARN', message, meta); }

  error(message, meta = {}, error = null) {
    const fullMeta = error
      ? { ...meta, errorMessage: error.message, stack: error.stack }
      : meta;
    this._log('ERROR', message, fullMeta);
  }

  setLevel(level) {
    if (!(level in LOG_LEVELS)) throw new Error(`Logger: невідомий рівень "${level}"`);
    this.minLevel = level;
  }

  addTransport(transport) {
    this._transports.push(transport);
  }

  clearTransports() {
    this._transports = [];
  }

  _shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  _log(level, message, meta) {
    if (!this._shouldLog(level)) return;

    const entry = {
      level,
      name:      this.name,
      message,
      meta,
      timestamp: new Date(),
    };

    const formatted = this.formatter(entry);

    for (const transport of this._transports) {
      try {
        transport(entry, formatted);
      } catch (err) {
        console.error('[Logger] помилка транспорту:', err);
      }
    }
  }
}

function consoleTransport(entry, formatted) {
  switch (entry.level) {
    case 'DEBUG': console.debug(formatted); break;
    case 'INFO':  console.info(formatted);  break;
    case 'WARN':  console.warn(formatted);  break;
    case 'ERROR': console.error(formatted); break;
    default:      console.log(formatted);
  }
}

export const authLog    = new Logger({ name: 'authproxy',    minLevel: 'INFO' });
export const treeLog    = new Logger({ name: 'createTree',   minLevel: 'INFO' });
export const importLog  = new Logger({ name: 'importexport', minLevel: 'INFO' });
export const apiLog     = new Logger({ name: 'api',          minLevel: 'INFO' });