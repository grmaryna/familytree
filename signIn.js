import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

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
const googleProvider = new GoogleAuthProvider();

const BASE_URL = 'http://localhost:4000/api';

// ─── Після входу: синхронізувати профіль з бекендом ──────────────────────────
async function onLoginSuccess() {
  try {
    const token = await auth.currentUser.getIdToken();

    // Повідомляємо бекенд про нового/поточного користувача
    await fetch(`${BASE_URL}/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (e) {
    console.warn('Бекенд недоступний, продовжуємо без нього:', e.message);
  }

  window.location.href = 'main.html';
}

// ─── Таби ─────────────────────────────────────────────────────────────────────
const signinForm  = document.getElementById('signinForm');
const registerForm = document.getElementById('registerForm');
const tabSignin   = document.getElementById('tabSignin');
const tabRegister = document.getElementById('tabRegister');

tabSignin.onclick = () => {
  signinForm.style.display   = 'block';
  registerForm.style.display = 'none';
  tabSignin.classList.add('active');
  tabRegister.classList.remove('active');
};

tabRegister.onclick = () => {
  signinForm.style.display   = 'none';
  registerForm.style.display = 'block';
  tabRegister.classList.add('active');
  tabSignin.classList.remove('active');
};

// ─── Показ пароля ─────────────────────────────────────────────────────────────
window.togglePass = function(id, btn) {
  const input = document.getElementById(id);
  input.type  = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '👁' : '🙈';
};

// ─── Вхід ─────────────────────────────────────────────────────────────────────
document.getElementById('signinBtn').onclick = async () => {
  const email    = document.getElementById('siEmail').value.trim();
  const password = document.getElementById('siPass').value;
  const errBanner = document.getElementById('siError');

  errBanner.textContent = '';
  errBanner.classList.remove('show');

  if (!email || !password) {
    errBanner.textContent = 'Заповніть всі поля';
    errBanner.classList.add('show');
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    await onLoginSuccess();
  } catch (error) {
    errBanner.textContent = friendlyError(error.code);
    errBanner.classList.add('show');
  }
};

// ─── Реєстрація ───────────────────────────────────────────────────────────────
document.getElementById('registerBtn').onclick = async () => {
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPass').value;
  const password2 = document.getElementById('regPass2').value;
  const errBanner = document.getElementById('regError');

  errBanner.textContent = '';
  errBanner.classList.remove('show');

  if (!name || !email || !password) {
    errBanner.textContent = "Заповніть всі поля";
    errBanner.classList.add('show');
    return;
  }

  if (password !== password2) {
    errBanner.textContent = "Паролі не співпадають";
    errBanner.classList.add('show');
    return;
  }

  if (password.length < 6) {
    errBanner.textContent = "Пароль мінімум 6 символів";
    errBanner.classList.add('show');
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Зберігаємо ім'я в Firebase Auth
    await updateProfile(userCredential.user, { displayName: name });

    // Зберігаємо профіль на бекенді
    try {
      const token = await userCredential.user.getIdToken();
      await fetch(`${BASE_URL}/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ displayName: name })
      });
    } catch (e) {
      console.warn('Бекенд недоступний:', e.message);
    }

    window.location.href = 'main.html';

  } catch (error) {
    errBanner.textContent = friendlyError(error.code);
    errBanner.classList.add('show');
  }
};

// ─── Google ───────────────────────────────────────────────────────────────────
async function googleLogin() {
  try {
    await signInWithPopup(auth, googleProvider);
    await onLoginSuccess();
  } catch (error) {
    alert(friendlyError(error.code));
  }
}

document.getElementById('googleLoginBtn').onclick   = googleLogin;
document.getElementById('googleRegisterBtn').onclick = googleLogin;

// ─── Відновлення пароля ───────────────────────────────────────────────────────
document.getElementById('forgotBtnLink').onclick = async (e) => {
  e.preventDefault();
  const email = prompt('Введіть email для відновлення пароля');
  if (!email) return;

  try {
    await sendPasswordResetEmail(auth, email);
    alert('✅ Лист для відновлення надіслано на ' + email);
  } catch (error) {
    alert(friendlyError(error.code));
  }
};

// ─── Людські повідомлення про помилки ─────────────────────────────────────────
function friendlyError(code) {
  const messages = {
    'auth/user-not-found':      'Користувача з таким email не існує',
    'auth/wrong-password':      'Невірний пароль',
    'auth/email-already-in-use':'Цей email вже зареєстрований',
    'auth/invalid-email':       'Невірний формат email',
    'auth/too-many-requests':   'Забагато спроб. Зачекайте хвилину',
    'auth/weak-password':       'Пароль занадто простий',
    'auth/invalid-credential':  'Невірний email або пароль',
    'auth/popup-closed-by-user':'Вхід через Google скасовано',
  };
  return messages[code] || 'Сталася помилка. Спробуйте ще раз';
}