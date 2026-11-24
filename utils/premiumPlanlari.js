// Premium plan verisi ve satın alma katmanı. Arayüz (PremiumModal) yalnızca bu dosyayı kullanır;
// mağazaya (RevenueCat) dokunan tek yer utils/magaza.js'tir.
//
// Fiyatlar mağazadan gelir, kodda sabit tutulmaz. Paketler RevenueCat'teki "current" teklifinden
// (offering) paket türüne göre okunur. Mağaza bağlı değilse yayın sürümünde liste boş döner ve satın alma
// kapalı kalır; geliştirme sürümünde arayüzü görebilmek için önizleme fiyatları gösterilir.
//
// Premium'u uygulama açmaz: satın alma / geri yükleme sonrası sunucu (abonelikYenile) RevenueCat'e kendisi
// sorar ve premium alanını yalnızca sunucu yazar. Arayüz bunu Firestore'dan canlı izler.

import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebaseConfig";
import {
  magazaDestekleniyor,
  dogrulanmisKimlik,
  anlikKimlik,
  teklifleriGetir,
  denemeUygunlugu,
  paketSatinAl,
  satinAlimlariYenidenYukle,
  PAKET_TURU,
  HATA_KODU,
  DENEME_UYGUN,
} from "./magaza";

export const PLAN_SIRASI = ["haftalik", "aylik", "iki_aylik", "uc_aylik", "alti_aylik", "yillik"];

export const PLAN_ADLARI = {
  haftalik: "Haftalık",
  aylik: "1 Aylık",
  iki_aylik: "2 Aylık",
  uc_aylik: "3 Aylık",
  alti_aylik: "6 Aylık",
  yillik: "12 Aylık",
};

const AY_SAYISI = { aylik: 1, iki_aylik: 2, uc_aylik: 3, alti_aylik: 6, yillik: 12 };

// RevenueCat paket türü → plan kimliği. Listede olmayan türler (ömür boyu, özel) gösterilmez.
// Haftalık planda tasarruf yüzdesi gösterilmez (AY_SAYISI'nda yok).
const PAKET_PLANI = {
  [PAKET_TURU.WEEKLY]: "haftalik",
  [PAKET_TURU.MONTHLY]: "aylik",
  [PAKET_TURU.TWO_MONTH]: "iki_aylik",
  [PAKET_TURU.THREE_MONTH]: "uc_aylik",
  [PAKET_TURU.SIX_MONTH]: "alti_aylik",
  [PAKET_TURU.ANNUAL]: "yillik",
};

export const SATIN_ALMA_IPTAL = "satin-alma/iptal";
export const SATIN_ALMA_HAZIR_DEGIL = "satin-alma/hazir-degil";
export const SATIN_ALMA_BEKLEMEDE = "satin-alma/beklemede";

const hata = (kod, mesaj) => {
  const h = new Error(mesaj);
  h.code = kod;
  return h;
};

// Yalnızca geliştirme sürümünde, mağaza bağlı değilken arayüzü görebilmek için.
const ONIZLEME_PLANLARI = [
  { id: "aylik", fiyat: 349, fiyatYazi: "349 ₺", aylikFiyatYazi: null, deneme: null },
  { id: "uc_aylik", fiyat: 799, fiyatYazi: "799 ₺", aylikFiyatYazi: "266 ₺", deneme: null },
  { id: "yillik", fiyat: 1999, fiyatYazi: "1999 ₺", aylikFiyatYazi: "167 ₺", deneme: null },
];

const bosSonuc = () =>
  __DEV__
    ? { planlar: ONIZLEME_PLANLARI, onizleme: true, satinAlinabilir: false }
    : { planlar: [], onizleme: false, satinAlinabilir: false };

// Aylık plana göre gerçek tasarruf yüzdesi (aşağı yuvarlanır, abartılmaz).
// Fiyatlar gerçek mağaza fiyatlarından hesaplanır; uydurma "eski fiyat" kullanılmaz.
export const tasarrufYuzdesi = (planlar, planId) => {
  if (planId === "aylik" || !AY_SAYISI[planId]) return 0;
  const aylik = planlar.find((p) => p.id === "aylik");
  const plan = planlar.find((p) => p.id === planId);
  if (!aylik || !plan || !(aylik.fiyat > 0) || !(plan.fiyat > 0)) return 0;
  const tamFiyat = aylik.fiyat * AY_SAYISI[planId];
  const yuzde = Math.floor((1 - plan.fiyat / tamFiyat) * 100);
  return yuzde > 0 ? yuzde : 0;
};

const BIRIMLER = { DAY: "gün", WEEK: "hafta", MONTH: "ay", YEAR: "yıl" };

// Deneme / tanıtım fiyatı metni. Yalnızca Apple'ın "uygun" dediği kullanıcıya gösterilir
// (deneme hakkını kullanmış birine "ücretsiz" yazmak yanıltıcı olur).
export const denemeMetni = (giris) => {
  if (!giris) return null;
  const birim = BIRIMLER[giris.periodUnit];
  const adet = Number(giris.periodNumberOfUnits) * Math.max(1, Number(giris.cycles) || 1);
  if (!birim || !(adet > 0)) return null;
  const sure = `${adet} ${birim}`;
  if (Number(giris.price) === 0) return `İlk ${sure} ücretsiz`;
  if (!giris.priceString) return null;
  return `İlk ${sure}: ${giris.priceString}`;
};

// Satın almada kullanılacak paketler (planId → RevenueCat paketi). Kullanıcıya özel değildir.
let paketler = new Map();

// Teklifi plan listesine çevirir (saf fonksiyon; test edilir).
export const teklifiPlanlaraCevir = (teklif, uygunluk = {}) => {
  const liste = [];
  const yeniPaketler = new Map();
  for (const paket of teklif?.availablePackages || []) {
    const id = PAKET_PLANI[paket?.packageType];
    const urun = paket?.product;
    if (!id || yeniPaketler.has(id) || !urun || !(Number(urun.price) > 0) || !urun.priceString) continue;
    const uygun = uygunluk[urun.identifier]?.status === DENEME_UYGUN.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
    yeniPaketler.set(id, paket);
    liste.push({
      id,
      fiyat: Number(urun.price),
      fiyatYazi: urun.priceString,
      aylikFiyatYazi: AY_SAYISI[id] > 1 ? urun.pricePerMonthString || null : null,
      deneme: uygun ? denemeMetni(urun.introPrice) : null,
    });
  }
  liste.sort((a, b) => PLAN_SIRASI.indexOf(a.id) - PLAN_SIRASI.indexOf(b.id));
  return { planlar: liste, paketler: yeniPaketler };
};

// Dönüş: { planlar, onizleme, satinAlinabilir }
export const planlariGetir = async () => {
  if (!magazaDestekleniyor()) return bosSonuc();
  try {
    await dogrulanmisKimlik(auth.currentUser?.uid);
    const teklif = (await teklifleriGetir())?.current;
    const urunler = (teklif?.availablePackages || [])
      .map((p) => p?.product)
      .filter((u) => u?.introPrice && u.identifier)
      .map((u) => u.identifier);
    let uygunluk = {};
    if (urunler.length) {
      try {
        uygunluk = (await denemeUygunlugu(urunler)) || {};
      } catch (e) {
        // Uygunluk öğrenilemezse deneme metni gösterilmez (yanıltıcı olmasın)
        console.log("Deneme uygunluğu alınamadı:", e?.code);
      }
    }
    const sonuc = teklifiPlanlaraCevir(teklif, uygunluk);
    paketler = sonuc.paketler;
    if (!sonuc.planlar.length) return bosSonuc();
    return { planlar: sonuc.planlar, onizleme: false, satinAlinabilir: true };
  } catch (e) {
    console.log("Planlar alınamadı:", e?.code, e?.message);
    paketler = new Map();
    return bosSonuc();
  }
};

// Sunucudan aboneliği RevenueCat'e sorup eşitlemesini ister (yalnızca çağıranın kendi aboneliği).
// Başarısız olsa bile satın alma geçerlidir: RevenueCat bildirimi (webhook) sunucuyu ayrıca günceller.
// Dönüş: { dogrulandi, premium, abonelik }
const sunucudaYenile = async (uid) => {
  try {
    if (auth.currentUser?.uid !== uid || (await anlikKimlik()) !== uid) {
      return { dogrulandi: false, premium: false, abonelik: false };
    }
    const sonuc = await httpsCallable(functions, "abonelikYenile")();
    return {
      dogrulandi: true,
      premium: sonuc?.data?.premium === true,
      abonelik: sonuc?.data?.abonelik === true,
    };
  } catch (e) {
    console.log("Abonelik yenilenemedi:", e?.code);
    return { dogrulandi: false, premium: false, abonelik: false };
  }
};

// Dönüş: { dogrulandi, premium, abonelik }
export const satinAl = async (planId) => {
  const paket = paketler.get(planId);
  if (!paket) throw hata(SATIN_ALMA_HAZIR_DEGIL, `Plan bulunamadı (${planId}).`);
  let uid;
  try {
    uid = await dogrulanmisKimlik(auth.currentUser?.uid);
  } catch (e) {
    throw hata(SATIN_ALMA_HAZIR_DEGIL, "Mağaza oturumu doğrulanamadı.");
  }

  try {
    await paketSatinAl(paket);
  } catch (e) {
    if (e?.userCancelled || e?.code === HATA_KODU.PURCHASE_CANCELLED_ERROR) {
      throw hata(SATIN_ALMA_IPTAL, "Satın alma iptal edildi.");
    }
    if (e?.code === HATA_KODU.PAYMENT_PENDING_ERROR) {
      throw hata(SATIN_ALMA_BEKLEMEDE, "Satın alma onay bekliyor.");
    }
    throw e;
  }
  return sunucudaYenile(uid);
};

// Dönüş: { dogrulandi, premium, abonelik }
export const satinAlimlariGeriYukle = async () => {
  let uid;
  try {
    uid = await dogrulanmisKimlik(auth.currentUser?.uid);
  } catch (e) {
    throw hata(SATIN_ALMA_HAZIR_DEGIL, "Mağaza oturumu doğrulanamadı.");
  }
  await satinAlimlariYenidenYukle();
  return sunucudaYenile(uid);
};
