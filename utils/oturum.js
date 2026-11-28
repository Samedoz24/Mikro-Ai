// Oturum kapatma ve cihazdaki kişisel verinin temizlenmesi: tek kaynak.
// Çıkış yaparken ve hesap silinirken aynı liste kullanılır; böylece ortak kullanılan bir telefonda
// önceki kişinin çözümleri, profil bilgileri ya da Google oturumu bir sonraki kişiye kalmaz.
//
// Cihaz ayarı olan ve kişisel veri içermeyen tema tercihi (kullaniciTemaTercihi) korunur.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { cozumOnbelleginiTemizle } from "./cozumYukleyici";
import { cancelAllNotifications } from "./notificationManager";
import { magazaGirisiniUnut } from "./magaza";

// Kullanıcıya ait sabit anahtarlar
const KULLANICI_ANAHTARLARI = [
  "adSoyad",
  "seciliSinif",
  "kullaniciRolu",
  "bildirimAktif",
  "profilFoto",
  "seriGunu",
  "sonSoruGunu",
  "hedefRol",
  "bekleyenAdSoyad",
];

// Kullanıcıya ait önekli anahtarlar (çözüm önbelleği ayrıca temizlenir: hafızadaki kopyası da silinir)
const KULLANICI_ONEKLERI = ["duyuruOkundu:"];

// Cihazdaki kullanıcı verisini temizler. Hata verse bile mümkün olan her şeyi silmeye çalışır.
export const yerelKullaniciVerisiniTemizle = async () => {
  await cozumOnbelleginiTemizle();
  let onekliler = [];
  try {
    const tumu = await AsyncStorage.getAllKeys();
    onekliler = tumu.filter((a) => KULLANICI_ONEKLERI.some((o) => a.startsWith(o)));
  } catch (e) {
    console.log("Yerel anahtarlar okunamadı:", e?.message);
  }
  await AsyncStorage.multiRemove([...KULLANICI_ANAHTARLARI, ...onekliler]);
};

// Google ile girişin cihazdaki oturumu kapatılır; sonraki "Google ile Giriş" hesap seçtirir.
// Google ile giriş yapılmadıysa sessizce geçer.
export const googleOturumunuKapat = async () => {
  try {
    await GoogleSignin.signOut();
  } catch (e) {}
};

// Çıkış: önce bildirimler ve cihaz verisi temizlenir, sonra oturum kapanır.
// Temizlikte hata olsa bile oturum MUTLAKA kapatılır (kullanıcı çıkış yapamaz durumda kalmaz).
export const oturumuKapat = async () => {
  try {
    await cancelAllNotifications();
  } catch (e) {
    console.log("Bildirimler iptal edilemedi:", e?.message);
  }
  try {
    await yerelKullaniciVerisiniTemizle();
  } catch (e) {
    console.log("Yerel veri temizlenemedi:", e?.message);
  }
  await googleOturumunuKapat();
  // Mağaza (RevenueCat): doğrulanmış kimlik unutulur; SDK kimliği bırakılmaz (utils/magaza.js açıklaması).
  // Sonraki kişi önceki kişinin kimliğiyle satın alma yapamaz: satın alma öncesi kimlik yeniden doğrulanır.
  try {
    await magazaGirisiniUnut();
  } catch (e) {
    console.log("Mağaza oturumu kapatılamadı:", e?.message);
  }
  await signOut(auth);
};
