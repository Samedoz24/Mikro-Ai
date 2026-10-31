import { htmlKacis } from "./metin";
import { aktiflikMetni, gunDizisi } from "./kurumIstatistik";
import { turkceTarih } from "./kurumRapor";

// Müdürün veli görüşmesi için paylaştığı öğrenci raporu (PDF'e çevrilecek HTML).
// Yalnızca istatistik içerir; soru içerikleri ve çözümler rapora girmez. Dışarıdan gelen tüm
// metinler (öğrenci adı, ders, konu) HTML'e gömülmeden önce kaçırılır.

const RAPOR_GUNU = 30;
const EN_FAZLA_DERS = 8;
const EN_FAZLA_KONU = 8;
const RENK = "#0F766E";

const TURKCE_ASCII = {
  ç: "c",
  Ç: "C",
  ğ: "g",
  Ğ: "G",
  ı: "i",
  İ: "I",
  ö: "o",
  Ö: "O",
  ş: "s",
  Ş: "S",
  ü: "u",
  Ü: "U",
};

// Paylaşılan dosyanın adı: "Mikro-Rapor-Ali-Yilmaz-2026-10-31.pdf" (yalnızca güvenli karakterler)
export const raporDosyaAdi = (isim, simdi = Date.now()) => {
  const ad =
    String(isim ?? "")
      .replace(/[çÇğĞıİöÖşŞüÜ]/g, (h) => TURKCE_ASCII[h])
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "Ogrenci";
  const tarih = new Date(simdi + 3 * 3600000).toISOString().slice(0, 10);
  return `Mikro-Rapor-${ad}-${tarih}.pdf`;
};

// Son gunSayisi günün kaçında en az bir soru sorulduğu
export const calisilanGunSayisi = (gunler, gunSayisi, simdi = Date.now()) =>
  gunDizisi(gunler, gunSayisi, simdi).filter((g) => g.adet > 0).length;

const STIL = `
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 36px; color: #1F2937; }
  .kurum { text-align: center; font-size: 13px; letter-spacing: 1.2px; color: #6B7280; text-transform: uppercase; }
  h1 { text-align: center; color: ${RENK}; font-size: 26px; margin: 6px 0 4px; }
  .ogrenci { text-align: center; font-size: 22px; font-weight: bold; margin: 4px 0; }
  .tarih { text-align: center; font-size: 13px; color: #6B7280; margin-bottom: 24px; border-bottom: 2px solid ${RENK}; padding-bottom: 14px; }
  .kartlar { display: flex; flex-wrap: wrap; margin: 0 -6px 8px; }
  .kart { width: 25%; box-sizing: border-box; padding: 0 6px; }
  .kart-ic { border: 1px solid #D1D5DB; border-radius: 10px; padding: 14px 8px; text-align: center; }
  .sayi { font-size: 26px; font-weight: bold; color: ${RENK}; }
  .etiket { font-size: 12px; color: #6B7280; margin-top: 2px; }
  .bilgi { font-size: 14px; margin: 6px 0; }
  h2 { font-size: 16px; color: #374151; margin: 26px 0 10px; }
  .grafik { display: flex; align-items: flex-end; height: 100px; border-bottom: 1px solid #D1D5DB; }
  .sutun { flex: 1; margin: 0 1px; }
  .cubuk { background: ${RENK}; border-radius: 2px 2px 0 0; }
  .cubuk-bos { background: #E5E7EB; height: 2px; }
  .gunler { display: flex; }
  .gun { flex: 1; margin: 0 1px; text-align: center; font-size: 8px; color: #6B7280; height: 12px; }
  .ders { margin-bottom: 10px; page-break-inside: avoid; }
  .ders-ust { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px; }
  .ders-arka { background: #E5E7EB; height: 8px; border-radius: 4px; }
  .ders-dolu { background: ${RENK}; height: 8px; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 8px 6px; border-bottom: 1px solid #E5E7EB; }
  td.sag { text-align: right; font-weight: bold; color: ${RENK}; width: 60px; }
  .soluk { color: #6B7280; font-size: 12px; }
  .bos { color: #6B7280; font-size: 14px; }
  .footer { margin-top: 36px; border-top: 1px solid #E5E7EB; padding-top: 12px; font-size: 11px; line-height: 1.6; color: #6B7280; text-align: center; }
`;

const sayi = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

/**
 * @param kurumAdi dershane adı
 * @param satir    ogrenciSatiri(...) sonucu
 * @param simdi    rapor zamanı (ms)
 */
export const ogrenciRaporuHtml = ({ kurumAdi, satir, simdi = Date.now() }) => {
  const toplam = sayi(satir.toplam);
  const okunan = sayi(satir.okunan);
  const okunanYuzde = toplam > 0 ? Math.round((okunan / toplam) * 100) : 0;
  const gunler = gunDizisi(satir.gunler, RAPOR_GUNU, simdi);
  const enYuksek = Math.max(1, ...gunler.map((g) => g.adet));
  const calisilan = gunler.filter((g) => g.adet > 0).length;

  const kartlar = [
    ["Toplam soru", toplam],
    ["Son 7 gün", sayi(satir.son7)],
    ["Son 30 gün", sayi(satir.son30)],
    [`Çalışılan gün (son ${RAPOR_GUNU})`, calisilan],
  ]
    .map(
      ([etiket, deger]) =>
        `<div class="kart"><div class="kart-ic"><div class="sayi">${deger}</div><div class="etiket">${htmlKacis(
          etiket
        )}</div></div></div>`
    )
    .join("");

  const cubuklar = gunler
    .map((g) => {
      const yukseklik = Math.round((g.adet / enYuksek) * 96);
      return g.adet > 0
        ? `<div class="sutun"><div class="cubuk" style="height:${Math.max(
            4,
            yukseklik
          )}px"></div></div>`
        : `<div class="sutun"><div class="cubuk-bos"></div></div>`;
    })
    .join("");
  const gunEtiketleri = gunler
    .map((g, i) => {
      const goster = (gunler.length - 1 - i) % 5 === 0;
      return `<div class="gun">${goster ? Number(g.anahtar.slice(8)) : ""}</div>`;
    })
    .join("");

  const dersler = (Array.isArray(satir.dersler) ? satir.dersler : []).slice(
    0,
    EN_FAZLA_DERS
  );
  const derslerHtml =
    dersler.length === 0
      ? '<div class="bos">Henüz soru gönderilmedi.</div>'
      : dersler
          .map(
            (d) =>
              `<div class="ders"><div class="ders-ust"><span>${htmlKacis(
                d.ders
              )}</span><span class="soluk">${sayi(d.adet)} soru · %${sayi(
                d.yuzde
              )}</span></div><div class="ders-arka"><div class="ders-dolu" style="width:${Math.min(
                100,
                Math.max(0, sayi(d.yuzde))
              )}%"></div></div></div>`
          )
          .join("");

  const konular = (Array.isArray(satir.konular) ? satir.konular : []).slice(
    0,
    EN_FAZLA_KONU
  );
  const konularHtml =
    konular.length === 0
      ? '<div class="bos">Konu bilgisi bulunmuyor.</div>'
      : `<table>${konular
          .map(
            (k) =>
              `<tr><td>${htmlKacis(k.konu)}<div class="soluk">${htmlKacis(
                k.ders
              )}</div></td><td class="sag">${sayi(k.adet)}</td></tr>`
          )
          .join("")}</table>`;

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>${STIL}</style></head><body>
  <div class="kurum">${htmlKacis(kurumAdi || "Dershane")}</div>
  <h1>Öğrenci Gelişim Raporu</h1>
  <div class="ogrenci">${htmlKacis(satir.isim || "Öğrenci")}</div>
  <div class="tarih">Rapor tarihi: ${htmlKacis(turkceTarih(simdi))}</div>

  <div class="kartlar">${kartlar}</div>
  <div class="bilgi"><strong>Okunan çözümler:</strong> ${okunan} / ${toplam} (%${okunanYuzde})</div>
  <div class="bilgi"><strong>Son aktiflik:</strong> ${htmlKacis(
    aktiflikMetni(satir.sonAktiflikMs, simdi)
  )}</div>

  <h2>Son ${RAPOR_GUNU} gün: günlük soru sayısı</h2>
  <div class="grafik">${cubuklar}</div>
  <div class="gunler">${gunEtiketleri}</div>
  <div class="soluk" style="margin-top:6px">En yoğun gün: ${
    gunler.some((g) => g.adet > 0) ? `${enYuksek} soru` : "-"
  }</div>

  <h2>Ders dağılımı</h2>
  ${derslerHtml}

  <h2>En çok sorduğu konular</h2>
  ${konularHtml}

  <div class="footer">Bu rapor, öğrencinin Mikro AI uygulamasındaki kullanımına ait otomatik istatistiklerden oluşturulmuştur. Soru içerikleri ve çözümler rapora dahil değildir. Kişisel veri içerdiğinden yalnızca öğrenci ve velisiyle paylaşılmalıdır.</div>
</body></html>`;
};
