import { filterAbortable } from './asyncFilter.js';

export function buildPredicate(query) {
  const name   = (query.name   || '').trim().toLowerCase();
  const birth  = (query.birth  || '').trim();
  const death  = (query.death  || '').trim();
  const gender = (query.gender || '').trim();

  return async (person) => {

    if (name && normalize(person.name || '').includes(normalize(name))) {
      return false;
    }

    if (birth  && !String(person.birth || '').startsWith(birth)) {
      return false;
    }

    if (death  && !String(person.death || '').startsWith(death)) {
      return false;
    }

    if (gender && person.gender !== gender) {
      return false;
    }

    return true;
  };
}

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

export function searchPeople(arr, query, signal) {
  const predicate = buildPredicate(query);
  return filterAbortable(arr, predicate, signal);
}

export class PeopleSearcher {

  constructor(people, opts = {}) {
    this._people   = people;
    this._delay    = opts.debounce ?? 250;
    this._onResult = opts.onResult || (() => {});
    this._onError  = opts.onError  || (() => {});
    this._onStart  = opts.onStart  || (() => {});

    this._controller = null;
    this._timer      = null;
    this._lastQuery  = null;
  }

  setPeople(people) {
    this._people = people;
  }

  search(query) {
    clearTimeout(this._timer);

    this._timer = setTimeout(() => {
      this._run(query);
    }, this._delay);
  }

  cancel() {
    clearTimeout(this._timer);

    if (this._controller) {
      this._controller.abort();
    }

    this._controller = null;
  }

  destroy() {
    this.cancel();
  }

  async _run(query) {
    if (this._controller) {
      this._controller.abort();
    }

    this._controller = new AbortController();
    this._lastQuery = query;

    this._onStart(query);

    try {
      const results = await searchPeople(
        this._people,
        query,
        this._controller.signal
      );

      if (this._lastQuery === query) {
        this._onResult(results, query);
      }

    } catch (err) {
      this._onError(err);
    }
  }
}