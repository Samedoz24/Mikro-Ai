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
const KONU_ADI_SINIRI = 60;
const EN_COK_KONU = 20;

const gunBicimi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
const gunAnahtari = (ms) => gunBicimi.format(new Date(ms)); // YYYY-MM-DD, Türkiye saati

// Sorunun konusu: n8n'in belgeye yazdığı alt konu, yoksa konu
const konuBul = (soru) =>
  String(soru?.subtopic || soru?.topic || soru?.konu || "")
    .trim()
    .slice(0, KONU_ADI_SINIRI);

// Saf hesap: soru belgeleri -> özet alanları
const ozetHesapla = (sorular, simdi = Date.now()) => {
  const dersDagilimi = {};
  const konuSayaci = new Map();
  const gunler = {};
  let okunanCozum = 0;
  let sonAktiflik = null;
  const sinir = simdi - GUN_PENCERESI * GUN_MS;

  for (const soru of sorular) {
    const ders = dersBul(soru).slice(0, DERS_ADI_SINIRI);
    dersDagilimi[ders] = (dersDagilimi[ders] || 0) + 1;
    if (soru.okunduMu === true) okunanCozum++;

    const konu = konuBul(soru);
    if (konu) {
      const anahtar = `${ders}\u0000${konu}`;
      konuSayaci.set(anahtar, (konuSayaci.get(anahtar) || 0) + 1);
    }

    const ms = Date.parse(soru.tarih);
    if (!Number.isFinite(ms)) continue;
    if (sonAktiflik === null || ms > sonAktiflik) sonAktiflik = ms;
    if (ms >= sinir) {
      const anahtar = gunAnahtari(ms);
      gunler[anahtar] = (gunler[anahtar] || 0) + 1;
    }
  }

  // En çok sorulan konular. Dizi olarak saklanır: konu adlarındaki nokta gibi karakterler sorun çıkarmaz.
  const konular = [...konuSayaci.entries()]
    .map(([anahtar, adet]) => {
      const [ders, konu] = anahtar.split("\u0000");
      return { ders, konu, adet };
    })
    .sort((a, b) => b.adet - a.adet || a.konu.localeCompare(b.konu, "tr"))
    .slice(0, EN_COK_KONU);

  return {
    toplamSoru: sorular.length,
    okunanCozum,
    dersDagilimi,
    konular,
    gunler,
    sonAktiflik: sonAktiflik === null ? null : Timestamp.fromMillis(sonAktiflik),
  };
};

const gorunenIsim = (kullanici) =>
  kullanici?.adSoyad || String(kullanici?.eposta || "").split("@")[0] || "Öğrenci";

// Öğrenci bir kurumun üyesiyse özetini yeniden hesaplar. Üye değilse hiçbir şey yazmaz.
// Öğrencinin özetinin grup kopyasının yolu. Öğretmenler yalnızca yetkili oldukları grupların bu
// yoluna erişir (güvenlik kuralları yol bazlıdır); müdür kurum geneli ozet koleksiyonunu okur.
const grupOzetRef = (kurumId, grupId, uid) =>
  db().doc(`kurumlar/${kurumId}/gruplar/${grupId}/ozet/${uid}`);

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
    const [uyeSnap, ozetSnap] = await Promise.all([tx.get(uyeRef), tx.get(ozetRef)]);
    if (!uyeSnap.exists) return false;

    const grupId = uyeSnap.data().grupId || null;
    const oncekiGrupId = ozetSnap.exists ? ozetSnap.data().grupId || null : null;
    const veri = {
      ...alanlar,
      isim: gorunenIsim(userSnap.data()),
      // Yeni katılan öğrenci "pasif" sayılmasın diye katılma zamanı da özette durur
      katilma: uyeSnap.data().katilma ?? null,
      grupId,
      guncelleme: FieldValue.serverTimestamp(),
    };
    tx.set(ozetRef, veri);
    // Öğrenci bir gruptaysa özetin aynısı grubun yoluna da yazılır; grup değiştiyse eskisi silinir
    if (oncekiGrupId && oncekiGrupId !== grupId) {
      tx.delete(grupOzetRef(kurumId, oncekiGrupId, uid));
    }
    if (grupId) tx.set(grupOzetRef(kurumId, grupId, uid), veri);
    return true;
  });
};

module.exports = { ozetHesapla, ozetYenile, gunAnahtari, konuBul, grupOzetRef };
