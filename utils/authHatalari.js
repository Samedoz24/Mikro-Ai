// Firebase Auth hata kodlarını kullanıcıya Türkçe ve anlaşılır mesajlara çevirir.
// Ham Firebase mesajları ("Firebase: Error (auth/...)") kullanıcıya gösterilmez.

const ORTAK = {
  "auth/network-request-failed":
    "İnternet bağlantısı yok ya da zayıf. Bağlantını kontrol edip tekrar dene.",
  "auth/too-many-requests":
    "Çok fazla deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar dene.",
  "auth/user-disabled":
    "Bu hesap devre dışı bırakılmış. Destek ile iletişime geçebilirsin.",
  "auth/invalid-email": "Geçerli bir e-posta adresi gir.",
};

const GENEL = "Bir sorun oluştu. Lütfen tekrar dene.";

const YANLIS_BILGI = [
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/user-not-found",
  "auth/invalid-login-credentials",
];

export const girisHatasiMesaji = (hata) => {
  const kod = hata?.code;
  if (YANLIS_BILGI.includes(kod)) return "E-posta veya şifre hatalı.";
  return ORTAK[kod] || "Giriş yapılamadı. Lütfen tekrar dene.";
};

export const kayitHatasiMesaji = (hata) => {
  const kod = hata?.code;
  if (kod === "auth/email-already-in-use")
    return "Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.";
  if (kod === "auth/weak-password") return "Şifre en az 6 karakter olmalı.";
  if (kod === "auth/operation-not-allowed")
    return "E-posta ile kayıt şu an kullanılamıyor. Lütfen daha sonra tekrar dene.";
  return ORTAK[kod] || "Hesap oluşturulamadı. Lütfen tekrar dene.";
};

export const sifreSifirlamaHatasiMesaji = (hata) => {
  const kod = hata?.code;
  return ORTAK[kod] || GENEL;
};

export const googleGirisHatasiMesaji = (hata) => {
  const kod = hata?.code;
  if (kod === "auth/account-exists-with-different-credential")
    return "Bu e-posta başka bir yöntemle kayıtlı. E-posta ve şifrenle giriş yapmayı dene.";
  return ORTAK[kod] || "Google ile giriş yapılamadı. Lütfen tekrar dene.";
};
