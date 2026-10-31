import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

// HTML'den PDF üretip paylaşma penceresini açar. Rapor çocuk verisi içerdiği için geçici dosyalar
// telefonda kalmamalı: PDF üretim çıktısı hemen silinir. Paylaşılan kopya iOS'ta paylaşma bitince
// silinir; Android'de paylaşma penceresi açılır açılmaz söz tamamlandığından (hedef uygulama dosyayı
// o sırada okuyor olabilir) silme bir sonraki rapora ertelenir.
const ONEK = "Mikro-Rapor-";

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
        .filter((ad) => ad.startsWith(ONEK))
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
  const ad = dosyaAdi.startsWith(ONEK) ? dosyaAdi : ONEK + dosyaAdi;
  let gecici = null;
  let kopya = null;
  let paylasildi = false;
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
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
