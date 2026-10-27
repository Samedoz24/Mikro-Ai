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
