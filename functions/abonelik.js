// Mağaza aboneliği (RevenueCat): Apple / Google satın almalarından premium.
//
// Akış:  Apple/Google → RevenueCat → (bildirim) abonelikBildirimi → RevenueCat REST API'ye SORULUR → premium yazılır
//        Uygulama "satın aldım / geri yükle" sonrası abonelikYenile'yi çağırır → aynı eşitleme hemen yapılır
//
// GÜVENLİK İLKELERİ
//  1) Bildirimin İÇERİĞİNE güvenilmez. Bildirim yalnızca "şu kullanıcıyı kontrol et" anlamına gelir; premium kararı
//     her zaman RevenueCat REST API'den (gizli anahtarla) okunan güncel duruma göre verilir. Bu, RevenueCat'in de
//     önerdiği yöntemdir; aynı bildirimin iki kez ya da sırasız gelmesi sonucu değiştirmez.
//  2) Bildirim iki ayrı gizli bilgiyle doğrulanır: Authorization başlığı + HMAC-SHA256 imza (zaman damgalı, 5 dk).
//     İkisi de tutmazsa hiçbir şey okunmaz ve yazılmaz. Karşılaştırmalar sabit sürelidir (zamanlama saldırısı yok).
//  3) Premium alanlarını yalnızca sunucu yazar (firestore.rules sunucuAlanlari). Eşitleme kaydı (abonelikEsitleme)
//     istemciye tamamen kapalıdır; aksi halde istemci "son sorgu zamanını" ileri alıp süre bitimini engelleyebilirdi.
//  4) RevenueCat kullanıcı kimliği = Firebase uid. Anonim / biçimsiz kimlikler yok sayılır; kullanıcı belgesi
//     olmayan kimlik için hiçbir şey oluşturulmaz.
//  5) Anahtarlar Secret Manager'dadır (index.js defineSecret); bu dosyada ve git'te anahtar yoktur.
//  6) Test (sandbox) satın almaları kabul edilir (Apple incelemesi bunu gerektirir). Taklit edilemezler: durum
//     RevenueCat → Apple'dan doğrulanır; gerçek App Store kullanıcıları sandbox kullanamaz; sandbox abonelikleri
//     Apple tarafından en geç ~1 saatte sonlandırılır.

const crypto = require("crypto");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { premiumGuncellemesi } = require("./premium");

const db = () => getFirestore();

// RevenueCat yetkisi (entitlement): panelde adı (lookup key) "premium". REST API v2 ise müşteri kaydında yetkiyi
// adıyla değil DAHİLİ kimliğiyle ("entl..." biçiminde) döndürür; bu kimlik .env'deki RC_YETKI_KIMLIGI'dir.
// Kimlik yoksa / biçimsizse eşitleme hiç yapılmaz (yanlış ayarla premium verilmez, alınmaz).
const YETKI_KIMLIGI_BICIMI = /^entl[A-Za-z0-9]{1,60}$/;
const IMZA_TOLERANSI_SN = 5 * 60;
const EN_FAZLA_GOVDE = 64 * 1024; // RevenueCat bildirimleri birkaç KB'dir
const EN_FAZLA_KIMLIK = 20;
const UID_BICIMI = /^[A-Za-z0-9]{1,128}$/; // Firebase uid; "$RCAnonymousID:..." gibi kimlikler elenir
const EN_UZUN_ABONELIK_MS = 400 * 24 * 60 * 60 * 1000; // yıllık paketten uzun bitiş tarihi kısılır
const API_ZAMAN_ASIMI_MS = 10 * 1000;
const YENILEME_ARALIGI_MS = 10 * 1000; // abonelikYenile: kullanıcı başına 10 saniyede bir

// ---------------------------------------------------------------- saf doğrulamalar

const sabitSureliEsit = (a, b) => {
  // Uzunluk farkını da sızdırmamak için önce özet alınır
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// Authorization başlığı: RevenueCat panelinde girilen gizli değerin aynısı gelmeli
const yetkiDogrula = (gelen, beklenen) => {
  if (typeof beklenen !== "string" || beklenen.length < 16) return false; // zayıf/boş gizli kabul edilmez
  if (typeof gelen !== "string" || gelen.length === 0 || gelen.length > 1024) return false;
  return sabitSureliEsit(gelen, beklenen);
};

// X-RevenueCat-Webhook-Signature: "t=<unix sn>,v1=<hex hmac>"; imza = HMAC-SHA256(gizli, "<t>.<ham gövde>")
const imzaDogrula = (hamGovde, baslik, gizli, simdiMs = Date.now()) => {
  if (!Buffer.isBuffer(hamGovde) || typeof gizli !== "string" || gizli.length < 16) return false;
  if (typeof baslik !== "string" || baslik.length === 0 || baslik.length > 1024) return false;
  let t = null;
  const imzalar = [];
  for (const parca of baslik.split(",")) {
    const esittir = parca.indexOf("=");
    if (esittir < 0) continue;
    const anahtar = parca.slice(0, esittir).trim();
    const deger = parca.slice(esittir + 1).trim();
    if (anahtar === "t") t = deger;
    else if (anahtar === "v1") imzalar.push(deger);
  }
  if (t === null || !/^\d{1,12}$/.test(t) || imzalar.length === 0) return false;
  if (Math.abs(simdiMs / 1000 - Number(t)) > IMZA_TOLERANSI_SN) return false; // eski / ileri tarihli: tekrar oynatma
  const beklenen = crypto.createHmac("sha256", gizli).update(`${t}.`).update(hamGovde).digest();
  return imzalar.some(
    (v) => /^[0-9a-f]{64}$/i.test(v) && crypto.timingSafeEqual(Buffer.from(v, "hex"), beklenen)
  );
};

// Bildirimden kontrol edilecek kullanıcılar (aktarmada hem eski hem yeni sahip)
const bildirimKimlikleri = (olay) => {
  const liste = (d) => (Array.isArray(d) ? d : []);
  const adaylar = [
    olay?.app_user_id,
    olay?.original_app_user_id,
    ...liste(olay?.aliases),
    ...liste(olay?.transferred_from),
    ...liste(olay?.transferred_to),
  ];
  return [...new Set(adaylar.filter((k) => typeof k === "string" && UID_BICIMI.test(k)))].slice(0, EN_FAZLA_KIMLIK);
};

const yetkiKimligiKontrol = (yetkiKimligi) => {
  if (typeof yetkiKimligi !== "string" || !YETKI_KIMLIGI_BICIMI.test(yetkiKimligi)) {
    throw new Error("revenuecat-yetki-kimligi-yok");
  }
};

// RevenueCat müşteri kaydından abonelik: { aktif: true, bitis: Date } ya da null
const abonelikHesapla = (musteri, yetkiKimligi, simdi = Date.now()) => {
  yetkiKimligiKontrol(yetkiKimligi);
  const kalemler = musteri?.active_entitlements?.items;
  if (!Array.isArray(kalemler)) return null;
  const yetki = kalemler.find((k) => k?.entitlement_id === yetkiKimligi);
  const bitis = Number(yetki?.expires_at);
  if (!Number.isFinite(bitis) || bitis <= simdi) return null; // süresiz ya da bitmiş: abonelik sayılmaz
  return { aktif: true, bitis: new Date(Math.min(bitis, simdi + EN_UZUN_ABONELIK_MS)) };
};

// ---------------------------------------------------------------- RevenueCat REST API (v2)

const apiAdresi = (projeId, uid) =>
  `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projeId)}/customers/${encodeURIComponent(uid)}`;

const istek = async (adres, { yontem, anahtar, fetchFn }) => {
  const kesici = new AbortController();
  const zamanlayici = setTimeout(() => kesici.abort(), API_ZAMAN_ASIMI_MS);
  try {
    return await fetchFn(adres, {
      method: yontem,
      headers: { Authorization: `Bearer ${anahtar}`, Accept: "application/json" },
      signal: kesici.signal,
    });
  } finally {
    clearTimeout(zamanlayici);
  }
};

const ayarKontrol = (projeId, anahtar, uid) => {
  if (typeof projeId !== "string" || !projeId) throw new Error("revenuecat-proje-yok");
  if (typeof anahtar !== "string" || !anahtar) throw new Error("revenuecat-anahtar-yok");
  if (typeof uid !== "string" || !UID_BICIMI.test(uid)) throw new Error("gecersiz-kimlik");
};

// Müşteri kaydı; yoksa null. Başka her hata fırlatılır (bildirim 500 döner, RevenueCat yeniden dener).
const musteriGetir = async (uid, { projeId, anahtar, fetchFn = fetch }) => {
  ayarKontrol(projeId, anahtar, uid);
  const yanit = await istek(apiAdresi(projeId, uid), { yontem: "GET", anahtar, fetchFn });
  if (yanit.status === 404) return null;
  if (yanit.status !== 200) throw new Error(`revenuecat-okuma-${yanit.status}`);
  return yanit.json();
};

// KVKK: hesap silinince RevenueCat müşteri kaydı da silinir (yoksa sorun değil)
const musteriSil = async (uid, { projeId, anahtar, fetchFn = fetch }) => {
  ayarKontrol(projeId, anahtar, uid);
  const yanit = await istek(apiAdresi(projeId, uid), { yontem: "DELETE", anahtar, fetchFn });
  if (yanit.status === 200 || yanit.status === 404) return yanit.status === 200;
  throw new Error(`revenuecat-silme-${yanit.status}`);
};

// ---------------------------------------------------------------- eşitleme

// RevenueCat'teki güncel durumu kullanıcı belgesine yazar. Sorgu zamanı saklanır: daha önce başlamış ama geç biten
// bir sorgu, daha yeni bir sorgunun sonucunu ezemez (sırasız bildirim / eşzamanlı çağrı).
const abonelikEsitle = async (uid, { getir, yetkiKimligi, simdi = () => Date.now() }) => {
  yetkiKimligiKontrol(yetkiKimligi); // ayar eksikse fırlatılır: hiçbir şey okunmaz / yazılmaz
  if (typeof uid !== "string" || !UID_BICIMI.test(uid)) return { durum: "gecersiz-kimlik" };
  const kullaniciRef = db().doc(`kullanicilar/${uid}`);
  if (!(await kullaniciRef.get()).exists) return { durum: "kullanici-yok" }; // gereksiz API çağrısı yapılmaz

  const sorguMs = simdi();
  const musteri = await getir(uid); // hata: fırlatılır, hiçbir şey yazılmaz
  const abonelik = abonelikHesapla(musteri, yetkiKimligi, sorguMs);
  const esitlemeRef = db().doc(`abonelikEsitleme/${uid}`);

  return db().runTransaction(async (tx) => {
    const [kullanici, esitleme] = await Promise.all([tx.get(kullaniciRef), tx.get(esitlemeRef)]);
    if (!kullanici.exists) return { durum: "kullanici-yok" };
    const oncekiSorgu = Number(esitleme.exists ? esitleme.get("sorguMs") : 0) || 0;
    if (oncekiSorgu > sorguMs) return { durum: "eski-sorgu" };
    const guncelleme = premiumGuncellemesi(kullanici.data(), { abonelik: abonelik || null }, { simdi: sorguMs });
    tx.update(kullaniciRef, guncelleme);
    tx.set(esitlemeRef, { sorguMs, guncellendi: FieldValue.serverTimestamp() }, { merge: true });
    return { durum: "guncellendi", premium: guncelleme.premiumMu, abonelik: Boolean(abonelik) };
  });
};

// abonelikYenile için hız sınırı: kullanıcı başına YENILEME_ARALIGI_MS'de bir (RevenueCat API kotasını korur)
const yenilemeHakkiKullan = (uid, simdi = Date.now()) => {
  const ref = db().doc(`abonelikEsitleme/${uid}`);
  return db().runTransaction(async (tx) => {
    const kayit = await tx.get(ref);
    const son = Number(kayit.exists ? kayit.get("sonYenilemeMs") : 0) || 0;
    if (simdi - son < YENILEME_ARALIGI_MS) return false;
    tx.set(ref, { sonYenilemeMs: simdi }, { merge: true });
    return true;
  });
};

// ---------------------------------------------------------------- bildirim (HTTP)

// req: Firebase HTTP isteği (rawBody, method, get), res: yanıt. Gövde ya da başlık içeriği hiçbir zaman günlüğe yazılmaz.
const bildirimIsle = async (req, res, { yetkiGizli, imzaGizli, esitle, simdiMs = () => Date.now() }) => {
  if (req.method !== "POST") return res.status(405).send("");
  const ham = req.rawBody;
  if (!Buffer.isBuffer(ham) || ham.length === 0 || ham.length > EN_FAZLA_GOVDE) return res.status(400).send("");
  const yetkiTamam = yetkiDogrula(req.get("authorization"), yetkiGizli);
  const imzaTamam = imzaDogrula(ham, req.get("x-revenuecat-webhook-signature"), imzaGizli, simdiMs());
  if (!yetkiTamam || !imzaTamam) {
    console.warn("Abonelik bildirimi reddedildi: doğrulama başarısız");
    return res.status(401).send("");
  }

  let olay;
  try {
    olay = JSON.parse(ham.toString("utf8"))?.event;
  } catch {
    return res.status(400).send("");
  }
  if (!olay || typeof olay !== "object" || typeof olay.type !== "string") return res.status(400).send("");
  if (olay.type === "TEST") return res.status(200).send("ok");

  const kimlikler = bildirimKimlikleri(olay);
  try {
    for (const uid of kimlikler) await esitle(uid);
  } catch (hata) {
    console.error("Abonelik eşitlenemedi (RevenueCat yeniden deneyecek):", String(olay.type).slice(0, 40), hata?.message);
    return res.status(500).send("");
  }
  return res.status(200).send("ok");
};

module.exports = {
  YETKI_KIMLIGI_BICIMI,
  yetkiDogrula,
  imzaDogrula,
  bildirimKimlikleri,
  abonelikHesapla,
  musteriGetir,
  musteriSil,
  abonelikEsitle,
  yenilemeHakkiKullan,
  bildirimIsle,
};
