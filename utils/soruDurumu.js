// Soru durumları: çözüm akışı (n8n, sunucu yetkisiyle) ve sunucu yazar, uygulama yalnızca okur.
// "İnceleme Gerekli": yapay zekâ soruyu güvenle çözemedi. Öğrenci seçer (sunucu: soruIncelemeKarari):
//   "devam" → soru incelemede kalır; "iptal" → soru "İptal Edildi" olur ve hak (aynı gün içindeyse) iade edilir.
export const INCELEME_DURUMU = "İnceleme Gerekli";
export const IPTAL_DURUMU = "İptal Edildi";
export const INCELEME_MESAJI =
  "Bu soruyu daha dikkatli inceliyoruz, çözüm hazır olunca bildireceğiz.";
export const incelemedeMi = (soru) => soru?.durum === INCELEME_DURUMU;
export const iptalMi = (soru) => soru?.durum === IPTAL_DURUMU;
export const iptalMesaji = (soru) =>
  soru?.hakIadeEdildi === true
    ? "Bu soruyu iptal ettin. Soru hakkın iade edildi."
    : "Bu soruyu iptal ettin.";
