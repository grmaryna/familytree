let people = [];
  let connections = [];
  let selectedId = null;
  let scale = 1;
  let translate = { x: 0, y: 0 };
  let dragging = null;
  let dragOffset = { x: 0, y: 0 };
  let canvasPan = null;
  let nextId = 1;

  const canvas = document.getElementById('canvas');
  const svgLines = document.getElementById('svgLines');
  const emptyHint = document.getElementById('emptyHint');
 
  function initials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
 
  function getById(id) { return people.find(p => p.id === id); }

  function openAddModal() {
    document.getElementById('mName').value = '';
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

  function addPerson() {
    const name = document.getElementById('mName').value.trim();
    if (!name) { document.getElementById('mName').focus(); return; }
    const birth = document.getElementById('mBirth').value.trim();
    const death = document.getElementById('mDeath').value.trim();
    const gender = document.getElementById('mGender').value;
 
    const id = nextId++;
    const existing = people.length;

    const col = existing % 4;
    const row = Math.floor(existing / 4);
    const x = 40 + col * 170;
    const y = 40 + row * 120;
 
    const person = { id, name, birth, death, gender, x, y };
    people.push(person);
    closeModal();
    renderAll();
    selectPerson(id);
  }

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
      node.className = 'node' + (p.gender === 'f' ? ' female' : '') + (p.id === selectedId ? ' selected' : '');
      node.dataset.id = p.id;
      node.style.left = p.x + 'px';
      node.style.top = p.y + 'px';
 
      const years = p.birth ? (p.death ? p.birth + '–' + p.death : p.birth + ' – …') : '';
 
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
      const to = getById(conn.to);
      if (!from || !to) return;
 
      const nodeW = 140, nodeH = 80;
      const fx = from.x + nodeW / 2;
      const fy = from.y + nodeH / 2;
      const tx = to.x + nodeW / 2;
      const ty = to.y + nodeH / 2;
 
      const mid_x = (fx + tx) / 2;
      const mid_y = (fy + ty) / 2;
      const d = `M${fx},${fy} C${fx},${mid_y} ${tx},${mid_y} ${tx},${ty}`;
 
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'conn-line ' + (conn.type === 'partner' ? 'partner' : conn.type === 'child' ? 'child' : conn.type === 'sibling' ? 'sibling' : ''));
      svgLines.appendChild(path);
    });
  }

  function renderSidebar() {
    // Person list
    const list = document.getElementById('personList');
    list.innerHTML = '';
    if (people.length === 0) {
      list.innerHTML = '<div style="font-size:.82rem;color:var(--muted);text-align:center;padding:8px 0">Ще нікого немає</div>';
    }
    people.forEach(p => {
      const item = document.createElement('div');
      item.className = 'person-item' + (p.id === selectedId ? ' selected' : '');
      const years = p.birth ? (p.death ? p.birth + '–' + p.death : p.birth) : '';
      item.innerHTML = `
        <div class="avatar avatar-${p.gender}">${initials(p.name)}</div>
        <div class="person-info">
          <div class="name">${p.name}</div>
          ${years ? `<div class="years">${years}</div>` : ''}
        </div>
        <button class="person-del" title="Видалити" onclick="deletePerson(${p.id},event)">✕</button>
      `;
      item.addEventListener('click', () => selectPerson(p.id));
      list.appendChild(item);
    });

    const opts = people.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    document.getElementById('connFrom').innerHTML = opts || '<option disabled>— немає людей —</option>';
    document.getElementById('connTo').innerHTML = opts || '<option disabled>— немає людей —</option>';
 
    const cList = document.getElementById('connectionList');
    cList.innerHTML = '';
    connections.forEach((c, i) => {
      const from = getById(c.from);
      const to = getById(c.to);
      if (!from || !to) return;
      const typeLabel = { parent: 'Батько/Мати', child: 'Дитина', partner: 'Партнер', sibling: 'Брат/Сестра' }[c.type] || c.type;
      const badgeClass = { parent: 'badge-parent', child: 'badge-child', partner: 'badge-partner', sibling: 'badge-sibling' }[c.type] || '';
      const item = document.createElement('div');
      item.className = 'connection-item';
      item.innerHTML = `
        <span style="font-weight:500;font-size:.82rem">${from.name}</span>
        <span class="badge ${badgeClass}">${typeLabel}</span>
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
      if (p) {
        document.getElementById('connFrom').value = p.id;
      }
    }
  }
 
  canvas.addEventListener('click', () => { selectedId = null; renderAll(); });

  function deletePerson(id, e) {
    e.stopPropagation();
    people = people.filter(p => p.id !== id);
    connections = connections.filter(c => c.from !== id && c.to !== id);
    if (selectedId === id) selectedId = null;
    renderAll();
  }
 
  function deleteConnection(i) {
    connections.splice(i, 1);
    renderAll();
  }

  function addConnection() {
    const from = parseInt(document.getElementById('connFrom').value);
    const to = parseInt(document.getElementById('connTo').value);
    const type = document.getElementById('connType').value;
    if (!from || !to || from === to) return;

    const dup = connections.find(c => c.from === from && c.to === to && c.type === type);
    if (dup) return;
    connections.push({ from, to, type });
    renderAll();
  }

  function onNodeMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const node = e.currentTarget;
    const id = parseInt(node.dataset.id);
    const p = getById(id);
    dragging = { id, node };
    dragOffset.x = e.clientX - p.x;
    dragOffset.y = e.clientY - p.y;
  }
 
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const p = getById(dragging.id);
    p.x = e.clientX - dragOffset.x;
    p.y = e.clientY - dragOffset.y;
    dragging.node.style.left = p.x + 'px';
    dragging.node.style.top = p.y + 'px';
    renderConnections();
  });
 
  window.addEventListener('mouseup', () => { dragging = null; });

  function zoom(delta) {
    scale = Math.min(2, Math.max(0.3, scale + delta));
    canvas.style.transform = `scale(${scale})`;
    canvas.style.transformOrigin = '0 0';
    svgLines.style.transform = `scale(${scale})`;
    svgLines.style.transformOrigin = '0 0';
  }
  function resetView() {
    scale = 1;
    canvas.style.transform = '';
    svgLines.style.transform = '';
  }

  document.addEventListener('keydown', e => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && document.activeElement.tagName !== 'INPUT') {
      deletePerson(selectedId, { stopPropagation: () => {} });
    }
    if (e.key === 'Escape') { selectedId = null; renderAll(); closeModal(); }
  });

  people = [
    { id: nextId++, name: 'Василь Петренко', birth: '1940', death: '2005', gender: 'm', x: 80, y: 80 },
    { id: nextId++, name: 'Марія Петренко', birth: '1945', death: '', gender: 'f', x: 260, y: 80 },
    { id: nextId++, name: 'Олексій Петренко', birth: '1968', death: '', gender: 'm', x: 80, y: 230 },
    { id: nextId++, name: 'Наталія Коваль', birth: '1972', death: '', gender: 'f', x: 260, y: 230 },
    { id: nextId++, name: 'Дмитро Петренко', birth: '1995', death: '', gender: 'm', x: 80, y: 380 },
    { id: nextId++, name: 'Анна Петренко', birth: '1998', death: '', gender: 'f', x: 260, y: 380 },
  ];
  connections = [
    { from: 1, to: 2, type: 'partner' },
    { from: 1, to: 3, type: 'parent' },
    { from: 2, to: 3, type: 'parent' },
    { from: 3, to: 4, type: 'partner' },
    { from: 3, to: 5, type: 'parent' },
    { from: 4, to: 5, type: 'parent' },
    { from: 3, to: 6, type: 'parent' },
    { from: 4, to: 6, type: 'parent' },
    { from: 5, to: 6, type: 'sibling' },
  ];
 
  renderAll();