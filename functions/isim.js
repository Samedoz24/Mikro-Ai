// Kullanıcının yazdığı ad soyadı, dershane panellerine kopyalanmadan önce güvenli hale getirir:
// metin değilse yok sayılır, kontrol/yön karakterleri atılır, en fazla 60 karakter (kurallarla aynı sınır).
const ISIM_EN_FAZLA = 60;

const guvenliIsim = (deger) =>
  typeof deger === "string"
    ? deger
        .replace(/[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, ISIM_EN_FAZLA)
    : "";

module.exports = { guvenliIsim, ISIM_EN_FAZLA };
