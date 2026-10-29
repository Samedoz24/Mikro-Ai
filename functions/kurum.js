// Kurum (dershane) iş mantığı. Yetki ve koltuk işleri istemciye bırakılmaz; hepsi burada,
// Admin SDK ile yapılır. index.js bu fonksiyonları callable/zamanlanmış görev olarak sunar.
//
// Koleksiyonlar (güvenlik kuralları: istemci yalnızca okuyabilir, hiçbir şey yazamaz):
//   kurumlar/{kurumId}                ad, kurumKodu, koltuk, uyeSayisi, durum, lisansBitis
//   kurumlar/{kurumId}/uyeler/{uid}   öğrenci üyeliği + onay kaydı
//   kurumlar/{kurumId}/ozet/{uid}     öğrenci istatistik özeti
//   kurumlar/{kurumId}/yoneticiler/{eposta}  yetkisini almış müdür/öğretmenler
//   yoneticiDavetleri/{eposta}        { kurumId, rol } davet listesi (istemciye tamamen kapalı)
//   kurumDenemeleri/{uid}             kod deneme sayacı (istemciye tamamen kapalı)

const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { HttpsError } = require("firebase-functions/v2/https");
const { ozetYenile } = require("./ozet");

const db = () => getFirestore();

const KOD_BICIMI = /^[A-Z0-9]{6,12}$/;
const ONAY_SURUMU = 1;
const DENEME_PENCERESI_MS = 60 * 60 * 1000;
const EN_FAZLA_DENEME = 10;
const TOPLU_BOYUT = 200;

const normKod = (kod) =>
  String(kod ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "");

const normEposta = (eposta) => String(eposta ?? "").trim().toLowerCase();

// Firestore Timestamp, Date ya da ISO metin olarak yazılmış tarihi milisaniyeye çevirir
const milisaniye = (deger) => {
  if (!deger) return null;
  if (typeof deger.toMillis === "function") return deger.toMillis();
  const ms = new Date(deger).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const lisansGecerli = (kurum, simdi = Date.now()) => {
  const bitis = milisaniye(kurum.lisansBitis);
  return kurum.durum === "aktif" && bitis !== null && bitis > simdi;
};

const girisliUid = (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "giris-gerekli");
  return request.auth.uid;
};

// Kurum kodunu kaba kuvvetle denemeyi sınırlar: bir saatte en fazla 10 deneme
const denemeHakkiKullan = async (uid) => {
  const ref = db().doc(`kurumDenemeleri/${uid}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const simdi = Date.now();
    let { sayi = 0, baslangic = simdi } = snap.exists ? snap.data() : {};
    if (simdi - baslangic > DENEME_PENCERESI_MS) {
      sayi = 0;
      baslangic = simdi;
    }
    if (sayi >= EN_FAZLA_DENEME) {
      throw new HttpsError("resource-exhausted", "cok-fazla-deneme");
    }
    tx.set(ref, { sayi: sayi + 1, baslangic });
  });
};

const ozetBaslangic = (kullanici) => ({
  isim: kullanici.adSoyad || String(kullanici.eposta || "").split("@")[0] || "Öğrenci",
  toplamSoru: 0,
  okunanCozum: 0,
  dersDagilimi: {},
  sonAktiflik: null,
  guncelleme: FieldValue.serverTimestamp(),
});

// ---------------------------------------------------------------------------
// Öğrenci: kurum koduyla katılma
// ---------------------------------------------------------------------------
const kurumaKatil = async (uid, veri) => {
  if (veri?.onay !== true) throw new HttpsError("failed-precondition", "onay-gerekli");
  const kod = normKod(veri?.kod);
  if (!KOD_BICIMI.test(kod)) throw new HttpsError("invalid-argument", "kod-gecersiz");

  await denemeHakkiKullan(uid);

  const bulunan = await db().collection("kurumlar").where("kurumKodu", "==", kod).limit(1).get();
  if (bulunan.empty) throw new HttpsError("not-found", "kod-bulunamadi");
  const kurumRef = bulunan.docs[0].ref;

  const sonuc = await db().runTransaction(async (tx) => {
    const userRef = db().doc(`kullanicilar/${uid}`);
    const uyeRef = kurumRef.collection("uyeler").doc(uid);
    const [kurumSnap, userSnap, uyeSnap] = await Promise.all([
      tx.get(kurumRef),
      tx.get(userRef),
      tx.get(uyeRef),
    ]);

    const kurum = kurumSnap.data();
    if (!kurum || kurum.kurumKodu !== kod) throw new HttpsError("not-found", "kod-bulunamadi");
    if (!lisansGecerli(kurum)) throw new HttpsError("failed-precondition", "lisans-gecersiz");

    if (!userSnap.exists) throw new HttpsError("failed-precondition", "profil-yok");
    const kullanici = userSnap.data();
    if ((kullanici.rol || "ogrenci") !== "ogrenci") {
      throw new HttpsError("failed-precondition", "rol-uygun-degil");
    }
    if (kullanici.kurumId && kullanici.kurumId !== kurumRef.id) {
      throw new HttpsError("already-exists", "baska-kurumda");
    }
    if (uyeSnap.exists) {
      return { kurumId: kurumRef.id, kurumAdi: kurum.ad, zatenUye: true };
    }

    const uyeSayisi = kurum.uyeSayisi || 0;
    if (uyeSayisi >= (kurum.koltuk || 0)) throw new HttpsError("resource-exhausted", "koltuk-dolu");

    tx.set(uyeRef, {
      uid,
      kurumAdi: kurum.ad || null,
      eposta: kullanici.eposta || null,
      adSoyad: kullanici.adSoyad || null,
      katilma: FieldValue.serverTimestamp(),
      onay: { onaylandi: true, surum: ONAY_SURUMU, tarih: FieldValue.serverTimestamp() },
      // Ayrılırken kurumun verdiği premium'u geri almak, kişinin kendi premium'unu korumak için
      oncekiPremium: kullanici.premiumMu === true,
    });
    tx.set(kurumRef.collection("ozet").doc(uid), ozetBaslangic(kullanici));
    tx.update(kurumRef, { uyeSayisi: FieldValue.increment(1) });
    tx.update(userRef, { kurumId: kurumRef.id, premiumMu: true });

    return { kurumId: kurumRef.id, kurumAdi: kurum.ad, zatenUye: false };
  });

  await db().doc(`kurumDenemeleri/${uid}`).delete().catch(() => {});
  // Katılmadan önce sorulan sorular da özete yansısın; başarısız olursa soru tetikleyicisi telafi eder
  if (!sonuc.zatenUye) await ozetYenile(uid).catch((hata) => console.error("ozet-yenile", hata));
  return sonuc;
};

// ---------------------------------------------------------------------------
// Öğrenci: kurumdan ayrılma
// ---------------------------------------------------------------------------
const kurumdanAyril = async (uid) => {
  return db().runTransaction(async (tx) => {
    const userRef = db().doc(`kullanicilar/${uid}`);
    const userSnap = await tx.get(userRef);
    const kullanici = userSnap.exists ? userSnap.data() : null;
    const kurumId = kullanici?.kurumId;
    if (!kurumId) return { ayrildi: false };
    if (kullanici.rol === "yonetici") throw new HttpsError("failed-precondition", "rol-uygun-degil");

    const kurumRef = db().doc(`kurumlar/${kurumId}`);
    const uyeRef = kurumRef.collection("uyeler").doc(uid);
    const [kurumSnap, uyeSnap] = await Promise.all([tx.get(kurumRef), tx.get(uyeRef)]);

    const guncelleme = { kurumId: FieldValue.delete() };
    if (uyeSnap.exists) guncelleme.premiumMu = uyeSnap.data().oncekiPremium === true;

    if (uyeSnap.exists) {
      tx.delete(uyeRef);
      if ((kurumSnap.data()?.uyeSayisi || 0) > 0) {
        tx.update(kurumRef, { uyeSayisi: FieldValue.increment(-1) });
      }
    }
    tx.delete(kurumRef.collection("ozet").doc(uid));
    tx.update(userRef, guncelleme);
    return { ayrildi: true };
  });
};

// ---------------------------------------------------------------------------
// Müdür / öğretmen: davet listesindeki doğrulanmış e-posta ile yetki alma
// ---------------------------------------------------------------------------
const yoneticiOl = async (uid, token) => {
  const eposta = normEposta(token?.email);
  if (!eposta) throw new HttpsError("failed-precondition", "eposta-yok");
  // Şifreyle açılan hesaplarda e-posta doğrulanmamış olabilir; başkasının adresiyle yetki alınamaz
  if (token.email_verified !== true) throw new HttpsError("failed-precondition", "eposta-dogrulanmadi");

  const davetRef = db().doc(`yoneticiDavetleri/${eposta}`);
  const davetSnap = await davetRef.get();
  if (!davetSnap.exists) throw new HttpsError("permission-denied", "davet-yok");
  const davet = davetSnap.data();
  if (davet.iptal === true) throw new HttpsError("permission-denied", "davet-yok");
  if (!["mudur", "ogretmen"].includes(davet.rol)) {
    throw new HttpsError("failed-precondition", "davet-hatali");
  }
  if (davet.uid && davet.uid !== uid) throw new HttpsError("permission-denied", "davet-kullanilmis");

  const kurumRef = db().doc(`kurumlar/${davet.kurumId}`);
  const kurumSnap = await kurumRef.get();
  if (!kurumSnap.exists) throw new HttpsError("failed-precondition", "davet-hatali");
  const kurum = kurumSnap.data();
  if (!lisansGecerli(kurum)) throw new HttpsError("failed-precondition", "lisans-gecersiz");

  // Aktif öğrenci/veli hesabı yönetici yapılamaz: veri karışmasın
  const userRef = db().doc(`kullanicilar/${uid}`);
  const userSnap = await userRef.get();
  const kullanici = userSnap.exists ? userSnap.data() : {};
  const soruVar = !(await db().collection("sorular").where("kullaniciUid", "==", uid).limit(1).get()).empty;
  const veliBagi = Array.isArray(kullanici.bagliOgrenciIdleri) && kullanici.bagliOgrenciIdleri.length > 0;
  const baskaKurumda = kullanici.kurumId && kullanici.kurumId !== davet.kurumId;
  const ogrenciUyesi = kullanici.kurumId && kullanici.rol !== "yonetici";
  if (soruVar || veliBagi || baskaKurumda || ogrenciUyesi) {
    throw new HttpsError("failed-precondition", "hesap-kullaniliyor");
  }

  const batch = db().batch();
  batch.set(userRef, { eposta, rol: "yonetici", kurumId: davet.kurumId }, { merge: true });
  batch.set(kurumRef.collection("yoneticiler").doc(eposta), {
    uid,
    eposta,
    rol: davet.rol,
    katilma: FieldValue.serverTimestamp(),
  });
  batch.set(davetRef, { uid, kullanildi: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();

  const auth = getAuth();
  const kayit = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, {
    ...(kayit.customClaims || {}),
    kurumId: davet.kurumId,
    kurumRol: davet.rol,
  });

  return { kurumId: davet.kurumId, kurumAdi: kurum.ad, rol: davet.rol };
};

// ---------------------------------------------------------------------------
// Lisans bitişi: kurumu kapatır, üyeleri serbest bırakır, yönetici yetkilerini alır
// ---------------------------------------------------------------------------
const yoneticiYetkisiniKaldir = async (uid) => {
  const auth = getAuth();
  const kayit = await auth.getUser(uid);
  const claims = { ...(kayit.customClaims || {}) };
  delete claims.kurumId;
  delete claims.kurumRol;
  await auth.setCustomUserClaims(uid, Object.keys(claims).length ? claims : null);
};

const kurumuKapat = async (kurumId) => {
  const kurumRef = db().doc(`kurumlar/${kurumId}`);
  // Yarıda kalırsa bir sonraki çalışmada devam edilebilsin diye önce durum işaretlenir
  await kurumRef.update({ durum: "kapatiliyor" });

  for (;;) {
    const uyeler = await kurumRef.collection("uyeler").limit(TOPLU_BOYUT).get();
    if (uyeler.empty) break;
    const batch = db().batch();
    for (const uye of uyeler.docs) {
      batch.delete(uye.ref);
      batch.delete(kurumRef.collection("ozet").doc(uye.id));
      // Premium'u yalnızca kurum vermişse geri al; kullanıcı belgesi silinmişse atla
      const userRef = db().doc(`kullanicilar/${uye.id}`);
      if ((await userRef.get()).exists) {
        batch.update(userRef, {
          kurumId: FieldValue.delete(),
          premiumMu: uye.data().oncekiPremium === true,
        });
      }
    }
    await batch.commit();
  }

  const yoneticiler = await kurumRef.collection("yoneticiler").get();
  for (const yonetici of yoneticiler.docs) {
    const uid = yonetici.data().uid;
    if (!uid) continue;
    await yoneticiYetkisiniKaldir(uid).catch((hata) => {
      // Hesap silinmişse yapacak bir şey kalmaz
      if (hata?.code !== "auth/user-not-found") throw hata;
    });
    const userRef = db().doc(`kullanicilar/${uid}`);
    if ((await userRef.get()).exists) await userRef.update({ kurumId: FieldValue.delete() });
  }

  await kurumRef.update({ durum: "suresi-doldu", uyeSayisi: 0, kapanis: FieldValue.serverTimestamp() });
};

// Süresi dolmuş ya da kapatılması yarım kalmış kurumları kapatır; kapatılan kurum id'lerini döndürür
const lisansKontrol = async (simdi = Date.now()) => {
  const adaylar = await db().collection("kurumlar").where("durum", "in", ["aktif", "kapatiliyor"]).get();
  const kapatilan = [];
  for (const kurum of adaylar.docs) {
    const veri = kurum.data();
    const bitis = milisaniye(veri.lisansBitis);
    const doldu = veri.durum === "kapatiliyor" || (bitis !== null && bitis <= simdi);
    if (!doldu) continue;
    await kurumuKapat(kurum.id);
    kapatilan.push(kurum.id);
  }
  return kapatilan;
};

module.exports = {
  kurumaKatil,
  kurumdanAyril,
  yoneticiOl,
  kurumuKapat,
  lisansKontrol,
  girisliUid,
  normKod,
  normEposta,
  Timestamp,
};
