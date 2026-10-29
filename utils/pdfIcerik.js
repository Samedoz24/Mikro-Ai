import { htmlKacis, htmlMetin } from "./metin";

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

export const PDF_STILI = `
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
  h1 { text-align: center; color: #2C3E50; border-bottom: 2px solid #3498DB; padding-bottom: 10px; font-size: 28px; margin-bottom: 5px; }
  .kategori-bilgi { text-align: center; font-size: 14px; color: #7F8C8D; margin-bottom: 35px; }
  .soru-kutusu { border: 1px solid #BDC3C7; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
  .soru-baslik { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; color: #2980B9; border-bottom: 1px solid #ECF0F1; padding-bottom: 10px; margin-bottom: 15px; }
  .soru-foto { max-width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px; margin-bottom: 15px; border: 1px solid #ddd; }
  .foto-yok { padding: 20px; background: #eee; text-align: center; border-radius: 8px; margin-bottom: 15px; color: #888; }
  .soru-metni { background: #F8F9FA; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px 14px; font-size: 15px; line-height: 1.6; margin-bottom: 14px; }
  .bolum-baslik { font-size: 13px; font-weight: bold; letter-spacing: 0.6px; color: #2980B9; margin: 16px 0 8px; }
  .adim { page-break-inside: avoid; background: #EFF6FF; border-left: 4px solid #3498DB; border-radius: 4px; padding: 10px 14px; margin-bottom: 8px; font-size: 15px; line-height: 1.6; }
  .adim-no { display: block; font-size: 11px; font-weight: bold; letter-spacing: 0.6px; color: #2980B9; margin-bottom: 2px; }
  .sonuc { page-break-inside: avoid; background: #ECFDF5; border: 1px solid #10B981; border-radius: 6px; padding: 12px 14px; margin-top: 12px; }
  .sonuc-etiket { display: block; font-size: 11px; font-weight: bold; letter-spacing: 0.6px; color: #059669; margin-bottom: 4px; }
  .sonuc-metin { font-size: 17px; font-weight: bold; color: #065F46; line-height: 1.5; }
  .aciklama { page-break-inside: avoid; background: #F4F6F7; border-left: 4px solid #1ABC9C; padding: 12px 14px; border-radius: 4px; font-size: 14px; line-height: 1.6; margin-top: 12px; }
  .cozum-yok { background: #F4F6F7; border-left: 4px solid #BDC3C7; padding: 14px; border-radius: 4px; font-size: 15px; line-height: 1.6; }
  .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #95A5A6; border-top: 1px solid #ECF0F1; padding-top: 15px; }
`;

const cozumHtml = (cozum, mesaj) => {
  if (!cozum) {
    return `<div class="cozum-yok"><strong>Yapay Zeka Çözümü:</strong><br/>${htmlMetin(
      mesaj
    )}</div>`;
  }

  const parcalar = [];

  if (cozum.question) {
    parcalar.push(
      `<div class="soru-metni"><strong>Soru:</strong> ${htmlMetin(
        cozum.question
      )}</div>`
    );
  }

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

  // Dosya var ama tanıdığımız hiçbir alan yoksa boş bir kutu bırakma
  if (parcalar.length === 0) {
    return `<div class="cozum-yok">Çözüm dosyası bulundu fakat içeriği okunamadı.</div>`;
  }
  return parcalar.join("\n");
};

// Bir sorunun PDF bloğu. `cozum`: cozumuDuzenle çıktısı ya da null; `mesaj`: çözüm yoksa nedeni.
export const soruBlokHtml = ({ sira, dersAdi, tarih, fotoLink, cozum, mesaj }) => {
  const resim = fotoLink
    ? `<img class="soru-foto" src="${htmlKacis(fotoLink)}" />`
    : `<div class="foto-yok">Fotoğraf Yok</div>`;

  return `
    <div class="soru-kutusu">
      <div class="soru-baslik">
        <span>Soru ${sira} - ${htmlKacis(dersAdi)}</span>
        <span>${htmlKacis(tarih)}</span>
      </div>
      ${resim}
      ${cozumHtml(cozum, mesaj)}
    </div>`;
};

export const belgeHtml = ({ kategori, toplam, govde }) => `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hata Defterim</title>
  <style>${PDF_STILI}</style>
</head>
<body>
  <h1>Akıllı Hata Defterim</h1>
  <div class="kategori-bilgi">Seçilen Kategori: <strong>${htmlKacis(
    kategori
  )}</strong> | Toplam Soru: <strong>${toplam}</strong></div>
  ${govde}
  <div class="footer">Bu belge Akıllı Hata Defterim uygulaması tarafından otomatik oluşturulmuştur.</div>
</body>
</html>`;
