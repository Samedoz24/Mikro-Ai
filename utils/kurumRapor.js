import { milisaniye, takvimGunFarki, gunAnahtari } from "./kurumIstatistik";

// Dershane ekranındaki lisans durumu ve paylaşılan metinler. Saf mantık: ağ kullanmaz.

const AYLAR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

// Türkiye saatine göre "30 Ekim 2026"; cihazın saat diliminden bağımsızdır
export const turkceTarih = (ms) => {
  const [yil, ay, gun] = gunAnahtari(ms).split("-").map(Number);
  return `${gun} ${AYLAR[ay - 1]} ${yil}`;
};

/**
 * Lisansın durumu ve kalan süre.
 * seviye: "iyi" (30 günden fazla), "yaklasiyor" (8-30 gün), "kritik" (en çok 7 gün),
 *         "bitti", "bilinmiyor"
 */
export const lisansDurumu = (lisansBitis, durum, simdi = Date.now()) => {
  if (durum && durum !== "aktif") {
    return { seviye: "bitti", kalanGun: 0, metin: "Kullanım süresi sona erdi" };
  }
  const bitisMs = milisaniye(lisansBitis);
  if (bitisMs === null) {
    return {
      seviye: "bilinmiyor",
      kalanGun: null,
      metin: "Lisans bilgisi yok",
    };
  }
  if (bitisMs <= simdi) {
    return { seviye: "bitti", kalanGun: 0, metin: "Kullanım süresi sona erdi" };
  }
  const kalanGun = Math.max(0, takvimGunFarki(simdi, bitisMs));
  const seviye =
    kalanGun <= 7 ? "kritik" : kalanGun <= 30 ? "yaklasiyor" : "iyi";
  const metin =
    kalanGun === 0
      ? "Bugün sona eriyor"
      : kalanGun === 1
        ? "Yarın sona eriyor"
        : `${kalanGun} gün kaldı`;
  return { seviye, kalanGun, metin };
};

export const bosKoltuk = (koltuk, uyeSayisi) =>
  Math.max(0, (Number(koltuk) || 0) - (Number(uyeSayisi) || 0));

// Müdürün öğrencilere göndereceği hazır katılım metni
export const ogrenciDavetMetni = (kurumAdi, kod) =>
  [
    `🏫 ${kurumAdi || "Dershanemiz"} — Mikro AI`,
    "",
    "Soru çözücü uygulamaya dershane hesabınla katılabilirsin:",
    "1. Mikro AI uygulamasını telefonuna indir ve Öğrenci olarak giriş yap.",
    '2. Hesabım sayfasında "Dershane Kodu Gir" bölümünü aç.',
    `3. Dershane kodunu yaz: ${kod}`,
    '4. Bilgilendirmeyi okuyup onayla ve "Bağlan"a bas.',
    "",
    "Bağlandıktan sonra premium haklarından yararlanırsın. Dershane yönetimi, gönderdiğin soruların istatistiklerini görebilir. İstediğin zaman Hesabım sayfasından ayrılabilirsin.",
  ].join("\n");

/**
 * Haftalık özet metni (paylaşılabilir). Öğrenci adı içermez: yalnızca sayılar ve konular.
 * @param bakis kurumGenelBakis(...) sonucu
 */
export const haftalikOzetMetni = (kurumAdi, bakis, simdi = Date.now()) => {
  const { toplamlar, konular, dikkat } = bakis;
  const satirlar = [
    `📊 ${kurumAdi || "Dershane"} — Haftalık Özet`,
    `${turkceTarih(simdi)} itibarıyla`,
    "",
    `• Öğrenci: ${toplamlar.ogrenci} (aktif: ${toplamlar.aktifOgrenci})`,
    `• Son 7 günde sorulan soru: ${toplamlar.son7}`,
    `• Bugün sorulan soru: ${toplamlar.bugun}`,
    `• Dikkat gerektiren öğrenci: ${dikkat.length}`,
  ];
  if (konular.length > 0) {
    satirlar.push("", "En çok sorulan konular:");
    konular
      .slice(0, 3)
      .forEach((k, i) =>
        satirlar.push(`${i + 1}. ${k.konu} (${k.ders}) — ${k.adet} soru`)
      );
  }
  return satirlar.join("\n");
};
