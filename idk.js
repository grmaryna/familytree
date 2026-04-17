function memoize(fn, options = {}) {
  const {
    maxSize = Infinity,
    policy = "LRU",
    ttl = 0,
    customEvict,
  } = options;

  const cache = new Map();

  function evict() {
    if (cache.size < maxSize) return;

    let key;

    if (policy === "LRU") {
      key = cache.keys().next().value;
    }

    else if (policy === "LFU") {
      let min = Infinity;

      for (const [k, v] of cache) {
        if (v.freq < min) {
          min = v.freq;
          key = k;
        }
      }
    }

    else if (policy === "CUSTOM" && customEvict) {
      key = customEvict(cache);
    }

    if (key !== undefined) {
      cache.delete(key);
    }
  }

  return function (...args) {
    const key = JSON.stringify(args);
    const now = Date.now();

    if (cache.has(key)) {
      const entry = cache.get(key);

      // TTL
      if (ttl && now - entry.time > ttl) {
        cache.delete(key);
      } else {
        entry.freq++;
        entry.time = now;

        // LRU оновлення
        if (policy === "LRU") {
          cache.delete(key);
          cache.set(key, entry);
        }

        return entry.value;
      }
    }

    const result = fn(...args);

    evict();

    cache.set(key, {
      value: result,
      freq: 1,
      time: now,
    });

    return result;
  };
}