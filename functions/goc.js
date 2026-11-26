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

const { getFirestore, FieldValue } = require("firebase-admin/firestore");
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

// premiumKaynaklariniTasi: Eski yapıda premium tek alandı (premiumMu). Premium'u açık olan ve henüz kaynak
// yapısı olmayan kullanıcılara kaynak yazılır:
//   dershane üyesiyse      → kurum: true  (+ katılmadan önce de premium idiyse elle: true)
//   değilse                → elle: true   (Console'dan verilmiş; asla kaybettirilmez)
// premiumMu değişmez (hepsi zaten true kalır). Kaynak yapısı olanlara dokunulmaz. Bitince bayrakla kapanır.
const premiumKaynaklariniTasi = async () => {
  const bayrakRef = db().doc(BAYRAK);
  if ((await bayrakRef.get()).data()?.premiumKaynaklari === true) return { atlandi: true };

  let tasinan = 0;
  const snap = await db().collection("kullanicilar").where("premiumMu", "==", true).get();
  for (const belge of snap.docs) {
    const veri = belge.data();
    if (veri.premiumKaynaklari && typeof veri.premiumKaynaklari === "object") continue;
    let kaynaklar = { elle: true };
    if (typeof veri.kurumId === "string" && veri.kurumId && veri.rol !== "yonetici") {
      const uye = await db().doc(`kurumlar/${veri.kurumId}/uyeler/${belge.id}`).get();
      if (uye.exists) {
        kaynaklar = { kurum: true };
        if (uye.data().oncekiPremium === true) kaynaklar.elle = true;
      }
    }
    // Yarışa karşı: belge bu arada değiştiyse (kaynak yazıldıysa) dokunulmaz
    const yazildi = await db().runTransaction(async (tx) => {
      const guncel = await tx.get(belge.ref);
      if (!guncel.exists || guncel.data().premiumKaynaklari || guncel.data().premiumMu !== true) return false;
      tx.update(belge.ref, { premiumKaynaklari: kaynaklar });
      return true;
    });
    if (yazildi) tasinan++;
  }
  await bayrakRef.set({ premiumKaynaklari: true, premiumTasinan: tasinan }, { merge: true });
  return { tasinan };
};

// kaldirilanVeliAlanlariniSil: Veli panelindeki "WhatsApp Raporlama" özelliği hiç çalışmıyordu (rapor gönderen
// kod yoktu) ve kaldırıldı. Velilerin girdiği telefon numaraları (whatsappNo) ve rapor tercihi (raporAktif) KVKK
// gereği (gereğinden fazla veri tutulmaz) tüm profillerden silinir. Güvenlik kuralları bu alanların yeniden
// yazılmasını engeller (yalnızca silinmelerine izin verir). Tekrar çalıştırılabilir; bitince bayrakla kapanır.
const KALDIRILAN_ALANLAR = ["whatsappNo", "raporAktif"];
const kaldirilanVeliAlanlariniSil = async () => {
  const bayrakRef = db().doc(BAYRAK);
  if ((await bayrakRef.get()).data()?.kaldirilanVeliAlanlari === true) return { atlandi: true };

  const refler = new Map();
  const sorgular = [
    db().collection("kullanicilar").where("whatsappNo", "!=", null).get(),
    db().collection("kullanicilar").where("raporAktif", "in", [true, false]).get(),
  ];
  for (const snap of await Promise.all(sorgular)) snap.docs.forEach((d) => refler.set(d.id, d.ref));

  const liste = [...refler.values()];
  const silme = Object.fromEntries(KALDIRILAN_ALANLAR.map((a) => [a, FieldValue.delete()]));
  for (let i = 0; i < liste.length; i += SAYFA) {
    const batch = db().batch();
    liste.slice(i, i + SAYFA).forEach((ref) => batch.update(ref, silme));
    await batch.commit();
  }
  await bayrakRef.set({ kaldirilanVeliAlanlari: true, kaldirilanVeliAlanlariSayisi: liste.length }, { merge: true });
  return { temizlenen: liste.length };
};

module.exports = {
  eskiSorularaKimlikEkle,
  premiumKaynaklariniTasi,
  kaldirilanVeliAlanlariniSil,
  KALDIRILAN_ALANLAR,
  kimlikYazilabilirMi,
  SAAT_PAYI_MS,
};
