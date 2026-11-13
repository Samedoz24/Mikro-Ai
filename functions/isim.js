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

// Apple "E-postamı Gizle" adresi: @ öncesi rastgele harflerdir, isim olarak gösterilmez
const gizliEpostaMi = (eposta) =>
  typeof eposta === "string" && /@privaterelay\.appleid\.com$/i.test(eposta.trim());

// Panellerde görünecek isim: ad soyad > (gizli değilse) e-posta başı > varsayılan
const gorunenIsim = (kullanici, varsayilan = "Öğrenci") =>
  guvenliIsim(kullanici?.adSoyad) ||
  (gizliEpostaMi(kullanici?.eposta) ? "" : guvenliIsim(String(kullanici?.eposta || "").split("@")[0])) ||
  varsayilan;

module.exports = { guvenliIsim, gizliEpostaMi, gorunenIsim, ISIM_EN_FAZLA };
