// Giriş/kayıt ve profil kuralları (28 Kasım 2026). Saf mantık: ağ kullanmaz, test edilir.
//
// Güvenlik özeti (asıl kontrol firestore.rules ve sunucudadır; buradaki kontroller kullanıcıya erken geri bildirim
// ve tutarlılık içindir):
//  - İstemci rolü yalnızca profil OLUŞTURULURKEN ve yalnızca "ogrenci" ya da "veli" olarak yazabilir; sonra değişmez.
//  - Yönetici rolünü yalnızca sunucu verir (yoneticiOl: doğrulanmış e-posta + davet).
//  - Sınıf yalnızca SINIF_SECENEKLERI'nden biridir; veli hesabında sınıf yoktur.
//  - E-postayla kayıtta form bilgileri, hesap oluşturulmadan önce "bekleyen profil" olarak cihazda tutulur ve
//    YALNIZCA aynı e-postanın, kısa süre içindeki ilk girişinde kullanılır (eski/başka hesaba ait bilgi uygulanmaz).
import { adSoyadTemizle } from "./profilDogrulama";
import { SIFRE_EN_AZ } from "./authHatalari";
import { onayKaydi } from "./onayMetni";

// firestore.rules sinifSecenekleri() ile birebir aynı olmalı (test denetler)
export const SINIF_SECENEKLERI = ["8. Sınıf", "9. Sınıf", "10. Sınıf", "11. Sınıf", "12. Sınıf", "Mezun"];
export const ISTEMCI_ROLLERI = ["ogrenci", "veli"];
export const BILINEN_ROLLER = ["ogrenci", "veli", "yonetici"];
export const BEKLEYEN_PROFIL_ANAHTARI = "bekleyenProfil";
export const BEKLEYEN_PROFIL_OMRU_MS = 15 * 60 * 1000;
const EPOSTA_BICIMI = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const epostaNormal = (e) => String(e ?? "").trim().toLowerCase();

// Rol alanı olmayan eski hesaplar öğrenci sayılır (sunucu ve kurallarla aynı). Bilinmeyen değer → null.
export const rolCoz = (veri) => {
  const rol = veri?.rol === undefined ? "ogrenci" : veri.rol;
  return BILINEN_ROLLER.includes(rol) ? rol : null;
};

// Mevcut profilde eksik alanlar (eski hesaplar bir kez "Profilini Tamamla" ekranına yönlendirilir)
export const profilEksikleri = (veri) => {
  const rol = rolCoz(veri);
  if (rol === null || rol === "yonetici") return [];
  const eksik = [];
  if (!adSoyadTemizle(veri?.adSoyad)) eksik.push("adSoyad");
  if (rol === "ogrenci" && !SINIF_SECENEKLERI.includes(veri?.sinif)) eksik.push("sinif");
  return eksik;
};

// Profil alanlarını doğrular. { hata } ya da { profil: { rol, adSoyad, sinif? } } döner.
// rolSabit: mevcut hesabın tamamlanmasında rol değiştirilemez (formdan gelen rol yok sayılır)
export const profilFormuDogrula = ({ adSoyad, sinif, rol, rolSabit } = {}) => {
  const hedefRol = rolSabit || rol;
  if (!ISTEMCI_ROLLERI.includes(hedefRol)) return { hata: "Lütfen Öğrenci ya da Veli seç." };
  const ad = adSoyadTemizle(adSoyad);
  if (ad.length < 2) return { hata: "Lütfen adını ve soyadını yaz." };
  if (hedefRol === "ogrenci") {
    if (!SINIF_SECENEKLERI.includes(sinif)) return { hata: "Lütfen sınıfını seç." };
    return { profil: { rol: "ogrenci", adSoyad: ad, sinif } };
  }
  return { profil: { rol: "veli", adSoyad: ad } };
};

// E-postayla kayıt formu: profil alanları + e-posta + şifre + kullanım koşulları/yaş onayı (zorunlu)
export const kayitFormuDogrula = ({ adSoyad, sinif, rol, eposta, sifre, onay } = {}) => {
  const p = profilFormuDogrula({ adSoyad, sinif, rol });
  if (p.hata) return p;
  const e = String(eposta ?? "").trim();
  if (!EPOSTA_BICIMI.test(e)) return { hata: "Lütfen geçerli bir e-posta adresi yaz." };
  if (typeof sifre !== "string" || sifre.length < SIFRE_EN_AZ) return { hata: `Şifre en az ${SIFRE_EN_AZ} karakter olmalı.` };
  if (onay !== true) return { hata: "Devam etmek için Kullanım Koşulları onay kutusunu işaretle." };
  return { profil: p.profil, eposta: e };
};

// Cihazda tutulacak bekleyen profil (JSON metni). Şifre ASLA saklanmaz. onayZamani: formdaki onay kutusunun
// işaretlendiği an (onay, profil oluşturulurken bu anla kaydedilir; yoksa onay ekranı ayrıca gösterilir).
export const bekleyenProfilMetni = (profil, eposta, simdi = Date.now(), onayZamani = null) =>
  JSON.stringify({ ...profil, eposta: epostaNormal(eposta), zaman: simdi, ...(onayZamani ? { onayZamani } : {}) });

// Bekleyen profili okur: yalnızca aynı e-posta, geçerli süre ve geçerli alanlar → profil; aksi hâlde null
export const bekleyenProfilCoz = (metin, eposta, simdi = Date.now()) => {
  let veri;
  try {
    veri = JSON.parse(metin);
  } catch {
    return null;
  }
  if (!veri || typeof veri !== "object") return null;
  if (!eposta || epostaNormal(veri.eposta) !== epostaNormal(eposta)) return null;
  if (!Number.isFinite(veri.zaman) || veri.zaman > simdi + 60 * 1000 || simdi - veri.zaman > BEKLEYEN_PROFIL_OMRU_MS) return null;
  const p = profilFormuDogrula({ adSoyad: veri.adSoyad, sinif: veri.sinif, rol: veri.rol });
  if (p.hata) return null;
  // Onay anı yalnızca kayıt anından önce ya da aynı anda ve aynı süre penceresi içindeyse geçerli
  const onayGecerli =
    Number.isFinite(veri.onayZamani) && veri.onayZamani <= veri.zaman && veri.zaman - veri.onayZamani <= BEKLEYEN_PROFIL_OMRU_MS;
  return onayGecerli ? { ...p.profil, onayZamani: veri.onayZamani } : p.profil;
};

// Yeni profil belgesi (yalnızca kuralların izin verdiği alanlar). Kayıt formunda onay verildiyse (onayZamani) aynı
// biçimde yasOnayi kaydedilir; böylece girişten sonraki onay ekranı ikinci kez çıkmaz.
export const yeniProfilBelgesi = ({ profil, eposta, simdi = Date.now() }) => ({
  eposta: typeof eposta === "string" ? eposta : null,
  rol: profil.rol,
  adSoyad: profil.adSoyad,
  ...(profil.rol === "ogrenci" ? { sinif: profil.sinif } : {}),
  kayitTarihi: new Date(simdi).toISOString(),
  ...(Number.isFinite(profil.onayZamani)
    ? { yasOnayi: onayKaydi({ rol: profil.rol, zaman: profil.onayZamani, kaynak: "kayit" }) }
    : {}),
});

// Yönetici daveti denemesinin sonucu: yalnızca "davet yok" normal kullanıcı akışına devam eder.
// Diğer her hata (lisans geçersiz, davet kullanılmış, ağ hatası...) güvenli tarafta kalınarak girişi durdurur.
export const yoneticiDenemesiSonucu = (hata) => {
  if (!hata) return "yonetici";
  if (hata?.message === "davet-yok") return "normal";
  return "dur";
};
