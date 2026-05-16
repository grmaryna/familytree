import { on$, map, filter } from './treeeventbus.js';

export class DetailPanelListener {
  constructor(initials) {
    this._initials = initials;
    this._subs = [];
  }

  subscribe() {
    const s1 = on$('person:selected').subscribe(({ person }) => this._open(person));
    const s2 = on$('person:deselected').subscribe(() => this._close());
    this._subs = [s1, s2];
  }

  unsubscribe() {
    this._subs.forEach(s => s.unsubscribe());
    this._subs = [];
  }

  _open(p) {
    const colors = { m: '#5a8f6a', f: '#c97a5a' };
    const av = document.getElementById('detailAvatar');
    if (!av) return;
    av.textContent      = this._initials(p.name);
    av.style.background = colors[p.gender] || '#5a8f6a';

    document.getElementById('detailName').textContent  = p.name;
    const years = p.birth
      ? (p.death ? p.birth + ' – ' + p.death : 'нар. ' + p.birth)
      : '';
    document.getElementById('detailYears').textContent = years;

    const relDiv = document.getElementById('detailRel');
    if (relDiv) {
      relDiv.innerHTML = p._relsHtml
        || '<div style="color:var(--muted);font-size:.8rem">Немає зв\'язків</div>';
    }

    document.getElementById('detailPanel')?.classList.add('open');
  }

  _close() {
    document.getElementById('detailPanel')?.classList.remove('open');
  }
}

export class NodeHighlightListener {
  constructor(getPeopleIds) {
    this._getPeopleIds = getPeopleIds;
    this._subs = [];
  }

  subscribe() {
    const s1 = on$('search:results').subscribe(({ matchedIds }) => {
      this._applyHighlight(new Set(matchedIds));
    });
    const s2 = on$('search:cleared').subscribe(() => this._clearHighlight());
    const s3 = on$('tree:loaded').subscribe(() => this._clearHighlight());
    this._subs = [s1, s2, s3];
  }

  unsubscribe() {
    this._subs.forEach(s => s.unsubscribe());
    this._subs = [];
  }

  _applyHighlight(matchSet) {
    const nodes     = document.querySelectorAll('#canvas .node');
    const peopleIds = this._getPeopleIds();

    nodes.forEach((node, i) => {
      const id = peopleIds[i];
      if (matchSet.has(id)) {
        node.classList.add('search-match');
        node.classList.remove('search-dim');
      } else {
        node.classList.add('search-dim');
        node.classList.remove('search-match');
      }
    });

    const countEl = document.getElementById('searchCount');
    if (countEl) {
      countEl.textContent = matchSet.size
        ? `Знайдено: ${matchSet.size}`
        : 'Нічого не знайдено';
    }
  }

  _clearHighlight() {
    document.querySelectorAll('#canvas .node').forEach(n => {
      n.classList.remove('search-match', 'search-dim');
    });
    const countEl = document.getElementById('searchCount');
    if (countEl) countEl.textContent = '';
  }
}

export class HistoryListener {
  constructor({ maxHistory = 20 } = {}) {
    this._maxHistory = maxHistory;
    this._history    = [];
    this._subs       = [];
  }

  subscribe() {
    const s1 = on$('person:selected')
      .pipe(map(({ person }) => person))
      .subscribe(person => this._record(person));

    const s2 = on$('tree:loaded').subscribe(() => {
      this._history = [];
    });

    this._subs = [s1, s2];
  }

  unsubscribe() {
    this._subs.forEach(s => s.unsubscribe());
    this._subs = [];
  }

  _record(person) {
    if (this._history.at(-1)?.id === person.id) return;
    this._history.push({ id: person.id, name: person.name });
    if (this._history.length > this._maxHistory) this._history.shift();
  }

  get entries() { return [...this._history]; }
}

export class ZoomSyncListener {
  constructor() {
    this._subs = [];
  }

  subscribe() {
    const s1 = on$('zoom:changed')
      .pipe(
        filter(({ scale }) => typeof scale === 'number'),
        map(({ scale }) => scale)
      )
      .subscribe(scale => this._applyScale(scale));

    const s2 = on$('zoom:reset').subscribe(() => this._resetScale());
    this._subs = [s1, s2];
  }

  unsubscribe() {
    this._subs.forEach(s => s.unsubscribe());
    this._subs = [];
  }

  _applyScale(scale) {
    const canvas   = document.getElementById('canvas');
    const svgLines = document.getElementById('svgLines');
    if (!canvas || !svgLines) return;
    const t = `scale(${scale})`;
    canvas.style.transform         = t;
    canvas.style.transformOrigin   = '0 0';
    svgLines.style.transform       = t;
    svgLines.style.transformOrigin = '0 0';
  }

  _resetScale() {
    const canvas   = document.getElementById('canvas');
    const svgLines = document.getElementById('svgLines');
    if (!canvas || !svgLines) return;
    canvas.style.transform   = '';
    svgLines.style.transform = '';
  }
}

export function initAllListeners({ initials, getPeopleIds }) {
  const detail    = new DetailPanelListener(initials);
  const highlight = new NodeHighlightListener(getPeopleIds);
  const history   = new HistoryListener();
  const zoomSync  = new ZoomSyncListener();

  detail.subscribe();
  highlight.subscribe();
  history.subscribe();
  zoomSync.subscribe();

  return {
    listeners: { detail, highlight, history, zoomSync },
    unsubscribeAll() {
      detail.unsubscribe();
      highlight.unsubscribe();
      history.unsubscribe();
      zoomSync.unsubscribe();
    }
  };
}