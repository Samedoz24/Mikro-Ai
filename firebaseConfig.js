import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // 👈 Eksik olan parça buydu!

// 🔐 Giriş bilgilerinin kalıcı olması için gerekli araçlar
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCHRIo3u_-QCQOdv1O7YZAEdoR6f3TiaLs",
  authDomain: "project-21-3e377.firebaseapp.com",
  projectId: "project-21-3e377",
  storageBucket: "project-21-3e377.firebasestorage.app",
  messagingSenderId: "758732204910",
  appId: "1:758732204910:web:d9b40d45ac4b312e842f7f",
};

// Uygulamayı başlat
const app = initializeApp(firebaseConfig);

// 🧠 Hafızayı (Persistence) aktif ederek Auth'u başlat
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);
const storage = getStorage(app); // 👈 Depoyu tanımladık

export { auth, db, storage };
