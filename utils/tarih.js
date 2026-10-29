// İki tarih arasındaki TAKVİM günü farkı (yerel saate göre).
// Saat dilimi / yaz saati değişimleri günleri 23 ya da 25 saat yapabildiği için
// milisaniye farkını 24'e bölüp aşağı yuvarlamak yanlış sonuç verir (ör. 1 yerine 0).
export const takvimGunFarki = (baslangic, bitis) => {
  const a = Date.UTC(
    baslangic.getFullYear(),
    baslangic.getMonth(),
    baslangic.getDate()
  );
  const b = Date.UTC(bitis.getFullYear(), bitis.getMonth(), bitis.getDate());
  return Math.round((b - a) / 86400000);
};

// Cihazın YEREL saatine göre bugünün tarihi (YYYY-MM-DD).
// Günlük kota "gün"ü bununla belirlenir. toISOString() UTC verir; Türkiye'de gece 00:00-03:00
// arasında bir önceki günü gösterir ve kotanın yanlış sıfırlanmasına yol açar.
export const yerelTarih = (tarih = new Date()) => {
  const yyyy = tarih.getFullYear();
  const mm = String(tarih.getMonth() + 1).padStart(2, "0");
  const dd = String(tarih.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
