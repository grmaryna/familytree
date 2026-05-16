import { on$ } from './treeeventbus.js';

export class DetailPanelListener {
  constructor(initials) {
    this._initials = initials;
    this._subs = [];
  }

  subscribe() {
    const s1 = on$('person:selected')
      .subscribe(({ person }) => this._open(person));

    const s2 = on$('person:deselected')
      .subscribe(() => this._close());

    this._subs = [s1, s2];
  }

  unsubscribe() {
    this._subs.forEach(s => s.unsubscribe());
    this._subs = [];
  }

  _open(p) {
    const av = document.getElementById('detailAvatar');
    if (!av) return;

    av.textContent = this._initials(p.name);

    document.getElementById('detailName').textContent = p.name;

    document.getElementById('detailPanel')
      ?.classList.add('open');
  }

  _close() {
    document.getElementById('detailPanel')
      ?.classList.remove('open');
  }
}