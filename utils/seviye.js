// Seviye ve puan (XP) hesabı. Saf mantık: ağ ya da veritabanı kullanmaz, kolayca test edilir.
//
// Puan yalnızca azalmayan sayılardan gelir (seri gibi bozulabilen değerler puana katılmaz),
// böylece öğrenci seviye kaybetmez:
//   her soru 50 puan, açılan her çözüm 15 puan.
//
// Seviye eğrisi (en yüksek seviye 100):
//   1→10 arası kolay:  bir sonraki seviyenin maliyeti 100, 125, 150 ... 300
//   10→100 arası yavaş yavaş zorlaşır: 300, 320, 340 ... 2080

export const EN_YUKSEK_SEVIYE = 100;
export const SORU_PUANI = 50;
export const COZUM_PUANI = 15;

const tamSayi = (x) => (Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);

// L seviyesinden L+1'e geçmek için gereken puan (1 ≤ L < 100)
export const seviyeMaliyeti = (seviye) =>
  seviye < 10 ? 100 + 25 * (seviye - 1) : 300 + 20 * (seviye - 10);

// Her seviyeye ulaşmak için gereken toplam puan: ESIKLER[L] = L. seviyenin başlangıcı
const ESIKLER = (() => {
  const esik = [0, 0];
  for (let s = 1; s < EN_YUKSEK_SEVIYE; s++) esik[s + 1] = esik[s] + seviyeMaliyeti(s);
  return esik;
})();

export const seviyeEsigi = (seviye) =>
  ESIKLER[Math.min(Math.max(1, Math.floor(seviye) || 1), EN_YUKSEK_SEVIYE)];

export const puanHesapla = ({ toplamSoru, okunanCozum } = {}) =>
  tamSayi(toplamSoru) * SORU_PUANI + tamSayi(okunanCozum) * COZUM_PUANI;

/**
 * @returns { seviye, puan, seviyedekiPuan, gerekenPuan, kalanPuan, yuzde, enYuksekte }
 */
export const seviyeBilgisi = (puanGirdi) => {
  const puan = tamSayi(puanGirdi);
  let seviye = 1;
  while (seviye < EN_YUKSEK_SEVIYE && puan >= ESIKLER[seviye + 1]) seviye++;

  if (seviye >= EN_YUKSEK_SEVIYE) {
    return { seviye, puan, seviyedekiPuan: 0, gerekenPuan: 0, kalanPuan: 0, yuzde: 100, enYuksekte: true };
  }
  const gerekenPuan = seviyeMaliyeti(seviye);
  const seviyedekiPuan = puan - ESIKLER[seviye];
  return {
    seviye,
    puan,
    seviyedekiPuan,
    gerekenPuan,
    kalanPuan: gerekenPuan - seviyedekiPuan,
    yuzde: Math.min(100, Math.max(0, Math.floor((seviyedekiPuan / gerekenPuan) * 100))),
    enYuksekte: false,
  };
};
