import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import {
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  revokeAccessToken,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  writeBatch,
  doc,
} from "firebase/firestore";
import { ref, listAll, deleteObject } from "firebase/storage";
import { auth, db, storage } from "../firebaseConfig";
import { appleKimligiAl, APPLE_IPTAL } from "./appleGiris";
import { cozumOnbelleginiTemizle } from "./cozumYukleyici";
import { kurumdanAyril } from "./kurumIstemci";

// Kullanıcının işlem iptal etmesi (Google penceresini kapatma) gibi hata olmayan çıkışlar için
export const SILME_IPTAL = "hesap-silme/iptal";

const YEREL_ANAHTARLAR = [
  "adSoyad",
  "seciliSinif",
  "kullaniciRolu",
  "bildirimAktif",
  "profilFoto",
  "seriGunu",
  "hedefRol",
];

// Hesabın giriş yöntemi: şifre mi, Google mı, Apple mı?
export const girisYonteminiBul = (user) => {
  const saglayicilar = (user?.providerData || []).map((p) => p.providerId);
  if (saglayicilar.includes("password")) return "password";
  if (saglayicilar.includes("google.com")) return "google";
  if (saglayicilar.includes("apple.com")) return "apple";
  return null;
};

// Firebase, hesap silmeden önce yakın zamanda giriş yapılmasını şart koşar.
// Bunu işin en başında yaparız; başarısız olursa hiçbir veriye dokunulmamış olur.
// Apple hesaplarında, Apple bağlantısını iptal etmek için tek kullanımlık yetki kodunu döndürür.
export const yenidenDogrula = async (user, sifre) => {
  const yontem = girisYonteminiBul(user);

  if (yontem === "password") {
    if (!sifre) {
      const hata = new Error("Şifre girilmedi.");
      hata.code = "hesap-silme/sifre-bos";
      throw hata;
    }
    const kimlik = EmailAuthProvider.credential(user.email, sifre);
    await reauthenticateWithCredential(user, kimlik);
    return;
  }

  if (yontem === "google") {
    await GoogleSignin.hasPlayServices();
    const cevap = await GoogleSignin.signIn();
    if (!isSuccessResponse(cevap)) {
      const hata = new Error("Doğrulama iptal edildi.");
      hata.code = SILME_IPTAL;
      throw hata;
    }
    const idToken =
      cevap.data.idToken || (await GoogleSignin.getTokens()).idToken;
    const kimlik = GoogleAuthProvider.credential(idToken);
    await reauthenticateWithCredential(user, kimlik);
    return;
  }

  if (yontem === "apple") {
    let sonuc;
    try {
      sonuc = await appleKimligiAl();
    } catch (e) {
      if (e?.code === APPLE_IPTAL) {
        const hata = new Error("Doğrulama iptal edildi.");
        hata.code = SILME_IPTAL;
        throw hata;
      }
      throw e;
    }
    if (!sonuc.yetkiKodu) {
      const hata = new Error("Apple yetki kodu alınamadı.");
      hata.code = "hesap-silme/apple-kod-yok";
      throw hata;
    }
    await reauthenticateWithCredential(user, sonuc.kimlik);
    return { appleYetkiKodu: sonuc.yetkiKodu };
  }

  const hata = new Error("Bu giriş yöntemi için yeniden doğrulama desteklenmiyor.");
  hata.code = "hesap-silme/desteklenmeyen-yontem";
  throw hata;
};

// Dosya zaten yoksa (daha önce silinmiş ya da hiç oluşmamış) hata sayılmaz.
const nesneSil = async (nesneRef) => {
  try {
    await deleteObject(nesneRef);
  } catch (e) {
    if (e?.code !== "storage/object-not-found") throw e;
  }
};

// Bir klasörün altındaki her şeyi (alt klasörler dahil) siler.
const klasoruSil = async (yol) => {
  let liste;
  try {
    liste = await listAll(ref(storage, yol));
  } catch (e) {
    if (e?.code === "storage/object-not-found") return;
    throw e;
  }
  for (const nesne of liste.items) await nesneSil(nesne);
  for (const altKlasor of liste.prefixes) await klasoruSil(altKlasor.fullPath);
};

// Soruların belgelerini 400'erli gruplar hâlinde siler (Firestore sınırı 500).
const belgeleriSil = async (belgeler) => {
  for (let i = 0; i < belgeler.length; i += 400) {
    const grup = writeBatch(db);
    belgeler.slice(i, i + 400).forEach((d) => grup.delete(d.ref));
    await grup.commit();
  }
};

// Kullanıcıya ait tüm sunucu verisini siler. Tekrar çalıştırılabilir (idempotent):
// yarıda kalırsa, hesap silinmediği için kullanıcı işlemi yeniden deneyebilir.
export const kullaniciVerileriniSil = async (user) => {
  const uid = user.uid;
  const eposta = user.email;

  // Kurum (dershane) öğrencisiyse koltuk boşalsın ve kurumun verdiği premium geri alınsın.
  // Başarısız olsa bile hesap silme engellenmez; kurum lisansı bitince üyelik zaten temizlenir.
  try {
    const profil = await getDoc(doc(db, "kullanicilar", uid));
    if (
      profil.exists() &&
      profil.data().kurumId &&
      profil.data().rol !== "yonetici"
    ) {
      await kurumdanAyril();
    }
  } catch (e) {
    console.log("Kurumdan ayrılma (hesap silme):", e?.code, e?.message);
  }

  // 1) Sorular: belgeler + her sorunun fotoğrafı
  let soruBelgeleri = [];
  if (eposta) {
    const anlik = await getDocs(
      query(collection(db, "sorular"), where("kullaniciEposta", "==", eposta))
    );
    soruBelgeleri = anlik.docs;
  }

  for (const soru of soruBelgeleri) {
    const fotoLink = soru.data().fotoLink;
    if (fotoLink) {
      try {
        await nesneSil(ref(storage, fotoLink));
      } catch (e) {
        // Link biçimi geçersizse klasör silme adımı zaten dosyayı yakalar
        if (e?.code !== "storage/invalid-url") throw e;
      }
    }
  }

  // 2) Depolama: soru fotoğrafları, çözüm dosyaları (n8n), profil fotoğrafı
  await klasoruSil(`kullanicilar/${uid}`);
  // Yeni n8n akışı çözüm dosyalarını UID klasörüne, eski akış e-posta klasörüne yazar
  await klasoruSil(`cozumDetayi/${uid}`);
  await klasoruSil(`solution-cards/${uid}`);
  if (eposta) {
    await klasoruSil(`cozumDetayi/${eposta}`);
    await klasoruSil(`solution-cards/${eposta}`);
  }
  await nesneSil(ref(storage, `profil_fotograflari/${uid}.jpg`));

  // 3) Soru belgeleri, en son kullanıcı belgesi. Bağlantı kodu kaydını ve veli bağlantılarını,
  //    kullanıcı belgesi silinince sunucu temizler (veliBaglantilariniTemizle).
  await belgeleriSil(soruBelgeleri);
  const grup = writeBatch(db);
  grup.delete(doc(db, "kullanicilar", uid));
  await grup.commit();
};

// Cihazdaki yerel kayıtları temizler.
export const yerelVeriyiTemizle = async () => {
  await AsyncStorage.multiRemove(YEREL_ANAHTARLAR);
  await cozumOnbelleginiTemizle();
};

// Tam akış: doğrula → sunucu verisini sil → giriş hesabını sil → yerel temizlik.
// Hesap en son silinir; bir adım hata verirse hesap durur ve işlem tekrarlanabilir.
export const hesabiTamamenSil = async (user, sifre) => {
  const dogrulama = await yenidenDogrula(user, sifre);

  // Apple kuralı: hesap silinirken "Apple ile Giriş" bağlantısı da iptal edilmeli.
  // Veriye dokunmadan önce yapılır; başarısız olursa hiçbir şey silinmemiş olur.
  if (dogrulama?.appleYetkiKodu) {
    try {
      await revokeAccessToken(auth, dogrulama.appleYetkiKodu);
    } catch (e) {
      e.asama = "apple";
      throw e;
    }
  }

  await kullaniciVerileriniSil(user);
  try {
    await deleteUser(user);
  } catch (e) {
    e.asama = "hesap";
    throw e;
  }

  try {
    await GoogleSignin.signOut();
  } catch (e) {}
  await yerelVeriyiTemizle();
};
