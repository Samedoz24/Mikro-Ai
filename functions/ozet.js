// Kurum öğrencilerinin istatistik özeti: kurumlar/{kurumId}/ozet/{uid}.
// Öğretmen yalnızca bu özeti görür (soru içeriğini göremez); müdür hem özeti hem soruları görür.
// Özet, öğrencinin soru belgelerinden her değişiklikte baştan hesaplanır; böylece silinen ya da
// güncellenen sorular sayıyı bozmaz.

const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { dersBul } = require("./ders");

const db = () => getFirestore();

const GUN_PENCERESI = 90;
const GUN_MS = 86400000;
const DERS_ADI_SINIRI = 40;

const gunBicimi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
const gunAnahtari = (ms) => gunBicimi.format(new Date(ms)); // YYYY-MM-DD, Türkiye saati

// Saf hesap: soru belgeleri -> özet alanları
const ozetHesapla = (sorular, simdi = Date.now()) => {
  const dersDagilimi = {};
  const gunler = {};
  let okunanCozum = 0;
  let sonAktiflik = null;
  const sinir = simdi - GUN_PENCERESI * GUN_MS;

  for (const soru of sorular) {
    const ders = dersBul(soru).slice(0, DERS_ADI_SINIRI);
    dersDagilimi[ders] = (dersDagilimi[ders] || 0) + 1;
    if (soru.okunduMu === true) okunanCozum++;

    const ms = Date.parse(soru.tarih);
    if (!Number.isFinite(ms)) continue;
    if (sonAktiflik === null || ms > sonAktiflik) sonAktiflik = ms;
    if (ms >= sinir) {
      const anahtar = gunAnahtari(ms);
      gunler[anahtar] = (gunler[anahtar] || 0) + 1;
    }
  }

  return {
    toplamSoru: sorular.length,
    okunanCozum,
    dersDagilimi,
    gunler,
    sonAktiflik: sonAktiflik === null ? null : Timestamp.fromMillis(sonAktiflik),
  };
};

const gorunenIsim = (kullanici) =>
  kullanici?.adSoyad || String(kullanici?.eposta || "").split("@")[0] || "Öğrenci";

// Öğrenci bir kurumun üyesiyse özetini yeniden hesaplar. Üye değilse hiçbir şey yazmaz.
const ozetYenile = async (uid) => {
  const userSnap = await db().doc(`kullanicilar/${uid}`).get();
  const kurumId = userSnap.exists ? userSnap.data().kurumId : null;
  if (!kurumId) return false;

  const sorular = (await db().collection("sorular").where("kullaniciUid", "==", uid).get()).docs.map((d) =>
    d.data()
  );
  const alanlar = ozetHesapla(sorular);

  const uyeRef = db().doc(`kurumlar/${kurumId}/uyeler/${uid}`);
  const ozetRef = db().doc(`kurumlar/${kurumId}/ozet/${uid}`);
  // Üyelik kontrolü ve yazma aynı işlemde: aynı anda ayrılan öğrencinin özeti geri oluşmaz
  return db().runTransaction(async (tx) => {
    const uyeSnap = await tx.get(uyeRef);
    if (!uyeSnap.exists) return false;
    tx.set(ozetRef, {
      ...alanlar,
      isim: gorunenIsim(userSnap.data()),
      guncelleme: FieldValue.serverTimestamp(),
    });
    return true;
  });
};

module.exports = { ozetHesapla, ozetYenile, gunAnahtari };
