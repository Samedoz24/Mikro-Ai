import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";

// Veli–öğrenci bağlantısı yalnızca sunucuda kurulur (functions/veliBaglanti.js).
// Uygulama bağlantı kodlarını okuyamaz, veli listesini kendisi yazamaz; güvenlik kuralları bunu engeller.

// Öğrenci: kendi bağlantı kodunu alır (yoksa sunucu oluşturur). Dönüş: kod (metin)
export const baglantiKoduAl = async () => {
  const sonuc = await httpsCallable(functions, "baglantiKoduAl")();
  return sonuc.data?.kod || null;
};

// Veli: kodla öğrenciye bağlanır. Dönüş: { ogrenci: { id, isim }, zatenVar }
export const veliBagla = async (kod) => {
  const sonuc = await httpsCallable(functions, "veliBagla")({ kod });
  return sonuc.data;
};

// Veli: bir öğrencinin bağlantısını kaldırır
export const veliBaglantisiKaldir = async (ogrenciId) => {
  const sonuc = await httpsCallable(functions, "veliBaglantisiKaldir")({ ogrenciId });
  return sonuc.data;
};

// Sunucu hatasını kullanıcıya gösterilecek Türkçe mesaja çevirir
export const veliBaglaHataMesaji = (hata) => {
  const kod = hata?.code || "";
  const mesaj = hata?.message || "";
  if (kod === "functions/not-found" || mesaj === "kod-bulunamadi")
    return "Bu koda sahip bir öğrenci bulunamadı. Lütfen kodu kontrol edin.";
  if (mesaj === "kod-gecersiz") return "Lütfen 6 haneli bağlantı kodunu eksiksiz girin.";
  if (mesaj === "kendi-hesabi") return "Kendi hesabınızı öğrenci olarak ekleyemezsiniz.";
  if (mesaj === "cok-fazla-deneme")
    return "Çok fazla hatalı kod denendi. Güvenliğiniz için lütfen bir süre sonra tekrar deneyin.";
  if (mesaj === "ogrenci-siniri") return "En fazla 10 öğrenci bağlayabilirsiniz.";
  if (mesaj === "rol-uygun-degil") return "Öğrenci bağlamak için veli hesabıyla giriş yapmalısınız.";
  return "Öğrenci bağlanamadı. İnternet bağlantını kontrol edip tekrar dene.";
};
