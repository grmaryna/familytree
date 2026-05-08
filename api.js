/**
 * api.js — клієнтський хелпер для роботи з бекендом
 * Підключай у будь-якому JS файлі:
 *   import { api } from './api.js';
 */

import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const BASE_URL = 'http://localhost:4000/api';

/**
 * Надсилає запит до бекенду з Firebase токеном у заголовку.
 */
async function request(method, path, body = null) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) throw new Error('Користувач не авторизований');

  const token = await user.getIdToken();

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(BASE_URL + path, options);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Помилка сервера');

  return data;
}

// ─── API методи ───────────────────────────────────────────────────────────────

export const api = {
  // Профіль
  getMe:        ()           => request('GET',   '/me'),
  updateMe:     (data)       => request('PATCH',  '/me', data),

  // Дерева
  getTrees:     ()           => request('GET',   '/trees'),
  createTree:   (name)       => request('POST',  '/trees', { name }),
  getTree:      (id)         => request('GET',   `/trees/${id}`),
  saveTree:     (id, data)   => request('PUT',   `/trees/${id}`, data),
  deleteTree:   (id)         => request('DELETE', `/trees/${id}`),
};