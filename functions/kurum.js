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

const crypto = require("node:crypto");
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

// Davet belgesi elle yazıldığı için küçük yazım farkları (boşluk, büyük harf, Türkçe karakter) tolere edilir
const YONETICI_ROLLERI = {
  mudur: "mudur",
  müdür: "mudur",
  ogretmen: "ogretmen",
  öğretmen: "ogretmen",
};
const normRol = (rol) => YONETICI_ROLLERI[String(rol ?? "").trim().toLocaleLowerCase("tr-TR")] || null;

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
// Öğrencinin kurum üyeliğini sonlandırır; öğrenci kendisi ayrılırken de müdür çıkarırken de bu
// kullanılır. Üyelik ve özet silinir, koltuk boşalır, kurumun verdiği premium geri alınır
// (öğrencinin kendi premium'u korunur). Öğrencinin soruları ve profili silinmez.
// Yönetici hesaplarına dokunulmaz. Döndürdüğü değer: bir şey değiştiyse true.
const uyelikSonlandir = async (uid, kurumId) => {
  return db().runTransaction(async (tx) => {
    const userRef = db().doc(`kullanicilar/${uid}`);
    const kurumRef = db().doc(`kurumlar/${kurumId}`);
    const uyeRef = kurumRef.collection("uyeler").doc(uid);
    const [userSnap, kurumSnap, uyeSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(kurumRef),
      tx.get(uyeRef),
    ]);

    const kullanici = userSnap.exists ? userSnap.data() : null;
    if (kullanici?.rol === "yonetici") return false;
    // Kullanıcı belgesi bu kuruma işaret ediyor mu? (üyelik kaydı yoksa tutarsız durumu temizler)
    const baglantiVar = kullanici?.kurumId === kurumId;
    if (!uyeSnap.exists && !baglantiVar) return false;

    if (uyeSnap.exists) {
      tx.delete(uyeRef);
      if ((kurumSnap.data()?.uyeSayisi || 0) > 0) {
        tx.update(kurumRef, { uyeSayisi: FieldValue.increment(-1) });
      }
    }
    tx.delete(kurumRef.collection("ozet").doc(uid));

    if (userSnap.exists) {
      const guncelleme = {};
      if (baglantiVar) guncelleme.kurumId = FieldValue.delete();
      // Premium yalnızca öğrenci bu kurumdaysa (ya da hiçbir kurumda görünmüyorsa) geri alınır
      if (uyeSnap.exists && (baglantiVar || !kullanici.kurumId)) {
        guncelleme.premiumMu = uyeSnap.data().oncekiPremium === true;
      }
      if (Object.keys(guncelleme).length > 0) tx.update(userRef, guncelleme);
    }
    return true;
  });
};

// Öğrenci kendi isteğiyle kurumdan ayrılır
const kurumdanAyril = async (uid) => {
  const userSnap = await db().doc(`kullanicilar/${uid}`).get();
  const kullanici = userSnap.exists ? userSnap.data() : null;
  const kurumId = kullanici?.kurumId;
  if (!kurumId) return { ayrildi: false };
  if (kullanici.rol === "yonetici") throw new HttpsError("failed-precondition", "rol-uygun-degil");
  return { ayrildi: await uyelikSonlandir(uid, kurumId) };
};

// Müdür bir öğrenciyi dershaneden çıkarır. Yalnızca kendi kurumunun üyelerini çıkarabilir.
// Girdi: { uid }. Öğrenci kodu yeniden girerse tekrar katılabilir (kod yenilenerek engellenir).
const ogrenciCikar = async (uid, token, veri) => {
  const hedef = typeof veri?.uid === "string" ? veri.uid.trim() : "";
  if (!hedef || hedef.length > 128 || hedef.includes("/")) {
    throw new HttpsError("invalid-argument", "uid-gecersiz");
  }
  const { kurumId } = await mudurDogrula(uid, token);
  return { cikarildi: await uyelikSonlandir(hedef, kurumId) };
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
  const rol = normRol(davet.rol);
  if (!rol) {
    // JSON.stringify görünmeyen boşlukları ve yanlış türleri kayıtta görünür kılar
    console.warn("davet-rol-hatali", JSON.stringify({ eposta, rol: davet.rol }));
    throw new HttpsError("failed-precondition", "davet-rol-hatali");
  }
  const kurumId = String(davet.kurumId ?? "").trim();
  if (!kurumId) throw new HttpsError("failed-precondition", "davet-kurum-yok");
  if (davet.uid && davet.uid !== uid) {
    // Daveti alan hesap silinmişse (yönetici hesabını silip yeniden açtıysa) davet yeniden kullanılabilir
    const eskiHesapVar = await getAuth()
      .getUser(davet.uid)
      .then(() => true)
      .catch((hata) => {
        if (hata?.code === "auth/user-not-found") return false;
        throw hata;
      });
    if (eskiHesapVar) throw new HttpsError("permission-denied", "davet-kullanilmis");
  }

  const kurumRef = db().doc(`kurumlar/${kurumId}`);
  const kurumSnap = await kurumRef.get();
  if (!kurumSnap.exists) {
    console.warn("davet-kurum-yok", JSON.stringify({ eposta, kurumId: davet.kurumId }));
    throw new HttpsError("failed-precondition", "davet-kurum-yok");
  }
  const kurum = kurumSnap.data();
  if (!lisansGecerli(kurum)) throw new HttpsError("failed-precondition", "lisans-gecersiz");

  // Aktif öğrenci/veli hesabı yönetici yapılamaz: veri karışmasın
  const userRef = db().doc(`kullanicilar/${uid}`);
  const userSnap = await userRef.get();
  const kullanici = userSnap.exists ? userSnap.data() : {};
  const soruVar = !(await db().collection("sorular").where("kullaniciUid", "==", uid).limit(1).get()).empty;
  const veliBagi = Array.isArray(kullanici.bagliOgrenciIdleri) && kullanici.bagliOgrenciIdleri.length > 0;
  const baskaKurumda = kullanici.kurumId && kullanici.kurumId !== kurumId;
  const ogrenciUyesi = kullanici.kurumId && kullanici.rol !== "yonetici";
  if (soruVar || veliBagi || baskaKurumda || ogrenciUyesi) {
    throw new HttpsError("failed-precondition", "hesap-kullaniliyor");
  }

  const batch = db().batch();
  batch.set(userRef, { eposta, rol: "yonetici", kurumId }, { merge: true });
  batch.set(kurumRef.collection("yoneticiler").doc(eposta), {
    uid,
    eposta,
    rol,
    durum: "aktif",
    katilma: FieldValue.serverTimestamp(),
  });
  batch.set(davetRef, { uid, kullanildi: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();

  const auth = getAuth();
  const kayit = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, {
    ...(kayit.customClaims || {}),
    kurumId,
    kurumRol: rol,
  });

  return { kurumId, kurumAdi: kurum.ad, rol };
};

// ---------------------------------------------------------------------------
// Müdür: kayıt kodunu yenileme
// ---------------------------------------------------------------------------
// Karışabilecek karakterler (0/O, 1/I) yoktur; öğrenci kodu elle yazar
const KOD_KARAKTERLERI = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KOD_UZUNLUGU = 8;
const KOD_YENILEME_BEKLEME_MS = 60 * 1000;
const KOD_URETME_DENEMESI = 10;

const kurumKoduUret = () => {
  let kod = "";
  for (let i = 0; i < KOD_UZUNLUGU; i++) {
    kod += KOD_KARAKTERLERI.charAt(crypto.randomInt(KOD_KARAKTERLERI.length));
  }
  return kod;
};

// Müdür kurumun kayıt kodunu yeniler. Eski kod anında geçersiz olur; zaten bağlı öğrenciler
// etkilenmez. Yeni kod başka bir kurumun kodu olamaz. uretici yalnızca testlerde değiştirilir.
const kodYenile = async (uid, token, uretici = kurumKoduUret) => {
  const { kurumRef } = await mudurDogrula(uid, token);

  for (let deneme = 0; deneme < KOD_URETME_DENEMESI; deneme++) {
    const kod = uretici();
    const sonuc = await db().runTransaction(async (tx) => {
      const [kurumSnap, ayniKodSnap] = await Promise.all([
        tx.get(kurumRef),
        tx.get(db().collection("kurumlar").where("kurumKodu", "==", kod).limit(1)),
      ]);
      const onceki = milisaniye(kurumSnap.data()?.kodYenilenme);
      if (onceki !== null && Date.now() - onceki < KOD_YENILEME_BEKLEME_MS) {
        throw new HttpsError("resource-exhausted", "cok-sik");
      }
      if (!ayniKodSnap.empty) return null; // çakışma: yeni kod denenir
      tx.update(kurumRef, { kurumKodu: kod, kodYenilenme: FieldValue.serverTimestamp() });
      return kod;
    });
    if (sonuc) return { kurumKodu: sonuc };
  }
  throw new HttpsError("internal", "kod-uretilemedi");
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

// ---------------------------------------------------------------------------
// Müdür: öğretmen daveti ve kaldırma
// ---------------------------------------------------------------------------
const OGRETMEN_SINIRI = 20;
const EPOSTA_BICIMI = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;

// Çağıran gerçekten bu kurumun müdürü mü? Kimlik belirtecindeki claim tek başına yetmez:
// iptal edilen yetki belirteçte bir süre kalabildiği için kurum kaydındaki müdür girdisi de aranır.
const mudurDogrula = async (uid, token) => {
  const kurumId = token?.kurumId;
  if (token?.kurumRol !== "mudur" || typeof kurumId !== "string" || !kurumId) {
    throw new HttpsError("permission-denied", "yetki-yok");
  }
  const eposta = normEposta(token.email);
  if (!eposta) throw new HttpsError("permission-denied", "yetki-yok");

  const kurumRef = db().doc(`kurumlar/${kurumId}`);
  const [kayitSnap, kurumSnap] = await Promise.all([
    kurumRef.collection("yoneticiler").doc(eposta).get(),
    kurumRef.get(),
  ]);
  const kayit = kayitSnap.data();
  if (!kayitSnap.exists || kayit.uid !== uid || kayit.rol !== "mudur") {
    throw new HttpsError("permission-denied", "yetki-yok");
  }
  if (!kurumSnap.exists || !lisansGecerli(kurumSnap.data())) {
    throw new HttpsError("failed-precondition", "lisans-gecersiz");
  }
  return { kurumId, kurumRef, eposta, kurum: kurumSnap.data() };
};

const hedefEposta = (veri) => {
  const eposta = normEposta(veri?.eposta);
  if (!eposta || eposta.length > 254 || !EPOSTA_BICIMI.test(eposta)) {
    throw new HttpsError("invalid-argument", "eposta-gecersiz");
  }
  return eposta;
};

// Müdür bir öğretmeni davet eder. Davet hemen ekip listesinde "davetli" görünür;
// öğretmen Yönetici sekmesinden giriş yapınca "aktif" olur. Girdi: { eposta }
const ogretmenDavetEt = async (uid, token, veri) => {
  const hedef = hedefEposta(veri);
  const { kurumId, kurumRef, eposta: ben } = await mudurDogrula(uid, token);
  if (hedef === ben) throw new HttpsError("failed-precondition", "zaten-yonetici");

  const davetRef = db().doc(`yoneticiDavetleri/${hedef}`);
  const ekipRef = kurumRef.collection("yoneticiler");
  const kayitRef = ekipRef.doc(hedef);

  return db().runTransaction(async (tx) => {
    const [davetSnap, kayitSnap, ekipSnap] = await Promise.all([
      tx.get(davetRef),
      tx.get(kayitRef),
      tx.get(ekipRef),
    ]);

    if (kayitSnap.exists && kayitSnap.data().rol === "mudur") {
      throw new HttpsError("failed-precondition", "zaten-yonetici");
    }
    const davet = davetSnap.data();
    if (davetSnap.exists && davet.iptal !== true && davet.kurumId !== kurumId) {
      // Adres başka bir dershanenin yöneticisi ya da davetlisi
      throw new HttpsError("already-exists", "baska-kurumda-davetli");
    }
    if (davetSnap.exists && davet.iptal !== true && kayitSnap.exists) {
      // Aynı dershane için zaten davetli ya da aktif öğretmen: işlem tekrarlanabilir
      return { eposta: hedef, durum: kayitSnap.data().durum || "aktif", zatenVar: true };
    }

    const ogretmenSayisi = ekipSnap.docs.filter((d) => d.data().rol === "ogretmen").length;
    if (ogretmenSayisi >= OGRETMEN_SINIRI) {
      throw new HttpsError("resource-exhausted", "ogretmen-siniri");
    }

    // set: önceki (iptal edilmiş ya da silinmiş hesaba ait) davetin uid/iptal alanlarını temizler
    tx.set(davetRef, {
      kurumId,
      rol: "ogretmen",
      davetEden: uid,
      olusturma: FieldValue.serverTimestamp(),
    });
    tx.set(kayitRef, {
      eposta: hedef,
      rol: "ogretmen",
      durum: "davetli",
      davetZamani: FieldValue.serverTimestamp(),
    });
    return { eposta: hedef, durum: "davetli", zatenVar: false };
  });
};

// Müdür bir öğretmeni kaldırır (davetliyse daveti iptal eder). Müdür kendini ya da başka bir
// müdürü kaldıramaz. Yetki hemen kapanır: claim silinir, hesap öğrenci hesabına döner.
const yoneticiKaldir = async (uid, token, veri) => {
  const hedef = hedefEposta(veri);
  const { kurumId, kurumRef, eposta: ben } = await mudurDogrula(uid, token);
  if (hedef === ben) throw new HttpsError("failed-precondition", "kendini-kaldiramaz");

  const kayitRef = kurumRef.collection("yoneticiler").doc(hedef);
  const davetRef = db().doc(`yoneticiDavetleri/${hedef}`);
  const [kayitSnap, davetSnap] = await Promise.all([kayitRef.get(), davetRef.get()]);

  if (!kayitSnap.exists) return { kaldirildi: false };
  const kayit = kayitSnap.data();
  if (kayit.rol !== "ogretmen") {
    throw new HttpsError("failed-precondition", "kaldirilamaz-rol");
  }

  // Önce yetki kapatılır, kayıtlar en son silinir: yarıda kalırsa işlem yeniden denenebilir
  if (kayit.uid) {
    await yoneticiYetkisiniKaldir(kayit.uid).catch((hata) => {
      if (hata?.code !== "auth/user-not-found") throw hata;
    });
    const userRef = db().doc(`kullanicilar/${kayit.uid}`);
    const userSnap = await userRef.get();
    // Yönetici hesabı hiç öğrenci/veli olarak kullanılmamıştı (yetki alırken denetlenir);
    // başka kuruma ait yeni bir yetkisi yoksa öğrenci hesabına döner
    if (userSnap.exists && userSnap.data().rol === "yonetici" && userSnap.data().kurumId === kurumId) {
      await userRef.update({ rol: "ogrenci", kurumId: FieldValue.delete() });
    }
  }

  const batch = db().batch();
  batch.delete(kayitRef);
  if (davetSnap.exists && davetSnap.data().kurumId === kurumId) batch.delete(davetRef);
  await batch.commit();
  return { kaldirildi: true };
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
  ogretmenDavetEt,
  yoneticiKaldir,
  ogrenciCikar,
  kodYenile,
  kurumKoduUret,
  kurumuKapat,
  lisansKontrol,
  girisliUid,
  normKod,
  normEposta,
  Timestamp,
};
