export function filterCallback(arr, predicate, callback) {
  if (!Array.isArray(arr)) {
    callback(new TypeError('filterCallback: перший аргумент має бути масивом'), null);
    return;
  }

  const promises = arr.map((item, i) =>
    Promise.resolve(predicate(item, i, arr))
      .then(ok => ({ item, ok }))
  );

  Promise.all(promises)
    .then(results => {
      const filtered = results.filter(r => r.ok).map(r => r.item);
      callback(null, filtered);
    })
    .catch(err => callback(err, null));
}
export function filterPromise(arr, predicate) {
  if (!Array.isArray(arr)) {
    return Promise.reject(new TypeError('filterPromise: перший аргумент має бути масивом'));
  }

  const checks = arr.map((item, i) =>
    Promise.resolve(predicate(item, i, arr)).then(ok => ({ item, ok }))
  );

  return Promise.all(checks).then(results =>
    results.filter(r => r.ok).map(r => r.item)
  );
}

export function filterAbortable(arr, predicate, signal) {
  if (!Array.isArray(arr)) {
    return Promise.reject(new TypeError('filterAbortable: перший аргумент має бути масивом'));
  }

  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(createAbortError());
    signal?.addEventListener('abort', onAbort, { once: true });

    const checks = arr.map((item, i) =>
      Promise.resolve(predicate(item, i, arr)).then(ok => {
        if (signal?.aborted) throw createAbortError();
        return { item, ok };
      })
    );

    Promise.all(checks)
      .then(results => {
        signal?.removeEventListener('abort', onAbort);
        resolve(results.filter(r => r.ok).map(r => r.item));
      })
      .catch(err => {
        signal?.removeEventListener('abort', onAbort);
        reject(err);
      });
  });
}

function createAbortError() {
  const err = new Error('Операцію фільтрації скасовано');
  err.name = 'AbortError';
  return err;
}

export async function runDemos(people = []) {
  if (people.length === 0) {
    console.warn('[asyncFilter demos] Масив людей порожній — демо пропущено');
    return;
  }

  console.group('📋 asyncFilter — демо-кейси');

  console.log('── 1. Callback: імена, що містять "а"');
  filterCallback(
    people,
    async p => p.name.toLowerCase().includes('а'),
    (err, found) => {
      if (err) console.error(err);
      else console.log('  Результат:', found.map(p => p.name));
    }
  );

  console.log('── 2. Promise: народжені після 1950');
  filterPromise(people, async p => Number(p.birth) > 1950)
    .then(found => console.log('  Результат:', found.map(p => p.name)))
    .catch(console.error);

  console.log('── 3. Async/Await: жінки (gender = "f")');
  try {
    const women = await filterPromise(people, async p => p.gender === 'f');
    console.log('  Результат:', women.map(p => p.name));
  } catch (e) {
    console.error(e);
  }

  console.log('── 4. Abortable: скасування до завершення');
  const ctrl = new AbortController();
  ctrl.abort();
  filterAbortable(people, async p => p.name.length > 3, ctrl.signal)
    .then(r => console.log('  Не має потрапити сюди', r))
    .catch(e => console.warn('  Скасовано, як очікувалось →', e.name));

  console.log('── 5. Abortable: нормальне завершення');
  const ctrl2 = new AbortController();
  try {
    const found = await filterAbortable(people, async p => Number(p.birth) < 2000, ctrl2.signal);
    console.log('  Результат:', found.map(p => p.name));
  } catch (e) {
    console.error(e);
  }

  console.groupEnd();
}