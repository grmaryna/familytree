import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// ─── Firebase Admin ───────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(
  readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];

app.use(cors({
  origin: (origin, cb) => {
    // Дозволяємо запити без origin (наприклад, Postman) та з дозволених origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} не дозволений`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

// ─── Middleware: перевірка Firebase токена ────────────────────────────────────
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Немає токена авторизації' });
  }

  const token = header.split('Bearer ')[1];

  try {
    req.user = await admin.auth().verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Невалідний або прострочений токен' });
  }
}

// ─── Маршрути ─────────────────────────────────────────────────────────────────

// GET /api/me — профіль поточного користувача
app.get('/api/me', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).get();
    const firebaseUser = await admin.auth().getUser(req.user.uid);

    res.json({
      uid: req.user.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      ...(doc.exists ? doc.data() : {}),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/me — оновити профіль
app.patch('/api/me', requireAuth, async (req, res) => {
  try {
    const { displayName, photoURL } = req.body;

    // Оновлюємо в Firebase Auth
    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (photoURL)    updates.photoURL    = photoURL;
    if (Object.keys(updates).length) {
      await admin.auth().updateUser(req.user.uid, updates);
    }

    // Зберігаємо додаткові дані у Firestore
    await db.collection('users').doc(req.user.uid).set(
      { ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Дерева ───────────────────────────────────────────────────────────────────

// GET /api/trees — список усіх дерев користувача
app.get('/api/trees', requireAuth, async (req, res) => {
  try {
    const snap = await db
      .collection('trees')
      .where('ownerId', '==', req.user.uid)
      .orderBy('updatedAt', 'desc')
      .get();

    const trees = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(trees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trees — створити нове дерево
app.post('/api/trees', requireAuth, async (req, res) => {
  try {
    const { name = 'Моє сімейне дерево' } = req.body;

    const ref = await db.collection('trees').add({
      name,
      ownerId: req.user.uid,
      people: [],
      connections: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({ id: ref.id, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trees/:id — завантажити конкретне дерево
app.get('/api/trees/:id', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('trees').doc(req.params.id).get();

    if (!doc.exists) return res.status(404).json({ error: 'Дерево не знайдено' });
    if (doc.data().ownerId !== req.user.uid) return res.status(403).json({ error: 'Немає доступу' });

    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/trees/:id — зберегти дерево (people + connections + name)
app.put('/api/trees/:id', requireAuth, async (req, res) => {
  try {
    const ref = db.collection('trees').doc(req.params.id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ error: 'Дерево не знайдено' });
    if (doc.data().ownerId !== req.user.uid) return res.status(403).json({ error: 'Немає доступу' });

    const { name, people, connections } = req.body;

    await ref.update({
      ...(name        !== undefined && { name }),
      ...(people      !== undefined && { people }),
      ...(connections !== undefined && { connections }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/trees/:id — видалити дерево
app.delete('/api/trees/:id', requireAuth, async (req, res) => {
  try {
    const ref = db.collection('trees').doc(req.params.id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ error: 'Дерево не знайдено' });
    if (doc.data().ownerId !== req.user.uid) return res.status(403).json({ error: 'Немає доступу' });

    await ref.delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Старт ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Сервер запущено на http://localhost:${PORT}`);
});