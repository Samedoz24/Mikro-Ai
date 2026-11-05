// Profil alanlarının doğrulanması. Güvenlik kurallarındaki (firestore.rules) denetimlerin
// istemci tarafı eşi: kullanıcıya erken ve anlaşılır geri bildirim verir, gösterim tarafında da
// (veli ekranı) ikinci bir savunma katmanıdır. Asıl zorlama sunucudaki kurallardadır.

export const AD_SOYAD_EN_FAZLA = 40;

// Kontrol karakterleri ve görünmez yön işaretleri atılır, boşluklar sadeleştirilir, uzunluk sınırlanır
export const adSoyadTemizle = (metin) =>
  String(metin ?? "")
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, AD_SOYAD_EN_FAZLA);

const KOVA = "project-21-3e377.firebasestorage.app";
const UID_BICIMI = /^[A-Za-z0-9]{1,128}$/;

// Yalnızca o kullanıcının kendi Storage profil fotoğrafının indirme bağlantısı kabul edilir
export const profilFotoGecerliMi = (uid, adres) => {
  if (typeof uid !== "string" || !UID_BICIMI.test(uid)) return false;
  if (typeof adres !== "string" || adres.length >= 300) return false;
  const kalip = new RegExp(
    `^https://firebasestorage\\.googleapis\\.com/v0/b/${KOVA.replace(/\./g, "\\.")}/o/profil_fotograflari%2F${uid}\\.jpg\\?alt=media&token=[0-9a-fA-F-]{36}$`
  );
  return kalip.test(adres);
};
