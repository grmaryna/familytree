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

  activeEvents() {
    return [...this._listeners.entries()]
      .filter(([, set]) => set.size > 0)
      .map(([name]) => name);
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
    const next  = new Observable(this._emitter, this._event);
    next._ops   = [...this._ops, ...operators];
    return next;
  }

  static _SKIP = Symbol('Observable.SKIP');
}

export const map = (fn) => (value) => fn(value);

export const filter = (fn) => (value) => fn(value) ? value : Observable._SKIP;

export const tap = (label = '') => (value) => {
  console.log(`[Observable${label ? ':' + label : ''}]`, value);
  return value;
};

export const treeEvents = new EventEmitter();

export const on$ = (event) => new Observable(treeEvents, event);

export function runEventBusDemos() {
  console.group('📡 treeEventBus — демо реактивної комунікації');

  const bus = new EventEmitter();

  console.log('── 1. Три незалежні слухачі на "person:selected"');
  const unsub1 = bus.on('person:selected', ({ person }) =>
    console.log('  Слухач A (detail panel): відкрити деталі для', person.name));
  const unsub2 = bus.on('person:selected', ({ person }) =>
    console.log('  Слухач B (highlight):    підсвітити вузол', person.id));
  const unsub3 = bus.on('person:selected', ({ person }) =>
    console.log('  Слухач C (history log):  додати до журналу:', person.name));

  bus.emit('person:selected', { person: { id: 'p1', name: 'Іван Петренко' } });

  console.log('── 2. Відписати слухача B, потім emitнути знову');
  unsub2();
  bus.emit('person:selected', { person: { id: 'p2', name: 'Ганна Коваль' } });

  console.log('── 3. once() — спрацює рівно один раз');
  bus.once('tree:loaded', ({ name }) =>
    console.log('  tree:loaded (once):', name));
  bus.emit('tree:loaded', { name: 'Дерево Петренків', people: [], connections: [] });
  bus.emit('tree:loaded', { name: 'Другий виклик — не повинен з\'явитись' });

  console.log('── 4. Observable: тільки жінки через pipe(filter)');
  const personSelected$ = new Observable(bus, 'person:selected');
  const women$ = personSelected$.pipe(
    map(p => p.person),
    filter(p => p.gender === 'f'),
    tap('women$')
  );
  const sub = women$.subscribe(p =>
    console.log('  Жінка знайдена:', p.name));

  bus.emit('person:selected', { person: { id: 'p3', name: 'Оксана Мороз', gender: 'f' } });
  bus.emit('person:selected', { person: { id: 'p4', name: 'Олег Мороз',   gender: 'm' } }); // skipped

  sub.unsubscribe();
  bus.emit('person:selected', { person: { id: 'p5', name: 'Марія Іваненко', gender: 'f' } }); // skipped (unsubscribed)

  console.log('  Активні події після cleanup:', bus.activeEvents());

  unsub1(); unsub3();
  console.groupEnd();
}