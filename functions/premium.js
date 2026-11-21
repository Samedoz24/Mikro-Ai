// Premium kaynakları: premium'un NEREDEN geldiği ayrı tutulur; premiumMu yalnızca bunlardan hesaplanır.
//
//   kullanicilar/{uid}.premiumKaynaklari = {
//     kurum: true                         dershane veriyor (katılınca açılır, ayrılınca kapanır)
//     abonelik: { aktif, bitis, urun }    mağaza aboneliği (RevenueCat; yalnızca sunucu yazar)
//     elle: true                          Console'dan elle verilmiş (bu yapıdan önceki premium'lar dahil)
//   }
//   kullanicilar/{uid}.premiumMu = kaynaklardan biri geçerli mi (uygulama ekranları bunu okur)
//
// Neden: Öğrenci dershanedeyken kendi parasıyla abonelik alırsa, dershaneden ayrılınca aboneliği
// kaybolmamalı. Eski yapıda ayrılırken premium "katılmadan önceki" haline dönüyordu.
//
// GÜVENLİK: Bu alanları istemci yazamaz (firestore.rules sunucuAlanlari). Abonelik, bitiş tarihi geçmişse
// sunucuya henüz haber gelmemiş olsa bile geçerli sayılmaz (kota bu hesapla verilir).

const { FieldValue } = require("firebase-admin/firestore");

const zamanMs = (deger) => {
  if (deger && typeof deger.toMillis === "function") return deger.toMillis();
  if (deger instanceof Date) return deger.getTime();
  if (typeof deger === "string" || typeof deger === "number") {
    const ms = new Date(deger).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
};

// Saf: abonelik şu an geçerli mi? (aktif işaretli VE bitiş tarihi gelecekte; bitişsiz abonelik geçersiz)
const abonelikGecerliMi = (abonelik, simdi = Date.now()) => {
  if (!abonelik || typeof abonelik !== "object" || abonelik.aktif !== true) return false;
  const bitis = zamanMs(abonelik.bitis);
  return bitis !== null && bitis > simdi;
};

// Saf: kaynaklardan premium
const premiumHesapla = (kaynaklar, simdi = Date.now()) => {
  if (!kaynaklar || typeof kaynaklar !== "object") return false;
  return kaynaklar.kurum === true || kaynaklar.elle === true || abonelikGecerliMi(kaynaklar.abonelik, simdi);
};

// Saf: kullanıcının premium durumu. Kaynak yapısı olmayan (henüz taşınmamış) eski kayıtta eski alan okunur.
const premiumDurumu = (kullanici, simdi = Date.now()) => {
  const k = kullanici?.premiumKaynaklari;
  if (k && typeof k === "object") return premiumHesapla(k, simdi);
  return kullanici?.premiumMu === true;
};

// Saf: kullanıcının mevcut kaynakları (yeni yapı yoksa eski alandan çıkarılır).
// eskiPremiumKaynagi: eski yapıda premiumMu=true iken bunun kaynağı ("elle" | "kurum"); bilinmiyorsa "elle"
// (premium'u asla sessizce kaybettirmemek için güvenli taraf: kullanıcı aleyhine yorum yapılmaz).
const mevcutKaynaklar = (kullanici, eskiPremiumKaynagi = "elle") => {
  const k = kullanici?.premiumKaynaklari;
  if (k && typeof k === "object") {
    const temiz = {};
    if (k.kurum === true) temiz.kurum = true;
    if (k.elle === true) temiz.elle = true;
    if (k.abonelik && typeof k.abonelik === "object") temiz.abonelik = k.abonelik;
    return temiz;
  }
  if (kullanici?.premiumMu === true) return eskiPremiumKaynagi === "kurum" ? { kurum: true } : { elle: true };
  return {};
};

// Kullanıcı belgesine yazılacak alanlar: verilen değişiklik uygulanmış kaynaklar + yeniden hesaplanmış premiumMu.
// degisiklik: { kurum?: true|null, elle?: true|null, abonelik?: {...}|null }  (null = kaynağı kaldır)
const premiumGuncellemesi = (kullanici, degisiklik, { eskiPremiumKaynagi = "elle", simdi = Date.now() } = {}) => {
  const yeni = mevcutKaynaklar(kullanici, eskiPremiumKaynagi);
  for (const anahtar of ["kurum", "elle", "abonelik"]) {
    if (!(anahtar in (degisiklik || {}))) continue;
    if (degisiklik[anahtar] === null) delete yeni[anahtar];
    else yeni[anahtar] = degisiklik[anahtar];
  }
  return {
    premiumKaynaklari: Object.keys(yeni).length > 0 ? yeni : FieldValue.delete(),
    premiumMu: premiumHesapla(yeni, simdi),
  };
};

module.exports = { premiumHesapla, premiumDurumu, abonelikGecerliMi, mevcutKaynaklar, premiumGuncellemesi };
