import { Platform } from "react-native";
import * as Application from "expo-application";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";

// Günlük soru kotası sunucuda sayılır (hesap + cihaz). Uygulama yalnızca sunucuya sorar ve soruyu sunucu
// üzerinden gönderir; soru belgesini kendisi yazamaz.

// Android ID ya da iOS satıcı kimliği. Sunucu ham kimliği saklamaz, özetini saklar.
export const cihazKimligi = async () =>
  Platform.OS === "android"
    ? Application.getAndroidId()
    : await Application.getIosIdForVendorAsync();

// { kalan, sinir, premiumMu }
export const kotaDurumuGetir = async () => {
  const cihazId = await cihazKimligi();
  const sonuc = await httpsCallable(functions, "kotaDurumu")({ cihazId });
  return sonuc.data;
};

// { soruId, kalan, sinir, premiumMu, zatenVar }
export const soruGonderSunucu = async ({ fotoYolu, ogrenciSecimi }) => {
  const cihazId = await cihazKimligi();
  const sonuc = await httpsCallable(
    functions,
    "soruGonder"
  )({ fotoYolu, ogrenciSecimi, cihazId });
  return sonuc.data;
};

// Sunucunun kesin bir kararla reddettiği durumlar (soru oluşturulmadı). Ağ kopması gibi belirsiz
// durumlarda soru oluşmuş olabilir; o zaman yüklenen fotoğraf silinmemeli.
const KESIN_RET_KODLARI = [
  "functions/resource-exhausted",
  "functions/invalid-argument",
  "functions/failed-precondition",
  "functions/permission-denied",
  "functions/unauthenticated",
];
export const kesinRetMi = (hata) => KESIN_RET_KODLARI.includes(hata?.code);

export const kotaDolduMu = (hata) =>
  hata?.code === "functions/resource-exhausted" &&
  hata?.message === "kota-doldu";

const MESAJLAR = {
  "foto-yok": "Fotoğraf yüklenemedi. Lütfen tekrar dene.",
  "foto-gecersiz": "Fotoğraf geçersiz ya da çok büyük. Lütfen yeniden çek.",
  "secim-gecersiz": "Göndermeden önce cevabı ya da Bilinmiyor'u seçmelisin.",
  "cihaz-gecersiz":
    "Cihaz bilgisi alınamadı. Uygulamayı kapatıp açıp tekrar dene.",
  "rol-uygun-degil":
    "Soru gönderme yalnızca öğrenci hesaplarında kullanılabilir.",
  "profil-yok":
    "Profilin henüz hazır değil. Uygulamayı kapatıp açıp tekrar dene.",
};

export const soruHataMesaji = (hata) => {
  if (MESAJLAR[hata?.message]) return MESAJLAR[hata.message];
  if (
    hata?.code === "functions/unavailable" ||
    hata?.code === "functions/deadline-exceeded"
  ) {
    return "Sunucuya ulaşılamadı. Sorunun gönderilip gönderilmediğini Geçmiş Sorular'dan kontrol et.";
  }
  return "Soru gönderilirken bir sorun oluştu. Lütfen tekrar dene.";
};
