export function memoize(fn, { maxSize = Infinity, policy = 'none' } = {}) {
  const cache = new Map();
  const freq  = new Map();
  let hits = 0, misses = 0, evictions = 0;

  function memoized(...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      hits++;

      if (policy === 'lru') {
        const value = cache.get(key);
        cache.delete(key);
        cache.set(key, value);
      }

      if (policy === 'lfu') {
        freq.set(key, (freq.get(key) ?? 0) + 1);
      }

      return cache.get(key);
    }

    misses++;

    if (cache.size >= maxSize) {
      if (policy === 'lru') {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
        freq.delete(oldest);
        evictions++;
      }

      if (policy === 'lfu') {
        let minFreq = Infinity;
        let minKey  = null;

        for (const [k, f] of freq) {
          if (f < minFreq) {
            minFreq = f;
            minKey  = k;
          }
        }

        if (minKey !== null) {
          cache.delete(minKey);
          freq.delete(minKey);
          evictions++;
        }
      }
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    freq.set(key, 1);
    return result;
  }

  memoized.cache     = cache;
  memoized.freqTable = freq;
  memoized.clear     = () => { cache.clear(); freq.clear(); };
  memoized.stats     = () => ({
    size: cache.size,
    maxSize,
    policy,
    hits,
    misses,
    evictions,
    hitRate: hits + misses === 0 ? 0 : (hits / (hits + misses)).toFixed(2),
    topEntries: [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, f]) => ({ key: JSON.parse(k), freq: f })),
  });

  return memoized;
}
