import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDQsG6kopkuVTiKknvOnT49QyutCtZA-q0",
  authDomain: "storemanagement-6b2b9.firebaseapp.com",
  projectId: "storemanagement-6b2b9",
  storageBucket: "storemanagement-6b2b9.firebasestorage.app",
  messagingSenderId: "133327872406",
  appId: "1:133327872406:web:d8e4e14b799510cf22fdb7"
};

// Inisialisasi Firebase
// Kita menggunakan pengecekan getApps() agar tidak terjadi error inisialisasi ulang saat hot-reload Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, app };