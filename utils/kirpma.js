// Kare kırpma hesabı (saf mantık, test edilebilir; ağ ya da dosya kullanmaz).
//
// Kırpma ekranında fotoğraf, kenarı `cerceve` olan kare bir alanın içinde gösterilir. Fotoğraf başlangıçta
// kareyi tamamen kaplayacak şekilde ölçeklenir (temel ölçek), kullanıcı kaydırır ve yakınlaştırır.
// Bu fonksiyon ekrandaki görünümü, orijinal fotoğraftaki piksel karesine çevirir.

// Fotoğrafın kareyi tamamen kapladığı temel ölçek (görüntü pikseli → ekran noktası)
export const temelOlcek = (genislik, yukseklik, cerceve) => cerceve / Math.min(genislik, yukseklik);

// Görünümdeki başlangıç kaydırması: fotoğraf karede ortalanır
export const ortalamaKaydirmasi = (genislik, yukseklik, cerceve) => {
  const s = temelOlcek(genislik, yukseklik, cerceve);
  return { x: (genislik * s - cerceve) / 2, y: (yukseklik * s - cerceve) / 2 };
};

// Ekrandaki kaydırma (kayX, kayY) ve yakınlaştırma (zoom) → orijinal fotoğrafta tam sayı kare
// { originX, originY, width, height }. Her zaman fotoğrafın içinde kalır ve kare olur.
export const kirpmaAlani = ({ genislik, yukseklik, cerceve, kayX, kayY, zoom }) => {
  if (!(genislik > 0 && yukseklik > 0 && cerceve > 0)) return null;
  const z = Number.isFinite(zoom) && zoom >= 1 ? zoom : 1;
  const olcek = temelOlcek(genislik, yukseklik, cerceve) * z;
  const kisaKenar = Math.min(genislik, yukseklik);
  // Karenin orijinal pikseldeki kenarı (yakınlaştıkça küçülür, kısa kenarı aşamaz)
  const kenar = Math.max(1, Math.min(kisaKenar, Math.round(cerceve / olcek)));
  const kis = (deger, enFazla) => Math.min(Math.max(0, deger), enFazla);
  const x = kis(Math.round((Number.isFinite(kayX) ? kayX : 0) / olcek), genislik - kenar);
  const y = kis(Math.round((Number.isFinite(kayY) ? kayY : 0) / olcek), yukseklik - kenar);
  return { originX: x, originY: y, width: kenar, height: kenar };
};
