// Veli–öğrenci bağlantısı yalnızca sunucuda kurulur.
//
// Neden: Güvenlik kuralları veliyi, velinin kendi belgesindeki bagliOgrenciIdleri listesinden tanır
// (veliMi). Bu listeyi istemci yazabilseydi, kod bilmeden herhangi bir öğrencinin profilini ve
// sorularını okuyabilirdi. Artık:
//   - bagliOgrenciIdleri, bagliOgrenciler ve baglantiKodu alanlarını yalnızca sunucu yazar,
//   - baglantiKodlari koleksiyonu istemciye tamamen kapalıdır (kod → öğrenci eşlemesi sızmaz),
//   - yanlış kod denemeleri saatte ve günde sınırlıdır (kaba kuvvetle kod taraması engellenir),
//   - kodlar kriptografik rastgele üretilir.
//
// Koleksiyonlar (yalnızca Admin SDK):
//   baglantiKodlari/{KOD}   { uid, olusturma }
//   veliDenemeleri/{uid}    { saat, saatYanlis, gun, gunYanlis }

const crypto = require("crypto");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");
const { guvenliIsim } = require("./isim");
const { listedenCikar } = require("./veli");

const db = () => getFirestore();

const KARAKTERLER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const KOD_BICIMI = /^[A-Z0-9]{6}$/;
const UID_BICIMI = /^[A-Za-z0-9]{1,128}$/;
const KOD_URETME_DENEMESI = 10;
const SAATLIK_YANLIS = 10;
const GUNLUK_YANLIS = 30;
const EN_FAZLA_OGRENCI = 10;

// Saf: kriptografik rastgele 6 karakterlik kod
const kodUret = () => {
  let kod = "";
  for (let i = 0; i < 6; i++) kod += KARAKTERLER[crypto.randomInt(KARAKTERLER.length)];
  return kod;
};

// Saf: istemciden gelen kodu temizler (küçük harf/boşluk toleransı); biçim dışıysa null
const kodTemizle = (girdi) => {
  if (typeof girdi !== "string" || girdi.length > 20) return null;
  const kod = girdi.replace(/\s+/g, "").toUpperCase();
  return KOD_BICIMI.test(kod) ? kod : null;
};

const saatAnahtari = (ms) => new Date(ms).toISOString().slice(0, 13);
const gunAnahtari = (ms) => new Date(ms).toISOString().slice(0, 10);

// Saf: deneme kaydının şu anki pencerelere göre değerleri
const denemeDurumu = (kayit, simdi) => {
  const saat = saatAnahtari(simdi);
  const gun = gunAnahtari(simdi);
  return {
    saat,
    gun,
    saatYanlis: kayit?.saat === saat && Number.isInteger(kayit.saatYanlis) ? kayit.saatYanlis : 0,
    gunYanlis: kayit?.gun === gun && Number.isInteger(kayit.gunYanlis) ? kayit.gunYanlis : 0,
  };
};

const sinirDolduMu = (d) => d.saatYanlis >= SAATLIK_YANLIS || d.gunYanlis >= GUNLUK_YANLIS;

const ogrenciRolundeMi = (veri) => (veri?.rol === undefined ? "ogrenci" : veri.rol) === "ogrenci";

// Öğrenci: kendi bağlantı kodunu alır (yoksa oluşturulur). Dönüş: { kod }
const baglantiKoduAl = async (uid) => {
  const profilRef = db().doc(`kullanicilar/${uid}`);
  const profil = await profilRef.get();
  if (!profil.exists) throw new HttpsError("failed-precondition", "profil-yok");
  if (!ogrenciRolundeMi(profil.data())) throw new HttpsError("permission-denied", "rol-uygun-degil");

  const mevcut = profil.data().baglantiKodu;
  if (typeof mevcut === "string" && KOD_BICIMI.test(mevcut)) {
    const kayit = await db().doc(`baglantiKodlari/${mevcut}`).get();
    if (kayit.exists && kayit.data().uid === uid) return { kod: mevcut };
    if (!kayit.exists) {
      // Eski hesap: profilde kod var ama kaydı yok. Kayıt yalnızca kod boştaysa oluşturulur.
      const sonuc = await db().runTransaction(async (tx) => {
        const k = await tx.get(db().doc(`baglantiKodlari/${mevcut}`));
        if (k.exists) return k.data().uid === uid;
        tx.create(db().doc(`baglantiKodlari/${mevcut}`), { uid, olusturma: FieldValue.serverTimestamp() });
        return true;
      });
      if (sonuc) return { kod: mevcut };
    }
  }

  for (let i = 0; i < KOD_URETME_DENEMESI; i++) {
    const kod = kodUret();
    const kodRef = db().doc(`baglantiKodlari/${kod}`);
    const alindi = await db().runTransaction(async (tx) => {
      const [k, p] = await Promise.all([tx.get(kodRef), tx.get(profilRef)]);
      if (k.exists) return false;
      if (!p.exists) throw new HttpsError("failed-precondition", "profil-yok");
      tx.create(kodRef, { uid, olusturma: FieldValue.serverTimestamp() });
      tx.update(profilRef, { baglantiKodu: kod });
      return true;
    });
    if (alindi) return { kod };
  }
  throw new HttpsError("internal", "kod-uretilemedi");
};

// Veli: öğrencinin bağlantı koduyla bağlanır. Girdi: { kod }. Dönüş: { ogrenci: { id, isim }, zatenVar }
const veliBagla = async (uid, veri, simdi = Date.now()) => {
  const kod = kodTemizle(veri?.kod);
  if (!kod) throw new HttpsError("invalid-argument", "kod-gecersiz");

  const veliRef = db().doc(`kullanicilar/${uid}`);
  const denemeRef = db().doc(`veliDenemeleri/${uid}`);
  const kodRef = db().doc(`baglantiKodlari/${kod}`);

  // Sonuç transaction dışında fırlatılır: yanlış kod sayacı transaction içinde kalıcı olarak yazılmalı
  const sonuc = await db().runTransaction(async (tx) => {
    const [veliSnap, denemeSnap, kodSnap] = await Promise.all([tx.get(veliRef), tx.get(denemeRef), tx.get(kodRef)]);

    if (!veliSnap.exists) return { hata: ["failed-precondition", "profil-yok"] };
    const veli = veliSnap.data();
    if (veli.rol !== "veli") return { hata: ["permission-denied", "rol-uygun-degil"] };

    const durum = denemeDurumu(denemeSnap.exists ? denemeSnap.data() : null, simdi);
    if (sinirDolduMu(durum)) return { hata: ["resource-exhausted", "cok-fazla-deneme"] };

    const yanlisSay = () => {
      tx.set(denemeRef, {
        saat: durum.saat,
        saatYanlis: durum.saatYanlis + 1,
        gun: durum.gun,
        gunYanlis: durum.gunYanlis + 1,
      });
    };

    const ogrenciId = kodSnap.exists ? kodSnap.data().uid : null;
    if (typeof ogrenciId !== "string" || !UID_BICIMI.test(ogrenciId)) {
      yanlisSay();
      return { hata: ["not-found", "kod-bulunamadi"] };
    }
    if (ogrenciId === uid) return { hata: ["invalid-argument", "kendi-hesabi"] };

    const ogrenciSnap = await tx.get(db().doc(`kullanicilar/${ogrenciId}`));
    if (!ogrenciSnap.exists || !ogrenciRolundeMi(ogrenciSnap.data())) {
      // Silinmiş ya da rolü değişmiş hesabın kodu: bulunamadı gibi davranılır (bilgi sızdırılmaz)
      yanlisSay();
      return { hata: ["not-found", "kod-bulunamadi"] };
    }

    const ogrenciVeri = ogrenciSnap.data();
    const isim =
      guvenliIsim(ogrenciVeri.adSoyad) ||
      guvenliIsim(String(ogrenciVeri.eposta || "").split("@")[0]) ||
      "Öğrenci";

    const idler = Array.isArray(veli.bagliOgrenciIdleri) ? veli.bagliOgrenciIdleri : [];
    const liste = Array.isArray(veli.bagliOgrenciler) ? veli.bagliOgrenciler : [];
    if (idler.includes(ogrenciId)) {
      return { ogrenci: { id: ogrenciId, isim }, zatenVar: true };
    }
    if (idler.length >= EN_FAZLA_OGRENCI) return { hata: ["resource-exhausted", "ogrenci-siniri"] };

    const ogrenci = { id: ogrenciId, isim };
    tx.update(veliRef, {
      bagliOgrenciIdleri: [...idler, ogrenciId],
      bagliOgrenciler: [...liste.filter((o) => !(o && o.id === ogrenciId)), ogrenci],
    });
    return { ogrenci, zatenVar: false };
  });

  if (sonuc.hata) throw new HttpsError(sonuc.hata[0], sonuc.hata[1]);
  return sonuc;
};

// Veli: bir öğrencinin bağlantısını kaldırır. Girdi: { ogrenciId }. Dönüş: { kaldirildi }
const veliBaglantisiKaldir = async (uid, veri) => {
  const ogrenciId = veri?.ogrenciId;
  if (typeof ogrenciId !== "string" || !UID_BICIMI.test(ogrenciId)) {
    throw new HttpsError("invalid-argument", "ogrenci-gecersiz");
  }
  const veliRef = db().doc(`kullanicilar/${uid}`);
  const kaldirildi = await db().runTransaction(async (tx) => {
    const snap = await tx.get(veliRef);
    if (!snap.exists) return false;
    const yeni = listedenCikar(snap.data(), ogrenciId);
    if (!yeni) return false;
    tx.update(veliRef, yeni);
    return true;
  });
  return { kaldirildi };
};

// Hesap silinince öğrencinin bağlantı kodu kaydı da silinir (kod başka birine geçmez, eşleme kalmaz)
const kodKayitlariniSil = async (uid) => {
  if (typeof uid !== "string" || !uid) return 0;
  const kayitlar = await db().collection("baglantiKodlari").where("uid", "==", uid).get();
  await Promise.all(kayitlar.docs.map((d) => d.ref.delete()));
  return kayitlar.size;
};

module.exports = {
  baglantiKoduAl,
  veliBagla,
  veliBaglantisiKaldir,
  kodKayitlariniSil,
  // test için
  kodUret,
  kodTemizle,
  denemeDurumu,
  sinirDolduMu,
  SAATLIK_YANLIS,
  GUNLUK_YANLIS,
  EN_FAZLA_OGRENCI,
};
