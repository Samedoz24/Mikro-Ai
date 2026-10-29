// Uygulamadaki utils/ders.js içindeki ders adı normalleştirmesinin sunucu kopyası.
// İki dosya aynı sonucu vermelidir; değişiklik yapılırsa ikisi birlikte güncellenir.

const norm = (metin) =>
  String(metin ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const DERS_ESLESMELERI = {
  matematik: "Matematik",
  geometri: "Matematik",
  fizik: "Fizik",
  kimya: "Kimya",
  biyoloji: "Biyoloji",
  turkce: "Türkçe",
  "turk dili ve edebiyati": "Türkçe",
  edebiyat: "Türkçe",
  tarih: "Tarih",
  cografya: "Coğrafya",
  diger: "Diğer",
};

const dersAdiniDuzelt = (deger) => {
  const metin = String(deger ?? "").trim();
  if (!metin) return "";
  return DERS_ESLESMELERI[norm(metin)] || metin;
};

const dersBul = (soru) => dersAdiniDuzelt(soru?.ders || soru?.subject || soru?.lesson) || "Diğer";

module.exports = { dersBul };
