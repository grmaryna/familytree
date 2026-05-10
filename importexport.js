import { initializeApp }          from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
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

async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Не авторизовано');
  return user.getIdToken();
}

async function* parseNDJSONStream(readableStream) {
  const reader  = readableStream.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {

        const trimmed = buffer.trim();
        if (trimmed) {
          try { yield JSON.parse(trimmed); } catch (_) {}
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          yield JSON.parse(trimmed);
        } catch (_) {
          console.warn('importExport: невалідний NDJSON рядок, пропускаємо');
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function exportTreeStream(treeId, callbacks = {}) {
  const { onMeta, onPerson, onConnection, onProgress } = callbacks;

  const token    = await getToken();
  const response = await fetch(`${BASE_URL}/trees/${treeId}/export-stream`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Помилка сервера');
  }

  const people      = [];
  const connections = [];
  let   meta        = null;
  let   received    = 0;

  for await (const obj of parseNDJSONStream(response.body)) {
    received++;

    if (obj.__type === 'tree-meta') {
      meta = obj;
      onMeta?.(meta);
    } else if (obj.__type === 'person') {
      const { __type, ...person } = obj;
      people.push(person);
      onPerson?.(person);
    } else if (obj.__type === 'connection') {
      const { __type, ...conn } = obj;
      connections.push(conn);
      onConnection?.(conn);
    }

    if (meta?.totalPeople) {
      onProgress?.({
        received: people.length,
        total:    meta.totalPeople,
        percent:  Math.round((people.length / meta.totalPeople) * 100),
      });
    }
  }

  return { people, connections, meta };
}

export async function importTreeStream(treeId, file, onProgress) {
  const token = await getToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE_URL}/trees/${treeId}/import-stream`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/x-ndjson');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded:  e.loaded,
          total:   e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(JSON.parse(xhr.responseText).error || 'Помилка імпорту'));
      }
    };

    xhr.onerror = () => reject(new Error('Мережева помилка'));

    xhr.send(file);
  });
}

export async function analyzeTreeStream(treeId) {
  const token    = await getToken();
  const response = await fetch(`${BASE_URL}/trees/${treeId}/analyze`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Помилка аналізу');
  }
  return response.json();
}

export async function downloadTreeAsNDJSON(treeId, filename) {
  const token    = await getToken();
  const response = await fetch(`${BASE_URL}/trees/${treeId}/export-stream`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Помилка експорту');

  const chunks = [];
  for await (const obj of parseNDJSONStream(response.body)) {
    chunks.push(JSON.stringify(obj) + '\n');
  }

  const blob = new Blob(chunks, { type: 'application/x-ndjson' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename || `family-tree-${treeId}.ndjson`;
  a.click();
  URL.revokeObjectURL(url);
}

export function mountImportExportPanel(container, treeId) {
  container.innerHTML = `
    <div class="io-panel">
      <div class="io-section">
        <div class="io-title">📤 Експорт дерева</div>
        <p class="io-desc">Завантажити як NDJSON-файл (підтримує великі дерева, стрімінг)</p>
        <button class="btn btn-outline btn-sm" id="btnExport">⬇️ Завантажити NDJSON</button>
        <div class="io-progress" id="exportProgress" style="display:none">
          <div class="progress-bar"><div class="progress-fill" id="exportFill"></div></div>
          <div class="progress-label" id="exportLabel">Завантаження...</div>
        </div>
      </div>

      <div class="io-section">
        <div class="io-title">📥 Імпорт дерева</div>
        <p class="io-desc">Завантажити NDJSON-файл (дані додадуться до поточного дерева)</p>
        <label class="btn btn-outline btn-sm" style="cursor:pointer">
          ⬆️ Обрати файл
          <input type="file" id="importFile" accept=".ndjson,.jsonl" style="display:none"/>
        </label>
        <div class="io-progress" id="importProgress" style="display:none">
          <div class="progress-bar"><div class="progress-fill" id="importFill"></div></div>
          <div class="progress-label" id="importLabel">Завантаження...</div>
        </div>
        <div class="io-result" id="importResult" style="display:none"></div>
      </div>

      <div class="io-section">
        <div class="io-title">📊 Аналіз дерева</div>
        <p class="io-desc">Статистика, обчислена потоково (async iterators)</p>
        <button class="btn btn-outline btn-sm" id="btnAnalyze">🔍 Аналізувати</button>
        <div class="io-stats" id="analyzeResult" style="display:none"></div>
      </div>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    .io-panel { display: flex; flex-direction: column; gap: 16px; }
    .io-section { background: var(--bg2); border-radius: 10px; padding: 14px 16px; border: 1px solid var(--border); }
    .io-title { font-weight: 600; color: var(--green); margin-bottom: 4px; font-size: .9rem; }
    .io-desc { font-size: .8rem; color: var(--muted); margin: 0 0 10px; }
    .progress-bar { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin: 8px 0 4px; }
    .progress-fill { height: 100%; background: var(--green); border-radius: 3px; width: 0%; transition: width .2s; }
    .progress-label { font-size: .75rem; color: var(--muted); }
    .io-result, .io-stats { margin-top: 10px; font-size: .82rem; color: var(--text); background: var(--bg); border-radius: 8px; padding: 10px 12px; }
    .stat-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid var(--border); }
    .stat-row:last-child { border-bottom: none; }
    .stat-key { color: var(--muted); }
    .stat-val { font-weight: 600; color: var(--green); }
  `;
  document.head.appendChild(style);

  document.getElementById('btnExport').addEventListener('click', async () => {
    const progress = document.getElementById('exportProgress');
    const fill     = document.getElementById('exportFill');
    const label    = document.getElementById('exportLabel');
    progress.style.display = 'block';
    fill.style.width = '0%';
    label.textContent = 'Підключення до сервера...';

    try {
      await exportTreeStream(treeId, {
        onMeta: (meta) => {
          label.textContent = `Експорт "${meta.name}" (${meta.totalPeople} осіб)`;
        },
        onProgress: ({ percent, received, total }) => {
          fill.style.width   = percent + '%';
          label.textContent  = `Отримано ${received} / ${total} осіб (${percent}%)`;
        },
      });

      await downloadTreeAsNDJSON(treeId);
      label.textContent = '✅ Готово!';
      fill.style.width  = '100%';
      setTimeout(() => { progress.style.display = 'none'; }, 2500);
    } catch (err) {
      label.textContent = '❌ ' + err.message;
    }
  });

  document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const progress = document.getElementById('importProgress');
    const fill     = document.getElementById('importFill');
    const label    = document.getElementById('importLabel');
    const result   = document.getElementById('importResult');

    progress.style.display = 'block';
    result.style.display   = 'none';
    fill.style.width = '0%';
    label.textContent = `Завантаження ${file.name} (${(file.size / 1024).toFixed(1)} КБ)`;

    try {
      const stats = await importTreeStream(treeId, file, ({ percent, loaded, total }) => {
        fill.style.width  = percent + '%';
        label.textContent = `${(loaded / 1024).toFixed(0)} / ${(total / 1024).toFixed(0)} КБ (${percent}%)`;
      });

      label.textContent        = '✅ Імпорт завершено!';
      fill.style.width         = '100%';
      result.style.display     = 'block';
      result.innerHTML         = `
        Імпортовано <strong>${stats.importedPeople}</strong> осіб 
        та <strong>${stats.importedConnections}</strong> зв'язків.<br/>
        <small style="color:var(--muted)">Оновіть сторінку, щоб побачити зміни.</small>
      `;
      setTimeout(() => { progress.style.display = 'none'; }, 2000);
    } catch (err) {
      label.textContent = '❌ ' + err.message;
    }
  });

  document.getElementById('btnAnalyze').addEventListener('click', async () => {
    const btn    = document.getElementById('btnAnalyze');
    const result = document.getElementById('analyzeResult');
    btn.textContent   = '⏳ Аналіз...';
    btn.disabled      = true;
    result.style.display = 'none';

    try {
      const stats = await analyzeTreeStream(treeId);
      result.style.display = 'block';
      result.innerHTML = `
        <div class="stat-row"><span class="stat-key">Всього людей</span><span class="stat-val">${stats.totalPeople}</span></div>
        <div class="stat-row"><span class="stat-key">Чоловіків / Жінок</span><span class="stat-val">${stats.totalMale} / ${stats.totalFemale}</span></div>
        <div class="stat-row"><span class="stat-key">Живих / Померлих</span><span class="stat-val">${stats.totalAlive} / ${stats.totalDeceased}</span></div>
        <div class="stat-row"><span class="stat-key">Середній вік</span><span class="stat-val">${stats.avgAge ?? '—'} р.</span></div>
        <div class="stat-row"><span class="stat-key">Покоління</span><span class="stat-val">${stats.generations?.join(', ') || '—'}</span></div>
        <div class="stat-row"><span class="stat-key">Глибина дерева (BFS)</span><span class="stat-val">${stats.treeDepth}</span></div>
        <div class="stat-row"><span class="stat-key">Зв'язків</span><span class="stat-val">${stats.totalConns}</span></div>
        <div class="stat-row"><span class="stat-key">Сторінок оброблено</span><span class="stat-val">${stats.pagesProcessed}</span></div>
      `;
    } catch (err) {
      result.style.display = 'block';
      result.textContent   = '❌ ' + err.message;
    }

    btn.textContent = '🔍 Аналізувати';
    btn.disabled    = false;
  });
}