import { initializeApp }   from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCarNJC1uHCXM-Pi69XGx_UVq79w3czYPA",
  authDomain: "family-tree-ce8a3.firebaseapp.com",
  projectId: "family-tree-ce8a3",
  storageBucket: "family-tree-ce8a3.firebasestorage.app",
  messagingSenderId: "304616447045",
  appId: "1:304616447045:web:1b98da8b6a0481c65d572c"
};

// ─── Теми ────────────────────────────────────────────────────────────────────
const themes = {
  forest: {'--bg':'#f5f0e8','--bg2':'#ede6d6','--green':'#3a6b4a','--green-light':'#5a8f6a','--green-pale':'#d4e8da','--brown':'#7a5c3a','--text':'#2c2218','--muted':'#7a6a55','--border':'#d8cdb8','--white':'#fff'},
  ocean:  {'--bg':'#e8f2f8','--bg2':'#d8eaf4','--green':'#2a6080','--green-light':'#3a80a8','--green-pale':'#c8e0ee','--brown':'#3a6878','--text':'#0f2a38','--muted':'#4a7088','--border':'#b8d4e4','--white':'#fff'},
  autumn: {'--bg':'#fdf3e8','--bg2':'#f5e6d0','--green':'#a04020','--green-light':'#c05030','--green-pale':'#fde0cc','--brown':'#8a5020','--text':'#2a1408','--muted':'#8a5a3a','--border':'#e0c8a8','--white':'#fff'},
  night:  {'--bg':'#1a1f2e','--bg2':'#141824','--green':'#4a7acf','--green-light':'#6a9aef','--green-pale':'#1e2d4a','--brown':'#7a8aaa','--text':'#e0e8f8','--muted':'#8090b0','--border':'#2a3550','--white':'#1e2438'},
  rose:   {'--bg':'#fdf0f0','--bg2':'#f5e2e2','--green':'#a04060','--green-light':'#c05070','--green-pale':'#fde0e8','--brown':'#8a4050','--text':'#280a14','--muted':'#8a4a58','--border':'#e0c0c8','--white':'#fff'},
  sand:   {'--bg':'#f5f0e0','--bg2':'#ede4cc','--green':'#7a6030','--green-light':'#9a7840','--green-pale':'#e8dfc0','--brown':'#6a5028','--text':'#28200c','--muted':'#7a6840','--border':'#d8c898','--white':'#fff'},
};
const saved = localStorage.getItem('rodo-theme');
if (saved && themes[saved]) Object.entries(themes[saved]).forEach(([k,v]) => document.documentElement.style.setProperty(k,v));

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const BASE = 'http://localhost:4000/api';

let people = [], connections = [], scale = 1;
const canvas   = document.getElementById('canvas');
const svgLines = document.getElementById('svgLines');

function initials(name) { return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function getById(id)    { return people.find(p => p.id === id); }

async function apiRequest(method, path) {
  const user  = auth.currentUser;
  const token = await user.getIdToken();
  const res   = await fetch(BASE + path, { headers: { 'Authorization': `Bearer ${token}` } });
  const data  = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'signIn.html'; return; }

  const params = new URLSearchParams(window.location.search);
  const treeId = params.get('treeId');

  // Оновлюємо посилання «Редагувати»
  if (treeId) {
    document.getElementById('editBtn').href = `createTree.html?treeId=${treeId}`;
  } else {
    document.getElementById('editBtn').href = 'createTree.html';
  }

  try {
    let data;
    if (treeId) {
      data = await apiRequest('GET', `/trees/${treeId}`);
    } else {
      const trees = await apiRequest('GET', '/trees');
      if (trees.length === 0) { showEmpty(); return; }
      data = await apiRequest('GET', `/trees/${trees[0].id}`);
      history.replaceState({}, '', `?treeId=${trees[0].id}`);
      document.getElementById('editBtn').href = `createTree.html?treeId=${trees[0].id}`;
    }
    people      = data.people      || [];
    connections = data.connections || [];
    document.getElementById('treeTitle').textContent = data.name || 'Сімейне дерево';
  } catch (e) {
    // Fallback — локальне збереження
    const local = localStorage.getItem('rodo-tree-local');
    if (local) {
      try {
        const saved = JSON.parse(local);
        people      = saved.people      || [];
        connections = saved.connections || [];
        document.getElementById('treeTitle').textContent = saved.name || 'Сімейне дерево';
      } catch (_) {}
    }
  }

  document.getElementById('loadingHint').style.display = 'none';
  renderAll();
});

function showEmpty() {
  document.getElementById('loadingHint').style.display = 'none';
  document.getElementById('emptyHint').style.display   = 'block';
}

function renderAll() {
  if (people.length === 0) { showEmpty(); return; }
  renderNodes();
  renderConnections();
}

function renderNodes() {
  document.querySelectorAll('.node').forEach(n => n.remove());
  people.forEach(p => {
    const node = document.createElement('div');
    node.className = 'node' + (p.gender === 'f' ? ' female' : '');
    node.style.left = p.x + 'px';
    node.style.top  = p.y + 'px';
    const years = p.birth ? (p.death ? p.birth + '–' + p.death : p.birth + ' – …') : '';
    node.innerHTML = `
      <div class="node-head">
        <div class="avatar avatar-${p.gender}">${initials(p.name)}</div>
        <div class="node-name">${p.name}</div>
      </div>
      ${years ? `<div class="node-years">${years}</div>` : ''}
    `;
    node.addEventListener('click', () => openDetail(p.id));
    canvas.appendChild(node);
  });
}

function renderConnections() {
  svgLines.innerHTML = '';
  connections.forEach(conn => {
    const from = getById(conn.from), to = getById(conn.to);
    if (!from || !to) return;
    const fx = from.x + 70, fy = from.y + 40;
    const tx = to.x   + 70, ty = to.y   + 40;
    const my = (fy + ty) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', `M${fx},${fy} C${fx},${my} ${tx},${my} ${tx},${ty}`);
    path.setAttribute('class', 'conn-line ' + conn.type);
    svgLines.appendChild(path);
  });
}

function openDetail(id) {
  const p = getById(id);
  if (!p) return;

  const colors = { m: '#5a8f6a', f: '#c97a5a' };
  const av = document.getElementById('detailAvatar');
  av.textContent         = initials(p.name);
  av.style.background    = colors[p.gender] || '#5a8f6a';

  document.getElementById('detailName').textContent  = p.name;
  const years = p.birth ? (p.death ? p.birth + ' – ' + p.death : 'нар. ' + p.birth) : '';
  document.getElementById('detailYears').textContent = years;

  // Зв'язки цієї людини
  const labels = { parent:'Батько/Мати', child:'Дитина', partner:'Партнер', sibling:'Брат/Сестра' };
  const rels = connections
    .filter(c => c.from === id || c.to === id)
    .map(c => {
      const otherId = c.from === id ? c.to : c.from;
      const other   = getById(otherId);
      if (!other) return null;
      const dir = c.from === id ? `→ ${other.name}` : `← ${other.name}`;
      return `<div class="detail-rel-item">${labels[c.type] || c.type}: ${dir}</div>`;
    })
    .filter(Boolean)
    .join('');

  const relDiv = document.getElementById('detailRel');
  if (rels) {
    relDiv.innerHTML = `<div class="detail-rel-title">Зв'язки</div>${rels}`;
  } else {
    relDiv.innerHTML = '<div style="color:var(--muted);font-size:.8rem">Немає зв\'язків</div>';
  }

  document.getElementById('detailPanel').classList.add('open');
}

function closeDetail() { document.getElementById('detailPanel').classList.remove('open'); }

function zoom(delta) {
  scale = Math.min(2, Math.max(0.3, scale + delta));
  canvas.style.transform         = `scale(${scale})`;
  canvas.style.transformOrigin   = '0 0';
  svgLines.style.transform       = `scale(${scale})`;
  svgLines.style.transformOrigin = '0 0';
}
function resetView() { scale=1; canvas.style.transform=''; svgLines.style.transform=''; }

window.zoom        = zoom;
window.resetView   = resetView;
window.closeDetail = closeDetail;

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDetail();
});