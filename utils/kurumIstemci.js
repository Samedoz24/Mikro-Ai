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
  "davet-yok":
    "Bu e-posta adresi için tanımlı bir yönetici daveti bulunamadı. Lütfen dershane yetkilisiyle iletişime geç.",
  "davet-kullanilmis":
    "Bu davet başka bir hesap tarafından kullanılmış. Lütfen dershane yetkilisiyle iletişime geç.",
  "davet-rol-hatali":
    "Davetteki rol bilgisi geçersiz (mudur ya da ogretmen olmalı). Lütfen dershane yetkilisiyle iletişime geç.",
  "davet-kurum-yok":
    "Davette belirtilen dershane bulunamadı. Lütfen dershane yetkilisiyle iletişime geç.",
  "davet-hatali":
    "Davet bilgisi eksik ya da hatalı. Lütfen dershane yetkilisiyle iletişime geç.",
  "hesap-kullaniliyor":
    "Bu hesap öğrenci ya da veli olarak kullanılıyor. Yönetici girişi için farklı bir e-posta adresi kullan.",
  "eposta-dogrulanmadi": "E-posta adresini doğrulaman gerekiyor.",
  "eposta-yok": "Hesabında e-posta adresi bulunamadı.",
  "eposta-gecersiz": "Geçerli bir e-posta adresi yaz.",
  "zaten-yonetici": "Bu adres zaten dershanenin yöneticisi.",
  "baska-kurumda-davetli":
    "Bu e-posta adresi başka bir dershanede yönetici olarak kayıtlı.",
  "ogretmen-siniri": "En fazla 20 öğretmen ekleyebilirsin.",
  "yetki-yok": "Bu işlem için müdür yetkisi gerekiyor.",
  "kendini-kaldiramaz": "Kendini ekipten kaldıramazsın.",
  "kaldirilamaz-rol": "Müdürler uygulamadan kaldırılamaz.",
  "uid-gecersiz": "Öğrenci bilgisi geçersiz. Listeyi yenileyip tekrar dene.",
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

// Davet edilmiş müdür/öğretmen yönetici yetkisi alır. Başarılıysa kimlik belirteci yenilenmelidir.
export const yoneticiOl = async () => {
  const sonuc = await httpsCallable(functions, "yoneticiOl")({});
  return sonuc.data;
};

// Müdür bir öğretmeni davet eder ({ eposta, durum, zatenVar } döner)
export const ogretmenDavetEt = async (eposta) => {
  const sonuc = await httpsCallable(functions, "ogretmenDavetEt")({ eposta });
  return sonuc.data;
};

// Müdür bir öğrenciyi dershaneden çıkarır ({ cikarildi } döner)
export const ogrenciCikar = async (uid) => {
  const sonuc = await httpsCallable(functions, "ogrenciCikar")({ uid });
  return sonuc.data;
};

// Müdür bir öğretmeni kaldırır ya da davetini iptal eder
export const yoneticiKaldir = async (eposta) => {
  const sonuc = await httpsCallable(functions, "yoneticiKaldir")({ eposta });
  return sonuc.data;
};

export const kurumdanAyril = async () => {
  const sonuc = await httpsCallable(functions, "kurumdanAyril")({});
  return sonuc.data;
};
