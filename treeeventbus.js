export class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  once(event, handler) {
    const wrapper = (payload) => {
      handler(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const handlers = this._listeners.get(event);
    if (!handlers || handlers.size === 0) return;
    for (const h of [...handlers]) {
      try { h(payload); }
      catch (err) {
        console.error(`[EventEmitter] Помилка в обробнику "${event}":`, err);
      }
    }
  }

  removeAll(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  listenerCount(event) {
    return this._listeners.get(event)?.size ?? 0;
  }
}

export class Observable {
  constructor(emitter, event) {
    this._emitter = emitter;
    this._event   = event;
    this._ops     = [];
  }

  subscribe(observer) {
    const ops = this._ops;
    const handler = (payload) => {
      let value = payload;
      for (const op of ops) {
        const result = op(value);
        if (result === Observable._SKIP) return;
        value = result;
      }
      try { observer(value); }
      catch (err) { console.error('[Observable] Помилка в observer:', err); }
    };
    const unsubscribe = this._emitter.on(this._event, handler);
    return { unsubscribe };
  }

  pipe(...operators) {
    const next = new Observable(this._emitter, this._event);
    next._ops  = [...this._ops, ...operators];
    return next;
  }

  static _SKIP = Symbol('Observable.SKIP');
}

export const map    = (fn) => (value) => fn(value);
export const filter = (fn) => (value) => fn(value) ? value : Observable._SKIP;

export const treeEvents = new EventEmitter();
export const on$ = (event) => new Observable(treeEvents, event);