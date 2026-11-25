// Günlük soru kotası: sunucuda sayılır; uygulama soru belgesini kendisi yazamaz (güvenlik kuralları).
//
// Akış: uygulama fotoğrafı kendi klasörüne (kullanicilar/{uid}/sorular/{zaman}.jpg) yükler, sonra soruGonder'i
// çağırır. Sunucu fotoğrafı doğrular, kotayı bir transaction içinde kontrol edip artırır ve soru belgesini oluşturur.
//
// İki sayaç (yalnızca sunucu yazar, istemciye kapalı):
//   kotaSayaclari/h_{uid}            hesap başına
//   kotaSayaclari/c_{cihaz özeti}    cihaz başına (cihaz kimliği ham saklanmaz, SHA-256 özeti saklanır)
// İkisinden biri günlük sınıra ulaşırsa soru reddedilir. Gün, Türkiye saatine göre (UTC+3) sunucuda hesaplanır.
//
// İnceleme: yapay zekâ bir soruyu güvenle çözemezse çözüm akışı (n8n, sunucu yetkisiyle) durumu "İnceleme Gerekli"
// yapar (yalnızca otomatik denemeleri bittikten sonra; son durumdur). Öğrenci seçer (soruIncelemeKarari):
// "devam" → soru BİR KEZ daha çözüm sırasına ("Bekliyor") alınır, hak iade edilmez. Bu ek deneme her soru için
// yalnızca bir kez kullanılabilir (ekDenemeKullanildi; yalnızca sunucu yazar): aksi hâlde tek hakla sınırsız
// yapay zekâ çağrısı yaptırılabilirdi. "iptal" → soru
// "İptal Edildi" olur (çözüm akışı bir daha işlemez) ve harcanan hak, soru aynı gün içindeyse BİR KEZ geri verilir.
// Soru durumunu istemci doğrudan değiştiremez (firestore.rules); karar yalnızca sunucu üzerinden, yalnızca sorunun
// sahibi tarafından ve yalnızca "İnceleme Gerekli" durumundayken verilebilir. İade için gereken bilgiler
// (uid, cihaz özeti, gün) soru belgesine değil, istemciye tamamen kapalı kotaKayitlari/{soruId} belgesine yazılır;
// bu kayıtlar ertesi gece silinir (eskiKotaKayitlariniSil), hesap silinince de silinir (kotaKayitlariniSil).
//
// Sınırlar Firebase Console'dan değiştirilebilir: ayarlar/kota { ucretsiz: 3, premium: 50 }.
// Belge yoksa ya da değerler geçersizse güvenli varsayılanlar kullanılır.

const crypto = require("crypto");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { HttpsError } = require("firebase-functions/v2/https");
const { premiumDurumu } = require("./premium");

const db = () => getFirestore();

const VARSAYILAN = { ucretsiz: 3, premium: 50 };
const SINIR_EN_FAZLA = 1000;
const SECIMLER = ["A", "B", "C", "D", "E", "Bilinmiyor"];
// Android ID (16 onaltılık) ya da iOS satıcı kimliği (UUID); biçim dışı değerler reddedilir
const CIHAZ_BICIMI = /^[A-Za-z0-9-]{8,64}$/;
const EN_BUYUK_FOTO = 10 * 1024 * 1024;
const TURKIYE_FARKI_MS = 3 * 60 * 60 * 1000;
// Çözüm akışının (n8n) güvenle çözemediği sorular için yazdığı durum; birebir bu metin olmalı
const INCELEME_DURUMU = "İnceleme Gerekli";
// Öğrencinin iptal ettiği soru: çözüm akışı bu durumdaki soruyu işlemez, sonuç yazmaz
const IPTAL_DURUMU = "İptal Edildi";
// Çözüm sırasında bekleyen soru (soruGonder ilk kez, "devam" kararı ek deneme için yazar)
const BEKLIYOR_DURUMU = "Bekliyor";
const KARARLAR = ["devam", "iptal"];
const TOPLU_BOYUT = 400;

// Türkiye takvim günü (YYYY-AA-GG); Türkiye yaz saati uygulamaz, fark sabit UTC+3
const turkiyeGunu = (ms = Date.now()) => new Date(ms + TURKIYE_FARKI_MS).toISOString().slice(0, 10);

const sinirGecerli = (deger) => Number.isInteger(deger) && deger >= 0 && deger <= SINIR_EN_FAZLA;

// Saf: ayar belgesinden geçerli sınırlar (geçersiz alan varsayılana döner)
const sinirlariCoz = (veri) => ({
  ucretsiz: sinirGecerli(veri?.ucretsiz) ? veri.ucretsiz : VARSAYILAN.ucretsiz,
  premium: sinirGecerli(veri?.premium) ? veri.premium : VARSAYILAN.premium,
});

const sinirlariOku = async () => sinirlariCoz((await db().doc("ayarlar/kota").get()).data());

// Saf: bir sayaç belgesinin bugünkü kullanımı (başka güne aitse 0)
const bugunkuKullanim = (sayac, gun) =>
  sayac && sayac.gun === gun && Number.isInteger(sayac.sayi) && sayac.sayi > 0 ? sayac.sayi : 0;

// Saf: kalan hak = sınır - (hesap ve cihaz kullanımından büyük olanı), en az 0
const kalanHak = (sinir, hesapKullanim, cihazKullanim) =>
  Math.max(0, sinir - Math.max(hesapKullanim, cihazKullanim));

const cihazKontrol = (cihazId) => {
  if (typeof cihazId !== "string" || !CIHAZ_BICIMI.test(cihazId)) {
    throw new HttpsError("invalid-argument", "cihaz-gecersiz");
  }
  return cihazId;
};

const cihazOzeti = (cihazId) =>
  crypto.createHash("sha256").update("mikro-cihaz:" + cihazId).digest("hex");

const sayacRefleri = (uid, cihazId) => ({
  hesap: db().doc(`kotaSayaclari/h_${uid}`),
  cihaz: db().doc(`kotaSayaclari/c_${cihazOzeti(cihazId)}`),
});

// Soru gönderebilecek kullanıcı: profili olan ve rolü öğrenci (rol alanı olmayan eski hesaplar öğrenci sayılır)
const ogrenciProfili = (snap) => {
  if (!snap.exists) throw new HttpsError("failed-precondition", "profil-yok");
  const veri = snap.data();
  const rol = veri.rol === undefined ? "ogrenci" : veri.rol;
  if (rol !== "ogrenci") throw new HttpsError("permission-denied", "rol-uygun-degil");
  return veri;
};

// Kalan hak (soru göndermeden önce ve Hesabım ekranı için). Girdi: { cihazId }
// Dönüş: { kalan, sinir, premiumMu, ucretsizSinir, premiumSinir }
const kotaDurumu = async (uid, token, veri) => {
  const cihazId = cihazKontrol(veri?.cihazId);
  const sinirlar = await sinirlariOku();
  const refler = sayacRefleri(uid, cihazId);
  const [profilSnap, hesapSnap, cihazSnap] = await Promise.all([
    db().doc(`kullanicilar/${uid}`).get(),
    refler.hesap.get(),
    refler.cihaz.get(),
  ]);
  const profil = ogrenciProfili(profilSnap);
  const premiumMu = premiumDurumu(profil);
  const sinir = premiumMu ? sinirlar.premium : sinirlar.ucretsiz;
  const gun = turkiyeGunu();
  return {
    kalan: kalanHak(sinir, bugunkuKullanim(hesapSnap.data(), gun), bugunkuKullanim(cihazSnap.data(), gun)),
    sinir,
    premiumMu,
    // Abonelik kartı ve premium metinleri için iki paketin günlük sınırı (ayarlar/kota; gizli değil)
    ucretsizSinir: sinirlar.ucretsiz,
    premiumSinir: sinirlar.premium,
  };
};

// Fotoğraf yolu yalnızca çağıranın kendi soru klasöründe olabilir
const fotoYoluKontrol = (uid, yol) => {
  const bicim = new RegExp(`^kullanicilar/${uid}/sorular/\\d{10,16}\\.jpg$`);
  if (typeof yol !== "string" || !bicim.test(yol)) throw new HttpsError("invalid-argument", "foto-gecersiz");
  return yol;
};

// Storage'daki fotoğrafı doğrular ve uygulamanın/n8n'in kullandığı indirme bağlantısını üretir
// (yükleme sırasında Storage'ın verdiği mevcut erişim anahtarı kullanılır, yenisi üretilmez).
const fotoBaglantisi = async (yol) => {
  const kova = getStorage().bucket();
  let meta;
  try {
    [meta] = await kova.file(yol).getMetadata();
  } catch (hata) {
    if (hata?.code === 404) throw new HttpsError("failed-precondition", "foto-yok");
    throw hata;
  }
  const boyut = Number(meta.size);
  if (!(typeof meta.contentType === "string" && meta.contentType.startsWith("image/"))) {
    throw new HttpsError("failed-precondition", "foto-gecersiz");
  }
  if (!Number.isFinite(boyut) || boyut <= 0 || boyut > EN_BUYUK_FOTO) {
    throw new HttpsError("failed-precondition", "foto-gecersiz");
  }
  const anahtar = String(meta.metadata?.firebaseStorageDownloadTokens || "").split(",")[0].trim();
  if (!anahtar) throw new HttpsError("failed-precondition", "foto-yok");
  return `https://firebasestorage.googleapis.com/v0/b/${kova.name}/o/${encodeURIComponent(yol)}?alt=media&token=${anahtar}`;
};

// Aynı fotoğraf için tekrarlanan istek (ağ kopması) ikinci soru açmaz ve kotayı iki kez düşmez
const soruKimligi = (uid, yol) =>
  crypto.createHash("sha256").update(`${uid}|${yol}`).digest("hex").slice(0, 32);

// Soru gönder. Girdi: { fotoYolu, ogrenciSecimi, cihazId }
const soruGonder = async (uid, token, veri, simdi = Date.now()) => {
  const fotoYolu = fotoYoluKontrol(uid, veri?.fotoYolu);
  const ogrenciSecimi = veri?.ogrenciSecimi;
  if (typeof ogrenciSecimi !== "string" || !SECIMLER.includes(ogrenciSecimi)) {
    throw new HttpsError("invalid-argument", "secim-gecersiz");
  }
  const cihazId = cihazKontrol(veri?.cihazId);

  // Profil ve rol transaction'dan önce de denetlenir: yetkisiz kullanıcı Storage'a hiç sorgu yaptıramaz
  ogrenciProfili(await db().doc(`kullanicilar/${uid}`).get());
  const sinirlar = await sinirlariOku();
  const fotoLink = await fotoBaglantisi(fotoYolu);

  const refler = sayacRefleri(uid, cihazId);
  const soruRef = db().doc(`sorular/${soruKimligi(uid, fotoYolu)}`);
  const profilRef = db().doc(`kullanicilar/${uid}`);
  const gun = turkiyeGunu(simdi);

  return db().runTransaction(async (tx) => {
    const [soruSnap, profilSnap, hesapSnap, cihazSnap] = await Promise.all([
      tx.get(soruRef),
      tx.get(profilRef),
      tx.get(refler.hesap),
      tx.get(refler.cihaz),
    ]);
    const profil = ogrenciProfili(profilSnap);
    // Kaynaklardan hesaplanır: bitiş tarihi geçmiş abonelik, haber gelmemiş olsa bile sayılmaz
    const premiumMu = premiumDurumu(profil, simdi);
    const sinir = premiumMu ? sinirlar.premium : sinirlar.ucretsiz;
    const hesapKullanim = bugunkuKullanim(hesapSnap.data(), gun);
    const cihazKullanim = bugunkuKullanim(cihazSnap.data(), gun);

    if (soruSnap.exists) {
      // Aynı istek tekrarı: yeni soru yok, kota düşmez
      return { soruId: soruRef.id, kalan: kalanHak(sinir, hesapKullanim, cihazKullanim), sinir, premiumMu, zatenVar: true };
    }
    if (hesapKullanim >= sinir || cihazKullanim >= sinir) {
      throw new HttpsError("resource-exhausted", "kota-doldu", { sinir, premiumMu });
    }

    tx.set(refler.hesap, { gun, sayi: hesapKullanim + 1, guncelleme: FieldValue.serverTimestamp() });
    tx.set(refler.cihaz, { gun, sayi: cihazKullanim + 1, guncelleme: FieldValue.serverTimestamp() });
    // İade için (yalnızca sunucu okur; ham cihaz kimliği değil özeti)
    tx.set(db().doc(`kotaKayitlari/${soruRef.id}`), {
      uid,
      cihaz: cihazOzeti(cihazId),
      gun,
      olusturma: FieldValue.serverTimestamp(),
    });
    tx.set(soruRef, {
      kullaniciUid: uid,
      kullaniciEposta: typeof token?.email === "string" ? token.email : null,
      fotoLink,
      tarih: new Date(simdi).toISOString(),
      durum: BEKLIYOR_DURUMU,
      ogrenciSecimi,
    });
    return {
      soruId: soruRef.id,
      kalan: kalanHak(sinir, hesapKullanim + 1, cihazKullanim + 1),
      sinir,
      premiumMu,
      zatenVar: false,
    };
  });
};

const SORU_KIMLIGI_BICIMI = /^[A-Za-z0-9]{1,64}$/;

// İade adımı (bir transaction içinde, tüm okumalardan sonra yazar). Her soru için en fazla bir kez; yalnızca
// sorunun sorulduğu Türkiye günü içinde (sayaçlar her gün sıfırlanır: eski günlerden biriken soruları bugün iptal
// ederek günlük sınırı aşmak mümkün olmasın). Sayaç asla eksiye düşmez.
// Dönüş: "iade-edildi" | "zaten-iade" | "kayit-yok" | "gun-gecti"
const iadeOku = async (tx, soruId) => {
  const kayitRef = db().doc(`kotaKayitlari/${soruId}`);
  const kayitSnap = await tx.get(kayitRef);
  if (!kayitSnap.exists) return { kayitRef, kayit: null, sayaclar: [] };
  const kayit = kayitSnap.data();
  const refler = [db().doc(`kotaSayaclari/h_${kayit.uid}`), db().doc(`kotaSayaclari/c_${kayit.cihaz}`)];
  const snaplar = await Promise.all(refler.map((r) => tx.get(r)));
  return { kayitRef, kayit, sayaclar: refler.map((ref, i) => ({ ref, veri: snaplar[i].data() })) };
};

const iadeYaz = (tx, okunan, simdi) => {
  const { kayitRef, kayit, sayaclar } = okunan;
  if (!kayit) return "kayit-yok";
  if (kayit.iade === true) return "zaten-iade";
  if (kayit.gun !== turkiyeGunu(simdi)) {
    tx.update(kayitRef, { iade: true, iadeSonucu: "gun-gecti" });
    return "gun-gecti";
  }
  for (const { ref, veri } of sayaclar) {
    if (veri && veri.gun === kayit.gun && Number.isInteger(veri.sayi) && veri.sayi > 0) {
      tx.update(ref, { sayi: veri.sayi - 1, guncelleme: FieldValue.serverTimestamp() });
    }
  }
  tx.update(kayitRef, { iade: true, iadeSonucu: "iade-edildi" });
  return "iade-edildi";
};

// Öğrencinin inceleme kararı. Girdi: { soruId, karar: "devam" | "iptal" }
// Yalnızca sorunun sahibi, yalnızca durum "İnceleme Gerekli" iken. Dönüş: { durum, iade? }
const soruIncelemeKarari = async (uid, veri, simdi = Date.now()) => {
  const soruId = veri?.soruId;
  const karar = veri?.karar;
  if (typeof soruId !== "string" || !SORU_KIMLIGI_BICIMI.test(soruId)) {
    throw new HttpsError("invalid-argument", "soru-gecersiz");
  }
  if (!KARARLAR.includes(karar)) throw new HttpsError("invalid-argument", "karar-gecersiz");
  const soruRef = db().doc(`sorular/${soruId}`);

  return db().runTransaction(async (tx) => {
    const soruSnap = await tx.get(soruRef);
    // Var olmayan ve başkasına ait soru aynı cevabı alır (başkasının soru kimliği yoklanamasın)
    if (!soruSnap.exists || soruSnap.get("kullaniciUid") !== uid) {
      throw new HttpsError("not-found", "soru-yok");
    }
    if (soruSnap.get("durum") !== INCELEME_DURUMU) {
      throw new HttpsError("failed-precondition", "durum-uygun-degil");
    }
    if (karar === "devam") {
      if (soruSnap.get("ekDenemeKullanildi") === true) {
        throw new HttpsError("failed-precondition", "devam-hakki-yok");
      }
      tx.update(soruRef, {
        durum: BEKLIYOR_DURUMU,
        kullaniciKarari: "devam",
        ekDenemeKullanildi: true,
        kararTarihi: FieldValue.serverTimestamp(),
      });
      return { durum: BEKLIYOR_DURUMU };
    }
    const okunan = await iadeOku(tx, soruId);
    const iade = iadeYaz(tx, okunan, simdi);
    tx.update(soruRef, {
      durum: IPTAL_DURUMU,
      kullaniciKarari: "iptal",
      kararTarihi: FieldValue.serverTimestamp(),
      hakIadeEdildi: iade === "iade-edildi",
    });
    return { durum: IPTAL_DURUMU, iade };
  });
};

const topluSil = async (sorgu) => {
  let silinen = 0;
  for (;;) {
    const snap = await sorgu.limit(TOPLU_BOYUT).get();
    if (snap.empty) return silinen;
    const batch = db().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    silinen += snap.size;
  }
};

// Gece görevi: bugünden eski iade kayıtları silinir (iade yalnızca aynı gün geçerli; KVKK: gereksiz veri tutulmaz)
const eskiKotaKayitlariniSil = (simdi = Date.now()) =>
  topluSil(db().collection("kotaKayitlari").where("gun", "<", turkiyeGunu(simdi)));

// Hesap silme: kullanıcının iade kayıtları silinir
const kotaKayitlariniSil = (uid) => topluSil(db().collection("kotaKayitlari").where("uid", "==", uid));

module.exports = {
  soruGonder,
  kotaDurumu,
  soruIncelemeKarari,
  eskiKotaKayitlariniSil,
  kotaKayitlariniSil,
  INCELEME_DURUMU,
  IPTAL_DURUMU,
  // test için
  turkiyeGunu,
  sinirlariCoz,
  bugunkuKullanim,
  kalanHak,
  cihazOzeti,
  soruKimligi,
  VARSAYILAN,
};
