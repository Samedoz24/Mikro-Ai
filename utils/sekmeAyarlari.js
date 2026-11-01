// Alt menü (sekme çubuğu) ayarları: saf mantık, ağ ve ekran kullanmaz; kolayca test edilir.
// Tüm roller (öğrenci, veli, müdür, öğretmen) aynı yapıyı kullanır; yalnızca sekmeler değişir.

// Sekme adı -> [dolu ikon (seçili), çizgili ikon (seçili değil)]
export const SEKME_IKONLARI = {
  "Ana Sayfa": ["camera", "camera-outline"],
  "Hata Defteri": ["time", "time-outline"],
  Profil: ["person-circle", "person-circle-outline"],
  "Genel Bakış": ["bar-chart", "bar-chart-outline"],
  Öğrenciler: ["people", "people-outline"],
  Yönetim: ["school", "school-outline"],
  "Veli Paneli": ["grid", "grid-outline"],
};

const VARSAYILAN_IKON = ["ellipse", "ellipse-outline"];

// Bilinmeyen bir sekme adında çökmesin diye yedek ikon verilir
export const ikonAdi = (sekmeAdi, secili) => {
  const cift = Object.prototype.hasOwnProperty.call(SEKME_IKONLARI, sekmeAdi)
    ? SEKME_IKONLARI[sekmeAdi]
    : VARSAYILAN_IKON;
  return secili ? cift[0] : cift[1];
};

// Rozet: 0 ya da geçersiz değer rozet göstermez; çok büyük sayılar "99+" olur
export const rozetDegeri = (sayi) => {
  const n = Number(sayi);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n > 99 ? "99+" : Math.floor(n);
};

// Sesli okuyucu etiketi: "Geçmiş Sorular, 3 okunmamış"
export const sekmeEtiketi = (
  baslik,
  rozetSayisi,
  rozetAciklamasi = "okunmamış"
) => {
  const n = Number(rozetSayisi);
  return Number.isFinite(n) && n > 0
    ? `${baslik}, ${n > 99 ? "99+" : Math.floor(n)} ${rozetAciklamasi}`
    : baslik;
};

// Alt menüdeki kayan göstergenin sol kenarı: seçili sekmenin ortasına hizalanır.
// Geçersiz değerlerde (genişlik/sayı sıfır, indeks taşması) güvenli bir konum döner.
export const gostergeKonumu = (
  indeks,
  genislik,
  sekmeSayisi,
  cizgiGenisligi
) => {
  const g = Number(genislik);
  const n = Number(sekmeSayisi);
  const i = Number(indeks);
  const c = Number(cizgiGenisligi);
  if (
    !Number.isFinite(g) ||
    !Number.isFinite(n) ||
    !Number.isFinite(i) ||
    !Number.isFinite(c)
  )
    return 0;
  if (g <= 0 || n <= 0 || c < 0) return 0;
  const sinirli = Math.min(Math.max(Math.floor(i), 0), n - 1);
  const sekmeGenisligi = g / n;
  return sinirli * sekmeGenisligi + (sekmeGenisligi - c) / 2;
};
