// Soru durumları: çözüm akışı (n8n, sunucu yetkisiyle) yazar, uygulama yalnızca okur.
// "İnceleme Gerekli": yapay zekâ soruyu güvenle çözemedi; o sorunun harcadığı soru hakkı sunucuda iade edilir
// (functions/kota.js kotaIadeEt).
export const INCELEME_DURUMU = "İnceleme Gerekli";
export const INCELEME_MESAJI =
  "Bu soruyu daha dikkatli inceliyoruz, çözüm hazır olunca bildireceğiz.";
export const incelemedeMi = (soru) => soru?.durum === INCELEME_DURUMU;
