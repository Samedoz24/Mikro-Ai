// Rozet tanımları. Saf mantık: ağ ya da veritabanı kullanmaz, kolayca test edilir.
// Rozetler kolaydan zora doğru sıralıdır; ilk birkaçı kullanıcıyı hemen ödüllendirecek kadar kolaydır.
//
// kosul(ist) ile hesaplanan rozetler kullanicilar/{uid}.rozetler alanına kalıcı yazılır;
// böylece seri bozulsa ya da soru silinse bile kazanılan rozet kaybolmaz.

export const ROZETLER = [
  {
    id: "ilk-adim",
    baslik: "İlk Adım",
    ikon: "🌱",
    aciklama: "İlk soru",
    kosul: (i) => i.toplamSoru >= 1,
  },
  {
    id: "tanisalim",
    baslik: "Tanışalım",
    ikon: "👋",
    aciklama: "Adını ekle",
    kosul: (i) => i.adSoyad.trim().length >= 2,
  },
  {
    id: "sinif",
    baslik: "Sınıfın Belli",
    ikon: "🏫",
    aciklama: "Sınıfını seç",
    kosul: (i) => i.sinifSecildi,
  },
  {
    id: "cozum-okuyucu",
    baslik: "Merak Uyandı",
    ikon: "📖",
    aciklama: "İlk çözümü aç",
    kosul: (i) => i.okunanCozum >= 1,
  },
  {
    id: "merakli",
    baslik: "Meraklı",
    ikon: "🔍",
    aciklama: "3 soru sordun",
    kosul: (i) => i.toplamSoru >= 3,
  },
  {
    id: "seri-2",
    baslik: "Alev Aldı",
    ikon: "🔥",
    aciklama: "2 günlük seri",
    kosul: (i) => i.seriGunu >= 2,
  },
  {
    id: "isinma",
    baslik: "Isınma Turu",
    ikon: "⚡",
    aciklama: "3 günlük seri",
    kosul: (i) => i.seriGunu >= 3,
  },
  {
    id: "hizlaniyor",
    baslik: "Hızlanıyor",
    ikon: "🚀",
    aciklama: "5 soru sordun",
    kosul: (i) => i.toplamSoru >= 5,
  },
  {
    id: "cok-yonlu",
    baslik: "Çok Yönlü",
    ikon: "🌈",
    aciklama: "3 farklı ders",
    kosul: (i) => i.farkliDers >= 3,
  },
  {
    id: "soru-avcisi",
    baslik: "Soru Avcısı",
    ikon: "🎯",
    aciklama: "10 soru sordun",
    kosul: (i) => i.toplamSoru >= 10,
  },
  {
    id: "calisan-okur",
    baslik: "Çalışkan Okur",
    ikon: "📚",
    aciklama: "10 çözüm okudun",
    kosul: (i) => i.okunanCozum >= 10,
  },
  {
    id: "istikrarli",
    baslik: "İstikrarlı",
    ikon: "📅",
    aciklama: "7 günlük seri",
    kosul: (i) => i.seriGunu >= 7,
  },
  {
    id: "cirak",
    baslik: "Çırak",
    ikon: "🛠️",
    aciklama: "25 soru sordun",
    kosul: (i) => i.toplamSoru >= 25,
  },
  {
    id: "bilge-baykus",
    baslik: "Bilge Baykuş",
    ikon: "🦉",
    aciklama: "50 soru sordun",
    kosul: (i) => i.toplamSoru >= 50,
  },
  {
    id: "kararli",
    baslik: "Kararlı",
    ikon: "💪",
    aciklama: "14 günlük seri",
    kosul: (i) => i.seriGunu >= 14,
  },
  {
    id: "efsane",
    baslik: "Efsane",
    ikon: "👑",
    aciklama: "100 soru barajı",
    kosul: (i) => i.toplamSoru >= 100,
  },
  {
    id: "demir-irade",
    baslik: "Demir İrade",
    ikon: "🏅",
    aciklama: "30 günlük seri",
    kosul: (i) => i.seriGunu >= 30,
  },
  {
    id: "usta",
    baslik: "Usta",
    ikon: "⚔️",
    aciklama: "250 soru sordun",
    kosul: (i) => i.toplamSoru >= 250,
  },
  {
    id: "profesor",
    baslik: "Profesör",
    ikon: "🎓",
    aciklama: "500 soru sordun",
    kosul: (i) => i.toplamSoru >= 500,
  },
];

const sayi = (x) => (Number.isFinite(x) ? x : 0);

/**
 * @param istatistik { toplamSoru, seriGunu, adSoyad, sinifSecildi, okunanCozum, farkliDers }
 * @returns şu anda koşulu sağlanan rozetlerin id listesi
 */
export const kazanilanRozetIdleri = (istatistik = {}) => {
  const i = {
    toplamSoru: sayi(istatistik.toplamSoru),
    seriGunu: sayi(istatistik.seriGunu),
    okunanCozum: sayi(istatistik.okunanCozum),
    farkliDers: sayi(istatistik.farkliDers),
    adSoyad: typeof istatistik.adSoyad === "string" ? istatistik.adSoyad : "",
    sinifSecildi: istatistik.sinifSecildi === true,
  };
  return ROZETLER.filter((r) => r.kosul(i)).map((r) => r.id);
};

// Soru belgelerinden istatistik çıkarır. dersBul, bir soru belgesinin dersini veren fonksiyondur.
export const soruIstatistigi = (sorular, dersBul) => {
  const dersler = new Set();
  let okunanCozum = 0;
  sorular.forEach((soru) => {
    const ders = dersBul(soru);
    if (ders && ders !== "Diğer") dersler.add(ders);
    if (soru.okunduMu === true) okunanCozum++;
  });
  return { toplamSoru: sorular.length, okunanCozum, farkliDers: dersler.size };
};
