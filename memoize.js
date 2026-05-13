export function memoize(fn) {
  const cache = new Map();

  let hits   = 0;
  let misses = 0;

  function memoized(...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      hits++;
      return cache.get(key);
    }

    misses++;
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  }

  memoized.cache = cache;

  memoized.clear = () => cache.clear();

  memoized.stats = () => ({
    size:   cache.size,
    hits,
    misses,
    hitRate: hits + misses === 0 ? 0 : (hits / (hits + misses)).toFixed(2),
  });

  return memoized;
}

function rawInitials(name) {
  return (name || '').split(' ').map(w => w[0]).filter(Boolean)
    .join('').toUpperCase().slice(0, 2) || '?';
}

const initialsM = memoize(rawInitials);

const names = ['Іван Петренко', 'Марія Коваль', 'Іван Петренко', 'Марія Коваль', 'Олег Мороз'];
names.forEach(n => console.log(`initials('${n}') => '${initialsM(n)}'`));
