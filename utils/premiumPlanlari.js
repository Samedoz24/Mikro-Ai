// Premium plan verisi ve satın alma katmanı.
//
// Şu an mağaza (RevenueCat) bağlı değil. Bağlandığında YALNIZCA bu dosyanın
// planlariGetir / satinAl / satinAlimlariGeriYukle fonksiyonları değişecek;
// arayüz (PremiumModal) aynı kalır.
//
// Fiyatlar mağazadan gelir, kodda sabit tutulmaz. Mağaza bağlı olmayan yayın
// sürümünde plan listesi boş döner ve satın alma kapalı kalır.

export const PLAN_SIRASI = ["aylik", "uc_aylik", "yillik"];

export const PLAN_ADLARI = {
  aylik: "1 Aylık",
  uc_aylik: "3 Aylık",
  yillik: "12 Aylık",
};

const AY_SAYISI = { aylik: 1, uc_aylik: 3, yillik: 12 };

export const SATIN_ALMA_IPTAL = "satin-alma/iptal";
export const SATIN_ALMA_HAZIR_DEGIL = "satin-alma/hazir-degil";

// Yalnızca geliştirme sürümünde, mağaza bağlı değilken arayüzü görebilmek için.
const ONIZLEME_PLANLARI = [
  { id: "aylik", fiyat: 349, fiyatYazi: "349 ₺", aylikFiyatYazi: null },
  { id: "uc_aylik", fiyat: 799, fiyatYazi: "799 ₺", aylikFiyatYazi: "266 ₺" },
  { id: "yillik", fiyat: 1999, fiyatYazi: "1999 ₺", aylikFiyatYazi: "167 ₺" },
];

// Aylık plana göre gerçek tasarruf yüzdesi (aşağı yuvarlanır, abartılmaz).
// Fiyatlar gerçek mağaza fiyatlarından hesaplanır; uydurma "eski fiyat" kullanılmaz.
export const tasarrufYuzdesi = (planlar, planId) => {
  if (planId === "aylik") return 0;
  const aylik = planlar.find((p) => p.id === "aylik");
  const plan = planlar.find((p) => p.id === planId);
  if (!aylik || !plan || !(aylik.fiyat > 0)) return 0;
  const tamFiyat = aylik.fiyat * AY_SAYISI[planId];
  const yuzde = Math.floor((1 - plan.fiyat / tamFiyat) * 100);
  return yuzde > 0 ? yuzde : 0;
};

// Dönüş: { planlar, onizleme, satinAlinabilir }
export const planlariGetir = async () => {
  // TODO(RevenueCat): Purchases.getOfferings() ile gerçek plan ve fiyatlar
  if (__DEV__) {
    return { planlar: ONIZLEME_PLANLARI, onizleme: true, satinAlinabilir: false };
  }
  return { planlar: [], onizleme: false, satinAlinabilir: false };
};

export const satinAl = async (planId) => {
  // TODO(RevenueCat): Purchases.purchasePackage(...)
  // Kullanıcı vazgeçerse { code: SATIN_ALMA_IPTAL } ile hata fırlatılmalı.
  const hata = new Error(`Satın alma altyapısı hazır değil (${planId}).`);
  hata.code = SATIN_ALMA_HAZIR_DEGIL;
  throw hata;
};

export const satinAlimlariGeriYukle = async () => {
  // TODO(RevenueCat): Purchases.restorePurchases()
  const hata = new Error("Satın alma altyapısı hazır değil.");
  hata.code = SATIN_ALMA_HAZIR_DEGIL;
  throw hata;
};
