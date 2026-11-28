// Seri kutlaması: soru gönderildikten 10 saniye sonra, hangi ekranda olursa olsun gösterilir (28 Kasım kararı).
// Soru gönderen ekran isteği bırakır; uygulamanın kökündeki SeriKutlama bileşeni dinler ve gösterir.
// Yalnızca görünüm: seri değeri sunucunun soruGonder yanıtından gelir (utils/seri.js kutlanacakSeri).
export const KUTLAMA_GECIKMESI_MS = 10 * 1000;

const dinleyiciler = new Set();

export const seriKutlamasiniDinle = (dinleyici) => {
  dinleyiciler.add(dinleyici);
  return () => dinleyiciler.delete(dinleyici);
};

export const seriKutlamasiIste = (gun) => {
  for (const dinleyici of dinleyiciler) dinleyici(gun);
};
