/**
 * createTree.js — редактор дерева
 * Підключається як <script type="module"> — всі обробники через addEventListener
 */

import { initializeApp }      from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCarNJC1uHCXM-Pi69XGx_UVq79w3czYPA",
  authDomain:        "family-tree-ce8a3.firebaseapp.com",
  projectId:         "family-tree-ce8a3",
  storageBucket:     "family-tree-ce8a3.firebasestorage.app",
  messagingSenderId: "304616447045",
  appId:             "1:304616447045:web:1b98da8b6a0481c65d572c",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

const BASE_URL = 'http://localhost:4000/api';

// ─── Стан ─────────────────────────────────────────────────────────────────────
let people      = [];
let connections = [];
let selectedId  = null;
let scale       = 1;
let dragging    = null;
let dragOffset  = { x: 0, y: 0 };
let nextId      = 1;
let treeId      = null;
let saveTimeout = null;

// ─── DOM ──────────────────────────────────────────────────────────────────────
const canvas    = document.getElementById('canvas');
const svgLines  = document.getElementById('svgLines');
const emptyHint = document.getElementById('emptyHint');
const addModal  = document.getElementById('addModal');

// ─── Прив'язуємо кнопки одразу (DOM вже готовий, бо скрипт унизу body) ───────
document.getElementById('btnOpenModal') .addEventListener('click', openAddModal);
document.getElementById('btnOpenModal2').addEventListener('click', openAddModal);
document.getElementById('btnCloseModal').addEventListener('click', closeModal);
document.getElementById('btnAddPerson') .addEventListener('click', addPerson);
document.getElementById('btnAddConn')   .addEventListener('click', addConnection);
document.getElementById('saveBtnMain')  .addEventListener('click', saveTree);
document.getElementById('btnZoomIn')    .addEventListener('click', () => zoom(0.15));
document.getElementById('btnZoomOut')   .addEventListener('click', () => zoom(-0.15));
document.getElementById('btnZoomReset') .addEventListener('click', resetView);

// Закрити модалку кліком на фон
addModal.addEventListener('click', (e) => { if (e.target === addModal) closeModal(); });

// Enter у полі імені — додати людину
document.getElementById('mName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addPerson();
});

// ─── API хелпер ───────────────────────────────────────────────────────────────
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

// ─── Авторизація + завантаження дерева ───────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'signIn.html';
    return;
  }

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

// ─── Збереження ───────────────────────────────────────────────────────────────
async function saveTree() {
  const btn = document.getElementById('saveBtnMain');

  if (treeId && auth.currentUser) {
    btn.textContent = '⏳ Збереження...';
    btn.disabled = true;
    try {
      await apiRequest('PUT', `/trees/${treeId}`, {
        name:        document.getElementById('treeName').value,
        people,
        connections,
      });
      btn.textContent = '✅ Збережено';
    } catch (e) {
      console.error(e);
      btn.textContent = '❌ Помилка';
    }
  } else {
    // Локальний fallback
    localStorage.setItem('rodo-tree-local', JSON.stringify({
      name:   document.getElementById('treeName').value,
      people,
      connections,
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

// ─── Модальне вікно ───────────────────────────────────────────────────────────
function openAddModal() {
  document.getElementById('mName').value   = '';
  document.getElementById('mBirth').value  = '';
  document.getElementById('mDeath').value  = '';
  document.getElementById('mGender').value = 'm';
  addModal.classList.add('open');
  setTimeout(() => document.getElementById('mName').focus(), 50);
}

function closeModal() {
  addModal.classList.remove('open');
}

// ─── Додати людину ────────────────────────────────────────────────────────────
function addPerson() {
  const nameEl = document.getElementById('mName');
  const name   = nameEl.value.trim();
  if (!name) { nameEl.focus(); nameEl.style.borderColor = 'red'; return; }
  nameEl.style.borderColor = '';

  const birth  = document.getElementById('mBirth').value.trim();
  const death  = document.getElementById('mDeath').value.trim();
  const gender = document.getElementById('mGender').value;

  const col = people.length % 4;
  const row = Math.floor(people.length / 4);

  people.push({
    id: nextId++,
    name, birth, death, gender,
    x: 40 + col * 170,
    y: 40 + row * 120,
  });

  closeModal();
  renderAll();
  selectPerson(people[people.length - 1].id);
  scheduleSave();
}

// ─── Рендер ───────────────────────────────────────────────────────────────────
function renderAll() {
  emptyHint.style.display = people.length === 0 ? 'block' : 'none';
  renderNodes();
  renderConnections();
  renderSidebar();
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getById(id) {
  return people.find(p => p.id === id);
}

function renderNodes() {
  document.querySelectorAll('.node').forEach(n => n.remove());

  people.forEach(p => {
    const node = document.createElement('div');
    node.className = 'node'
      + (p.gender === 'f' ? ' female' : '')
      + (p.id === selectedId ? ' selected' : '');
    node.dataset.id = p.id;
    node.style.left = p.x + 'px';
    node.style.top  = p.y + 'px';

    const years = p.birth
      ? (p.death ? `${p.birth}–${p.death}` : `${p.birth} – …`)
      : '';

    node.innerHTML = `
      <div class="node-head">
        <div class="avatar avatar-${p.gender}">${initials(p.name)}</div>
        <div class="node-name">${p.name}</div>
      </div>
      ${years ? `<div class="node-years">${years}</div>` : ''}
    `;

    node.addEventListener('mousedown', onNodeMouseDown);
    node.addEventListener('click', (e) => { e.stopPropagation(); selectPerson(p.id); });
    canvas.appendChild(node);
  });
}

function renderConnections() {
  svgLines.innerHTML = '';

  connections.forEach(conn => {
    const from = getById(conn.from);
    const to   = getById(conn.to);
    if (!from || !to) return;

    const nodeW = 140, nodeH = 80;
    const fx = from.x + nodeW / 2, fy = from.y + nodeH / 2;
    const tx = to.x   + nodeW / 2, ty = to.y   + nodeH / 2;
    const midY = (fy + ty) / 2;
    const d = `M${fx},${fy} C${fx},${midY} ${tx},${midY} ${tx},${ty}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'conn-line ' + conn.type);
    svgLines.appendChild(path);
  });
}

function renderSidebar() {
  // Список людей
  const list = document.getElementById('personList');
  list.innerHTML = '';

  if (people.length === 0) {
    list.innerHTML = '<div style="font-size:.82rem;color:var(--muted);text-align:center;padding:8px 0">Ще нікого немає</div>';
  } else {
    people.forEach(p => {
      const item  = document.createElement('div');
      const years = p.birth ? (p.death ? `${p.birth}–${p.death}` : p.birth) : '';
      item.className = 'person-item' + (p.id === selectedId ? ' selected' : '');
      item.innerHTML = `
        <div class="avatar avatar-${p.gender}">${initials(p.name)}</div>
        <div class="person-info">
          <div class="name">${p.name}</div>
          ${years ? `<div class="years">${years}</div>` : ''}
        </div>
        <button class="person-del" title="Видалити">✕</button>
      `;
      item.querySelector('.person-del').addEventListener('click', (e) => {
        e.stopPropagation();
        deletePerson(p.id);
      });
      item.addEventListener('click', () => selectPerson(p.id));
      list.appendChild(item);
    });
  }

  // Дропдауни для зв'язків
  const opts = people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const noOpt = '<option disabled>— немає людей —</option>';
  document.getElementById('connFrom').innerHTML = opts || noOpt;
  document.getElementById('connTo').innerHTML   = opts || noOpt;

  // Список зв'язків
  const cList = document.getElementById('connectionList');
  cList.innerHTML = '';

  if (connections.length === 0) {
    cList.innerHTML = '<div style="font-size:.8rem;color:var(--muted);text-align:center;padding:6px 0">Зв\'язків ще немає</div>';
  } else {
    const labels = { parent: 'Батько/Мати', child: 'Дитина', partner: 'Партнер', sibling: 'Брат/Сестра' };
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

// ─── Вибір людини ─────────────────────────────────────────────────────────────
function selectPerson(id) {
  selectedId = (selectedId === id) ? null : id;
  renderAll();
  if (selectedId) {
    const p = getById(selectedId);
    if (p) document.getElementById('connFrom').value = p.id;
  }
}

canvas.addEventListener('click', () => { selectedId = null; renderAll(); });

// ─── Видалення ────────────────────────────────────────────────────────────────
function deletePerson(id) {
  people      = people.filter(p => p.id !== id);
  connections = connections.filter(c => c.from !== id && c.to !== id);
  if (selectedId === id) selectedId = null;
  renderAll();
  scheduleSave();
}

function deleteConnection(i) {
  connections.splice(i, 1);
  renderAll();
  scheduleSave();
}

// ─── Додати зв'язок ───────────────────────────────────────────────────────────
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

// ─── Перетягування ────────────────────────────────────────────────────────────
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

// ─── Масштаб ──────────────────────────────────────────────────────────────────
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

// ─── Клавіатура ───────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { selectedId = null; renderAll(); closeModal(); }
  if ((e.key === 'Delete' || e.key === 'Backspace')
      && selectedId
      && document.activeElement.tagName !== 'INPUT'
      && document.activeElement.tagName !== 'TEXTAREA') {
    deletePerson(selectedId);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveTree();
  }
});

// ─── Демо-дані (коли бекенд недоступний і немає локального збереження) ────────
function loadDemoData() {
  people = [
    { id: nextId++, name: 'Василь Петренко',  birth: '1940', death: '2005', gender: 'm', x: 80,  y: 80  },
    { id: nextId++, name: 'Марія Петренко',   birth: '1945', death: '',     gender: 'f', x: 260, y: 80  },
    { id: nextId++, name: 'Олексій Петренко', birth: '1968', death: '',     gender: 'm', x: 80,  y: 230 },
    { id: nextId++, name: 'Наталія Коваль',   birth: '1972', death: '',     gender: 'f', x: 260, y: 230 },
  ];
  connections = [
    { from: 1, to: 2, type: 'partner' },
    { from: 1, to: 3, type: 'parent'  },
    { from: 2, to: 3, type: 'parent'  },
    { from: 3, to: 4, type: 'partner' },
  ];
}