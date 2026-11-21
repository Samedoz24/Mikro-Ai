// Tek seferlik veri göçleri (gece görevinden çağrılır; işi bitince bir bayrakla kendini kapatır).
//
// eskiSorularaKimlikEkle: Eski sistemde sorular yalnızca e-postayla (kullaniciEposta) sahiplenilirdi.
// Güvenlik kuralının e-posta dalı sıkılaştırılmadan (e-posta doğrulaması şartı) önce, bu sorulara
// sahiplerinin kimliği (kullaniciUid) yazılır; böylece sahipleri kimlikle sorgulayarak görmeye devam eder.
//
// GÜVENLİK: Kimlik yalnızca soru, o e-postanın BUGÜNKÜ hesabı açıldıktan SONRA sorulmuşsa yazılır.
// Hesabını silmiş birinin e-postasıyla sonradan yeni hesap açan kişi eski sahibin sorularını alamaz.
// Hesabı bulunamayan, zamanı okunamayan ya da hesaptan önce sorulmuş soru kimseye verilmez (sahipsiz).
// Var olan kullaniciUid asla değiştirilmez.

const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const db = () => getFirestore();
const SAYFA = 300;
// Eski akışta soru zamanını cihaz yazıyordu; cihaz saatindeki küçük sapmalar için pay
const SAAT_PAYI_MS = 10 * 60 * 1000;
const BAYRAK = "ayarlar/goc";

const zamanMs = (deger) => {
  if (deger && typeof deger.toMillis === "function") return deger.toMillis();
  if (typeof deger === "string") {
    const ms = Date.parse(deger);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
};

// Saf karar: bu soruya bu hesabın kimliği yazılabilir mi?
const kimlikYazilabilirMi = (soruMs, hesap) =>
  !!hesap && soruMs !== null && Number.isFinite(hesap.olusturmaMs) && soruMs + SAAT_PAYI_MS >= hesap.olusturmaMs;

// e-posta -> { uid, olusturmaMs } | null (hesap yoksa)
const hesapBul = async (eposta, onbellek) => {
  if (onbellek.has(eposta)) return onbellek.get(eposta);
  let sonuc = null;
  try {
    const kayit = await getAuth().getUserByEmail(eposta);
    sonuc = { uid: kayit.uid, olusturmaMs: Date.parse(kayit.metadata.creationTime) };
  } catch (hata) {
    if (hata?.code !== "auth/user-not-found" && hata?.code !== "auth/invalid-email") throw hata;
  }
  onbellek.set(eposta, sonuc);
  return sonuc;
};

const eskiSorularaKimlikEkle = async () => {
  const bayrakRef = db().doc(BAYRAK);
  if ((await bayrakRef.get()).data()?.eskiSorularKimlik === true) return { atlandi: true };

  const onbellek = new Map();
  let imlec = null;
  let eklenen = 0;
  let sahipsiz = 0;
  for (;;) {
    let sorgu = db().collection("sorular").orderBy("__name__").limit(SAYFA);
    if (imlec) sorgu = sorgu.startAfter(imlec);
    const sayfa = await sorgu.get();
    if (sayfa.empty) break;
    imlec = sayfa.docs[sayfa.docs.length - 1];

    const batch = db().batch();
    let yazilacak = 0;
    for (const belge of sayfa.docs) {
      const veri = belge.data();
      if (typeof veri.kullaniciUid === "string" && veri.kullaniciUid) continue; // var olana dokunulmaz
      const eposta = typeof veri.kullaniciEposta === "string" ? veri.kullaniciEposta.trim().toLowerCase() : "";
      const hesap = eposta ? await hesapBul(eposta, onbellek) : null;
      if (!kimlikYazilabilirMi(zamanMs(veri.tarih), hesap)) {
        sahipsiz++;
        continue;
      }
      batch.update(belge.ref, { kullaniciUid: hesap.uid });
      yazilacak++;
    }
    if (yazilacak > 0) await batch.commit();
    eklenen += yazilacak;
    if (sayfa.size < SAYFA) break;
  }

  // Tam tarama hatasız bitti: yeni sorular zaten kimlikle oluşturulduğu için tekrar gerekmez
  await bayrakRef.set({ eskiSorularKimlik: true, eklenen, sahipsiz, tarih: new Date().toISOString() }, { merge: true });
  return { eklenen, sahipsiz };
};

module.exports = { eskiSorularaKimlikEkle, kimlikYazilabilirMi, SAAT_PAYI_MS };
