import { htmlKacis, htmlMetin } from "./metin";
import { PDF_SAYFA_STILI } from "./pdfYazdir";

// Hata Defteri PDF'inin içeriği. Yapay zekâdan gelen tüm metinler HTML'e gömülmeden önce
// kaçırılır ("x < 5" gibi ifadeler belgeyi bozmasın).

// Çözüm dosyasında sonucun bulunabileceği alanlar (eski ve yeni n8n biçimleri)
export const cevapBul = (cozum) => {
  if (!cozum) return "";
  const aday =
    cozum.cardAnswer ||
    cozum.correct_answer ||
    cozum.solution ||
    cozum.answer ||
    cozum.sonuc ||
    cozum.result;
  return aday ? String(aday) : "";
};

// Sayfa düzeni (28 Kasım): A4 ve her sayfada kenar boşluğu (pdfYazdir.js). Sorunun başlığı ve fotoğrafı birlikte
// kalır (.soru-ust; soru metni dahil edilmez, yoksa blok sığmayıp sayfa altlarında büyük boşluk kalıyordu); soru
// metni, adım, sonuç ve açıklama kutuları hiçbir zaman ortadan bölünmez. Sorular çerçeveli tek kutu yerine başlık
// çizgisiyle ayrılır: uzun bir soru sayfaya bölündüğünde yarım çerçeve kalmaz. "Sormix tarafından oluşturuldu"
// notu başlığın altındadır (sonda tek başına bir sayfa kaplamasın).
export const PDF_STILI = `${PDF_SAYFA_STILI}
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; }
  h1 { text-align: center; color: #2C3E50; border-bottom: 2px solid #3498DB; padding-bottom: 10px; font-size: 26px; margin: 0 0 5px; }
  .kategori-bilgi { text-align: center; font-size: 13px; color: #7F8C8D; margin-bottom: 4px; }
  .olusturan { text-align: center; font-size: 11px; color: #95A5A6; margin-bottom: 26px; }
  .soru-kutusu { margin-bottom: 30px; }
  .soru-kutusu + .soru-kutusu { border-top: 1px dashed #BDC3C7; padding-top: 22px; }
  .soru-ust { page-break-inside: avoid; break-inside: avoid; }
  .soru-baslik { display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; color: #2980B9; border-bottom: 2px solid #3498DB; padding-bottom: 8px; margin-bottom: 14px; }
  .soru-foto { display: block; max-width: 100%; max-height: 320px; object-fit: contain; border-radius: 8px; margin: 0 0 14px; border: 1px solid #ddd; }
  .foto-yok { padding: 20px; background: #eee; text-align: center; border-radius: 8px; margin-bottom: 14px; color: #888; }
  .soru-metni { page-break-inside: avoid; break-inside: avoid; background: #F8F9FA; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px 14px; font-size: 14px; line-height: 1.6; margin-bottom: 12px; }
  .bolum-baslik { font-size: 12px; font-weight: bold; letter-spacing: 0.6px; color: #2980B9; margin: 14px 0 8px; page-break-after: avoid; break-after: avoid; }
  .adim { page-break-inside: avoid; break-inside: avoid; background: #EFF6FF; border-left: 4px solid #3498DB; border-radius: 4px; padding: 10px 14px; margin-bottom: 8px; font-size: 14px; line-height: 1.6; }
  .adim-no { display: block; font-size: 11px; font-weight: bold; letter-spacing: 0.6px; color: #2980B9; margin-bottom: 2px; }
  .sonuc { page-break-inside: avoid; break-inside: avoid; background: #ECFDF5; border: 1px solid #10B981; border-radius: 6px; padding: 12px 14px; margin-top: 12px; }
  .sonuc-etiket { display: block; font-size: 11px; font-weight: bold; letter-spacing: 0.6px; color: #059669; margin-bottom: 4px; }
  .sonuc-metin { font-size: 16px; font-weight: bold; color: #065F46; line-height: 1.5; }
  .aciklama { page-break-inside: avoid; break-inside: avoid; background: #F4F6F7; border-left: 4px solid #1ABC9C; padding: 12px 14px; border-radius: 4px; font-size: 14px; line-height: 1.6; margin-top: 12px; }
  .cozum-yok { page-break-inside: avoid; break-inside: avoid; background: #F4F6F7; border-left: 4px solid #BDC3C7; padding: 14px; border-radius: 4px; font-size: 14px; line-height: 1.6; }
`;

const cozumHtml = (cozum, mesaj) => {
  if (!cozum) {
    return `<div class="cozum-yok"><strong>Yapay Zeka Çözümü:</strong><br/>${htmlMetin(
      mesaj
    )}</div>`;
  }

  const parcalar = [];

  const adimlar = Array.isArray(cozum.cardSteps) ? cozum.cardSteps : [];
  if (adimlar.length > 0) {
    parcalar.push(`<div class="bolum-baslik">ÇÖZÜM ADIMLARI</div>`);
    adimlar.forEach((adim, i) => {
      parcalar.push(
        `<div class="adim"><span class="adim-no">ADIM ${i + 1}</span>${htmlMetin(
          adim
        )}</div>`
      );
    });
  }

  const cevap = cevapBul(cozum);
  if (cevap) {
    parcalar.push(
      `<div class="sonuc"><span class="sonuc-etiket">KESİN SONUÇ</span><div class="sonuc-metin">${htmlMetin(
        cevap
      )}</div></div>`
    );
  }

  if (cozum.explanation) {
    parcalar.push(`<div class="aciklama">${htmlMetin(cozum.explanation)}</div>`);
  }

  // Dosya var ama tanıdığımız hiçbir alan yoksa boş bir kutu bırakma (soru metni üst blokta gösterilir)
  if (parcalar.length === 0 && !cozum.question) {
    return `<div class="cozum-yok">Çözüm dosyası bulundu fakat içeriği okunamadı.</div>`;
  }
  return parcalar.join("\n");
};

// Bir sorunun PDF bloğu. `cozum`: cozumuDuzenle çıktısı ya da null; `mesaj`: çözüm yoksa nedeni.
export const soruBlokHtml = ({ sira, dersAdi, tarih, fotoLink, cozum, mesaj }) => {
  const resim = fotoLink
    ? `<img class="soru-foto" src="${htmlKacis(fotoLink)}" />`
    : `<div class="foto-yok">Fotoğraf Yok</div>`;
  // Başlık ve fotoğraf aynı sayfada kalır; soru metni ayrı (bölünmeyen) kutuda hemen ardından gelir
  const soruMetni = cozum?.question
    ? `<div class="soru-metni"><strong>Soru:</strong> ${htmlMetin(cozum.question)}</div>`
    : "";

  return `
    <div class="soru-kutusu">
      <div class="soru-ust">
        <div class="soru-baslik">
          <span>Soru ${sira} - ${htmlKacis(dersAdi)}</span>
          <span>${htmlKacis(tarih)}</span>
        </div>
        ${resim}
      </div>
      ${soruMetni}
      ${cozumHtml(cozum, mesaj)}
    </div>`;
};

export const belgeHtml = ({ kategori, toplam, govde }) => `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>Sormix - Hata Defterim</title>
  <style>${PDF_STILI}</style>
</head>
<body>
  <h1>Akıllı Hata Defterim</h1>
  <div class="kategori-bilgi">Seçilen Kategori: <strong>${htmlKacis(
    kategori
  )}</strong> | Toplam Soru: <strong>${toplam}</strong></div>
  <div class="olusturan">Bu belge Sormix uygulaması tarafından otomatik oluşturulmuştur.</div>
  ${govde}
</body>
</html>`;
