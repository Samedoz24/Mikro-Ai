// Kamera sekmesindeki şık seçimi: saf mantık (ağ ve ekran kullanmaz, kolayca test edilir).
// Öğrenci fotoğrafı gönderirken sorunun cevabını (A-E) ya da "Bilinmiyor" seçer. Seçim yapay zekaya
// ipucu olarak DEĞİL, çözümü doğrulamak için kullanılır: çözüm seçimi görmeden üretilir, sonra karşılaştırılır.

export const SIK_SECENEKLERI = ["A", "B", "C", "D", "E"];
export const BILINMIYOR = "Bilinmiyor";
export const TUM_SECENEKLER = [...SIK_SECENEKLERI, BILINMIYOR];

// Yalnızca listedeki kesin değerler geçerlidir (küçük harf, boşluk, sayı, null reddedilir)
export const secimGecerliMi = (secim) =>
  typeof secim === "string" && TUM_SECENEKLER.includes(secim);

// Gönder düğmesi: fotoğraf var, geçerli bir seçim yapılmış ve yükleme sürmüyor
export const gonderilebilirMi = ({ fotograf, secim, yukleniyor }) =>
  !!fotograf && secimGecerliMi(secim) && !yukleniyor;

// Sesli okuyucu etiketi
export const secimEtiketi = (secenek, secili) =>
  secenek === BILINMIYOR
    ? `Bilinmiyor, cevabı bilmiyorum${secili ? ", seçili" : ""}`
    : `${secenek} şıkkı${secili ? ", seçili" : ""}`;
