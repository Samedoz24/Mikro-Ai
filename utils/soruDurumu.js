// Soru durumları: çözüm akışı (n8n, sunucu yetkisiyle) ve sunucu yazar, uygulama yalnızca okur.
// "İnceleme Gerekli": yapay zekâ soruyu güvenle çözemedi. Öğrenci seçer (sunucu: soruIncelemeKarari):
//   "devam" → soru BİR KEZ daha çözüm sırasına alınır (ekDenemeKullanildi); "iptal" → soru "İptal Edildi" olur ve
//   hak (aynı gün içindeyse) iade edilir.
export const INCELEME_DURUMU = "İnceleme Gerekli";
export const IPTAL_DURUMU = "İptal Edildi";
export const INCELEME_MESAJI =
  "Bu soruyu daha dikkatli inceliyoruz, çözüm hazır olunca bildireceğiz.";
export const EK_DENEME_SONRASI_MESAJI =
  "Bu soruyu yeniden denedik ama güvenle çözemedik. Dilersen soruyu iptal edip soru hakkını geri alabilirsin.";
export const incelemedeMi = (soru) => soru?.durum === INCELEME_DURUMU;
// Ek deneme ("Çözmeye devam et") bu soru için kullanılabilir mi?
export const ekDenemeVarMi = (soru) => soru?.ekDenemeKullanildi !== true;
export const iptalMi = (soru) => soru?.durum === IPTAL_DURUMU;

// "İşleniyor": çözüm sunucusu soruyu şu an çözüyor. Değer sunucudan gelir; yazım farklarına (İ/I/ı, ş/s,
// büyük-küçük harf, baştaki/sondaki boşluk) dayanıklı tanınır. Yalnızca görünümü etkiler.
export const ISLENIYOR_METNI = "İşleniyor";
export const ISLENIYOR_EMOJI = "🔄";
export const ISLENIYOR_RENGI = "#F97316"; // turuncu
export const isleniyorMu = (soru) => {
  if (typeof soru?.durum !== "string") return false;
  const sade = soru.durum
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/i̇/g, "i"); // "İ" bazı ortamlarda "i + nokta" olarak küçülür
  return sade === "isleniyor";
};
export const iptalMesaji = (soru) =>
  soru?.hakIadeEdildi === true
    ? "Bu soruyu iptal ettin. Soru hakkın iade edildi."
    : "Bu soruyu iptal ettin.";
