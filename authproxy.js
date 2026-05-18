import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const BASE_URL = 'http://localhost:4000/api';
const MAX_RPS  = 10;

const _timestamps = [];

function _checkRateLimit() {
  const now = Date.now();
  while (_timestamps.length && _timestamps[0] <= now - 1000) _timestamps.shift();
  if (_timestamps.length >= MAX_RPS) {
    throw new Error(`Rate limit: не більше ${MAX_RPS} запитів/сек`);
  }
  _timestamps.push(now);
}

const strategies = {
  jwt: async (force = false) => {
    const user = getAuth().currentUser;
    if (!user) throw new Error('Користувач не авторизований');
    const token = await user.getIdToken(force);
    return { Authorization: `Bearer ${token}` };
  },

  apiKey: async () => {
    const key = window.__API_KEY;
    if (!key) throw new Error('API ключ не задано (window.__API_KEY)');
    return { 'X-API-Key': key };
  },

  oauth: async () => {
    const token = sessionStorage.getItem('oauth_access_token');
    if (!token) throw new Error('OAuth токен не знайдено');
    return { Authorization: `Bearer ${token}` };
  },
};

let _activeStrategy = 'jwt';

export function setStrategy(name) {
  if (!strategies[name]) throw new Error(`Невідома стратегія: ${name}`);
  _activeStrategy = name;
}

export async function request(method, path, body = null, opts = {}) {
  _checkRateLimit();
  return _doRequest(method, path, body, opts, false);
}

async function _doRequest(method, path, body, opts, isRetry) {
  const authHeaders = await strategies[_activeStrategy](isRetry);
  const headers     = { 'Content-Type': 'application/json', ...authHeaders, ...(opts.headers || {}) };
  const fetchOpts   = { method, headers, ...opts };
  if (body !== null) fetchOpts.body = JSON.stringify(body);

  const res = await fetch(BASE_URL + path, fetchOpts);

  // Retry тільки для JWT (apiKey/oauth не оновлюються автоматично)
  if (res.status === 401 && !isRetry && _activeStrategy === 'jwt') {
    return _doRequest(method, path, body, opts, true);
  }

  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function requestStream(method, path, rawBody = null, extraHeaders = {}) {
  _checkRateLimit();

  const authHeaders = await strategies[_activeStrategy]();
  const headers     = { ...authHeaders, ...extraHeaders };
  const fetchOpts   = { method, headers };
  if (rawBody !== null) fetchOpts.body = rawBody;

  const res = await fetch(BASE_URL + path, fetchOpts);

  if (res.status === 401 && _activeStrategy === 'jwt') {
    const freshHeaders = await strategies.jwt(true);
    const retryOpts    = { method, headers: { ...freshHeaders, ...extraHeaders } };
    if (rawBody !== null) retryOpts.body = rawBody;
    return fetch(BASE_URL + path, retryOpts);
  }

  return res;
}