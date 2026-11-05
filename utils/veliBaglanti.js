// Veli paneli: hesabı silinmiş (belgesi artık olmayan) bağlı öğrencileri belirler. Saf mantık.
// Yalnızca sunucunun "belge yok" dediği öğrenciler silinir; ağ ya da izin hatasında asla silinmez.
//   durumlar[i]: "var" | "yok" | "hata"
export const silinmisOgrenciler = (bagliOgrenciler, durumlar) =>
  (Array.isArray(bagliOgrenciler) ? bagliOgrenciler : []).filter(
    (ogr, i) =>
      ogr &&
      typeof ogr === "object" &&
      typeof ogr.id === "string" &&
      Array.isArray(durumlar) &&
      durumlar[i] === "yok"
  );
