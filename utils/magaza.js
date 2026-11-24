// Mağaza (RevenueCat) oturumu: SDK'ya dokunan TEK yer.
//
// Güvenlik ilkeleri:
// - Premium'a uygulama karar vermez. Satın alma / geri yükleme sonrası sunucu (abonelikYenile) RevenueCat'e
//   gizli anahtarla kendisi sorar ve premium alanını yalnızca sunucu yazar. SDK'nın döndürdüğü müşteri bilgisi
//   premium için KULLANILMAZ.
// - RevenueCat kullanıcı kimliği = Firebase uid. Satın alma ve geri yükleme, SDK'daki kimlik o an girişli
//   kullanıcının uid'siyle birebir aynı değilse başlatılmaz (anonim kimliğe ya da ortak telefonda önceki kişiye
//   satın alma yazılmasın).
// - Çıkışta ve hesap silinince SDK oturumu kapatılır.
// - RevenueCat'e uid dışında kişisel bilgi (ad, e-posta vb.) gönderilmez.
// - Yayın sürümünde SDK günlükleri yalnızca uyarı/hata düzeyindedir.

import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

// RevenueCat GENEL (public) SDK anahtarı. Uygulamanın içine konmak için tasarlanmıştır, gizli değildir:
// yalnızca bu cihazdaki kullanıcının satın almasını yürütebilir; premium veremez, kayıt silemez.
// Gizli (secret) anahtarlar asla buraya yazılmaz; onlar yalnızca sunucuda, Secret Manager'dadır.
const IOS_GENEL_ANAHTAR = "appl_ShdYFozdaZGSEDnQyvisfXRTRLj";

// Sunucudaki UID_BICIMI ile aynı: Firebase uid
const UID_BICIMI = /^[A-Za-z0-9]{1,128}$/;

export const MAGAZA_HAZIR_DEGIL = "magaza/hazir-degil";

const hazirDegilHatasi = (neden) => {
  const hata = new Error(`Mağaza hazır değil (${neden}).`);
  hata.code = MAGAZA_HAZIR_DEGIL;
  return hata;
};

// Şimdilik yalnızca iOS (Android için Play Console ve App Check kaydı yok)
export const magazaDestekleniyor = () => Platform.OS === "ios";

let yapilandirildi = false;
let aktifUid = null;

// Giriş / çıkış işlemleri sırayla çalışır: hızlı hesap değişiminde araya giren çağrı kimliği karıştıramaz
let kuyruk = Promise.resolve();
const sirayla = (is) => {
  const sonuc = kuyruk.then(is, is);
  kuyruk = sonuc.catch(() => {});
  return sonuc;
};

// Girişli öğrenci için SDK'yı hazırlar (ilk sefer configure, hesap değiştiyse logIn).
// Başarısız olursa aktifUid boş kalır; satın alma da başlatılamaz.
export const magazaKullanicisiniAyarla = (uid) =>
  sirayla(async () => {
    if (!magazaDestekleniyor()) return false;
    if (typeof uid !== "string" || !UID_BICIMI.test(uid)) throw hazirDegilHatasi("gecersiz-uid");
    aktifUid = null;
    if (!yapilandirildi) {
      await Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.INFO : LOG_LEVEL.WARN);
      Purchases.configure({ apiKey: IOS_GENEL_ANAHTAR, appUserID: uid });
      yapilandirildi = true;
    } else if ((await Purchases.getAppUserID()) !== uid) {
      await Purchases.logIn(uid);
    }
    if ((await Purchases.getAppUserID()) !== uid) throw hazirDegilHatasi("kimlik-uyusmadi");
    aktifUid = uid;
    return true;
  });

// Çıkış / hesap silme: SDK kimliği bırakılır (anonim olur), sonraki kişi önceki kişinin kimliğiyle işlem yapamaz.
export const magazaOturumunuKapat = () =>
  sirayla(async () => {
    aktifUid = null;
    if (!yapilandirildi) return;
    try {
      if (!(await Purchases.isAnonymous())) await Purchases.logOut();
    } catch (e) {
      console.log("Mağaza oturumu kapatılamadı:", e?.code);
    }
  });

// Satın alma / geri yükleme öncesi: SDK kimliği, girişli kullanıcının uid'siyle birebir aynı olmalı.
// Değilse bir kez yeniden ayarlanır; yine olmazsa işlem başlatılmaz.
export const dogrulanmisKimlik = async (girisliUid) => {
  if (!magazaDestekleniyor()) throw hazirDegilHatasi("platform");
  if (!girisliUid) throw hazirDegilHatasi("giris-yok");
  if (aktifUid !== girisliUid) await magazaKullanicisiniAyarla(girisliUid);
  await kuyruk;
  if (aktifUid !== girisliUid || (await Purchases.getAppUserID()) !== girisliUid) {
    throw hazirDegilHatasi("kimlik-uyusmadi");
  }
  return girisliUid;
};

export const teklifleriGetir = () => Purchases.getOfferings();
export const denemeUygunlugu = (urunKimlikleri) =>
  Purchases.checkTrialOrIntroductoryPriceEligibility(urunKimlikleri);
export const paketSatinAl = (paket) => Purchases.purchasePackage(paket);
export const satinAlimlariYenidenYukle = () => Purchases.restorePurchases();
export const anlikKimlik = () => Purchases.getAppUserID();

export const PAKET_TURU = Purchases.PACKAGE_TYPE;
export const HATA_KODU = Purchases.PURCHASES_ERROR_CODE;
export const DENEME_UYGUN = Purchases.INTRO_ELIGIBILITY_STATUS;
