import { Readable, Transform, Writable, pipeline } from 'stream';
import { promisify } from 'util';
import admin from 'firebase-admin';

const pipelineAsync = promisify(pipeline);

export function createPeopleReadStream(db, treeId, { batchSize = 50 } = {}) {
  let offset    = 0;
  let allPeople = null;

  return new Readable({
    objectMode: true,
    highWaterMark: batchSize,

    async read() {
      try {
        if (allPeople === null) {
          const doc = await db.collection('trees').doc(treeId).get();
          if (!doc.exists) { this.push(null); return; }
          allPeople = doc.data().people || [];
        }

        const batch = allPeople.slice(offset, offset + batchSize);
        offset += batchSize;

        if (batch.length === 0) {
          this.push(null);
          return;
        }

        for (const person of batch) {
          this.push(person);
        }
      } catch (err) {
        this.destroy(err);
      }
    }
  });
}

export function createEnrichTransform() {
  return new Transform({
    objectMode: true,
    highWaterMark: 16,

    transform(person, _encoding, callback) {
      try {
        if (!person || !person.name || !person.name.trim()) {
          return callback();
        }

        const enriched = { ...person };

        const birthYear = parseInt(enriched.birth) || null;
        const deathYear = parseInt(enriched.death) || null;
        enriched.birthYear = birthYear;
        enriched.deathYear = deathYear;

        if (birthYear) {
          const endYear = deathYear || new Date().getFullYear();
          enriched.age = endYear - birthYear;
        } else {
          enriched.age = null;
        }

        if (birthYear) {
          enriched.generation = Math.floor((birthYear - 1900) / 25) + 1;
        } else {
          enriched.generation = null;
        }

        enriched.isAlive = !deathYear;

        callback(null, enriched);
      } catch (err) {
        callback(err);
      }
    }
  });
}

export function createNDJSONSerializeTransform() {
  return new Transform({
    objectMode: true,

    transform(obj, _encoding, callback) {
      try {
        callback(null, JSON.stringify(obj) + '\n');
      } catch (err) {
        callback(err);
      }
    }
  });
}

export function createNDJSONParseTransform() {
  let buffer = '';

  return new Transform({
    readableObjectMode: true,

    transform(chunk, _encoding, callback) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');

      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          this.push(JSON.parse(trimmed));
        } catch (err) {
          console.warn('treeStream: невалідний NDJSON рядок, пропускаємо:', trimmed.slice(0, 80));
        }
      }
      callback();
    },

    flush(callback) {
      const trimmed = buffer.trim();
      if (trimmed) {
        try { this.push(JSON.parse(trimmed)); } catch (_) {}
      }
      callback();
    }
  });
}

export function createFirestoreBatchWriter(db, treeId, { batchSize = 100 } = {}) {
  let batch    = [];
  let total    = 0;
  let batches  = 0;
  const allPeople = [];

  const stream = new Writable({
    objectMode: true,
    highWaterMark: batchSize,

    async write(person, _encoding, callback) {
      try {
        allPeople.push(person);
        batch.push(person);
        total++;

        if (batch.length >= batchSize) {
          await flushBatch();
        }
        callback();
      } catch (err) {
        callback(err);
      }
    },

    async final(callback) {
      try {
        if (batch.length > 0) await flushBatch();
        callback();
      } catch (err) {
        callback(err);
      }
    }
  });

  async function flushBatch() {
    batches++;
    console.log(`treeStream: зберігаємо пачку #${batches} (${batch.length} осіб, всього: ${total})`);

    await db.collection('trees').doc(treeId).update({
      people:    allPeople,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch = [];
  }

  const getStats = () => ({ total, batches });

  return { stream, getStats };
}

export async function* traverseTreeBFS(people, connections, startId, maxDepth = 10) {
  const byId    = new Map(people.map(p => [p.id, p]));
  const visited = new Set();
  const queue   = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift();

    if (visited.has(id) || depth > maxDepth) continue;
    visited.add(id);

    const person = byId.get(id);
    if (!person) continue;

    yield { person, depth };

    const neighbors = connections
      .filter(c => c.from === id || c.to === id)
      .map(c => (c.from === id ? c.to : c.from))
      .filter(nid => !visited.has(nid));

    for (const nid of neighbors) {
      queue.push({ id: nid, depth: depth + 1 });
    }

    await new Promise(r => setImmediate(r));
  }
}

export async function* analyzeInPages(source, pageSize = 20) {
  let page     = [];
  let pageNum  = 0;

  for await (const person of source) {
    page.push(person);

    if (page.length >= pageSize) {
      pageNum++;
      yield computePageStats(page, pageNum);
      page = [];
    }
  }

  if (page.length > 0) {
    pageNum++;
    yield computePageStats(page, pageNum);
  }
}

function computePageStats(people, pageNum) {
  const withBirth = people.filter(p => p.birthYear);
  const avgAge = withBirth.length
    ? Math.round(withBirth.reduce((s, p) => s + (p.age || 0), 0) / withBirth.length)
    : null;

  return {
    page:        pageNum,
    count:       people.length,
    male:        people.filter(p => p.gender === 'm').length,
    female:      people.filter(p => p.gender === 'f').length,
    alive:       people.filter(p => p.isAlive).length,
    avgAge,
    oldest:      withBirth.length ? withBirth.reduce((a, b) => (a.age > b.age ? a : b)).name : null,
    youngest:    withBirth.length ? withBirth.reduce((a, b) => (a.age < b.age ? a : b)).name : null,
    generations: [...new Set(people.map(p => p.generation).filter(Boolean))].sort((a, b) => a - b),
  };
}

export async function streamExportToResponse(db, treeId, res) {
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Stream-Format', 'ndjson-enriched');

 const doc = await db.collection('trees').doc(treeId).get();
  if (!doc.exists) { res.status(404).end(); return; }

  const treeData   = doc.data();
  const connections = treeData.connections || [];

  res.write(JSON.stringify({
    __type:       'tree-meta',
    id:           treeId,
    name:         treeData.name,
    totalPeople:  (treeData.people || []).length,
    totalConns:   connections.length,
    exportedAt:   new Date().toISOString(),
  }) + '\n');

  for (const conn of connections) {
    res.write(JSON.stringify({ __type: 'connection', ...conn }) + '\n');
  }
  
  const readStream   = createPeopleReadStream(db, treeId, { batchSize: 30 });
  const enrichStream = createEnrichTransform();
  const serializeStr = createNDJSONSerializeTransform();

  const typeTagStream = new Transform({
    objectMode: true,
    transform(obj, _, cb) { cb(null, { __type: 'person', ...obj }); }
  });

  await pipelineAsync(
    readStream,
    enrichStream,
    typeTagStream,
    serializeStr,
    res,
  );
}

export async function streamImportFromRequest(db, treeId, req) {
  const people      = [];
  const connections = [];
  let   meta        = null;

  const parseStream  = createNDJSONParseTransform();
  const enrichStream = createEnrichTransform();

  const collectStream = new Writable({
    objectMode: true,
    write(obj, _, callback) {
      if      (obj.__type === 'tree-meta')   meta = obj;
      else if (obj.__type === 'connection')  connections.push({ from: obj.from, to: obj.to, type: obj.type });
      else if (obj.__type === 'person')      people.push(obj);
      callback();
    }
  });

  await pipelineAsync(req, parseStream, enrichStream, collectStream);

  await db.collection('trees').doc(treeId).update({
    people,
    connections,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(meta?.name && { name: meta.name }),
  });

  return { importedPeople: people.length, importedConnections: connections.length };
}

export async function analyzeTree(db, treeId) {
  const doc = await db.collection('trees').doc(treeId).get();
  if (!doc.exists) throw new Error('Дерево не знайдено');

  const people      = doc.data().people      || [];
  const connections = doc.data().connections || [];

  async function* enrichedPeople() {
    const enrichTransform = createEnrichTransform();
    for (const person of people) {
      await new Promise(r => setImmediate(r));
      const enriched = await new Promise((resolve, reject) => {
        enrichTransform.once('data', resolve);
        enrichTransform.once('error', reject);
        enrichTransform.write(person);
      });
      if (enriched) yield enriched;
    }
  }

  const pageStats  = [];
  let   totalMale  = 0, totalFemale = 0, totalAlive = 0;
  let   ageSum     = 0, ageCount    = 0;
  const allGens    = new Set();

  for await (const stats of analyzeInPages(enrichedPeople(), 20)) {
    pageStats.push(stats);
    totalMale   += stats.male;
    totalFemale += stats.female;
    totalAlive  += stats.alive;
    if (stats.avgAge) { ageSum += stats.avgAge * stats.count; ageCount += stats.count; }
    stats.generations.forEach(g => allGens.add(g));
  }

  let maxDepth = 0;
  if (people.length > 0) {
    for await (const { depth } of traverseTreeBFS(people, connections, people[0].id)) {
      if (depth > maxDepth) maxDepth = depth;
    }
  }

  return {
    totalPeople:    people.length,
    totalMale,
    totalFemale,
    totalAlive,
    totalDeceased:  people.length - totalAlive,
    avgAge:         ageCount ? Math.round(ageSum / ageCount) : null,
    generations:    [...allGens].sort((a, b) => a - b),
    treeDepth:      maxDepth,
    totalConns:     connections.length,
    pagesProcessed: pageStats.length,
  };
}