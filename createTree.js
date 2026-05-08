/**
 * createTree.js — редактор дерева з підтримкою бекенду
 * Зберігає/завантажує дерево через Node.js API
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCarNJC1uHCXM-Pi69XGx_UVq79w3czYPA",
  authDomain: "family-tree-ce8a3.firebaseapp.com",
  projectId: "family-tree-ce8a3",
  storageBucket: "family-tree-ce8a3.firebasestorage.app",
  messagingSenderId: "304616447045",
  appId: "1:304616447045:web:1b98da8b6a0481c65d572c"
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
let treeId      = null;     // ID дерева в Firestore
let saveTimeout = null;     // для автозбереження

const canvas    = document.getElementById('canvas');
const svgLines  = document.getElementById('svgLines');
const emptyHint = document.getElementById('emptyHint');

// ─── API хелпер ───────────────────────────────────────────────────────────────
async function apiRequest(method, path, body = null) {
  const user = auth.currentUser;
  if (!user) throw new Error('Не авторизовано');

  const token = await user.getIdToken();
  const opts  = {
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

// ─── Завантаження дерева при старті ──────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Незареєстрований — перенаправляємо на вхід
    window.location.href = 'signIn.html';
    return;
  }

  // Беремо treeId з URL (?treeId=xxx) або вантажимо перше дерево
  const params = new URLSearchParams(window.location.search);
  treeId = params.get('treeId');

  try {
    if (treeId) {
      // Завантажуємо конкретне дерево
      await loadTree(treeId);
    } else {
      // Беремо список дерев — якщо є, відкриваємо перше; якщо ні — створюємо нове
      const trees = await apiRequest('GET', '/trees');

      if (trees.length > 0) {
        treeId = trees[0].id;
        await loadTree(treeId);
        // Оновлюємо URL без перезавантаження
        history.replaceState({}, '', `?treeId=${treeId}`);
      } else {
        treeId = await createNewTree();
      }
    }
  } catch (e) {
    console.warn('Бекенд недоступний, працюємо локально:', e.message);
    // Демо-дані якщо бекенд не запущено
    loadDemoData();
  }

  renderAll();
});

async function loadTree(id) {
  const data = await apiRequest('GET', `/trees/${id}`);

  document.getElementById('treeName').value = data.name || 'Моє сімейне дерево';
  people      = data.people      || [];
  connections = data.connections || [];

  // Відновлюємо nextId щоб не було дублікатів
  const maxId = people.reduce((m, p) => Math.max(m, p.id || 0), 0);
  nextId = maxId + 1;
}

async function createNewTree() {
  const name = document.getElementById('treeName').value;
  const res  = await apiRequest('POST', '/trees', { name });
  history.replaceState({}, '', `?treeId=${res.id}`);
  return res.id;
}

// ─── Збереження ───────────────────────────────────────────────────────────────

// Зберегти одразу
async function saveTree() {
  if (!treeId || !auth.currentUser) return;

  const saveBtn = document.querySelector('.btn-primary[data-save]');
  if (saveBtn) saveBtn.textContent = '⏳ Збереження...';

  try {
    await apiRequest('PUT', `/trees/${treeId}`, {
      name:        document.getElementById('treeName').value,
      people,
      connections,
    });

    if (saveBtn) {
      saveBtn.textContent = '✅ Збережено';
      setTimeout(() => { saveBtn.textContent = '💾 Зберегти'; }, 2000);
    }
  } catch (e) {
    console.error('Помилка збереження:', e);
    if (saveBtn) saveBtn.textContent = '❌ Помилка';
    setTimeout(() => { saveBtn.textContent = '💾 Зберегти'; }, 2000);
  }
}

// Автозбереження через 1.5 сек після змін
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveTree, 1500);
}

// Вішаємо збереження на кнопку
document.querySelector('.btn-primary')?.setAttribute('data-save', '1');
document.querySelector('.btn-primary')?.addEventListener('click', saveTree);

// ─── Решта логіки (без змін від оригіналу) ───────────────────────────────────

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getById(id) { return people.find(p => p.id === id); }

function openAddModal() {
  document.getElementById('mName').value  = '';
  document.getElementById('mBirth').value = '';
  document.getElementById('mDeath').value = '';
  document.getElementById('mGender').value = 'm';
  document.getElementById('addModal').classList.add('open');
  setTimeout(() => document.getElementById('mName').focus(), 50);
}
function closeModal() {
  document.getElementById('addModal').classList.remove('open');
}
document.getElementById('addModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Робимо функції глобальними для onclick у HTML
window.openAddModal  = openAddModal;
window.closeModal    = closeModal;
window.addConnection = addConnection;

function addPerson() {
  const name = document.getElementById('mName').value.trim();
  if (!name) { document.getElementById('mName').focus(); return; }

  const birth  = document.getElementById('mBirth').value.trim();
  const death  = document.getElementById('mDeath').value.trim();
  const gender = document.getElementById('mGender').value;

  const existing = people.length;
  const col = existing % 4;
  const row = Math.floor(existing / 4);

  const person = {
    id: nextId++,
    name,
    birth,
    death,
    gender,
    x: 40 + col * 170,
    y: 40 + row * 120,
  };

  people.push(person);
  closeModal();
  renderAll();
  selectPerson(person.id);
  scheduleSave();   // ← автозбереження після змін
}
window.addPerson = addPerson;

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
    node.dataset.id = p.id;
    node.style.left = p.x + 'px';
    node.style.top  = p.y + 'px';

    const years = p.birth
      ? (p.death ? p.birth + '–' + p.death : p.birth + ' – …')
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
    const mid_y = (fy + ty) / 2;
    const d = `M${fx},${fy} C${fx},${mid_y} ${tx},${mid_y} ${tx},${ty}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'conn-line ' + conn.type);
    svgLines.appendChild(path);
  });
}

function renderSidebar() {
  const list = document.getElementById('personList');
  list.innerHTML = '';

  if (people.length === 0) {
    list.innerHTML = '<div style="font-size:.82rem;color:var(--muted);text-align:center;padding:8px 0">Ще нікого немає</div>';
  }

  people.forEach(p => {
    const item  = document.createElement('div');
    const years = p.birth ? (p.death ? p.birth + '–' + p.death : p.birth) : '';
    item.className = 'person-item' + (p.id === selectedId ? ' selected' : '');
    item.innerHTML = `
      <div class="avatar avatar-${p.gender}">${initials(p.name)}</div>
      <div class="person-info">
        <div class="name">${p.name}</div>
        ${years ? `<div class="years">${years}</div>` : ''}
      </div>
      <button class="person-del" title="Видалити" onclick="deletePerson(${p.id}, event)">✕</button>
    `;
    item.addEventListener('click', () => selectPerson(p.id));
    list.appendChild(item);
  });

  const opts = people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  document.getElementById('connFrom').innerHTML = opts || '<option disabled>— немає людей —</option>';
  document.getElementById('connTo').innerHTML   = opts || '<option disabled>— немає людей —</option>';

  const cList = document.getElementById('connectionList');
  cList.innerHTML = '';

  connections.forEach((c, i) => {
    const from = getById(c.from);
    const to   = getById(c.to);
    if (!from || !to) return;

    const labels = { parent: 'Батько/Мати', child: 'Дитина', partner: 'Партнер', sibling: 'Брат/Сестра' };
    const item = document.createElement('div');
    item.className = 'connection-item';
    item.innerHTML = `
      <span style="font-weight:500;font-size:.82rem">${from.name}</span>
      <span class="badge badge-${c.type}">${labels[c.type] || c.type}</span>
      <span style="font-size:.82rem">${to.name}</span>
      <button class="conn-del" onclick="deleteConnection(${i})" title="Видалити">✕</button>
    `;
    cList.appendChild(item);
  });

  if (connections.length === 0) {
    cList.innerHTML = '<div style="font-size:.8rem;color:var(--muted);text-align:center;padding:6px 0">Зв\'язків ще немає</div>';
  }
}

function selectPerson(id) {
  selectedId = (selectedId === id) ? null : id;
  renderAll();
  if (selectedId) {
    const p = getById(selectedId);
    if (p) document.getElementById('connFrom').value = p.id;
  }
}

canvas.addEventListener('click', () => { selectedId = null; renderAll(); });

function deletePerson(id, e) {
  e?.stopPropagation();
  people      = people.filter(p => p.id !== id);
  connections = connections.filter(c => c.from !== id && c.to !== id);
  if (selectedId === id) selectedId = null;
  renderAll();
  scheduleSave();
}
window.deletePerson = deletePerson;

function deleteConnection(i) {
  connections.splice(i, 1);
  renderAll();
  scheduleSave();
}
window.deleteConnection = deleteConnection;

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
  dragging  = { id, node: e.currentTarget };
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
  if (dragging) scheduleSave();   // зберігаємо після перетягування
  dragging = null;
});

function zoom(delta) {
  scale = Math.min(2, Math.max(0.3, scale + delta));
  canvas.style.transform    = `scale(${scale})`;
  canvas.style.transformOrigin = '0 0';
  svgLines.style.transform  = `scale(${scale})`;
  svgLines.style.transformOrigin = '0 0';
}
function resetView() {
  scale = 1;
  canvas.style.transform   = '';
  svgLines.style.transform = '';
}
window.zoom      = zoom;
window.resetView = resetView;

document.addEventListener('keydown', e => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && document.activeElement.tagName !== 'INPUT') {
    deletePerson(selectedId, null);
  }
  if (e.key === 'Escape') { selectedId = null; renderAll(); closeModal(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveTree(); }
});

// Ctrl+S збереження + назва дерева
document.getElementById('treeName').addEventListener('input', scheduleSave);

function loadDemoData() {
  people = [
    { id: nextId++, name: 'Василь Петренко', birth: '1940', death: '2005', gender: 'm', x: 80, y: 80 },
    { id: nextId++, name: 'Марія Петренко',  birth: '1945', death: '',     gender: 'f', x: 260, y: 80 },
    { id: nextId++, name: 'Олексій Петренко',birth: '1968', death: '',     gender: 'm', x: 80, y: 230 },
    { id: nextId++, name: 'Наталія Коваль',  birth: '1972', death: '',     gender: 'f', x: 260, y: 230 },
  ];
  connections = [
    { from: 1, to: 2, type: 'partner' },
    { from: 1, to: 3, type: 'parent' },
    { from: 2, to: 3, type: 'parent' },
    { from: 3, to: 4, type: 'partner' },
  ];
}