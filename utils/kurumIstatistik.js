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

// İki zaman arasındaki takvim günü farkı (saat farkı değil): dün 23:00 ile bugün 01:00 = 1 gün
export const takvimGunFarki = (ms, simdi = Date.now()) =>
  Math.round(
    (Date.parse(gunAnahtari(simdi)) - Date.parse(gunAnahtari(ms))) / GUN_MS
  );

// "Bugün", "Dün", "3 gün önce"... Takvim günü farkıyla hesaplanır (saat farkıyla değil).
export const aktiflikMetni = (sonAktiflik, simdi = Date.now()) => {
  const ms = milisaniye(sonAktiflik);
  if (ms === null) return "Henüz soru sormadı";
  const fark = takvimGunFarki(ms, simdi);
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

// Özetteki konu dizisini güvenli biçime getirir: [{ ders, konu, adet }], çoktan aza
export const konuListesi = (konular) =>
  (Array.isArray(konular) ? konular : [])
    .map((k) => ({
      ders: String(k?.ders ?? "").trim() || "Diğer",
      konu: String(k?.konu ?? "").trim(),
      adet: sayi(k?.adet),
    }))
    .filter((k) => k.konu && k.adet > 0)
    .sort((a, b) => b.adet - a.adet || a.konu.localeCompare(b.konu, "tr"));

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
    katilmaMs: milisaniye(ozet?.katilma),
    enCokDers: dersler.length ? dersler[0].ders : null,
    dersler,
    konular: konuListesi(ozet?.konular),
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

const YENI_KATILAN_GUN = 7;

/**
 * Müdür ve öğretmenin "Genel Bakış" ekranı için kurum geneli sayılar.
 *  - gunler: son gunSayisi günün tüm öğrencilerce sorulan toplam soru sayısı (eskiden yeniye)
 *  - dersler: ders dağılımı, konular: en çok sorulan konular (hepsi öğrenciler toplamı)
 *  - dikkat: son aktiflikGunu günde hiç soru sormamış öğrenciler, en uzun süredir pasif olan başta.
 *    Son 7 günde katılanlar henüz ısınmamış sayılır ve listeye alınmaz.
 *  - enAktif: son aktiflikGunu günde en çok soru soran öğrenciler (donemSoru alanıyla)
 *  - donem: seçilen aralığın özeti { gun, soru, aktifOgrenci }
 * Ders ve konu dağılımı tüm zamanları kapsar (özette günlük ders verisi tutulmaz).
 */
export const kurumGenelBakis = (
  satirlar,
  simdi = Date.now(),
  gunSayisi = 14,
  aktiflikGunu = 7
) => {
  // Her öğrencinin seçilen aralıktaki soru sayısı
  const donemSorulari = new Map(
    satirlar.map((s) => [s.id, sonGunlerToplami(s.gunler, aktiflikGunu, simdi)])
  );
  const gunler = gunDizisi({}, gunSayisi, simdi).map((g) => ({
    anahtar: g.anahtar,
    adet: satirlar.reduce((t, s) => t + sayi(s.gunler?.[g.anahtar]), 0),
  }));

  const dersToplam = {};
  const konuToplam = new Map();
  satirlar.forEach((s) => {
    s.dersler.forEach((d) => {
      dersToplam[d.ders] = (dersToplam[d.ders] || 0) + d.adet;
    });
    s.konular.forEach((k) => {
      const anahtar = `${k.ders}\u0000${k.konu}`;
      konuToplam.set(anahtar, (konuToplam.get(anahtar) || 0) + k.adet);
    });
  });
  const konular = [...konuToplam.entries()]
    .map(([anahtar, adet]) => {
      const [ders, konu] = anahtar.split("\u0000");
      return { ders, konu, adet };
    })
    .sort((a, b) => b.adet - a.adet || a.konu.localeCompare(b.konu, "tr"));

  const dikkat = satirlar
    .filter((s) => {
      if (donemSorulari.get(s.id) > 0) return false;
      const yeni =
        s.katilmaMs !== null &&
        takvimGunFarki(s.katilmaMs, simdi) < YENI_KATILAN_GUN;
      return !yeni;
    })
    .map((s) => {
      const referans = s.sonAktiflikMs ?? s.katilmaMs;
      return {
        id: s.id,
        isim: s.isim,
        hicBaslamadi: s.sonAktiflikMs === null,
        pasifGun: referans === null ? null : takvimGunFarki(referans, simdi),
      };
    })
    .sort(
      (a, b) =>
        (b.pasifGun ?? -1) - (a.pasifGun ?? -1) ||
        a.isim.localeCompare(b.isim, "tr")
    );

  const enAktif = satirlar
    .filter((s) => donemSorulari.get(s.id) > 0)
    .map((s) => ({ ...s, donemSoru: donemSorulari.get(s.id) }))
    .sort(
      (a, b) => b.donemSoru - a.donemSoru || a.isim.localeCompare(b.isim, "tr")
    );

  return {
    toplamlar: kurumToplamlari(satirlar),
    donem: {
      gun: aktiflikGunu,
      soru: [...donemSorulari.values()].reduce((t, n) => t + n, 0),
      aktifOgrenci: enAktif.length,
    },
    gunler,
    dersler: dersListesi(dersToplam),
    konular,
    dikkat,
    enAktif,
  };
};

// Öğrenciler ekranındaki hızlı süzgeçler
export const DURUM_FILTRELERI = [
  { id: "hepsi", etiket: "Tümü" },
  { id: "aktif", etiket: "Aktif" },
  { id: "pasif", etiket: "Pasif" },
  { id: "baslamayan", etiket: "Hiç başlamayan" },
];

const durumUygun = (s, durum) => {
  if (durum === "aktif") return s.aktif; // son 7 günde soru sordu
  if (durum === "pasif") return !s.aktif && s.sonAktiflikMs !== null; // sordu ama son 7 günde sormadı
  if (durum === "baslamayan") return s.sonAktiflikMs === null; // hiç soru sormadı
  return true;
};

/**
 * Öğrenci satırlarını durum ve derse göre süzer (girdi dizisini değiştirmez).
 * @param secenek { durum: "hepsi"|"aktif"|"pasif"|"baslamayan", ders: null | "Matematik" }
 */
export const ogrenciFiltrele = (
  satirlar,
  { durum = "hepsi", ders = null } = {}
) =>
  satirlar.filter(
    (s) =>
      durumUygun(s, durum) && (!ders || s.dersler.some((d) => d.ders === ders))
  );

// Durum süzgeçlerinin yanında gösterilecek sayılar (seçili ders süzgeci dikkate alınır)
export const durumSayilari = (satirlar, ders = null) =>
  Object.fromEntries(
    DURUM_FILTRELERI.map((f) => [
      f.id,
      ogrenciFiltrele(satirlar, { durum: f.id, ders }).length,
    ])
  );

// Öğrencilerin sorduğu dersler, çok soru soranlar önde: [{ ders, ogrenci }]
export const dersSecenekleri = (satirlar) => {
  const sayac = new Map();
  satirlar.forEach((s) =>
    s.dersler.forEach((d) => sayac.set(d.ders, (sayac.get(d.ders) || 0) + 1))
  );
  return [...sayac.entries()]
    .map(([ders, ogrenci]) => ({ ders, ogrenci }))
    .sort(
      (a, b) => b.ogrenci - a.ogrenci || a.ders.localeCompare(b.ders, "tr")
    );
};
