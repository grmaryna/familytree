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