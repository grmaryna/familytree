import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const BASE_URL = 'http://localhost:4000/api';

async function _getJwtHeaders(force = false) {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Користувач не авторизований');
  const token = await user.getIdToken(force);
  return { Authorization: `Bearer ${token}` };
}

export async function request(method, path, body = null, opts = {}) {
  return _doRequest(method, path, body, opts, false);
}

async function _doRequest(method, path, body, opts, isRetry) {
  const authHeaders = await _getJwtHeaders(isRetry);

  const headers   = { 'Content-Type': 'application/json', ...authHeaders, ...(opts.headers || {}) };
  const fetchOpts = { method, headers, ...opts };
  if (body !== null) fetchOpts.body = JSON.stringify(body);

  const res = await fetch(BASE_URL + path, fetchOpts);

  if (res.status === 401 && !isRetry) {
    return _doRequest(method, path, body, opts, true);
  }

  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function requestStream(method, path, rawBody = null, extraHeaders = {}) {
  const authHeaders = await _getJwtHeaders();
  const headers     = { ...authHeaders, ...extraHeaders };
  const fetchOpts   = { method, headers };
  if (rawBody !== null) fetchOpts.body = rawBody;

  const res = await fetch(BASE_URL + path, fetchOpts);

  if (res.status === 401) {
    const freshHeaders = await _getJwtHeaders(true);
    const retryOpts    = { method, headers: { ...freshHeaders, ...extraHeaders } };
    if (rawBody !== null) retryOpts.body = rawBody;
    return fetch(BASE_URL + path, retryOpts);
  }

  return res;
}