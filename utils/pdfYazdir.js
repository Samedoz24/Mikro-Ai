import * as Print from "expo-print";

// Uygulamanın bütün PDF'leri (öğrencinin Hata Defteri, müdürün öğrenci raporu) bu ayarlarla üretilir.
// Sayfa boyutu A4 (Türkiye standardı; belirtilmezse iOS ABD "Letter" kullanıyordu: sayfalar ~2 cm kısa).
// Kenar boşlukları HER sayfaya uygulanır (iOS: margins). Önceden boşluk yalnızca gövde dolgusundan geldiği için
// ilk sayfadan sonraki sayfalar en tepeden başlıyor, yazılar alt kenara dayanıyordu.
// Android'de margins seçeneği yok; aynı boşluk CSS @page ile verilir (PDF_SAYFA_STILI).
export const A4 = { width: 595, height: 842 }; // nokta (1/72 inç)
export const SAYFA_KENARI = { top: 40, bottom: 44, left: 36, right: 36 };

// Her PDF'in <style> başına eklenir: A4, kenarlar ve gövdede ek dolgu olmaması (kenar sayfadan gelir)
export const PDF_SAYFA_STILI = `
  @page { size: A4; margin: ${SAYFA_KENARI.top}pt ${SAYFA_KENARI.right}pt ${SAYFA_KENARI.bottom}pt ${SAYFA_KENARI.left}pt; }
  html, body { margin: 0; padding: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  img { max-width: 100%; }
`;

export const pdfOlustur = (html) =>
  Print.printToFileAsync({
    html,
    base64: false,
    width: A4.width,
    height: A4.height,
    margins: SAYFA_KENARI,
  });
