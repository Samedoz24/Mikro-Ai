// Öğretmenin kapsamı: hangi öğrencilerin istatistiklerini görebileceği. Saf mantık: ağ kullanmaz.
// Gerçek yetki sunucu kurallarındadır; bu dosya yalnızca ekranın hangi veriyi isteyeceğini seçer
// ve kurallarla aynı kararı verir (aksi hâlde ekran yetkisiz veri isteyip hata alırdı).

export const KAPSAM_TUM = "tum";
export const KAPSAM_GRUPLAR = "gruplar";

const GRUP_KIMLIGI = /^[A-HJ-NP-Z2-9]{8}$/;

/**
 * Kimlik belirteci claim'lerinden kapsam: { kapsam: "tum" | "gruplar", gruplar: [kimlikler] }
 *  - claim yoksa "tum" (bu özellikten önce eklenen öğretmenler de tüm öğrencileri görür)
 *  - "gruplar" ise claim'deki geçerli grup kimlikleri
 *  - bilinmeyen/bozuk değer güvenli tarafa düşer: hiçbir öğrenci görünmez
 */
export const kapsamBilgisi = (claims) => {
  const kapsam = claims?.kapsam;
  if (kapsam === undefined || kapsam === null || kapsam === KAPSAM_TUM) {
    return { kapsam: KAPSAM_TUM, gruplar: [] };
  }
  if (kapsam === KAPSAM_GRUPLAR && Array.isArray(claims.gruplar)) {
    const gruplar = [
      ...new Set(
        claims.gruplar.filter(
          (g) => typeof g === "string" && GRUP_KIMLIGI.test(g)
        )
      ),
    ];
    return { kapsam: KAPSAM_GRUPLAR, gruplar };
  }
  return { kapsam: KAPSAM_GRUPLAR, gruplar: [] };
};

// Aynı kapsamı tek metinde tanımlar (sıradan bağımsız); önbellek ve karşılaştırma anahtarı olarak kullanılır
export const kapsamAnahtari = (kapsam, gruplar = []) =>
  kapsam === KAPSAM_TUM
    ? KAPSAM_TUM
    : `gruplar:${[...gruplar].sort().join(",")}`;

// Kapsamın ekranda gösterilecek açıklaması. Silinmiş (listede olmayan) gruplar atlanır.
export const kapsamMetni = (kapsam, gruplar, grupListesi) => {
  if (kapsam === KAPSAM_TUM) return "Tüm öğrenciler";
  const adlar = (gruplar || [])
    .map((id) => (grupListesi || []).find((g) => g.id === id)?.ad)
    .filter(Boolean);
  return adlar.length > 0 ? adlar.join(", ") : "Hiç grup atanmadı";
};
