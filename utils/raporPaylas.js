import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { pdfOlustur } from "./pdfYazdir";

// HTML'den PDF üretip (A4, her sayfada kenar boşluğu: pdfYazdir.js) paylaşma penceresini açar. Hem müdürün
// öğrenci raporu hem öğrencinin Hata Defteri bunu kullanır. PDF kişisel veri içerdiği için geçici dosyalar
// telefonda kalmamalı: PDF üretim çıktısı hemen silinir. Paylaşılan kopya iOS'ta paylaşma bitince
// silinir; Android'de paylaşma penceresi açılır açılmaz söz tamamlandığından (hedef uygulama dosyayı
// o sırada okuyor olabilir) silme bir sonraki rapora ertelenir.
const ONEKLER = ["Sormix-Rapor-", "Sormix-HataDefteri-"];
// Ad değişikliğinden (Mikro → Sormix) önce kalmış geçici raporlar da temizlenir
const ESKI_ONEKLER = [...ONEKLER, "Mikro-Rapor-"];

const sil = async (yol) => {
  if (!yol) return;
  try {
    await FileSystem.deleteAsync(yol, { idempotent: true });
  } catch (e) {
    console.log("Geçici dosya silinemedi:", e?.message);
  }
};

const eskileriTemizle = async () => {
  try {
    const adlar = await FileSystem.readDirectoryAsync(
      FileSystem.cacheDirectory
    );
    await Promise.all(
      adlar
        .filter((ad) => ESKI_ONEKLER.some((o) => ad.startsWith(o)))
        .map((ad) => sil(FileSystem.cacheDirectory + ad))
    );
  } catch (e) {
    console.log("Eski raporlar temizlenemedi:", e?.message);
  }
};

/**
 * @returns { paylasildi: boolean, desteklenmiyor?: boolean }
 */
export const raporuPaylas = async ({ html, dosyaAdi, baslik }) => {
  await eskileriTemizle();
  const ad = ONEKLER.some((o) => dosyaAdi.startsWith(o)) ? dosyaAdi : ONEKLER[0] + dosyaAdi;
  let gecici = null;
  let kopya = null;
  let paylasildi = false;
  try {
    const { uri } = await pdfOlustur(html);
    gecici = uri;
    kopya = FileSystem.cacheDirectory + ad;
    await FileSystem.copyAsync({ from: uri, to: kopya });
    if (!(await Sharing.isAvailableAsync())) {
      return { paylasildi: false, desteklenmiyor: true };
    }
    await Sharing.shareAsync(kopya, {
      mimeType: "application/pdf",
      dialogTitle: baslik,
      UTI: "com.adobe.pdf",
    });
    paylasildi = true;
    return { paylasildi: true };
  } finally {
    await sil(gecici);
    // Paylaşım başarısızsa kopya hemen silinir; başarılıysa Android'de silme ertelenir
    if (Platform.OS === "ios" || !paylasildi) await sil(kopya);
  }
};
