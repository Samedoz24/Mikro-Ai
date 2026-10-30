import { dersBul } from "./ders";
import { milisaniye } from "./kurumIstatistik";

// Müdürün öğrenci soruları listesi için: en yeni soru başta, her soruya ders adı ve zaman eklenir.
// Saf mantık: ağ kullanmaz, kolayca test edilir.
export const sorulariHazirla = (sorular) =>
  sorular
    .map((soru) => ({
      ...soru,
      dersAdi: dersBul(soru),
      tarihMs: milisaniye(soru.tarih),
      cozuldu: soru.durum === "Çözüldü",
    }))
    .sort((a, b) => (b.tarihMs ?? -Infinity) - (a.tarihMs ?? -Infinity));

export const tarihSaatMetni = (ms) =>
  ms === null || ms === undefined
    ? "Tarih yok"
    : new Date(ms).toLocaleString("tr-TR", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
