// Seri (28 Kasım 2026): yalnızca SORU GÖNDERİLİNCE artar ve yalnızca sunucuda hesaplanır (functions/kota.js).
// Uygulama seriyi YAZMAZ; profildeki seriGunu/sonSoruGunu yalnızca okunur (firestore.rules istemciye kapalı).
// Görünen seri: son soru Türkiye saatiyle bugün ya da dün gönderildiyse seri sürüyor; daha eskiyse 0.
// Saf mantık: ağ kullanmaz. (Cihaz saati yanlışsa yalnızca GÖRÜNÜM etkilenir; asıl hesap sunucudadır.)

const TURKIYE_FARKI_MS = 3 * 60 * 60 * 1000;
const GUN_MS = 24 * 60 * 60 * 1000;
const GUN_BICIMI = /^\d{4}-\d{2}-\d{2}$/;
const SERI_EN_FAZLA = 100000;

export const turkiyeGunu = (ms = Date.now()) => new Date(ms + TURKIYE_FARKI_MS).toISOString().slice(0, 10);

export const oncekiGun = (gun) => new Date(Date.parse(`${gun}T00:00:00Z`) - GUN_MS).toISOString().slice(0, 10);

const seriSayisi = (deger) =>
  Number.isInteger(deger) && deger > 0 && deger <= SERI_EN_FAZLA ? deger : 0;

const gunMetni = (deger) => (typeof deger === "string" && GUN_BICIMI.test(deger) ? deger : null);

// Profil belgesinden (ya da { seriGunu, sonSoruGunu }) ekranda gösterilecek seri
export const gorunenSeri = (profil, simdi = Date.now()) => {
  const seri = seriSayisi(profil?.seriGunu);
  const sonGun = gunMetni(profil?.sonSoruGunu);
  if (!seri || !sonGun) return 0;
  const bugun = turkiyeGunu(simdi);
  return sonGun === bugun || sonGun === oncekiGun(bugun) ? seri : 0;
};

// Bugün (Türkiye) soru gönderildi mi? (Seri hatırlatması bugün gerekli mi?)
export const bugunSoruGonderildiMi = (profil, simdi = Date.now()) =>
  gunMetni(profil?.sonSoruGunu) === turkiyeGunu(simdi);

// Sunucunun soruGonder yanıtındaki seri bilgisi: kutlama yalnızca seri bu soruyla değiştiyse ve değer geçerliyse
export const kutlanacakSeri = (yanit) =>
  yanit?.seri?.artti === true && seriSayisi(yanit?.seri?.gun) > 0 ? yanit.seri.gun : null;

// Kutlama penceresi metni
export const seriKutlamaMetni = (gun) =>
  gun <= 1
    ? "Serin başladı! Her gün en az bir soru göndererek serini büyütebilirsin."
    : `Harika gidiyorsun! Bugün de soru göndererek serini ${gun} güne çıkardın. Yarın da bir soru gönder, serin bozulmasın!`;
