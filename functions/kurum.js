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
    const ozetRef = kurumRef.collection("ozet").doc(uid);
    const [userSnap, kurumSnap, uyeSnap, ozetSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(kurumRef),
      tx.get(uyeRef),
      tx.get(ozetRef),
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
    tx.delete(ozetRef);
    // Öğrenci bir gruptaysa özetinin grup kopyası da silinir (üyelik ya da özet kaydı grubu bilir)
    const grupId = (uyeSnap.exists && uyeSnap.data().grupId) || (ozetSnap.exists && ozetSnap.data().grupId);
    if (grupId) tx.delete(kurumRef.collection("gruplar").doc(grupId).collection("ozet").doc(uid));

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

  // Öğretmenin kapsamı (tüm öğrenciler ya da seçili gruplar) ekip kaydından gelir; davet edilirken
  // ya da sonradan müdür tarafından belirlenmiş olabilir. Silinmiş gruplar kapsamdan düşer.
  const ekipKaydiRef = kurumRef.collection("yoneticiler").doc(eposta);
  const ekipKaydi = (await ekipKaydiRef.get()).data() || {};
  const kapsam = rol === "ogretmen" ? (ekipKaydi.kapsam === "gruplar" ? "gruplar" : "tum") : null;
  const gruplar = kapsam === "gruplar" ? await gecerliGruplar(kurumRef, ekipKaydi.gruplar) : [];

  const batch = db().batch();
  batch.set(userRef, { eposta, rol: "yonetici", kurumId }, { merge: true });
  batch.set(
    ekipKaydiRef,
    {
      uid,
      eposta,
      rol,
      durum: "aktif",
      katilma: FieldValue.serverTimestamp(),
      ...kapsamAlanlari(kapsam, gruplar),
    },
    { merge: true }
  );
  batch.set(davetRef, { uid, kullanildi: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();

  const auth = getAuth();
  const kayit = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, {
    ...kapsamClaimleri(kayit.customClaims, kapsam, gruplar),
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
// Gruplar (sınıf/şube) ve öğretmen kapsamı
// ---------------------------------------------------------------------------
// Müdür grup oluşturur, öğrencileri gruplara atar ve her öğretmenin kapsamını belirler:
//   kapsam "tum"     -> öğretmen kurumun tüm öğrencilerinin istatistiklerini görür
//   kapsam "gruplar" -> yalnızca atandığı grupların öğrencilerini görür (grup yoksa hiçbirini)
// Kapsam kimlik belirtecindeki claim'lerle (kapsam, gruplar) güvenlik kurallarına taşınır;
// kurallar yol bazlıdır: öğretmen yalnızca kendi gruplarının ozet yoluna erişebilir.
const EN_FAZLA_GRUP = 30;
const OGRETMEN_EN_FAZLA_GRUP = 10;
const GRUP_ADI_SINIRI = 30;
const GRUP_KIMLIGI = /^[A-HJ-NP-Z2-9]{8}$/;

const gecerliGrupKimligi = (id) => typeof id === "string" && GRUP_KIMLIGI.test(id);
const grupAdiTemizle = (ad) => (typeof ad === "string" ? ad.replace(/\s+/g, " ").trim() : "");
const grupAdiGecerli = (ad) =>
  ad.length >= 1 && ad.length <= GRUP_ADI_SINIRI && !/[\u0000-\u001f\u007f<>]/.test(ad);
const grupAdiAnahtari = (ad) => ad.toLocaleLowerCase("tr-TR");

const grupKimligiUret = () => {
  let id = "";
  for (let i = 0; i < 8; i++) id += KOD_KARAKTERLERI.charAt(crypto.randomInt(KOD_KARAKTERLERI.length));
  return id;
};

// Ekip kaydında saklanan kapsam alanları (kapsam yoksa ikisi de silinir)
const kapsamAlanlari = (kapsam, gruplar) => {
  if (kapsam === "gruplar") return { kapsam, gruplar };
  if (kapsam === "tum") return { kapsam, gruplar: FieldValue.delete() };
  return { kapsam: FieldValue.delete(), gruplar: FieldValue.delete() };
};

// Kimlik belirtecine yazılacak claim'ler; kapsamla ilgisiz claim'ler korunur
const kapsamClaimleri = (claims, kapsam, gruplar) => {
  const yeni = { ...(claims || {}) };
  delete yeni.kapsam;
  delete yeni.gruplar;
  if (kapsam) yeni.kapsam = kapsam;
  if (kapsam === "gruplar") yeni.gruplar = gruplar;
  return yeni;
};

// Verilen grup kimliklerinden biçimi doğru, kurumda var olan ve silinmekte olmayanlar
const gecerliGruplar = async (kurumRef, idler) => {
  if (!Array.isArray(idler)) return [];
  const adaylar = [...new Set(idler.filter(gecerliGrupKimligi))];
  if (adaylar.length === 0) return [];
  const snaplar = await Promise.all(
    adaylar.map((id) => kurumRef.collection("gruplar").doc(id).get())
  );
  return adaylar.filter((id, i) => snaplar[i].exists && snaplar[i].data().silinecek !== true);
};

const koleksiyonuBosalt = async (ref) => {
  for (;;) {
    const snap = await ref.limit(TOPLU_BOYUT).get();
    if (snap.empty) return;
    const batch = db().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

// Müdür yeni bir grup oluşturur. Girdi: { ad }
const grupOlustur = async (uid, token, veri) => {
  const ad = grupAdiTemizle(veri?.ad);
  if (!grupAdiGecerli(ad)) throw new HttpsError("invalid-argument", "grup-adi-gecersiz");
  const { kurumRef } = await mudurDogrula(uid, token);
  const anahtar = grupAdiAnahtari(ad);

  for (let deneme = 0; deneme < 5; deneme++) {
    const grupRef = kurumRef.collection("gruplar").doc(grupKimligiUret());
    const sonuc = await db().runTransaction(async (tx) => {
      const [gruplarSnap, grupSnap] = await Promise.all([
        tx.get(kurumRef.collection("gruplar")),
        tx.get(grupRef),
      ]);
      if (grupSnap.exists) return null; // kimlik çakışması: yenisi denenir
      const aktifler = gruplarSnap.docs.filter((d) => d.data().silinecek !== true);
      if (aktifler.length >= EN_FAZLA_GRUP) throw new HttpsError("resource-exhausted", "grup-siniri");
      if (aktifler.some((d) => d.data().adAnahtar === anahtar)) {
        throw new HttpsError("already-exists", "grup-adi-var");
      }
      tx.set(grupRef, { ad, adAnahtar: anahtar, olusturma: FieldValue.serverTimestamp() });
      return { grupId: grupRef.id, ad };
    });
    if (sonuc) return sonuc;
  }
  throw new HttpsError("internal", "grup-uretilemedi");
};

// Müdür bir grubun adını değiştirir. Girdi: { grupId, ad }
const grupAdiDegistir = async (uid, token, veri) => {
  if (!gecerliGrupKimligi(veri?.grupId)) throw new HttpsError("invalid-argument", "grup-gecersiz");
  const ad = grupAdiTemizle(veri?.ad);
  if (!grupAdiGecerli(ad)) throw new HttpsError("invalid-argument", "grup-adi-gecersiz");
  const { kurumRef } = await mudurDogrula(uid, token);
  const anahtar = grupAdiAnahtari(ad);

  return db().runTransaction(async (tx) => {
    const gruplarSnap = await tx.get(kurumRef.collection("gruplar"));
    const grup = gruplarSnap.docs.find((d) => d.id === veri.grupId);
    if (!grup || grup.data().silinecek === true) throw new HttpsError("not-found", "grup-yok");
    const baskasi = gruplarSnap.docs.some(
      (d) => d.id !== veri.grupId && d.data().silinecek !== true && d.data().adAnahtar === anahtar
    );
    if (baskasi) throw new HttpsError("already-exists", "grup-adi-var");
    tx.update(grup.ref, { ad, adAnahtar: anahtar });
    return { grupId: veri.grupId, ad };
  });
};

// Grubun üyelerini gruptan çıkarır ve grubun özet kopyalarını siler
const grubuBosalt = async (kurumRef, grupId) => {
  const grupRef = kurumRef.collection("gruplar").doc(grupId);
  for (;;) {
    const uyeler = await kurumRef.collection("uyeler").where("grupId", "==", grupId).limit(TOPLU_BOYUT).get();
    if (uyeler.empty) break;
    for (const uye of uyeler.docs) {
      const ozetRef = kurumRef.collection("ozet").doc(uye.id);
      const ozetSnap = await ozetRef.get();
      const batch = db().batch();
      batch.update(uye.ref, { grupId: FieldValue.delete() });
      if (ozetSnap.exists) batch.update(ozetRef, { grupId: null });
      batch.delete(grupRef.collection("ozet").doc(uye.id));
      await batch.commit();
    }
  }
  await koleksiyonuBosalt(grupRef.collection("ozet"));
};

// Müdür bir grubu siler: öğrenciler gruptan çıkar (kurumda kalır), öğretmenlerin kapsamından düşer.
// Girdi: { grupId }. Yarıda kalırsa aynı çağrı tekrarlanarak tamamlanır.
const grupSil = async (uid, token, veri) => {
  const grupId = veri?.grupId;
  if (!gecerliGrupKimligi(grupId)) throw new HttpsError("invalid-argument", "grup-gecersiz");
  const { kurumRef } = await mudurDogrula(uid, token);
  const grupRef = kurumRef.collection("gruplar").doc(grupId);
  if (!(await grupRef.get()).exists) return { silindi: false };

  // Önce grup silinecek diye işaretlenir: yeni atamalar ve kapsamlar bu gruba artık yapılamaz
  await grupRef.update({ silinecek: true });
  await grubuBosalt(kurumRef, grupId);

  // Kapsamında bu grup olan öğretmenlerden grup düşer (kalan grup yoksa hiçbir şey göremezler)
  const ogretmenler = await kurumRef.collection("yoneticiler").where("kapsam", "==", "gruplar").get();
  for (const ogretmen of ogretmenler.docs) {
    const kayit = ogretmen.data();
    if (!Array.isArray(kayit.gruplar) || !kayit.gruplar.includes(grupId)) continue;
    const kalan = kayit.gruplar.filter((g) => g !== grupId);
    await ogretmen.ref.update({ gruplar: kalan });
    if (kayit.uid) {
      const auth = getAuth();
      await auth
        .getUser(kayit.uid)
        .then((k) =>
          auth.setCustomUserClaims(kayit.uid, kapsamClaimleri(k.customClaims, "gruplar", kalan))
        )
        .catch((hata) => {
          if (hata?.code !== "auth/user-not-found") throw hata;
        });
    }
  }

  // Aradaki sürede gruba atanan olursa onlar da temizlenir; grubun duyuruları silinir, sonra grup silinir
  await grubuBosalt(kurumRef, grupId);
  await require("./duyuru").grubunDuyurulariniSil(kurumRef, grupId);
  await grupRef.delete();
  return { silindi: true };
};

// Müdür bir öğrenciyi gruba atar ya da gruptan çıkarır. Girdi: { uid, grupId | null }
const ogrenciGrupAta = async (uid, token, veri) => {
  const hedef = typeof veri?.uid === "string" ? veri.uid.trim() : "";
  if (!hedef || hedef.length > 128 || hedef.includes("/")) {
    throw new HttpsError("invalid-argument", "uid-gecersiz");
  }
  const grupId = veri?.grupId ?? null;
  if (grupId !== null && !gecerliGrupKimligi(grupId)) {
    throw new HttpsError("invalid-argument", "grup-gecersiz");
  }
  const { kurumRef } = await mudurDogrula(uid, token);

  const uyeRef = kurumRef.collection("uyeler").doc(hedef);
  const ozetRef = kurumRef.collection("ozet").doc(hedef);
  return db().runTransaction(async (tx) => {
    const [uyeSnap, ozetSnap, grupSnap] = await Promise.all([
      tx.get(uyeRef),
      tx.get(ozetRef),
      grupId ? tx.get(kurumRef.collection("gruplar").doc(grupId)) : Promise.resolve(null),
    ]);
    if (!uyeSnap.exists) throw new HttpsError("not-found", "ogrenci-yok");
    if (grupId && (!grupSnap.exists || grupSnap.data().silinecek === true)) {
      throw new HttpsError("not-found", "grup-yok");
    }

    const onceki = uyeSnap.data().grupId || null;
    if (onceki === grupId) return { grupId, degisti: false };

    tx.update(uyeRef, { grupId: grupId ?? FieldValue.delete() });
    if (ozetSnap.exists) {
      tx.update(ozetRef, { grupId });
      if (onceki) tx.delete(kurumRef.collection("gruplar").doc(onceki).collection("ozet").doc(hedef));
      if (grupId) {
        tx.set(kurumRef.collection("gruplar").doc(grupId).collection("ozet").doc(hedef), {
          ...ozetSnap.data(),
          grupId,
        });
      }
    }
    return { grupId, degisti: true };
  });
};

// Müdür bir öğretmenin kapsamını belirler. Girdi: { eposta, kapsam: "tum" | "gruplar", gruplar: [...] }
const ogretmenKapsamAta = async (uid, token, veri) => {
  const hedef = hedefEposta(veri);
  const kapsam = veri?.kapsam;
  if (kapsam !== "tum" && kapsam !== "gruplar") throw new HttpsError("invalid-argument", "kapsam-gecersiz");

  let istenen = [];
  if (kapsam === "gruplar") {
    if (!Array.isArray(veri?.gruplar) || !veri.gruplar.every(gecerliGrupKimligi)) {
      throw new HttpsError("invalid-argument", "grup-gecersiz");
    }
    istenen = [...new Set(veri.gruplar)];
    if (istenen.length > OGRETMEN_EN_FAZLA_GRUP) throw new HttpsError("invalid-argument", "cok-grup");
  }

  const { kurumRef } = await mudurDogrula(uid, token);
  const kayitRef = kurumRef.collection("yoneticiler").doc(hedef);
  const kayitSnap = await kayitRef.get();
  if (!kayitSnap.exists) throw new HttpsError("not-found", "ogretmen-yok");
  if (kayitSnap.data().rol !== "ogretmen") throw new HttpsError("failed-precondition", "kapsam-rol");

  const gecerli = await gecerliGruplar(kurumRef, istenen);
  if (gecerli.length !== istenen.length) throw new HttpsError("not-found", "grup-yok");

  await kayitRef.update(kapsamAlanlari(kapsam, gecerli));
  const hesapUid = kayitSnap.data().uid;
  if (hesapUid) {
    const auth = getAuth();
    const kayit = await auth.getUser(hesapUid);
    await auth.setCustomUserClaims(hesapUid, kapsamClaimleri(kayit.customClaims, kapsam, gecerli));
  }
  return { kapsam, gruplar: gecerli };
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
  delete claims.kapsam;
  delete claims.gruplar;
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
      kapsam: "tum",
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

  // Üyeler çıkarıldı; duyurular ve grupların özet kopyaları da silinir (veri azaltma)
  await require("./duyuru").tumDuyurulariSil(kurumRef);
  const kapananGruplar = await kurumRef.collection("gruplar").get();
  for (const grup of kapananGruplar.docs) await koleksiyonuBosalt(grup.ref.collection("ozet"));

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
  grupOlustur,
  grupAdiDegistir,
  grupSil,
  ogrenciGrupAta,
  ogretmenKapsamAta,
  mudurDogrula,
  koleksiyonuBosalt,
  gecerliGrupKimligi,
  kurumuKapat,
  lisansKontrol,
  girisliUid,
  normKod,
  normEposta,
  Timestamp,
};
