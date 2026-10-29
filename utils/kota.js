// Günlük soru kotası hesabı. Hem Ana ekran (soru gönderirken) hem Profil ekranı (kalan hak
// göstergesi) aynı fonksiyonu kullanır; böylece iki ekran asla farklı sonuç göstermez.

export const UCRETSIZ_KOTA = 3;
export const PREMIUM_KOTA = 50;

export const maksimumKota = (premiumMu) =>
  premiumMu ? PREMIUM_KOTA : UCRETSIZ_KOTA;

/**
 * @param veri     cihazHaklari belgesinin verisi (belge yoksa null)
 * @param bugun    yerel tarih, YYYY-MM-DD
 * @param maxKota  kullanıcının şu anki günlük hakkı (3 ya da 50)
 * @returns { kalan, guncelleme }  guncelleme doluysa belgeye yazılmalıdır
 */
export const kotaDurumu = (veri, bugun, maxKota) => {
  // Belge yok ya da başka bir güne ait: yeni gün, tam kota
  if (!veri || veri.tarih !== bugun) {
    return {
      kalan: maxKota,
      guncelleme: { kalanSoru: maxKota, tarih: bugun, toplamHak: maxKota },
    };
  }

  const kayitliKalan =
    typeof veri.kalanSoru === "number" ? veri.kalanSoru : maxKota;
  const kayitliToplam = veri.toplamHak || UCRETSIZ_KOTA;

  if (kayitliToplam === maxKota) {
    return { kalan: kayitliKalan, guncelleme: null };
  }

  // Gün içinde premium durumu değişti (yükseltme ya da düşürme):
  // bugün harcanan soru sayısı korunur, yeni toplam hak üzerinden kalan yeniden hesaplanır.
  const harcanan = Math.max(0, kayitliToplam - kayitliKalan);
  const kalan = Math.max(0, maxKota - harcanan);
  return {
    kalan,
    guncelleme: { kalanSoru: kalan, toplamHak: maxKota },
  };
};
