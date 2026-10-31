// Duyurular: müdür dershane öğrencilerine (hepsine ya da bir gruba) uygulama içi duyuru gönderir.
//
// Veri:
//   kurumlar/{k}/duyurular/{id}                          müdürün yönetim listesi (gönderen dahil)
//   kurumlar/{k}/duyuruKutusu/{kutuId}/duyurular/{id}    öğrencilere teslim kopyası (gönderen yok);
//                                                        kutuId: "hepsi" ya da grup kimliği
// Güvenlik kuralları yol bazlıdır: öğrenci "hepsi" kutusunu ve yalnızca kendi grubunun kutusunu okur.
// İstemci hiçbir duyuru verisi yazamaz; tüm yazmalar burada, yalnızca müdür için yapılır.

const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { mudurDogrula, koleksiyonuBosalt, gecerliGrupKimligi } = require("./kurum");

const db = () => getFirestore();

const BASLIK_SINIRI = 60;
const METIN_SINIRI = 500;
const KUTU_SINIRI = 30; // bir kutuda en çok bu kadar duyuru tutulur; eskileri silinir
const BEKLEME_MS = 20 * 1000;
const DUYURU_KIMLIGI = /^[A-Za-z0-9]{20}$/;

const temizle = (deger) =>
  typeof deger === "string" ? deger.replace(/\r\n/g, "\n").trim() : "";

// Başlıkta satır sonu ve kontrol karakteri yok; metinde yalnızca satır sonu serbest
const BASLIK_YASAK = /[\u0000-\u001f\u007f]/;
const METIN_YASAK = /[\u0000-\u0009\u000b-\u001f\u007f]/;

// Fazla boş satırlar sıkıştırılır (en fazla bir boş satır)
const metniDuzenle = (metin) => metin.replace(/\n{3,}/g, "\n\n");

// Müdür duyuru gönderir. Girdi: { baslik, metin, grupId: null | grup kimliği }
const duyuruGonder = async (uid, token, veri) => {
  const baslik = temizle(veri?.baslik);
  if (baslik.length < 1 || baslik.length > BASLIK_SINIRI || BASLIK_YASAK.test(baslik)) {
    throw new HttpsError("invalid-argument", "baslik-gecersiz");
  }
  const metin = metniDuzenle(temizle(veri?.metin));
  if (metin.length < 1 || metin.length > METIN_SINIRI || METIN_YASAK.test(metin)) {
    throw new HttpsError("invalid-argument", "metin-gecersiz");
  }
  const grupId = veri?.grupId ?? null;
  if (grupId !== null && !gecerliGrupKimligi(grupId)) {
    throw new HttpsError("invalid-argument", "grup-gecersiz");
  }

  const { kurumRef, eposta } = await mudurDogrula(uid, token);
  const kutuId = grupId ?? "hepsi";
  const duyuruRef = kurumRef.collection("duyurular").doc();
  const teslimRef = kurumRef
    .collection("duyuruKutusu")
    .doc(kutuId)
    .collection("duyurular")
    .doc(duyuruRef.id);

  await db().runTransaction(async (tx) => {
    const [kurumSnap, grupSnap] = await Promise.all([
      tx.get(kurumRef),
      grupId ? tx.get(kurumRef.collection("gruplar").doc(grupId)) : Promise.resolve(null),
    ]);
    if (grupId && (!grupSnap.exists || grupSnap.data().silinecek === true)) {
      throw new HttpsError("not-found", "grup-yok");
    }
    const onceki = kurumSnap.data()?.sonDuyuru?.toMillis?.() ?? null;
    if (onceki !== null && Date.now() - onceki < BEKLEME_MS) {
      throw new HttpsError("resource-exhausted", "cok-sik");
    }
    const zaman = FieldValue.serverTimestamp();
    tx.update(kurumRef, { sonDuyuru: zaman });
    tx.set(duyuruRef, { baslik, metin, hedef: kutuId, gonderen: eposta, olusturma: zaman });
    tx.set(teslimRef, { baslik, metin, hedef: kutuId, olusturma: zaman });
  });

  // Kutuda sınırdan fazla duyuru varsa en eskileri silinir (müdür listesinden de)
  const fazlalar = await teslimRef.parent
    .orderBy("olusturma", "desc")
    .offset(KUTU_SINIRI)
    .get();
  if (!fazlalar.empty) {
    const batch = db().batch();
    fazlalar.docs.forEach((d) => {
      batch.delete(d.ref);
      batch.delete(kurumRef.collection("duyurular").doc(d.id));
    });
    await batch.commit();
  }
  return { duyuruId: duyuruRef.id };
};

// Müdür bir duyuruyu siler (yönetim listesinden ve öğrencilerin kutusundan). Girdi: { duyuruId }
const duyuruSil = async (uid, token, veri) => {
  const duyuruId = veri?.duyuruId;
  if (typeof duyuruId !== "string" || !DUYURU_KIMLIGI.test(duyuruId)) {
    throw new HttpsError("invalid-argument", "duyuru-gecersiz");
  }
  const { kurumRef } = await mudurDogrula(uid, token);
  const duyuruRef = kurumRef.collection("duyurular").doc(duyuruId);
  const snap = await duyuruRef.get();
  if (!snap.exists) return { silindi: false };

  const kutuId = snap.data().hedef;
  const batch = db().batch();
  batch.delete(duyuruRef);
  if (typeof kutuId === "string" && kutuId) {
    batch.delete(kurumRef.collection("duyuruKutusu").doc(kutuId).collection("duyurular").doc(duyuruId));
  }
  await batch.commit();
  return { silindi: true };
};

// Bir grubun duyurularını siler (grup silinirken): hem teslim kutusu hem müdür listesi
const grubunDuyurulariniSil = async (kurumRef, grupId) => {
  await koleksiyonuBosalt(kurumRef.collection("duyuruKutusu").doc(grupId).collection("duyurular"));
  for (;;) {
    const snap = await kurumRef.collection("duyurular").where("hedef", "==", grupId).limit(200).get();
    if (snap.empty) return;
    const batch = db().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

// Kurum kapanırken tüm duyurular silinir (veri azaltma)
const tumDuyurulariSil = async (kurumRef) => {
  await koleksiyonuBosalt(kurumRef.collection("duyurular"));
  const kutular = await kurumRef.collection("duyuruKutusu").listDocuments();
  for (const kutu of kutular) await koleksiyonuBosalt(kutu.collection("duyurular"));
};

module.exports = { duyuruGonder, duyuruSil, grubunDuyurulariniSil, tumDuyurulariSil };
