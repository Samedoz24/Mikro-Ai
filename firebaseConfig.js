import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCHRIo3u_-QCQOdv1O7YZAEdoR6f3TiaLs",
  authDomain: "project-21-3e377.firebaseapp.com",
  projectId: "project-21-3e377",
  storageBucket: "project-21-3e377.firebasestorage.app",
  messagingSenderId: "758732204910",
  appId: "1:758732204910:web:d9b40d45ac4b312e842f7f",
};

// 🛡️ Uygulama zaten başlatıldıysa olanı al, yoksa yeni başlat
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  auth = getAuth(app);
}

// 🔄 ÇÖZÜM: Hata veren çevrimdışı bellek denemesi silindi, orijinal hatasız koda dönüldü
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
