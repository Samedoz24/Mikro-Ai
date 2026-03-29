// theme.js
// Bu dosya uygulamanın tüm renk hafızasını tutar.

export const colors = {
  // ☀️ AÇIK MOD RENKLERİ (Gündüz)
  light: {
    arkaplan: "#F8F9FA", // Çok açık gri (Göz yormayan beyaz)
    metin: "#2D3436", // Koyu gri/siyah (Okunabilirlik için)
    ikincilMetin: "#6c757d",

    // Palet 1: Güven ve Temel Aksiyonlar
    anaButon: "#007BFF", // Güven Mavisi (Giriş yap, Kayıt ol)

    // Palet 2: Yapay Zeka ve Teknoloji
    aiButon: "#6C5CE7", // Teknoloji Moru (Hocaya Sor butonu)

    // Palet 3: Enerji ve Aksiyon
    kameraButon: "#FFC107", // Dikkat Sarısı (Fotoğraf Çek)

    kutuArkaplan: "#FFFFFF", // Metin kutuları için saf beyaz
    kutuCerceve: "#ced4da",
    hataKirmizi: "#dc3545", // Çıkış yap veya vazgeç
  },

  // 🌙 KARANLIK MOD RENKLERİ (Gece)
  dark: {
    arkaplan: "#1E272E", // Gece Laciverti (Tam siyah yerine asil lacivert)
    metin: "#F8F9FA", // Açık gri/beyaz (Okunabilirlik için)
    ikincilMetin: "#b2bec3",

    anaButon: "#0984E3", // Geceye uygun Mavi
    aiButon: "#A29BFE", // Geceye uygun açık Teknoloji Moru
    kameraButon: "#FDCB6E", // Geceye uygun yumuşak Sarı

    kutuArkaplan: "#2D3436", // Metin kutuları için koyu gri
    kutuCerceve: "#636e72",
    hataKirmizi: "#ff7675",
  },
};
