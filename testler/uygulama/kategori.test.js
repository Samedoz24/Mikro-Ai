// Uygulama testi: utils/ders.js kategoriSiralamasi (Geçmiş Sorular ders kategorisi sırası).
// Çalıştırma (proje kökünden):  node testler/uygulama/kategori.test.js

const path = require("path");
const os = require("os");
const fs = require("fs");
const KOK = path.resolve(__dirname, "..", "..");
const esbuild = require(require.resolve("esbuild", { paths: [KOK] }));
const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-kategori-")), "m.cjs");
esbuild.buildSync({ entryPoints: [path.join(KOK, "utils/ders.js")], bundle: true, format: "cjs", platform: "node", outfile: cikti, logLevel: "error" });
const { kategoriSiralamasi, DERSLER } = require(cikti);

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};
const s = (ders, t = 0) => ({ ders, t });
const zaman = (q) => q.t;

esit("soru yok: sabit sıra", kategoriSiralamasi([]), ["Tümü", ...DERSLER]);
esit("geçersiz girdi", kategoriSiralamasi(null), ["Tümü", ...DERSLER]);

const liste = kategoriSiralamasi(
  [s("Kimya", 1), s("Kimya", 2), s("Kimya", 3), s("Fizik", 4), s("Fizik", 5), s("Matematik", 6)],
  zaman
);
esit("en çok soru önce", liste.slice(0, 4), ["Tümü", "Kimya", "Fizik", "Matematik"]);
esit("sorusuz dersler sabit sırada sonda", liste.slice(4), ["Biyoloji", "Türkçe", "Tarih", "Coğrafya", "Diğer"]);

esit(
  "eşitlikte son sorusu daha yeni olan önce",
  kategoriSiralamasi([s("Tarih", 10), s("Biyoloji", 20)], zaman).slice(0, 3),
  ["Tümü", "Biyoloji", "Tarih"]
);
esit(
  "eşit adet ve zaman: sabit sıra",
  kategoriSiralamasi([s("Tarih"), s("Fizik")], zaman).slice(0, 3),
  ["Tümü", "Fizik", "Tarih"]
);
esit(
  "Diğer çok olsa da en sonda",
  kategoriSiralamasi([s("Diğer"), s("Diğer"), s("Diğer"), s("Kimya")], zaman).at(-1),
  "Diğer"
);
esit(
  "dersi olmayan soru Diğer sayılır, Diğer sonda",
  kategoriSiralamasi([{}, {}, s("Fizik")], zaman).slice(0, 2),
  ["Tümü", "Fizik"]
);
const felsefe = kategoriSiralamasi([s("Felsefe", 1), s("Felsefe", 2), s("Kimya", 3)], zaman);
esit("listede olmayan ders kendi kategorisiyle", felsefe.slice(0, 3), ["Tümü", "Felsefe", "Kimya"]);
esit("her kategori bir kez", new Set(felsefe).size, felsefe.length);
esit("Tümü her zaman ilk", kategoriSiralamasi([s("Kimya")], zaman)[0], "Tümü");
esit("ders adı düzeltmesi (subject alanı)", kategoriSiralamasi([{ subject: "matematik" }, { subject: "Matematik" }], zaman)[1], "Matematik");

console.log(`[kategori] ${gecen} geçti, ${kalan} hata`);
process.exit(kalan ? 1 : 0);
