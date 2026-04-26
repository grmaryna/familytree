function defaultKeySerializer(...args) {
  return JSON.stringify(args);
}

function createEntry(value, now = Date.now()) {
  return {
    value,
    hits: 1,
    lastUsed: now,
    createdAt: now,
  };
}
 

function evictLRU(cache) {
  let oldestKey = null;
  let oldestTime = Infinity;

  for (const [key, entry] of cache) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed;
      oldestKey = key;
    }
  }

  if (oldestKey !== null) cache.delete(oldestKey);
}


function evictLFU(cache) {
  let minKey = null;
  let minHits = Infinity;
  let minCreated = Infinity;

  for (const [key, entry] of cache) {
    if (
      entry.hits < minHits ||
      (entry.hits === minHits && entry.createdAt < minCreated)
    ) {
      minHits = entry.hits;
      minCreated = entry.createdAt;
      minKey = key;
    }
  }

  if (minKey !== null) cache.delete(minKey);
}


function evictTTL(cache, ttlMs) {
  const now = Date.now();
  let removed = 0;

  for (const [key, entry] of cache) {
    if (now - entry.createdAt > ttlMs) {
      cache.delete(key);
      removed++;
    }
  }

  if (removed === 0) evictLRU(cache);
}


function memoize(fn, options = {}) {
  const {
    maxSize = Infinity,
    policy = "lru",
    ttlMs = 60_000,
    keySerializer = defaultKeySerializer,
  } = options;

  const validPolicies = ["lru", "lfu", "ttl"];
  if (typeof policy !== "function" && !validPolicies.includes(policy)) {
    throw new TypeError(
      `memoize: unknown eviction policy "${policy}". Use "lru", "lfu", "ttl", or a custom function.`
    );
  }

  const cache = new Map();

  const stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    get hitRate() {
      const total = this.hits + this.misses;
      return total === 0 ? 0 : ((this.hits / total) * 100).toFixed(1) + "%";
    },
  };

  function runEviction() {
    stats.evictions++;

    if (typeof policy === "function") {
      policy(cache);
      return;
    }

    switch (policy) {
      case "lru": evictLRU(cache); break;
      case "lfu": evictLFU(cache); break;
      case "ttl": evictTTL(cache, ttlMs); break;
    }
  }

  if (policy === "ttl" && isFinite(maxSize)) {
    _sweepInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of cache) {
        if (now - entry.createdAt > ttlMs) cache.delete(key);
      }
    }, Math.max(ttlMs / 2, 1000));

    if (typeof _sweepInterval?.unref === "function") _sweepInterval.unref();
  }

  function memoized(...args) {
    const key = keySerializer(...args);

    if (policy === "ttl" && cache.has(key)) {
      const entry = cache.get(key);
      if (Date.now() - entry.createdAt > ttlMs) {
        cache.delete(key);
      }
    }

    if (cache.has(key)) {
      const entry = cache.get(key);
      entry.hits++;
      entry.lastUsed = Date.now();
      stats.hits++;
      return entry.value;
    }

    stats.misses++;
    const result = fn(...args);

    if (isFinite(maxSize) && cache.size >= maxSize) {
      runEviction();
    }

    cache.set(key, createEntry(result));
    return result;
  }

  memoized.cache = cache;
  memoized.stats = stats;

  memoized.clear = () => {
    cache.clear();
    stats.hits = 0;
    stats.misses = 0;
    stats.evictions = 0;
  };

memoized.delete = (...args) => cache.delete(keySerializer(...args));
 
  /** Stop background TTL sweep (call when the memoized fn is no longer needed). */
  memoized.destroy = () => {
    if (_sweepInterval !== null) clearInterval(_sweepInterval);
  };
 
  return memoized;
}
 

export default memoize;
export { memoize, defaultKeySerializer, evictLRU, evictLFU, evictTTL };