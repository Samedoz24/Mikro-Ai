import { milisaniye, takvimGunFarki } from "./kurumIstatistik";
import { turkceTarih } from "./kurumRapor";

// Duyuru listesi ve gönderme penceresi için saf mantık: ağ kullanmaz, kolayca test edilir.

export const HEDEF_HEPSI = "hepsi";
export const BASLIK_SINIRI = 60;
export const METIN_SINIRI = 500;

// "Tüm öğrenciler", grup adı ya da (grup artık yoksa) "Silinmiş grup"
export const hedefAdi = (hedef, gruplar) =>
  hedef === HEDEF_HEPSI
    ? "Tüm öğrenciler"
    : ((gruplar || []).find((g) => g.id === hedef)?.ad ?? "Silinmiş grup");

// Duyuruyu kaç öğrencinin göreceği: tüm dershane için üye sayısı, grup için gruptaki öğrenci sayısı
export const aliciSayisi = (hedef, uyeSayisi, grupSayilari) =>
  hedef === HEDEF_HEPSI
    ? Math.max(0, Number(uyeSayisi) || 0)
    : Math.max(0, Number(grupSayilari?.[hedef]) || 0);

// "Bugün 14:30", "Dün 09:00", "28 Ekim 2026 18:05" (Türkiye saati)
export const duyuruZamanMetni = (ms, simdi = Date.now()) => {
  if (ms === null || ms === undefined) return "";
  const saat = new Date(ms + 3 * 3600000).toISOString().slice(11, 16);
  const fark = takvimGunFarki(ms, simdi);
  if (fark <= 0) return `Bugün ${saat}`;
  if (fark === 1) return `Dün ${saat}`;
  return `${turkceTarih(ms)} ${saat}`;
};

/**
 * Müdürün yönetim listesi: en yeni önde. Eksik/bozuk kayıtlar elenir.
 * @param belgeler [{ id, baslik, metin, hedef, gonderen, olusturma }]
 */
export const duyurulariHazirla = (belgeler, gruplar) =>
  (belgeler || [])
    .filter(
      (d) =>
        d &&
        typeof d.id === "string" &&
        typeof d.baslik === "string" &&
        d.baslik &&
        typeof d.metin === "string" &&
        typeof d.hedef === "string" &&
        d.hedef
    )
    .map((d) => ({
      id: d.id,
      baslik: d.baslik,
      metin: d.metin,
      hedef: d.hedef,
      hedefAdi: hedefAdi(d.hedef, gruplar),
      zamanMs: milisaniye(d.olusturma),
    }))
    .sort((a, b) => (b.zamanMs ?? -Infinity) - (a.zamanMs ?? -Infinity));

// Gönderme penceresindeki alan denetimi (sunucu da aynı kuralları uygular)
export const duyuruDenetle = (baslik, metin) => {
  const b = String(baslik ?? "").trim();
  const m = String(metin ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (b.length < 1) return "Duyuru için bir başlık yaz.";
  if (b.length > BASLIK_SINIRI)
    return `Başlık en fazla ${BASLIK_SINIRI} karakter olabilir.`;
  if (m.length < 1) return "Duyuru metnini yaz.";
  if (m.length > METIN_SINIRI)
    return `Metin en fazla ${METIN_SINIRI} karakter olabilir.`;
  return null;
};
