import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Öğrenci bağlantı kodları: baglantiKodlari/{KOD} -> { uid }.
// Veli kodu girince belge doğrudan okunur; kullanıcı listesi hiç sorgulanmaz (güvenlik kuralları
// kullanicilar ve baglantiKodlari koleksiyonlarını listelemeye izin vermez).

const KARAKTERLER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const KOD_BICIMI = /^[A-Z0-9]{6}$/;
const EN_FAZLA_DENEME = 10;

export const rastgeleKodUret = () => {
  let kod = "";
  for (let i = 0; i < 6; i++) {
    kod += KARAKTERLER.charAt(Math.floor(Math.random() * KARAKTERLER.length));
  }
  return kod;
};

// Kodun kaydı bu kullanıcıya aitse true. Kayıt yoksa oluşturur; başkasına aitse false döner.
const kodKaydiniGaranti = async (kod, uid) => {
  const kayit = doc(db, "baglantiKodlari", kod);
  const mevcut = await getDoc(kayit);
  if (mevcut.exists()) return mevcut.data().uid === uid;

  try {
    await setDoc(kayit, { uid, olusturma: new Date().toISOString() });
    return true;
  } catch (hata) {
    // Aynı anda başka biri aynı kodu aldıysa kurallar yazmayı reddeder; yeni kod denenir
    if (hata?.code === "permission-denied") return false;
    throw hata;
  }
};

/**
 * Kullanıcının kayıtlı ve kendisine ait bir bağlantı kodu olmasını sağlar, kodu döndürür.
 * @param mevcutKod  kullanicilar belgesindeki kod (yoksa null)
 */
export const baglantiKoduGaranti = async (uid, mevcutKod) => {
  if (
    mevcutKod &&
    KOD_BICIMI.test(mevcutKod) &&
    (await kodKaydiniGaranti(mevcutKod, uid))
  ) {
    return mevcutKod;
  }

  for (let i = 0; i < EN_FAZLA_DENEME; i++) {
    const kod = rastgeleKodUret();
    if (await kodKaydiniGaranti(kod, uid)) return kod;
  }
  throw new Error("Bağlantı kodu üretilemedi");
};

// Veli tarafı: koda karşılık gelen öğrencinin UID'si (yoksa null)
export const kodlaOgrenciBul = async (kod) => {
  const snap = await getDoc(doc(db, "baglantiKodlari", kod));
  return snap.exists() ? snap.data().uid || null : null;
};
