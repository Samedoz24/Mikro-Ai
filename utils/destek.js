// Soru çözüm ekranındaki "destek" düğmesi: destek adresine hazır bir e-posta açar.
// Gizlilik: e-postaya YALNIZCA sorunun kimlik numarası eklenir (destek ekibi soruyu bununla bulur);
// ad, e-posta, kullanıcı kimliği, soru içeriği ya da fotoğraf bağlantısı EKLENMEZ. Kimlik beklenen biçimde
// değilse (sunucunun soru kimliği biçimi: functions/kota.js SORU_KIMLIGI_BICIMI) hiç eklenmez.
// Metinler encodeURIComponent ile kodlanır; bağlantıya başka parametre sızamaz. Saf mantık: ağ kullanmaz.
export const DESTEK_EPOSTASI = "cesa@cesaai.tech";

const SORU_KIMLIGI_BICIMI = /^[A-Za-z0-9]{1,64}$/;

export const soruDestekBaglantisi = (soruId) => {
  const kimlik = typeof soruId === "string" && SORU_KIMLIGI_BICIMI.test(soruId) ? soruId : null;
  const konu = kimlik ? `Sormix Soru Bildirimi (${kimlik})` : "Sormix Soru Bildirimi";
  const govde =
    (kimlik ? `Soru numarası: ${kimlik}\n\n` : "") +
    "Merhaba, bu soruyla ilgili şöyle bir sorun var: ";
  return `mailto:${DESTEK_EPOSTASI}?subject=${encodeURIComponent(konu)}&body=${encodeURIComponent(govde)}`;
};
