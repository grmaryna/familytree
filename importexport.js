import { initializeApp }          from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCarNJC1uHCXM-Pi69XGx_UVq79w3czYPA",
  authDomain:        "family-tree-ce8a3.firebaseapp.com",
  projectId:         "family-tree-ce8a3",
  storageBucket:     "family-tree-ce8a3.firebasestorage.app",
  messagingSenderId: "304616447045",
  appId:             "1:304616447045:web:1b98da8b6a0481c65d572c",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

const BASE_URL = 'http://localhost:4000/api';

async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Не авторизовано');
  return user.getIdToken();
}
