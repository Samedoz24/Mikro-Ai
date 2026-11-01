// Platform yönetimi: yeni dershane (kurum) ekleme aracı. Yalnızca platform yöneticisi kullanır.
//
// Yetki: `platformYoneticileri/{eposta}` belgesi ({ aktif: true }) Firebase Console'dan elle eklenir.
// İstemciye tamamen kapalıdır (güvenlik kuralları). Çağıranın e-postası doğrulanmış olmalı ve belge aktif olmalıdır.
// Hizmet hesabı anahtarı kullanılmaz; her şey bu callable'larla, kimlik doğrulaması yapılmış çağrıyla yürür.
//
// kurumOlustur: kurum belgesi + müdür daveti tek işlemde (transaction) yazılır. Girdideki `istekKimligi`
// kurum belgesinin kimliğidir; aynı istek tekrarlanırsa (ağ kopması, çift dokunuş) ikinci bir kurum açılmaz.

const crypto = require("crypto");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { HttpsError } = require("firebase-functions/v2/https");
const { kurumKoduUret, normEposta, kurumuKapat, yoneticiYetkisiniKaldir } = require("./kurum");

const db = () => getFirestore();

const EPOSTA_BICIMI = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
const ISTEK_KIMLIGI = /^[A-Za-z0-9]{20}$/;
const TARIH_BICIMI = /^(\d{4})-(\d{2})-(\d{2})$/;
const KONTROL_KARAKTERI = /[\u0000-\u001f\u007f]/;
const AD_EN_AZ = 2;
const AD_EN_FAZLA = 80;
const KOLTUK_EN_FAZLA = 5000;
const LISANS_EN_FAZLA_MS = 5 * 366 * 24 * 60 * 60 * 1000; // en fazla 5 yıl
const KOD_DENEMESI = 10;
const LISTE_SINIRI = 500;

// Çağıran platform yöneticisi mi? Değilse hiçbir ayrıntı vermeden reddedilir.
const platformDogrula = async (uid, token) => {
  const eposta = normEposta(token?.email);
  if (!eposta || eposta.length > 254 || !EPOSTA_BICIMI.test(eposta) || token.email_verified !== true) {
    throw new HttpsError("permission-denied", "yetki-yok");
  }
  const snap = await db().doc(`platformYoneticileri/${eposta}`).get();
  if (!snap.exists || snap.data().aktif !== true) {
    throw new HttpsError("permission-denied", "yetki-yok");
  }
  return { uid, eposta };
};

// İstemcinin "Platform Yönetimi" kartını gösterip göstermeyeceği. Yetkisizlerde hata değil false döner.
const platformYetkisi = async (uid, token) => {
  try {
    await platformDogrula(uid, token);
    return { yetkili: true };
  } catch (hata) {
    if (hata?.code === "permission-denied") return { yetkili: false };
    throw hata;
  }
};

const adTemizle = (deger) => {
  if (typeof deger !== "string") throw new HttpsError("invalid-argument", "ad-gecersiz");
  const ad = deger.replace(/\s+/g, " ").trim();
  if (ad.length < AD_EN_AZ || ad.length > AD_EN_FAZLA || KONTROL_KARAKTERI.test(ad)) {
    throw new HttpsError("invalid-argument", "ad-gecersiz");
  }
  return ad;
};

const koltukKontrol = (deger) => {
  if (!Number.isInteger(deger) || deger < 1 || deger > KOLTUK_EN_FAZLA) {
    throw new HttpsError("invalid-argument", "koltuk-gecersiz");
  }
  return deger;
};

// "YYYY-AA-GG" -> o günün sonu (Türkiye saati 23:59:59.999, UTC+3). Takvimde olmayan günler reddedilir.
const lisansBitisMs = (deger, simdi) => {
  const eslesme = typeof deger === "string" ? TARIH_BICIMI.exec(deger) : null;
  if (!eslesme) throw new HttpsError("invalid-argument", "tarih-gecersiz");
  const [yil, ay, gun] = [Number(eslesme[1]), Number(eslesme[2]), Number(eslesme[3])];
  const kontrol = new Date(Date.UTC(yil, ay - 1, gun));
  if (kontrol.getUTCFullYear() !== yil || kontrol.getUTCMonth() !== ay - 1 || kontrol.getUTCDate() !== gun) {
    throw new HttpsError("invalid-argument", "tarih-gecersiz");
  }
  const bitis = Date.UTC(yil, ay - 1, gun, 20, 59, 59, 999);
  if (bitis <= simdi) throw new HttpsError("invalid-argument", "tarih-gecmis");
  if (bitis > simdi + LISANS_EN_FAZLA_MS) throw new HttpsError("invalid-argument", "tarih-cok-uzak");
  return bitis;
};

const epostaKontrol = (deger) => {
  if (typeof deger !== "string") throw new HttpsError("invalid-argument", "eposta-gecersiz");
  const eposta = normEposta(deger);
  if (eposta.length > 254 || !EPOSTA_BICIMI.test(eposta)) {
    throw new HttpsError("invalid-argument", "eposta-gecersiz");
  }
  return eposta;
};

const istekOzeti = (ad, koltuk, bitisMs, mudurEposta) =>
  crypto.createHash("sha256").update(JSON.stringify([ad, koltuk, bitisMs, mudurEposta])).digest("hex");

// Müdür adayının hesabı zaten öğrenci/veli olarak kullanılıyorsa yönetici olamaz (yoneticiOl da reddeder);
// kurum açılmadan önce yöneticiyi uyarmak için aynı koşullar burada denetlenir.
const hesapUygunMu = async (mudurEposta) => {
  let kayit;
  try {
    kayit = await getAuth().getUserByEmail(mudurEposta);
  } catch (hata) {
    if (hata?.code === "auth/user-not-found") return true; // hesap henüz yok: davetle açılacak
    throw hata;
  }
  const profil = await db().doc(`kullanicilar/${kayit.uid}`).get();
  const kullanici = profil.exists ? profil.data() : {};
  const soruVar = !(await db().collection("sorular").where("kullaniciUid", "==", kayit.uid).limit(1).get()).empty;
  const veliBagi = Array.isArray(kullanici.bagliOgrenciIdleri) && kullanici.bagliOgrenciIdleri.length > 0;
  const kurumda = !!kullanici.kurumId && kullanici.rol !== "yonetici";
  return !(soruVar || veliBagi || kurumda);
};

// Yeni dershane. Girdi: { istekKimligi, ad, koltuk, lisansBitis: "YYYY-AA-GG", mudurEposta }
const kurumOlustur = async (uid, token, veri, simdi = Date.now(), uretici = kurumKoduUret) => {
  const yonetici = await platformDogrula(uid, token);

  const kurumId = veri?.istekKimligi;
  if (typeof kurumId !== "string" || !ISTEK_KIMLIGI.test(kurumId)) {
    throw new HttpsError("invalid-argument", "istek-gecersiz");
  }
  const ad = adTemizle(veri?.ad);
  const koltuk = koltukKontrol(veri?.koltuk);
  const bitis = lisansBitisMs(veri?.lisansBitis, simdi);
  const mudurEposta = epostaKontrol(veri?.mudurEposta);
  const ozet = istekOzeti(ad, koltuk, bitis, mudurEposta);

  const kurumRef = db().doc(`kurumlar/${kurumId}`);
  const davetRef = db().doc(`yoneticiDavetleri/${mudurEposta}`);

  // Zaten oluşturulmuşsa (aynı istek tekrarı) hesap denetimi atlanır ve mevcut kayıt döner
  const mevcut = await kurumRef.get();
  if (!mevcut.exists && !(await hesapUygunMu(mudurEposta))) {
    throw new HttpsError("failed-precondition", "hesap-kullaniliyor");
  }

  for (let deneme = 0; deneme < KOD_DENEMESI; deneme++) {
    const kod = uretici();
    const sonuc = await db().runTransaction(async (tx) => {
      const [kurumSnap, davetSnap, ayniKod] = await Promise.all([
        tx.get(kurumRef),
        tx.get(davetRef),
        tx.get(db().collection("kurumlar").where("kurumKodu", "==", kod).limit(1)),
      ]);

      if (kurumSnap.exists) {
        // Aynı istek mi? Yalnızca özet eşleşirse mevcut kurum döner; aksi halde çakışma
        if (kurumSnap.data().istekOzeti !== ozet) throw new HttpsError("already-exists", "istek-cakisti");
        return { kurumKodu: kurumSnap.data().kurumKodu, zatenVar: true };
      }

      const davet = davetSnap.data();
      if (davetSnap.exists && davet.iptal !== true) {
        // Bu adres zaten bir dershanede müdür/öğretmen ya da davetli
        throw new HttpsError("already-exists", "davet-var");
      }
      if (!ayniKod.empty) return null; // kod çakışması: yeni kod denenir

      tx.set(kurumRef, {
        ad,
        kurumKodu: kod,
        koltuk,
        uyeSayisi: 0,
        durum: "aktif",
        lisansBitis: Timestamp.fromMillis(bitis),
        istekOzeti: ozet,
        olusturanUid: yonetici.uid,
        olusturma: FieldValue.serverTimestamp(),
      });
      // set: eski (iptal edilmiş) davetin uid/iptal alanlarını temizler
      tx.set(davetRef, {
        kurumId,
        rol: "mudur",
        davetEden: yonetici.uid,
        olusturma: FieldValue.serverTimestamp(),
      });
      return { kurumKodu: kod, zatenVar: false };
    });
    if (sonuc) {
      return { kurumId, ad, koltuk, lisansBitis: bitis, mudurEposta, kurumKodu: sonuc.kurumKodu, zatenVar: sonuc.zatenVar };
    }
  }
  throw new HttpsError("internal", "kod-uretilemedi");
};

const milisaniye = (deger) => (deger && typeof deger.toMillis === "function" ? deger.toMillis() : null);

// Platform yöneticisi için dershane listesi (ad sırasıyla)
const kurumListele = async (uid, token) => {
  await platformDogrula(uid, token);
  const snap = await db().collection("kurumlar").limit(LISTE_SINIRI).get();
  const liste = snap.docs.map((d) => {
    const k = d.data();
    return {
      id: d.id,
      ad: typeof k.ad === "string" ? k.ad : "",
      durum: typeof k.durum === "string" ? k.durum : "",
      koltuk: Number.isInteger(k.koltuk) ? k.koltuk : 0,
      uyeSayisi: Number.isInteger(k.uyeSayisi) ? k.uyeSayisi : 0,
      lisansBitis: milisaniye(k.lisansBitis),
      kurumKodu: typeof k.kurumKodu === "string" ? k.kurumKodu : "",
    };
  });
  liste.sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
  return { kurumlar: liste };
};

// ---------------------------------------------------------------------------
// Dershane yaşam döngüsü: askıya alma, yeniden açma, kapatma (yalnızca platform yöneticisi)
//   aktif --askiyaAl--> askida --yenidenAc--> aktif
//   aktif | askida | kapatiliyor --kurumKapat--> kapatildi   (geri alınamaz)
// Her işlem platformKayitlari koleksiyonuna (istemciye kapalı) denetim kaydı yazar.
// ---------------------------------------------------------------------------
const KURUM_KIMLIGI = /^[A-Za-z0-9_-]{1,64}$/;

const kurumKimligiKontrol = (deger) => {
  if (typeof deger !== "string" || !KURUM_KIMLIGI.test(deger)) {
    throw new HttpsError("invalid-argument", "kurum-gecersiz");
  }
  return deger;
};

const islemKaydi = (tx, islem, kurumId, kurum, yonetici) =>
  tx.set(db().collection("platformKayitlari").doc(), {
    islem,
    kurumId,
    kurumAdi: typeof kurum.ad === "string" ? kurum.ad : "",
    yoneticiUid: yonetici.uid,
    zaman: FieldValue.serverTimestamp(),
  });

// Kurumun tüm yöneticilerinin (müdür/öğretmen) yetki claim'lerini siler. Silinmiş hesaplar atlanır.
// Bir hesap için hata olursa diğerleri yine denenir ve sonunda hata verilir (işlem tekrarlanabilir).
const yoneticiYetkileriniKaldir = async (kurumId) => {
  const ekip = await db().collection(`kurumlar/${kurumId}/yoneticiler`).get();
  let basarisiz = false;
  for (const kayit of ekip.docs) {
    const hedefUid = kayit.data().uid;
    if (typeof hedefUid !== "string" || !hedefUid) continue; // davetli: henüz hesap bağlanmamış
    try {
      await yoneticiYetkisiniKaldir(hedefUid);
    } catch (hata) {
      if (hata?.code !== "auth/user-not-found") {
        console.error("yetki-kaldirilamadi", kurumId, hata?.code || hata?.message);
        basarisiz = true;
      }
    }
  }
  if (basarisiz) throw new HttpsError("internal", "yetki-kaldirilamadi");
};

// Dershaneyi askıya alır: yeni katılım, müdür/öğretmen işlemleri ve yönetici girişi durur; öğrenciler bağlı kalır.
// Müdür/öğretmen claim'leri silinir; güvenlik kuralları da kurum "aktif" değilse yönetici okumasını reddeder.
// Aynı işlem tekrarlanabilir (zaten askıdaysa yalnızca claim silme yeniden denenir). Girdi: { kurumId }
const kurumAskiyaAl = async (uid, token, veri) => {
  const yonetici = await platformDogrula(uid, token);
  const kurumId = kurumKimligiKontrol(veri?.kurumId);
  const kurumRef = db().doc(`kurumlar/${kurumId}`);

  const sonuc = await db().runTransaction(async (tx) => {
    const snap = await tx.get(kurumRef);
    if (!snap.exists) throw new HttpsError("not-found", "kurum-yok");
    const kurum = snap.data();
    if (kurum.durum === "askida") return { zatenAskida: true };
    if (kurum.durum !== "aktif") throw new HttpsError("failed-precondition", "durum-uygun-degil");
    tx.update(kurumRef, {
      durum: "askida",
      askiyaAlma: FieldValue.serverTimestamp(),
      askiyaAlanUid: yonetici.uid,
    });
    islemKaydi(tx, "askiya-al", kurumId, kurum, yonetici);
    return { zatenAskida: false };
  });

  await yoneticiYetkileriniKaldir(kurumId);
  return { kurumId, durum: "askida", zatenAskida: sonuc.zatenAskida };
};

// Askıdaki dershaneyi yeniden açar (lisansı hâlâ geçerliyse). Yöneticiler bir sonraki girişlerinde yetkilerini geri alır.
const kurumYenidenAc = async (uid, token, veri, simdi = Date.now()) => {
  const yonetici = await platformDogrula(uid, token);
  const kurumId = kurumKimligiKontrol(veri?.kurumId);
  const kurumRef = db().doc(`kurumlar/${kurumId}`);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(kurumRef);
    if (!snap.exists) throw new HttpsError("not-found", "kurum-yok");
    const kurum = snap.data();
    if (kurum.durum !== "askida") throw new HttpsError("failed-precondition", "durum-uygun-degil");
    const bitis = milisaniye(kurum.lisansBitis);
    if (bitis === null || bitis <= simdi) throw new HttpsError("failed-precondition", "lisans-gecersiz");
    tx.update(kurumRef, {
      durum: "aktif",
      askiyaAlma: FieldValue.delete(),
      askiyaAlanUid: FieldValue.delete(),
    });
    islemKaydi(tx, "yeniden-ac", kurumId, kurum, yonetici);
  });
  return { kurumId, durum: "aktif" };
};

const adKarsilastir = (a, b) =>
  typeof a === "string" && typeof b === "string" && a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

// Dershaneyi kapatır (GERİ ALINAMAZ). Yanlışlıkla kapatmayı önlemek için dershane adı aynen yazılmalıdır.
// Önce "kapatiliyor" işaretlenir (kapanisNedeni: platform), sonra tüm üyelikler ve yetkiler sonlandırılır.
// Yarıda kalırsa kurum "kapatiliyor" durumunda kalır; gece kontrolü devam ettirir, tekrar çağrı da tamamlar.
// Girdi: { kurumId, onayAdi }
const kurumKapat = async (uid, token, veri) => {
  const yonetici = await platformDogrula(uid, token);
  const kurumId = kurumKimligiKontrol(veri?.kurumId);
  const kurumRef = db().doc(`kurumlar/${kurumId}`);

  const onceki = await db().runTransaction(async (tx) => {
    const snap = await tx.get(kurumRef);
    if (!snap.exists) throw new HttpsError("not-found", "kurum-yok");
    const kurum = snap.data();
    if (kurum.durum === "kapatildi" || kurum.durum === "suresi-doldu") return { kapaliydi: true };
    if (!["aktif", "askida", "kapatiliyor"].includes(kurum.durum)) {
      throw new HttpsError("failed-precondition", "durum-uygun-degil");
    }
    if (!adKarsilastir(veri?.onayAdi, kurum.ad)) throw new HttpsError("failed-precondition", "ad-eslesmedi");
    if (kurum.durum !== "kapatiliyor") {
      tx.update(kurumRef, {
        durum: "kapatiliyor",
        kapanisNedeni: "platform",
        kapatanUid: yonetici.uid,
      });
      islemKaydi(tx, "kapat", kurumId, kurum, yonetici);
    }
    return { kapaliydi: false };
  });
  if (onceki.kapaliydi) return { kurumId, durum: "kapatildi", zatenKapali: true };

  try {
    await kurumuKapat(kurumId);
  } catch (hata) {
    console.error("kapatma-yarim", kurumId, hata?.code || hata?.message);
    throw new HttpsError("internal", "kapatma-yarim");
  }
  const son = (await kurumRef.get()).data()?.durum;
  return { kurumId, durum: son === "suresi-doldu" ? "suresi-doldu" : "kapatildi", zatenKapali: false };
};

module.exports = {
  platformYetkisi,
  kurumOlustur,
  kurumListele,
  kurumAskiyaAl,
  kurumYenidenAc,
  kurumKapat,
  platformDogrula,
  lisansBitisMs,
};
