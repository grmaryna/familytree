import { initializeApp }          from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

const firebaseConfig = {
  apiKey:            'AIzaSyCarNJC1uHCXM-Pi69XGx_UVq79w3czYPA',
  authDomain:        'family-tree-ce8a3.firebaseapp.com',
  projectId:         'family-tree-ce8a3',
  storageBucket:     'family-tree-ce8a3.firebasestorage.app',
  messagingSenderId: '304616447045',
  appId:             '1:304616447045:web:1b98da8b6a0481c65d572c',
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

const BASE_URL = 'http://localhost:4000/api';

let people      = [];
let connections = [];
let selectedId  = null;
let editingId   = null;
let photoData   = null;
let scale       = 1;
let dragging    = null;
let dragOffset  = { x: 0, y: 0 };
let nextId      = 1;
let treeId      = null;
let saveTimeout = null;

const canvas    = document.getElementById('canvas');
const svgLines  = document.getElementById('svgLines');
const emptyHint = document.getElementById('emptyHint');
const addModal  = document.getElementById('addModal');

document.getElementById('btnOpenModal') .addEventListener('click', openAddModal);
document.getElementById('btnOpenModal2').addEventListener('click', openAddModal);
document.getElementById('btnCloseModal').addEventListener('click', closeModal);
document.getElementById('btnCancelModal').addEventListener('click', closeModal);
document.getElementById('btnSavePerson').addEventListener('click', savePerson);
document.getElementById('btnAddConn')   .addEventListener('click', addConnection);
document.getElementById('saveBtnMain')  .addEventListener('click', saveTree);
document.getElementById('btnZoomIn')    .addEventListener('click', () => zoom(0.15));
document.getElementById('btnZoomOut')   .addEventListener('click', () => zoom(-0.15));
document.getElementById('btnZoomReset') .addEventListener('click', resetView);
document.getElementById('btnCloseProfile').addEventListener('click', closeProfile);

addModal.addEventListener('click', e => { if (e.target === addModal) closeModal(); });

document.getElementById('mName').addEventListener('keydown', e => {
  if (e.key === 'Enter') savePerson();
});

document.getElementById('mName').addEventListener('input', updatePhotoInitials);

document.getElementById('photoPreview').addEventListener('click', () => {
  document.getElementById('photoInput').click();
});
document.getElementById('photoInput').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    photoData = e.target.result;
    const img = document.getElementById('photoImg');
    img.src = photoData;
    img.style.display = 'block';
    document.getElementById('photoInitials').style.display = 'none';
  };
  reader.readAsDataURL(file);
});

function syncDeathFields() {
  const alive = document.getElementById('mAlive').value === 'alive';
  const block = document.getElementById('deathFields');
  block.style.display = alive ? 'none' : '';
  if (alive) { setVal('mDeath', ''); setVal('mDeathPlace', ''); }
}
document.getElementById('mAlive').addEventListener('change', syncDeathFields);

document.getElementById('modalTabs').addEventListener('click', e => {
  const btn = e.target.closest('.mtab');
  if (!btn) return;
  document.querySelectorAll('.mtab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.mtab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(btn.dataset.tab).classList.add('active');
});

async function apiRequest(method, path, body = null) {
  const user = auth.currentUser;
  if (!user) throw new Error('Не авторизовано');
  const token = await user.getIdToken();
  const opts = {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(BASE_URL + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Помилка сервера');
  return data;
}

onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = 'signIn.html'; return; }

  const params = new URLSearchParams(window.location.search);
  treeId = params.get('treeId');

  try {
    if (treeId) {
      await loadTree(treeId);
    } else {
      const trees = await apiRequest('GET', '/trees');
      if (trees.length > 0) {
        treeId = trees[0].id;
        await loadTree(treeId);
        history.replaceState({}, '', `?treeId=${treeId}`);
      } else {
        treeId = await createNewTree();
      }
    }
  } catch (e) {
    console.warn('Бекенд недоступний, працюємо локально:', e.message);
    const local = localStorage.getItem('rodo-tree-local');
    if (local) {
      try {
        const saved = JSON.parse(local);
        people      = saved.people      || [];
        connections = saved.connections || [];
        document.getElementById('treeName').value = saved.name || 'Моє сімейне дерево';
        nextId = people.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
      } catch (_) { loadDemoData(); }
    } else {
      loadDemoData();
    }
  }

  renderAll();
});

async function loadTree(id) {
  const data = await apiRequest('GET', `/trees/${id}`);
  document.getElementById('treeName').value = data.name || 'Моє сімейне дерево';
  people      = data.people      || [];
  connections = data.connections || [];
  nextId = people.reduce((m, p) => Math.max(m, p.id || 0), 0) + 1;
}

async function createNewTree() {
  const name = document.getElementById('treeName').value;
  const res  = await apiRequest('POST', '/trees', { name });
  history.replaceState({}, '', `?treeId=${res.id}`);
  return res.id;
}

async function saveTree() {
  const btn = document.getElementById('saveBtnMain');
  if (treeId && auth.currentUser) {
    btn.textContent = '⏳ Збереження...';
    btn.disabled = true;
    try {
      await apiRequest('PUT', `/trees/${treeId}`, {
        name: document.getElementById('treeName').value,
        people, connections,
      });
      btn.textContent = '✅ Збережено';
    } catch (e) {
      console.error(e);
      btn.textContent = '❌ Помилка';
    }
  } else {
    localStorage.setItem('rodo-tree-local', JSON.stringify({
      name:   document.getElementById('treeName').value,
      people, connections,
    }));
    btn.textContent = '✅ Збережено';
  }
  btn.disabled = false;
  setTimeout(() => { btn.textContent = '💾 Зберегти'; }, 2000);
}

function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveTree, 1500);
}

document.getElementById('treeName').addEventListener('input', scheduleSave);

function openAddModal() {
  editingId = null;
  photoData = null;
  document.getElementById('modalTitle').textContent    = 'Нова людина';
  document.getElementById('btnSavePerson').textContent = 'Додати';
  resetModalFields();
  syncDeathFields();
  addModal.classList.add('open');
  setTimeout(() => document.getElementById('mName').focus(), 50);
}

function openEditModal(id) {
  const p = getById(id);
  if (!p) return;
  editingId = id;
  photoData = p.photo || null;

  document.getElementById('modalTitle').textContent    = 'Редагувати профіль';
  document.getElementById('btnSavePerson').textContent = 'Зберегти';

  setVal('mName',        p.name        || '');
  setVal('mGender',      p.gender      || 'm');
  setVal('mAlive',       p.alive       || 'alive');
  setVal('mBirth',       p.birth       || '');
  setVal('mBirthPlace',  p.birthPlace  || '');
  setVal('mDeath',       p.death       || '');
  setVal('mDeathPlace',  p.deathPlace  || '');
  setVal('mNationality', p.nationality || '');
  setVal('mReligion',    p.religion    || '');
  setVal('mOccupation',  p.occupation  || '');
  setVal('mMarital',     p.marital     || '');
  setVal('mSocialClass', p.socialClass || '');
  setVal('mLocation',    p.location    || '');
  setVal('mAwards',      p.awards      || '');
  setVal('mEduLevel',    p.eduLevel    || '');
  setVal('mSchool',      p.school      || '');
  setVal('mEduFrom',     p.eduFrom     || '');
  setVal('mEduTo',       p.eduTo       || '');
  setVal('mSpecialty',   p.specialty   || '');
  setVal('mNotes',       p.notes       || '');
  setVal('mSources',     p.sources     || '');

  const img = document.getElementById('photoImg');
  if (p.photo) {
    img.src = p.photo; img.style.display = 'block';
    document.getElementById('photoInitials').style.display = 'none';
  } else {
    img.style.display = 'none';
    document.getElementById('photoInitials').style.display = 'block';
    document.getElementById('photoInitials').textContent = initials(p.name);
  }

  document.querySelectorAll('.mtab')[0].click();
  syncDeathFields();
  addModal.classList.add('open');
}

function closeModal() {
  addModal.classList.remove('open');
  photoData = null;
}

function resetModalFields() {
  const textIds = ['mName','mBirth','mBirthPlace','mDeath','mDeathPlace',
    'mNationality','mReligion','mOccupation','mLocation','mAwards',
    'mSchool','mEduFrom','mEduTo','mSpecialty','mNotes','mSources'];
  textIds.forEach(id => setVal(id, ''));

  setVal('mGender', 'm');
  setVal('mAlive', 'alive');
  setVal('mMarital', '');
  setVal('mSocialClass', '');
  setVal('mEduLevel', '');

  document.getElementById('photoImg').style.display = 'none';
  document.getElementById('photoInitials').style.display = 'block';
  document.getElementById('photoInitials').textContent = '?';
  document.getElementById('photoInput').value = '';
  document.querySelectorAll('.mtab')[0].click();
}

function updatePhotoInitials() {
  if (!photoData) {
    const name = document.getElementById('mName').value.trim();
    document.getElementById('photoInitials').textContent = initials(name) || '?';
  }
}

function savePerson() {
  const nameEl = document.getElementById('mName');
  const name   = nameEl.value.trim();
  if (!name) { nameEl.focus(); nameEl.style.borderColor = 'red'; return; }
  nameEl.style.borderColor = '';

  const data = {
    name,
    gender:      getVal('mGender'),
    alive:       getVal('mAlive'),
    birth:       getVal('mBirth'),
    birthPlace:  getVal('mBirthPlace'),
    death:       getVal('mDeath'),
    deathPlace:  getVal('mDeathPlace'),
    nationality: getVal('mNationality'),
    religion:    getVal('mReligion'),
    occupation:  getVal('mOccupation'),
    marital:     getVal('mMarital'),
    socialClass: getVal('mSocialClass'),
    location:    getVal('mLocation'),
    awards:      getVal('mAwards'),
    eduLevel:    getVal('mEduLevel'),
    school:      getVal('mSchool'),
    eduFrom:     getVal('mEduFrom'),
    eduTo:       getVal('mEduTo'),
    specialty:   getVal('mSpecialty'),
    notes:       getVal('mNotes'),
    sources:     getVal('mSources'),
    photo:       photoData,
  };

  if (editingId !== null) {
    Object.assign(getById(editingId), data);
    closeModal();
    renderAll();
    showProfilePanel(editingId);
  } else {
    const id  = nextId++;
    const col = people.length % 4;
    const row = Math.floor(people.length / 4);
    data.id   = id;
    data.x    = 40 + col * 170;
    data.y    = 40 + row * 130;
    people.push(data);
    closeModal();
    renderAll();
    selectPerson(id);
  }

  scheduleSave();
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}
function initials(name) {
  return (name || '').split(' ').map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?';
}
function getById(id) { return people.find(p => p.id === id); }

function renderAll() {
  emptyHint.style.display = people.length === 0 ? 'block' : 'none';
  renderNodes();
  renderConnections();
  renderSidebar();
}

function renderNodes() {
  document.querySelectorAll('.node').forEach(n => n.remove());

  people.forEach(p => {
    const node = document.createElement('div');
    node.className = 'node'
      + (p.gender === 'f' ? ' female' : '')
      + (p.id === selectedId ? ' selected' : '');
    node.dataset.id  = p.id;
    node.style.left  = p.x + 'px';
    node.style.top   = p.y + 'px';

    const years = p.birth
      ? (p.death ? `${p.birth}–${p.death}` : `${p.birth} – …`)
      : '';

    const avatarContent = p.photo
      ? `<img src="${p.photo}" alt=""/>`
      : initials(p.name);

    node.innerHTML = `
      <div class="node-head">
        <div class="avatar avatar-${p.gender}">${avatarContent}</div>
        <div class="node-name">${p.name}</div>
      </div>
      ${years          ? `<div class="node-years">${years}</div>` : ''}
      ${p.occupation   ? `<div class="node-job">${p.occupation}</div>` : ''}
    `;

    node.addEventListener('mousedown', onNodeMouseDown);
    node.addEventListener('click', e => { e.stopPropagation(); selectPerson(p.id); });
    canvas.appendChild(node);
  });
}

function renderConnections() {
  svgLines.innerHTML = '';
  connections.forEach(conn => {
    const from = getById(conn.from);
    const to   = getById(conn.to);
    if (!from || !to) return;

    const nodeW = 150, nodeH = 86;
    const fx = from.x + nodeW / 2, fy = from.y + nodeH / 2;
    const tx = to.x   + nodeW / 2, ty = to.y   + nodeH / 2;
    const midY = (fy + ty) / 2;
    const d = `M${fx},${fy} C${fx},${midY} ${tx},${midY} ${tx},${ty}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', `conn-line ${conn.type}`);
    svgLines.appendChild(path);
  });
}

function renderSidebar() {
  const list = document.getElementById('personList');
  list.innerHTML = '';

  if (people.length === 0) {
    list.innerHTML = '<div style="font-size:.82rem;color:var(--muted);text-align:center;padding:8px 0">Ще нікого немає</div>';
  } else {
    people.forEach(p => {
      const item  = document.createElement('div');
      const years = p.birth ? (p.death ? `${p.birth}–${p.death}` : p.birth) : '';
      item.className = 'person-item' + (p.id === selectedId ? ' selected' : '');

      const avatarContent = p.photo
        ? `<img src="${p.photo}" alt=""/>`
        : initials(p.name);

      item.innerHTML = `
        <div class="avatar avatar-${p.gender}">${avatarContent}</div>
        <div class="person-info">
          <div class="name">${p.name}</div>
          ${years ? `<div class="years">${years}</div>` : ''}
        </div>
        <button class="person-del" title="Видалити">✕</button>
      `;
      item.querySelector('.person-del').addEventListener('click', e => {
        e.stopPropagation(); deletePerson(p.id);
      });
      item.addEventListener('click', () => selectPerson(p.id));
      list.appendChild(item);
    });
  }

  const opts   = people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const noOpts = '<option disabled>— немає людей —</option>';
  document.getElementById('connFrom').innerHTML = opts || noOpts;
  document.getElementById('connTo').innerHTML   = opts || noOpts;

  const cList = document.getElementById('connectionList');
  cList.innerHTML = '';

  if (connections.length === 0) {
    cList.innerHTML = '<div style="font-size:.8rem;color:var(--muted);text-align:center;padding:6px 0">Зв\'язків ще немає</div>';
  } else {
    const labels = { parent:'Батько/Мати', child:'Дитина', partner:'Партнер', sibling:'Брат/Сестра' };
    connections.forEach((c, i) => {
      const from = getById(c.from);
      const to   = getById(c.to);
      if (!from || !to) return;
      const item = document.createElement('div');
      item.className = 'connection-item';
      item.innerHTML = `
        <span style="font-weight:500;font-size:.82rem">${from.name}</span>
        <span class="badge badge-${c.type}">${labels[c.type] || c.type}</span>
        <span style="font-size:.82rem">${to.name}</span>
        <button class="conn-del" title="Видалити">✕</button>
      `;
      item.querySelector('.conn-del').addEventListener('click', () => deleteConnection(i));
      cList.appendChild(item);
    });
  }
}

function selectPerson(id) {
  selectedId = (selectedId === id) ? null : id;
  renderAll();
  if (selectedId) {
    const p = getById(selectedId);
    if (p) document.getElementById('connFrom').value = p.id;
    showProfilePanel(selectedId);
  } else {
    closeProfile();
  }
}

canvas.addEventListener('click', () => { selectedId = null; renderAll(); closeProfile(); });

const MARITAL_LABELS = {
  single:'Неодружений/а', married:'Одружений/а',
  divorced:'Розлучений/а', widowed:'Вдівець/Вдова',
};
const SOCIAL_LABELS = {
  peasant:'Селянин/Селянка', worker:'Робітник/Робітниця',
  intelligentsia:'Інтелігенція', military:'Військовий/а',
  clergy:'Духовенство', nobility:'Дворянство', merchant:'Купець/Купчиха',
};
const EDU_LABELS = {
  none:'Без освіти', primary:'Початкова', secondary:'Середня',
  vocational:'Проф.-технічна', higher:'Вища', postgrad:'Аспірантура/Докторантура',
};

function ppRow(key, val) {
  if (!val) return '';
  return `<div class="pp-row"><span class="pp-key">${key}</span><span class="pp-val">${val}</span></div>`;
}

function showProfilePanel(id) {
  const p = getById(id);
  if (!p) return;

  document.getElementById('ppTitle').textContent = p.name;

  const years = p.birth
    ? (p.death ? `${p.birth} – ${p.death}` : `${p.birth} – …`)
    : '';

  const photoHtml = p.photo
    ? `<div class="pp-photo"><img src="${p.photo}" alt=""/></div>`
    : `<div class="pp-photo" style="background:${p.gender === 'f' ? '#c97a5a' : '#5a8f6a'}">${initials(p.name)}</div>`;

  let html = `
    ${photoHtml}
    <div class="pp-name">${p.name}</div>
    ${years ? `<div class="pp-years">🗓 ${years}</div>` : ''}
    <button class="btn btn-outline btn-sm pp-edit-btn" id="ppEditBtn">✏️ Редагувати</button>
  `;

  const genRows = [
    ppRow('Стать',         p.gender === 'm' ? 'Чоловік' : 'Жінка'),
    ppRow('Народження',    [p.birth, p.birthPlace].filter(Boolean).join(', ')),
    ppRow('Смерть',        p.death ? [p.death, p.deathPlace].filter(Boolean).join(', ') : ''),
    ppRow('Національність', p.nationality),
    ppRow('Релігія',       p.religion),
  ].join('');
  if (genRows) html += `<div class="pp-section"><div class="pp-section-title">📋 Загальні дані</div>${genRows}</div>`;

  const socRows = [
    ppRow('Професія',      p.occupation),
    ppRow('Сімейний стан', MARITAL_LABELS[p.marital] || ''),
    ppRow('Соц. стан',     SOCIAL_LABELS[p.socialClass] || ''),
    ppRow('Проживання',    p.location),
    ppRow('Нагороди',      p.awards),
  ].join('');
  if (socRows) html += `<div class="pp-section"><div class="pp-section-title">👔 Соціальний статус</div>${socRows}</div>`;

  const eduPeriod = p.eduFrom || p.eduTo
    ? [p.eduFrom, p.eduTo].filter(Boolean).join(' – ')
    : '';
  const eduRows = [
    ppRow('Рівень',        EDU_LABELS[p.eduLevel] || ''),
    ppRow('Заклад',        p.school),
    ppRow('Роки навчання', eduPeriod),
    ppRow('Спеціальність', p.specialty),
  ].join('');
  if (eduRows) html += `<div class="pp-section"><div class="pp-section-title">🎓 Освіта</div>${eduRows}</div>`;

  if (p.notes) html += `
    <div class="pp-section">
      <div class="pp-section-title">📝 Нотатки</div>
      <div class="pp-notes">${p.notes}</div>
    </div>`;

  if (p.sources) html += `
    <div class="pp-section">
      ${ppRow('📚 Джерела', p.sources)}
    </div>`;

  document.getElementById('ppBody').innerHTML = html;
  document.getElementById('ppEditBtn').addEventListener('click', () => openEditModal(id));
  document.getElementById('profilePanel').classList.add('open');
}

function closeProfile() {
  document.getElementById('profilePanel').classList.remove('open');
}

function deletePerson(id) {
  people      = people.filter(p => p.id !== id);
  connections = connections.filter(c => c.from !== id && c.to !== id);
  if (selectedId === id) { selectedId = null; closeProfile(); }
  renderAll();
  scheduleSave();
}

function deleteConnection(i) {
  connections.splice(i, 1);
  renderAll();
  scheduleSave();
}

function addConnection() {
  const from = parseInt(document.getElementById('connFrom').value);
  const to   = parseInt(document.getElementById('connTo').value);
  const type = document.getElementById('connType').value;
  if (!from || !to || from === to) return;
  if (connections.find(c => c.from === from && c.to === to && c.type === type)) return;
  connections.push({ from, to, type });
  renderAll();
  scheduleSave();
}

function onNodeMouseDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const id = parseInt(e.currentTarget.dataset.id);
  const p  = getById(id);
  dragging     = { id, node: e.currentTarget };
  dragOffset.x = e.clientX - p.x;
  dragOffset.y = e.clientY - p.y;
}

window.addEventListener('mousemove', e => {
  if (!dragging) return;
  const p = getById(dragging.id);
  p.x = e.clientX - dragOffset.x;
  p.y = e.clientY - dragOffset.y;
  dragging.node.style.left = p.x + 'px';
  dragging.node.style.top  = p.y + 'px';
  renderConnections();
});

window.addEventListener('mouseup', () => {
  if (dragging) scheduleSave();
  dragging = null;
});

function zoom(delta) {
  scale = Math.min(2, Math.max(0.3, scale + delta));
  canvas.style.transform         = `scale(${scale})`;
  canvas.style.transformOrigin   = '0 0';
  svgLines.style.transform       = `scale(${scale})`;
  svgLines.style.transformOrigin = '0 0';
}

function resetView() {
  scale = 1;
  canvas.style.transform   = '';
  svgLines.style.transform = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    selectedId = null; renderAll(); closeModal(); closeProfile();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace')
      && selectedId
      && document.activeElement.tagName !== 'INPUT'
      && document.activeElement.tagName !== 'TEXTAREA') {
    deletePerson(selectedId);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault(); saveTree();
  }
});

function loadDemoData() {
  people = [
    { id: nextId++, name: 'Василь Петренко',  birth: '1940', death: '2005', gender: 'm', alive: 'dead',
      birthPlace: 'Полтава', occupation: 'Агроном', socialClass: 'peasant', eduLevel: 'secondary',
      nationality: 'Українець', notes: 'Учасник відбудови після Другої світової.', x: 80,  y: 80  },
    { id: nextId++, name: 'Марія Петренко',   birth: '1945', death: '',     gender: 'f', alive: 'alive',
      birthPlace: 'Вінниця',  occupation: 'Вчителька', socialClass: 'intelligentsia', eduLevel: 'higher',
      school: 'Вінницький педагогічний', specialty: 'Початкова освіта', x: 260, y: 80  },
    { id: nextId++, name: 'Олексій Петренко', birth: '1968', death: '',     gender: 'm', alive: 'alive',
      birthPlace: 'Київ',     occupation: 'Інженер',   socialClass: 'intelligentsia', eduLevel: 'higher',
      school: 'КПІ', specialty: 'Електроніка', location: 'Київ', x: 80,  y: 240 },
    { id: nextId++, name: 'Наталія Коваль',   birth: '1972', death: '',     gender: 'f', alive: 'alive',
      birthPlace: 'Харків',   occupation: 'Лікарка',   socialClass: 'intelligentsia', eduLevel: 'higher',
      school: 'Харківський медичний університет', specialty: 'Педіатрія', x: 260, y: 240 },
  ];
  connections = [
    { from: 1, to: 2, type: 'partner' },
    { from: 1, to: 3, type: 'parent'  },
    { from: 2, to: 3, type: 'parent'  },
    { from: 3, to: 4, type: 'partner' },
  ];
}