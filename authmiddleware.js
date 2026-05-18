import admin from 'firebase-admin';

const RATE_LIMIT     = 60;
const RATE_WINDOW_MS = 60 * 1000;
const _rateCounts    = new Map();

function _checkRateLimit(uid) {
  const now  = Date.now();
  const hits = (_rateCounts.get(uid) || []).filter(t => t > now - RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) return false;
  hits.push(now);
  _rateCounts.set(uid, hits);
  return true;
}

const PUBLIC_PATHS = ['/health'];

const strategies = {
  jwt: async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.split('Bearer ')[1];
    return admin.auth().verifyIdToken(token);
  },

  apiKey: async (req) => {
    const key = req.headers['x-api-key'];
    if (!key || key !== process.env.SERVER_API_KEY) return null;
    return { uid: 'api-key-client', api_key: true };
  },
};

export async function authMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const ms  = Date.now() - start;
    const uid = req.user?.uid ?? 'anonymous';
    console.log(`[API] ${req.method} ${req.path} | ${res.statusCode} | ${ms}ms | uid:${uid}`);
  });

  if (PUBLIC_PATHS.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    return next();
  }

  let decoded = null;

  try {
    decoded = await strategies.jwt(req);
  } catch {
    return res.status(401).json({ error: 'Невалідний або прострочений токен' });
  }

  if (!decoded) {
    try { decoded = await strategies.apiKey(req); } catch { /* ігнорується */ }
  }

  if (!decoded) {
    return res.status(401).json({ error: 'Немає токена авторизації' });
  }

  if (!_checkRateLimit(decoded.uid)) {
    return res.status(429).json({ error: `Забагато запитів. Ліміт: ${RATE_LIMIT}/хв` });
  }

  req.user = decoded;
  next();
}