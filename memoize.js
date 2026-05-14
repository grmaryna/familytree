export function memoize(fn, {
  maxSize        = Infinity,
  policy         = 'none',
  ttl            = Infinity,
  sweepInterval  = 60_000,
} = {}) {

  const cache = new Map();
  let hits = 0, misses = 0, evictions = 0, expired = 0;

  let sweepTimer = null;
  if (ttl !== Infinity && sweepInterval > 0) {
    sweepTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of cache) {
        if (now >= entry.expiresAt) {
          cache.delete(key);
          expired++;
        }
      }
    }, sweepInterval);

    if (sweepTimer.unref) sweepTimer.unref();
  }

  function isExpired(entry) {
    return Date.now() >= entry.expiresAt;
  }

  function evict() {
    if (cache.size < maxSize) return;

    if (policy === 'lru') {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
      evictions++;
      return;
    }

    if (policy === 'lfu') {
      let minFreq = Infinity, minKey = null;
      for (const [k, entry] of cache) {
        if (entry.freq < minFreq) { minFreq = entry.freq; minKey = k; }
      }
      if (minKey) { cache.delete(minKey); evictions++; }
      return;
    }

    cache.delete(cache.keys().next().value);
    evictions++;
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

        if (policy === 'lru') {
          cache.delete(key);
          cache.set(key, entry);
        }

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

  memoized.cache        = cache;
  memoized.stopSweep    = () => clearInterval(sweepTimer);
  memoized.clear        = () => cache.clear();

  memoized.stats = () => ({
    size:      cache.size,
    maxSize,
    policy,
    ttl:       ttl === Infinity ? '∞' : `${ttl}ms`,
    hits,
    misses,
    evictions,
    expired,
    hitRate:   hits + misses === 0 ? 0 : (hits / (hits + misses)).toFixed(2),
  });

  return memoized;
}

function slowCompute(x) {
  return x ** 2;
}

const mShort = memoize(slowCompute, { ttl: 100, policy: 'lru', maxSize: 10 });

mShort(5);
mShort(5);
console.log('Одразу після виклику:', mShort.stats());

await new Promise(r => setTimeout(r, 150));

mShort(5);
console.log('Після 150ms (TTL=100ms):', mShort.stats());