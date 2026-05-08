import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// ─── Firebase ────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCarNJC1uHCXM-Pi69XGx_UVq79w3czYPA",
  authDomain: "family-tree-ce8a3.firebaseapp.com",
  projectId: "family-tree-ce8a3",
  storageBucket: "family-tree-ce8a3.firebasestorage.app",
  messagingSenderId: "304616447045",
  appId: "1:304616447045:web:1b98da8b6a0481c65d572c"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

const BASE_URL = 'http://localhost:4000/api';

// ─── API хелпер ───────────────────────────────────────────────────────────────
async function apiRequest(method, path, body = null) {
  const user = auth.currentUser;
  if (!user) throw new Error('Не авторизовано');
  const token = await user.getIdToken();
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(BASE_URL + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Помилка сервера');
  return data;
}

// ─── Стан авторизації — завантажити профіль ──────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'signIn.html';
    return;
  }
  try {
    const profile = await apiRequest('GET', '/me');
    fillProfileForm(profile);
  } catch (e) {
    // Бекенд недоступний — заповнюємо з Firebase Auth
    fillProfileForm({
      displayName: user.displayName || '',
      email:       user.email || '',
      photoURL:    user.photoURL || '',
    });
    console.warn('Бекенд недоступний:', e.message);
  }
});

// ─── Заповнити форму профілю ──────────────────────────────────────────────────
function fillProfileForm(profile) {
  const nameParts = (profile.displayName || '').split(' ');
  document.getElementById('firstName').value = nameParts[0] || '';
  document.getElementById('lastName').value  = nameParts.slice(1).join(' ') || '';
  document.getElementById('email').value     = profile.email || '';
  document.getElementById('bio').value       = profile.bio   || '';
  document.getElementById('dob').value       = profile.dob   || '';
  document.getElementById('phone').value     = profile.phone || '';

  // Аватар
  const img      = document.getElementById('avatarImg');
  const initials = document.getElementById('avatarInitials');
  if (profile.photoURL) {
    img.src = profile.photoURL;
    img.style.display    = 'block';
    initials.style.display = 'none';
  } else {
    const name = profile.displayName || 'Користувач';
    initials.textContent   = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    img.style.display      = 'none';
    initials.style.display = 'block';
  }

  // Зберігаємо оригінал для кнопки «Скасувати»
  window._originalProfile = {
    firstName: document.getElementById('firstName').value,
    lastName:  document.getElementById('lastName').value,
    bio:       document.getElementById('bio').value,
    dob:       document.getElementById('dob').value,
    phone:     document.getElementById('phone').value,
  };
}

// ─── Зберегти профіль ────────────────────────────────────────────────────────
async function saveProfile() {
  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();
  const bio       = document.getElementById('bio').value.trim();
  const dob       = document.getElementById('dob').value;
  const phone     = document.getElementById('phone').value.trim();

  const displayName = [firstName, lastName].filter(Boolean).join(' ');

  // Зміна пароля (якщо заповнені поля)
  const currentPass = document.querySelector('#sec-profile input[type="password"]:nth-of-type(1)').value;
  const newPass     = document.querySelector('#sec-profile input[type="password"]:nth-of-type(2)').value;
  const confirmPass = document.querySelector('#sec-profile input[type="password"]:nth-of-type(3)').value;

  if (newPass) {
    if (newPass !== confirmPass) { showToast('❌ Паролі не співпадають'); return; }
    if (newPass.length < 6)     { showToast('❌ Пароль мінімум 6 символів'); return; }
    if (!currentPass)           { showToast('❌ Введіть поточний пароль'); return; }
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPass);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPass);
    } catch (e) {
      showToast('❌ ' + friendlyError(e.code));
      return;
    }
  }

  try {
    await apiRequest('PATCH', '/me', { displayName, bio, dob, phone });
    showToast(T('toast.profileSaved'));
    window._originalProfile = { firstName, lastName, bio, dob, phone };
  } catch (e) {
    showToast('❌ Помилка збереження: ' + e.message);
  }
}

// ─── Скасувати зміни профілю ──────────────────────────────────────────────────
function resetProfile() {
  const p = window._originalProfile || {};
  document.getElementById('firstName').value = p.firstName || '';
  document.getElementById('lastName').value  = p.lastName  || '';
  document.getElementById('bio').value       = p.bio       || '';
  document.getElementById('dob').value       = p.dob       || '';
  document.getElementById('phone').value     = p.phone     || '';
}

// ─── Прев'ю аватара (base64) та збереження ────────────────────────────────────
function previewAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('❌ Файл занадто великий (макс 2 МБ)'); return; }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    document.getElementById('avatarImg').src        = dataUrl;
    document.getElementById('avatarImg').style.display    = 'block';
    document.getElementById('avatarInitials').style.display = 'none';

    try {
      await apiRequest('PATCH', '/me', { photoURL: dataUrl });
      showToast('🖼️ Фото оновлено ✓');
    } catch (err) {
      showToast('❌ Не вдалося зберегти фото');
    }
  };
  reader.readAsDataURL(file);
}

// ─── Небезпечна зона ─────────────────────────────────────────────────────────
let _dangerTarget = null;

function openDanger(type) {
  _dangerTarget = type;
  document.getElementById('dangerInput').value = '';
  const titles = { trees: 'Видалити всі дерева?', account: 'Видалити акаунт?' };
  const texts  = { trees: 'Усі ваші дерева та зв\'язки будуть видалені назавжди.', account: 'Акаунт та всі дані будуть видалені безповоротно.' };
  document.getElementById('dangerTitle').textContent = titles[type] || 'Підтвердіть дію';
  document.getElementById('dangerText').textContent  = texts[type]  || 'Ця дія незворотна.';
  document.getElementById('dangerModal').classList.add('open');
}

function closeDanger() {
  document.getElementById('dangerModal').classList.remove('open');
  _dangerTarget = null;
}

async function confirmDanger() {
  const input = document.getElementById('dangerInput').value.trim();
  if (input !== 'ВИДАЛИТИ') { showToast('❌ Введіть слово ВИДАЛИТИ'); return; }

  try {
    if (_dangerTarget === 'trees') {
      const trees = await apiRequest('GET', '/trees');
      for (const t of trees) {
        await apiRequest('DELETE', `/trees/${t.id}`);
      }
      showToast('🗑️ Всі дерева видалено ✓');
    } else if (_dangerTarget === 'account') {
      // Видаляємо всі дерева, потім акаунт Firebase
      try {
        const trees = await apiRequest('GET', '/trees');
        for (const t of trees) await apiRequest('DELETE', `/trees/${t.id}`);
      } catch (_) {}
      await deleteUser(auth.currentUser);
      window.location.href = 'signIn.html';
      return;
    }
  } catch (e) {
    showToast('❌ Помилка: ' + e.message);
  }
  closeDanger();
}

// ─── Вихід ────────────────────────────────────────────────────────────────────
async function logout() {
  await signOut(auth);
  window.location.href = 'signIn.html';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Сумісність зі старим кодом у settings.html
function save(msg) { showToast(msg); }

// ─── NAV ──────────────────────────────────────────────────────────────────────
function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  btn.classList.add('active');
}

// ─── THEME ────────────────────────────────────────────────────────────────────
const themes = {
  forest:  { '--bg':'#f5f0e8','--bg2':'#ede6d6','--green':'#3a6b4a','--green-light':'#5a8f6a','--green-pale':'#d4e8da','--brown':'#7a5c3a','--text':'#2c2218','--muted':'#7a6a55','--border':'#d8cdb8','--white':'#fff' },
  ocean:   { '--bg':'#e8f2f8','--bg2':'#d8eaf4','--green':'#2a6080','--green-light':'#3a80a8','--green-pale':'#c8e0ee','--brown':'#3a6878','--text':'#0f2a38','--muted':'#4a7088','--border':'#b8d4e4','--white':'#fff' },
  autumn:  { '--bg':'#fdf3e8','--bg2':'#f5e6d0','--green':'#a04020','--green-light':'#c05030','--green-pale':'#fde0cc','--brown':'#8a5020','--text':'#2a1408','--muted':'#8a5a3a','--border':'#e0c8a8','--white':'#fff' },
  night:   { '--bg':'#1a1f2e','--bg2':'#141824','--green':'#4a7acf','--green-light':'#6a9aef','--green-pale':'#1e2d4a','--brown':'#7a8aaa','--text':'#e0e8f8','--muted':'#8090b0','--border':'#2a3550','--white':'#1e2438' },
  rose:    { '--bg':'#fdf0f0','--bg2':'#f5e2e2','--green':'#a04060','--green-light':'#c05070','--green-pale':'#fde0e8','--brown':'#8a4050','--text':'#280a14','--muted':'#8a4a58','--border':'#e0c0c8','--white':'#fff' },
  sand:    { '--bg':'#f5f0e0','--bg2':'#ede4cc','--green':'#7a6030','--green-light':'#9a7840','--green-pale':'#e8dfc0','--brown':'#6a5028','--text':'#28200c','--muted':'#7a6840','--border':'#d8c898','--white':'#fff' },
};

function selectTheme(el) {
  document.querySelectorAll('.theme-option').forEach(t => t.classList.remove('selected'));
  el.classList.add('selected');
}

function applyTheme() {
  const selected = document.querySelector('.theme-option.selected');
  if (!selected) return;
  const name = selected.dataset.theme;
  const vars = themes[name];
  if (!vars) return;
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  localStorage.setItem('rodo-theme', name);
  showToast(T('toast.themeSaved').replace('{name}', selected.querySelector('.theme-label').textContent.trim()));
}

// ─── TRANSLATIONS ─────────────────────────────────────────────────────────────
const i18n = {
  uk: {
    "nav.back":"← На головну","nav.profile":"Профіль","nav.appearance":"Вигляд",
    "nav.notifications":"Сповіщення","nav.privacy":"Приватність","nav.data":"Дані","nav.danger":"Небезпечна зона",
    "page.title":"Налаштування","page.sub":"Управляйте своїм акаунтом та персоналізуйте Родовід",
    "profile.title":"Профіль","profile.desc":"Ваше ім'я та особиста інформація",
    "profile.firstName":"Ім'я","profile.lastName":"Прізвище","profile.email":"Електронна пошта",
    "profile.bio":"Про себе","profile.dob":"Дата народження","profile.phone":"Телефон",
    "profile.changePass":"Змінити пароль","profile.passHint":"Залиште порожнім, якщо не хочете змінювати",
    "profile.currentPass":"Поточний пароль","profile.newPass":"Новий пароль","profile.confirmPass":"Підтвердження",
    "appear.title":"Вигляд","appear.desc":"Тема та мова інтерфейсу",
    "appear.themeLabel":"Тема кольорів","appear.langLabel":"Мова інтерфейсу",
    "notif.title":"Сповіщення","notif.desc":"Керуйте тим, що і як вам надходить",
    "notif.email":"Email-сповіщення","notif.emailDesc":"Отримувати важливі оновлення на пошту",
    "notif.shared":"Нові спільні дерева","notif.sharedDesc":"Коли хтось запрошує вас до дерева",
    "notif.changes":"Зміни від учасників","notif.changesDesc":"Коли хтось редагує спільне дерево",
    "notif.bday":"Нагадування про дні народження","notif.bdayDesc":"Сповіщення за день до дати народження",
    "notif.marketing":"Маркетингові листи","notif.marketingDesc":"Поради, новини та оновлення продукту",
    "priv.title":"Приватність","priv.desc":"Контролюйте, хто що бачить",
    "priv.public":"Публічний профіль","priv.publicDesc":"Інші користувачі можуть знайти вас у пошуку",
    "priv.showDob":"Відображати дату народження","priv.showDobDesc":"Видимо для учасників спільних дерев",
    "priv.invites":"Дозволити запрошення","priv.invitesDesc":"Інші можуть запрошувати вас до дерев",
    "priv.2fa":"Двофакторна автентифікація","priv.2faDesc":"Підвищений захист акаунту",
    "priv.visibility":"Хто може переглядати ваші дерева",
    "data.title":"Дані та експорт","data.desc":"Управляйте своїми даними та деревами",
    "data.autosave":"Автозбереження","data.autosaveDesc":"Автоматично зберігати зміни кожні 5 хвилин",
    "data.backup":"Резервні копії","data.backupDesc":"Щотижнева резервна копія у хмарі",
    "data.exportTitle":"Експорт даних","data.exportDesc":"Завантажте своє дерево у різних форматах",
    "data.importTitle":"Імпорт","data.importDesc":"Завантажте існуюче дерево у форматі GEDCOM",
    "danger.title":"Небезпечна зона","danger.desc":"Незворотні дії — будьте обережні",
    "danger.deleteTrees":"Видалити всі дерева","danger.deleteTreesDesc":"Усі ваші дерева та зв'язки будуть видалені назавжди",
    "danger.deleteTreesBtn":"Видалити дерева",
    "danger.logoutAll":"Вийти з усіх пристроїв","danger.logoutAllDesc":"Завершити всі активні сесії, крім поточної",
    "danger.logoutAllBtn":"Вийти скрізь",
    "danger.deleteAccount":"Видалити акаунт","danger.deleteAccountDesc":"Акаунт та всі дані будуть видалені безповоротно",
    "danger.deleteAccountBtn":"Видалити акаунт",
    "modal.confirm":"Підтвердіть дію","modal.irreversible":"Ця дія незворотна.",
    "btn.cancel":"Скасувати","btn.confirm":"Підтвердити","btn.save":"Зберегти",
    "btn.apply":"Застосувати","btn.saveChanges":"Зберегти зміни",
    "toast.profileSaved":"Профіль збережено ✓","toast.saved":"Налаштування збережено ✓",
    "toast.loggedOut":"Всі сесії завершено ✓","toast.themeSaved":"Тему «{name}» застосовано ✓",
    "toast.langSaved":"Мову змінено на «{name}» ✓",
  },
  en: {
    "nav.back":"← Back to home","nav.profile":"Profile","nav.appearance":"Appearance",
    "nav.notifications":"Notifications","nav.privacy":"Privacy","nav.data":"Data","nav.danger":"Danger zone",
    "page.title":"Settings","page.sub":"Manage your account and personalise Rodovid",
    "profile.title":"Profile","profile.desc":"Your name and personal information",
    "profile.firstName":"First name","profile.lastName":"Last name","profile.email":"Email address",
    "profile.bio":"About me","profile.dob":"Date of birth","profile.phone":"Phone",
    "profile.changePass":"Change password","profile.passHint":"Leave blank if you don't want to change it",
    "profile.currentPass":"Current password","profile.newPass":"New password","profile.confirmPass":"Confirm",
    "appear.title":"Appearance","appear.desc":"Theme and interface language",
    "appear.themeLabel":"Colour theme","appear.langLabel":"Interface language",
    "notif.title":"Notifications","notif.desc":"Manage what and how you receive",
    "notif.email":"Email notifications","notif.emailDesc":"Receive important updates by email",
    "notif.shared":"New shared trees","notif.sharedDesc":"When someone invites you to a tree",
    "notif.changes":"Member changes","notif.changesDesc":"When someone edits a shared tree",
    "notif.bday":"Birthday reminders","notif.bdayDesc":"Notifications one day before a birthday",
    "notif.marketing":"Marketing emails","notif.marketingDesc":"Tips, news and product updates",
    "priv.title":"Privacy","priv.desc":"Control who sees what",
    "priv.public":"Public profile","priv.publicDesc":"Other users can find you in search",
    "priv.showDob":"Show date of birth","priv.showDobDesc":"Visible to members of shared trees",
    "priv.invites":"Allow invitations","priv.invitesDesc":"Others can invite you to trees",
    "priv.2fa":"Two-factor authentication","priv.2faDesc":"Enhanced account security",
    "priv.visibility":"Who can view your trees",
    "data.title":"Data & export","data.desc":"Manage your data and trees",
    "data.autosave":"Auto-save","data.autosaveDesc":"Automatically save changes every 5 minutes",
    "data.backup":"Backups","data.backupDesc":"Weekly cloud backup",
    "data.exportTitle":"Export data","data.exportDesc":"Download your tree in various formats",
    "data.importTitle":"Import","data.importDesc":"Upload an existing tree in GEDCOM format",
    "danger.title":"Danger zone","danger.desc":"Irreversible actions — be careful",
    "danger.deleteTrees":"Delete all trees","danger.deleteTreesDesc":"All your trees and connections will be deleted permanently",
    "danger.deleteTreesBtn":"Delete trees",
    "danger.logoutAll":"Log out of all devices","danger.logoutAllDesc":"End all active sessions except the current one",
    "danger.logoutAllBtn":"Log out everywhere",
    "danger.deleteAccount":"Delete account","danger.deleteAccountDesc":"Account and all data will be permanently deleted",
    "danger.deleteAccountBtn":"Delete account",
    "modal.confirm":"Confirm action","modal.irreversible":"This action is irreversible.",
    "btn.cancel":"Cancel","btn.confirm":"Confirm","btn.save":"Save",
    "btn.apply":"Apply","btn.saveChanges":"Save changes",
    "toast.profileSaved":"Profile saved ✓","toast.saved":"Settings saved ✓",
    "toast.loggedOut":"All sessions ended ✓","toast.themeSaved":"Theme «{name}» applied ✓",
    "toast.langSaved":"Language changed to «{name}» ✓",
  },
};

let currentLang = localStorage.getItem('rodo-lang') || 'uk';
function T(key) { return (i18n[currentLang] || i18n.uk)[key] || key; }

function applyTranslations(lang) {
  const t = i18n[lang] || i18n.uk;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });
  document.documentElement.lang = lang;
}

function selectLang(el) {
  document.querySelectorAll('.lang-option').forEach(l => l.classList.remove('selected'));
  el.classList.add('selected');
}

function applyLang() {
  const selected = document.querySelector('.lang-option.selected');
  if (!selected) return;
  const flags = { '🇺🇦': 'uk', '🇬🇧': 'en', '🇩🇪': 'de', '🇵🇱': 'pl' };
  const flagEl = selected.querySelector('.lang-flag');
  const code = flags[flagEl ? flagEl.textContent.trim() : '🇺🇦'] || 'uk';
  currentLang = code;
  applyTranslations(code);
  localStorage.setItem('rodo-lang', code);
  const langNames = { uk: 'Українська', en: 'English', de: 'Deutsch', pl: 'Polski' };
  showToast(T('toast.langSaved').replace('{name}', langNames[code]));
}

function importFile(input) {
  const file = input.files[0];
  if (!file) return;
  showToast('📂 Файл «' + file.name + '» завантажено ✓');
}

// ─── Помилки Firebase Auth ────────────────────────────────────────────────────
function friendlyError(code) {
  const map = {
    'auth/wrong-password':    'Невірний поточний пароль',
    'auth/too-many-requests': 'Забагато спроб. Зачекайте',
    'auth/requires-recent-login': 'Будь ласка, увійдіть знову перед цією дією',
  };
  return map[code] || 'Сталася помилка: ' + code;
}

// ─── Ініціалізація збережених налаштувань ─────────────────────────────────────
(function init() {
  // Тема
  const savedTheme = localStorage.getItem('rodo-theme');
  if (savedTheme && themes[savedTheme]) {
    document.querySelectorAll('.theme-option').forEach(t => {
      t.classList.toggle('selected', t.dataset.theme === savedTheme);
    });
    Object.entries(themes[savedTheme]).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }
  // Мова
  const savedLang = localStorage.getItem('rodo-lang') || 'uk';
  currentLang = savedLang;
  const flagMap = { uk: '🇺🇦', en: '🇬🇧', de: '🇩🇪', pl: '🇵🇱' };
  document.querySelectorAll('.lang-option').forEach(l => {
    const flag = l.querySelector('.lang-flag');
    if (flag) l.classList.toggle('selected', flag.textContent.trim() === flagMap[savedLang]);
  });
  applyTranslations(savedLang);
})();

// ─── Глобальні функції для onclick у HTML ─────────────────────────────────────
window.showSection   = showSection;
window.selectTheme   = selectTheme;
window.applyTheme    = applyTheme;
window.selectLang    = selectLang;
window.applyLang     = applyLang;
window.previewAvatar = previewAvatar;
window.resetProfile  = resetProfile;
window.openDanger    = openDanger;
window.closeDanger   = closeDanger;
window.confirmDanger = confirmDanger;
window.importFile    = importFile;
window.save          = save; // сумісність для кнопок у HTML

// Кнопка «Зберегти зміни» профілю
document.querySelector('#sec-profile .btn-primary[data-i18n="btn.saveChanges"]')
  ?.addEventListener('click', saveProfile);

// Кнопка «Вийти скрізь» → просто logout
document.querySelector('[data-i18n="danger.logoutAllBtn"]')
  ?.addEventListener('click', async () => {
    await logout();
  });