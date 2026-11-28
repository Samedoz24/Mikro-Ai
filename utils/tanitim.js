// Tanıtım (onboarding) sayfaları öğrenci özelliklerini anlatır (soru çözme, seri, rozetler).
// Yalnızca yeni ÖĞRENCİ hesabına gösterilir; veliye gösterilmez (28 Kasım 2026 kararı). Saf mantık.
export const tanitimGosterilsinMi = (rol) => rol === "ogrenci";
