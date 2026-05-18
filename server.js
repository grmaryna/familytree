import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { streamExportToResponse, streamImportFromRequest, analyzeTree } from './Treestream.js';
import { authMiddleware } from './authmiddleware.js';

const serviceAccount = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db  = admin.firestore();
const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} не дозволений`));
  },
  credentials: true,
}));

app.use('/api', authMiddleware);

const jsonRouter = express.Router();
jsonRouter.use(express.json({ limit: '2mb' }));

jsonRouter.get('/me', async (req, res) => {
  try {
    const doc          = await db.collection('users').doc(req.user.uid).get();
    const firebaseUser = await admin.auth().getUser(req.user.uid);
    res.json({ uid: req.user.uid, email: firebaseUser.email, displayName: firebaseUser.displayName, photoURL: firebaseUser.photoURL, ...(doc.exists ? doc.data() : {}) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

jsonRouter.patch('/me', async (req, res) => {
  try {
    const { displayName, photoURL } = req.body;
    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (photoURL)    updates.photoURL    = photoURL;
    if (Object.keys(updates).length) await admin.auth().updateUser(req.user.uid, updates);
    await db.collection('users').doc(req.user.uid).set(
      { ...req.body, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

jsonRouter.get('/trees', async (req, res) => {
  try {
    const snap = await db.collection('trees').where('ownerId', '==', req.user.uid).orderBy('updatedAt', 'desc').get();
    res.json(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

jsonRouter.post('/trees', async (req, res) => {
  try {
    const { name = 'Моє сімейне дерево' } = req.body;
    const ref = await db.collection('trees').add({ name, ownerId: req.user.uid, people: [], connections: [], createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.status(201).json({ id: ref.id, name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

jsonRouter.get('/trees/:id', async (req, res) => {
  try {
    const doc = await db.collection('trees').doc(req.params.id).get();
    if (!doc.exists)                         return res.status(404).json({ error: 'Дерево не знайдено' });
    if (doc.data().ownerId !== req.user.uid) return res.status(403).json({ error: 'Немає доступу' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

jsonRouter.put('/trees/:id', async (req, res) => {
  try {
    const ref = db.collection('trees').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists)                         return res.status(404).json({ error: 'Дерево не знайдено' });
    if (doc.data().ownerId !== req.user.uid) return res.status(403).json({ error: 'Немає доступу' });
    const { name, people, connections } = req.body;
    await ref.update({ ...(name !== undefined && { name }), ...(people !== undefined && { people }), ...(connections !== undefined && { connections }), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

jsonRouter.delete('/trees/:id', async (req, res) => {
  try {
    const ref = db.collection('trees').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists)                         return res.status(404).json({ error: 'Дерево не знайдено' });
    if (doc.data().ownerId !== req.user.uid) return res.status(403).json({ error: 'Немає доступу' });
    await ref.delete();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use('/api', jsonRouter);

app.get('/api/trees/:id/export-stream', async (req, res) => {
  try {
    const doc = await db.collection('trees').doc(req.params.id).get();
    if (!doc.exists)                         return res.status(404).json({ error: 'Дерево не знайдено' });
    if (doc.data().ownerId !== req.user.uid) return res.status(403).json({ error: 'Немає доступу' });
    await streamExportToResponse(db, req.params.id, res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
});

app.post('/api/trees/:id/import-stream', async (req, res) => {
  try {
    const doc = await db.collection('trees').doc(req.params.id).get();
    if (!doc.exists)                         return res.status(404).json({ error: 'Дерево не знайдено' });
    if (doc.data().ownerId !== req.user.uid) return res.status(403).json({ error: 'Немає доступу' });
    const stats = await streamImportFromRequest(db, req.params.id, req);
    res.json({ ok: true, ...stats });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
});

app.get('/api/trees/:id/analyze', async (req, res) => {
  try {
    const doc = await db.collection('trees').doc(req.params.id).get();
    if (!doc.exists)                         return res.status(404).json({ error: 'Дерево не знайдено' });
    if (doc.data().ownerId !== req.user.uid) return res.status(403).json({ error: 'Немає доступу' });
    const stats = await analyzeTree(db, req.params.id);
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Сервер запущено на http://localhost:${PORT}`));