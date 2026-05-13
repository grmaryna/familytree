export function memoize(fn, { maxSize = Infinity, policy = 'none' } = {}) {
  const cache = new Map();
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

      return cache.get(key);
    }

    misses++;

    if (policy === 'lru' && cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
      evictions++;
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  }

  memoized.cache  = cache;
  memoized.clear  = () => cache.clear();
  memoized.stats  = () => ({
    size: cache.size,
    maxSize,
    policy,
    hits,
    misses,
    evictions,
    hitRate: hits + misses === 0 ? 0 : (hits / (hits + misses)).toFixed(2),
  });

  return memoized;
}

function rawInitials(name) {
  return (name || '').split(' ').map(w => w[0]).filter(Boolean)
    .join('').toUpperCase().slice(0, 2) || '?';
}

const initialsLRU = memoize(rawInitials, { maxSize: 3, policy: 'lru' });


const seq = ['Іван Петренко', 'Марія Коваль', 'Олег Мороз', 'Іван Петренко', 'Наталія Бойко'];

seq.forEach(name => {
  initialsLRU(name);
  console.log(`виклик '${name}' → кеш: [${[...initialsLRU.cache.keys()].map(k => JSON.parse(k)).join(', ')}]`);
});
