// Firebase App Check: her Firebase isteğine "bu istek gerçek Mikro uygulamasından, gerçek bir cihazdan
// geliyor" belgesi eklenir. Sunucu ve Firebase (Firestore, Storage, Functions) belgesiz istekleri
// reddedebilir; böylece kurcalanmış programlar ve botlar sunucuya ulaşamaz.
//
// Nasıl çalışır:
//  - Belgeyi cihazın kendi (native) Firebase kütüphanesi alır: iOS'ta Apple App Attest,
//    Android'de Google Play Integrity.
//  - Uygulamanın kullandığı Firebase JavaScript kütüphanesi bu belgeyi "özel sağlayıcı" ile alır ve
//    her isteğe otomatik ekler. Belge doğrulaması Google tarafından yapılır.
//  - Burada hiçbir gizli anahtar yoktur; belge kısa ömürlüdür ve otomatik yenilenir.

import { getApp as yerelUygulama } from "@react-native-firebase/app";
import {
  initializeAppCheck as yerelAppCheckBaslat,
  getToken as yerelBelgeAl,
  ReactNativeFirebaseAppCheckProvider,
} from "@react-native-firebase/app-check";
import { initializeAppCheck, CustomProvider } from "firebase/app-check";

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

let baslatildi = false;

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

  initializeAppCheck(jsUygulamasi, {
    provider: new CustomProvider({
      getToken: async () => {
        const { token } = await yerelBelgeAl(yerel, false);
        return { token, expireTimeMillis: bitisZamani(token) };
      },
    }),
    isTokenAutoRefreshEnabled: true,
  });
};
