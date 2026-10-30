// Kurum öğrenci özetlerinden (kurumlar/{id}/ozet/{uid}) ekranda gösterilen sayıları üretir.
// Saf mantık: ağ kullanmaz, kolayca test edilir.
//
// Günler Türkiye saatine (UTC+3, yaz saati uygulaması yok) göre sayılır; sunucu özeti de aynı
// kurala göre yazar, böylece "bugün" cihazın saat dilimine bağlı kalmaz.

const TR_FARKI_MS = 3 * 60 * 60 * 1000;
const GUN_MS = 86400000;

export const gunAnahtari = (ms) =>
  new Date(ms + TR_FARKI_MS).toISOString().slice(0, 10);

const sayi = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

// Firestore Timestamp, ISO metin ya da milisaniye -> milisaniye (yoksa null)
export const milisaniye = (deger) => {
  if (deger === null || deger === undefined) return null;
  if (typeof deger.toMillis === "function") return deger.toMillis();
  const ms = typeof deger === "number" ? deger : Date.parse(deger);
  return Number.isFinite(ms) ? ms : null;
};

// Bugünden geriye gunSayisi günün (bugün dahil) toplam soru sayısı
export const sonGunlerToplami = (gunler, gunSayisi, simdi = Date.now()) => {
  let toplam = 0;
  for (let i = 0; i < gunSayisi; i++) {
    toplam += sayi(gunler?.[gunAnahtari(simdi - i * GUN_MS)]);
  }
  return toplam;
};

// Grafik için: eskiden yeniye gunSayisi günlük dizi [{ anahtar, adet }]
export const gunDizisi = (gunler, gunSayisi, simdi = Date.now()) => {
  const dizi = [];
  for (let i = gunSayisi - 1; i >= 0; i--) {
    const anahtar = gunAnahtari(simdi - i * GUN_MS);
    dizi.push({ anahtar, adet: sayi(gunler?.[anahtar]) });
  }
  return dizi;
};

// "Bugün", "Dün", "3 gün önce"... Takvim günü farkıyla hesaplanır (saat farkıyla değil).
export const aktiflikMetni = (sonAktiflik, simdi = Date.now()) => {
  const ms = milisaniye(sonAktiflik);
  if (ms === null) return "Henüz soru sormadı";
  const fark = Math.round(
    (Date.parse(gunAnahtari(simdi)) - Date.parse(gunAnahtari(ms))) / GUN_MS
  );
  if (fark <= 0) return "Bugün";
  if (fark === 1) return "Dün";
  if (fark < 30) return `${fark} gün önce`;
  return "30 günden uzun süre önce";
};

// Ders dağılımı -> çoktan aza sıralı [{ ders, adet, yuzde }]
export const dersListesi = (dersDagilimi) => {
  const girdiler = Object.entries(dersDagilimi || {})
    .map(([ders, adet]) => ({ ders, adet: sayi(adet) }))
    .filter((g) => g.adet > 0);
  const toplam = girdiler.reduce((t, g) => t + g.adet, 0);
  return girdiler
    .map((g) => ({
      ...g,
      yuzde: toplam > 0 ? Math.round((g.adet / toplam) * 100) : 0,
    }))
    .sort((a, b) => b.adet - a.adet || a.ders.localeCompare(b.ders, "tr"));
};

// Bir öğrencinin liste satırı
export const ogrenciSatiri = (id, ozet, simdi = Date.now()) => {
  const gunler = ozet?.gunler;
  const dersler = dersListesi(ozet?.dersDagilimi);
  const son7 = sonGunlerToplami(gunler, 7, simdi);
  return {
    id,
    isim: String(ozet?.isim ?? "").trim() || "Öğrenci",
    toplam: sayi(ozet?.toplamSoru),
    okunan: sayi(ozet?.okunanCozum),
    bugun: sonGunlerToplami(gunler, 1, simdi),
    son7,
    son30: sonGunlerToplami(gunler, 30, simdi),
    aktif: son7 > 0,
    sonAktiflikMs: milisaniye(ozet?.sonAktiflik),
    enCokDers: dersler.length ? dersler[0].ders : null,
    dersler,
    gunler: gunler || {},
  };
};

// Kurumun genel toplamları
export const kurumToplamlari = (satirlar) => ({
  ogrenci: satirlar.length,
  bugun: satirlar.reduce((t, s) => t + s.bugun, 0),
  son7: satirlar.reduce((t, s) => t + s.son7, 0),
  aktifOgrenci: satirlar.filter((s) => s.aktif).length,
});

const arama = (metin) =>
  String(metin ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

export const SIRALAMALAR = [
  { id: "aktiflik", etiket: "Son aktiflik" },
  { id: "hafta", etiket: "Bu hafta" },
  { id: "toplam", etiket: "En çok soru" },
  { id: "isim", etiket: "A-Z" },
];

// Aramaya uyan satırları seçilen ölçüte göre sıralar (girdi dizisini değiştirmez)
export const ogrenciSirala = (satirlar, olcut = "aktiflik", aranan = "") => {
  const aranacak = arama(aranan);
  const liste = aranacak
    ? satirlar.filter((s) => arama(s.isim).includes(aranacak))
    : [...satirlar];
  const isimle = (a, b) => a.isim.localeCompare(b.isim, "tr");
  const karsilastir = {
    aktiflik: (a, b) =>
      (b.sonAktiflikMs ?? -Infinity) - (a.sonAktiflikMs ?? -Infinity) ||
      isimle(a, b),
    hafta: (a, b) => b.son7 - a.son7 || b.toplam - a.toplam || isimle(a, b),
    toplam: (a, b) => b.toplam - a.toplam || isimle(a, b),
    isim: isimle,
  }[olcut];
  return liste.sort(karsilastir || isimle);
};
