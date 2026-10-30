// Dershane ekibi (müdür ve öğretmenler) listesi. Saf mantık: ağ kullanmaz.

const ROL_SIRASI = { mudur: 0, ogretmen: 1 };

// Kayıtları ekranda gösterilecek sıraya koyar: önce müdürler, sonra aktif öğretmenler,
// sonra davetliler; aynı gruptakiler e-postaya göre. durum yoksa eski kayıt: aktif sayılır.
export const ekipSirala = (kayitlar) =>
  kayitlar
    .map((k) => ({
      ...k,
      eposta: String(k.eposta ?? k.id ?? ""),
      durum: k.durum === "davetli" ? "davetli" : "aktif",
    }))
    .filter((k) => k.eposta && k.rol in ROL_SIRASI)
    .sort(
      (a, b) =>
        ROL_SIRASI[a.rol] - ROL_SIRASI[b.rol] ||
        (a.durum === "davetli") - (b.durum === "davetli") ||
        a.eposta.localeCompare(b.eposta, "tr")
    );
