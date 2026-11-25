// Firebase App Check: her Firebase isteğine "bu istek gerçek Sormix uygulamasından, gerçek bir cihazdan
// geliyor" belgesi eklenir. Sunucu ve Firebase (Firestore, Storage, Functions) belgesiz istekleri
// reddedebilir; böylece kurcalanmış programlar ve botlar sunucuya ulaşamaz.
//
// Nasıl çalışır:
//  - Belgeyi cihazın kendi (native) Firebase kütüphanesi alır: iOS'ta Apple App Attest,
//    Android'de Google Play Integrity.
//  - Uygulamanın kullandığı Firebase JavaScript kütüphanesi bu belgeyi "özel sağlayıcı" ile alır ve
//    her isteğe otomatik ekler. Belge doğrulaması Google tarafından yapılır.
//  - Burada hiçbir gizli anahtar yoktur; belge kısa ömürlüdür ve otomatik yenilenir.

import { Platform } from "react-native";
import * as Application from "expo-application";
import { getApp as yerelUygulama } from "@react-native-firebase/app";
import {
  initializeAppCheck as yerelAppCheckBaslat,
  getToken as yerelBelgeAl,
  ReactNativeFirebaseAppCheckProvider,
} from "@react-native-firebase/app-check";
import { initializeAppCheck, CustomProvider, getToken as jsBelgeAl } from "firebase/app-check";

const VARSAYILAN_OMUR_MS = 30 * 60 * 1000;

// Belgenin bitiş zamanı (JWT "exp"). Okunamazsa kısa bir varsayılan kullanılır; bu yalnızca yenileme
// zamanlamasıdır, güvenlik kararı değildir (belgeyi doğrulayan Google'dır).
const bitisZamani = (belge) => {
  try {
    const govde = belge.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const veri = JSON.parse(globalThis.atob(govde + "=".repeat((4 - (govde.length % 4)) % 4)));
    if (Number.isFinite(veri?.exp)) return veri.exp * 1000;
  } catch {}
  return Date.now() + VARSAYILAN_OMUR_MS;
};

// YALNIZCA geliştirme sürümünde ve YALNIZCA iOS simülatöründe: Apple App Attest simülatörde çalışmaz;
// Firebase'in resmi "debug" sağlayıcısına geçilir. Gizli kod koda yazılmaz: simülatördeki Firebase kendi
// rastgele kodunu üretip simülatörün içinde saklar; geliştirici bu kodu Console'da "debug token" olarak tanıtır.
// Simülatör tespiti: simülatör Apple bildirim sunucusuna (APNs) kaydolamaz, ortam değeri null döner.
// Mağaza sürümünde __DEV__ false olduğundan bu kod hiç çalışmaz: hem çağrı yeri hem fonksiyonun ilk satırı
// __DEV__ ile korunur (fonksiyonun kendisi pakette kalabilir; Release paketi denetiminde doğrulandı, 25 Kasım).
const simulatordeHataAyiklamaSaglayicisi = async (yerel) => {
  if (!__DEV__ || Platform.OS !== "ios") return;
  const apnsOrtami = await Application.getIosPushNotificationServiceEnvironmentAsync();
  if (apnsOrtami !== null) return; // gerçek cihaz: App Attest kullanılmaya devam eder
  const hataAyiklama = new ReactNativeFirebaseAppCheckProvider();
  hataAyiklama.configure({ apple: { provider: "debug" }, android: { provider: "debug" } });
  await yerel.initializeAppCheck({ provider: hataAyiklama, isTokenAutoRefreshEnabled: true });
};

let baslatildi = false;
let jsAppCheck = null;

// firebaseConfig.js'te, Firestore/Storage/Functions/Auth kullanılmadan önce bir kez çağrılır
export const appCheckBaslat = (jsUygulamasi) => {
  if (baslatildi) return;
  baslatildi = true;

  const saglayici = new ReactNativeFirebaseAppCheckProvider();
  saglayici.configure({
    // Uygulama iOS 15.1+ gerektirir; tüm bu cihazlar App Attest destekler (simülatör desteklemez)
    apple: { provider: "appAttest" },
    android: { provider: "playIntegrity" },
  });
  const yerel = yerelAppCheckBaslat(yerelUygulama(), {
    provider: saglayici,
    isTokenAutoRefreshEnabled: true,
  });

  if (__DEV__) {
    simulatordeHataAyiklamaSaglayicisi(yerel).catch((e) =>
      console.log("Simülatör App Check ayarı yapılamadı:", e?.message)
    );
  }

  jsAppCheck = initializeAppCheck(jsUygulamasi, {
    provider: new CustomProvider({
      getToken: async () => {
        const { token } = await yerelBelgeAl(yerel, false);
        return { token, expireTimeMillis: bitisZamani(token) };
      },
    }),
    isTokenAutoRefreshEnabled: true,
  });
};

// Firebase kütüphanesi dışından yapılan doğrudan Storage istekleri (dosya yükleme, indirme bağlantısı)
// App Check belgesini kendiliğinden taşımaz; bu başlık eklenmelidir. Belge kısa ömürlüdür, her istekte
// yeniden alınır (önbellekten gelir, ağ gerektirmez). Belge alınamazsa boş döner: zorunluluk açıkken
// istek sunucuda reddedilir, belge hiçbir zaman uydurulmaz.
export const appCheckBasligi = async () => {
  if (!jsAppCheck) return {};
  try {
    const { token } = await jsBelgeAl(jsAppCheck, false);
    return token ? { "X-Firebase-AppCheck": token } : {};
  } catch {
    return {};
  }
};
