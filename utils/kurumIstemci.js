import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";

// Kurum (dershane) fonksiyonlarının istemci tarafı. Koltuk, lisans ve yetki kararları sunucuda
// verilir; burada yalnızca çağrı yapılır ve dönen hata kodları kullanıcı mesajına çevrilir.

const HATA_MESAJLARI = {
  "onay-gerekli": "Devam etmek için bilgilendirmeyi onaylaman gerekiyor.",
  "kod-gecersiz":
    "Kod 6-12 karakterden oluşmalı ve yalnızca harf ya da rakam içermeli.",
  "kod-bulunamadi":
    "Bu koda ait bir dershane bulunamadı. Kodu kontrol edip tekrar dene.",
  "lisans-gecersiz":
    "Bu dershanenin kullanım süresi dolmuş. Lütfen dershaneyle iletişime geç.",
  "koltuk-dolu":
    "Bu dershanede boş kontenjan kalmamış. Lütfen dershaneyle iletişime geç.",
  "baska-kurumda":
    "Zaten başka bir dershaneye kayıtlısın. Önce o dershaneden ayrılmalısın.",
  "rol-uygun-degil":
    "Dershane kodu yalnızca öğrenci hesaplarıyla kullanılabilir.",
  "profil-yok":
    "Profilin henüz hazır değil. Uygulamayı kapatıp açıp tekrar dene.",
  "cok-fazla-deneme":
    "Çok fazla deneme yaptın. Lütfen bir saat sonra tekrar dene.",
};

// Sunucu HttpsError mesajını (örn. "kod-bulunamadi") okunur Türkçe metne çevirir
export const kurumHataMesaji = (hata) => {
  const mesaj = hata?.message;
  if (mesaj && HATA_MESAJLARI[mesaj]) return HATA_MESAJLARI[mesaj];
  if (
    hata?.code === "functions/unavailable" ||
    hata?.code === "functions/deadline-exceeded"
  ) {
    return "Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.";
  }
  return "İşlem şu anda yapılamadı. Lütfen biraz sonra tekrar dene.";
};

export const kurumaKatil = async (kod) => {
  const sonuc = await httpsCallable(
    functions,
    "kurumaKatil"
  )({ kod, onay: true });
  return sonuc.data;
};

export const kurumdanAyril = async () => {
  const sonuc = await httpsCallable(functions, "kurumdanAyril")({});
  return sonuc.data;
};
