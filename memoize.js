export function memoize(fn, {
  maxSize       = Infinity,
  policy        = 'none',
  ttl           = Infinity,
  sweepInterval = 60_000,
  evictWith     = null,
} = {}) {

  const cache = new Map();
  let hits = 0, misses = 0, evictions = 0, expired = 0;

  let sweepTimer = null;
  if (ttl !== Infinity && sweepInterval > 0) {
    sweepTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of cache) {
        if (now >= entry.expiresAt) { cache.delete(key); expired++; }
      }
    }, sweepInterval);
    if (sweepTimer.unref) sweepTimer.unref();
  }

  function isExpired(entry) {
    return entry.expiresAt !== Infinity && Date.now() >= entry.expiresAt;
  }

  function evict() {
    if (cache.size < maxSize) return;

    let keyToRemove = null;

    switch (policy) {
      case 'lru':
        keyToRemove = cache.keys().next().value;
        break;

      case 'lfu': {
        let minFreq = Infinity;
        for (const [k, e] of cache) {
          if (e.freq < minFreq) { minFreq = e.freq; keyToRemove = k; }
        }
        break;
      }

      case 'ttl': {
        let soonest = Infinity;
        for (const [k, e] of cache) {
          if (e.expiresAt < soonest) { soonest = e.expiresAt; keyToRemove = k; }
        }
        break;
      }

      case 'custom':
        if (typeof evictWith === 'function') {
          keyToRemove = evictWith(cache);
        }
        break;

      default:
        keyToRemove = cache.keys().next().value;
    }

    if (keyToRemove !== null) {
      cache.delete(keyToRemove);
      evictions++;
    }
  }

  function memoized(...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      const entry = cache.get(key);

      if (isExpired(entry)) {
        cache.delete(key);
        expired++;
      } else {
        hits++;
        entry.freq = (entry.freq ?? 1) + 1;
        if (policy === 'lru') { cache.delete(key); cache.set(key, entry); }
        return entry.value;
      }
    }

    misses++;
    evict();

    const value = fn.apply(this, args);
    cache.set(key, {
      value,
      expiresAt: ttl === Infinity ? Infinity : Date.now() + ttl,
      freq: 1,
    });
    return value;
  }

  memoized.cache     = cache;
  memoized.clear     = () => cache.clear();
  memoized.delete    = (key) => cache.delete(JSON.stringify(key));
  memoized.stopSweep = () => clearInterval(sweepTimer);
  memoized.stats     = () => ({
    size:      cache.size,
    maxSize,
    policy,
    ttl:       ttl === Infinity ? '∞' : `${ttl}ms`,
    hits, misses, evictions, expired,
    hitRate:   hits + misses === 0 ? '—' : `${(hits / (hits + misses) * 100).toFixed(1)}%`,
  });

  return memoized;
}

import { memoize } from './memoize.js';

export const initials = memoize(
  (name) => (name || '').split(' ').map(w => w[0]).filter(Boolean)
    .join('').toUpperCase().slice(0, 2) || '?',
  { maxSize: 150, policy: 'lru' }
);

export const formatYears = memoize(
  (birth, death) => birth ? (death ? `${birth}–${death}` : `${birth} – …`) : '',
);

export const buildSvgPath = memoize(
  (fx, fy, tx, ty) => {
    const midY = (fy + ty) / 2;
    return `M${fx},${fy} C${fx},${midY} ${tx},${midY} ${tx},${ty}`;
  },
  { maxSize: 200, policy: 'lru', ttl: 30_000 }
);

export const getRelationsFor = memoize(
  (personId, _connectionsHash, people, connections) => {
    const labels = { parent:'Батько/Мати', child:'Дитина', partner:'Партнер', sibling:'Брат/Сестра' };
    return connections
      .filter(c => c.from === personId || c.to === personId)
      .map(c => {
        const otherId = c.from === personId ? c.to : c.from;
        const other   = people.find(p => p.id === otherId);
        if (!other) return null;
        return {
          type:  c.type,
          label: labels[c.type] || c.type,
          name:  other.name,
          dir:   c.from === personId ? 'to' : 'from',
        };
      })
      .filter(Boolean);
  },
  { maxSize: 50, policy: 'lfu' }
);

export const photoCache = memoize(
  (personId, photoData) => photoData,
  {
    maxSize:  20,
    policy:   'custom',
    evictWith: (cacheMap) => {
      let maxLen = -1, maxKey = null;
      for (const [k, entry] of cacheMap) {
        const len = (entry.value || '').length;
        if (len > maxLen) { maxLen = len; maxKey = k; }
      }
      return maxKey;
    }
  }
);

const fakePhoto = (id, size) => 'x'.repeat(size);
const pc = memoize(
  (id, data) => data,
  {
    maxSize:   3,
    policy:    'custom',
    evictWith: (m) => {
      let maxLen = -1, maxKey = null;
      for (const [k, e] of m) {
        if ((e.value||'').length > maxLen) { maxLen = (e.value||'').length; maxKey = k; }
      }
      return maxKey;
    }
  }
);

pc(1, fakePhoto(1, 500));
pc(2, fakePhoto(2, 1200));
pc(3, fakePhoto(3, 300));
pc(4, fakePhoto(4, 800));

const remaining = [...pc.cache.keys()].map(k => JSON.parse(k)[0]);
console.log('Залишилось у кеші (id):', remaining);

console.log('\n=== Статистика всіх кешів ===');
console.log('initials:      ', initials.stats());
console.log('formatYears:   ', formatYears.stats());
console.log('buildSvgPath:  ', buildSvgPath.stats());
console.log('getRelationsFor:', getRelationsFor.stats());