// Uygulama testi: utils/ders.js kategoriSiralamasi (Geçmiş Sorular ders kategorisi sırası).
// Çalıştırma (proje kökünden):  node testler/uygulama/kategori.test.js

const path = require("path");
const os = require("os");
const fs = require("fs");
const KOK = path.resolve(__dirname, "..", "..");
const esbuild = require(require.resolve("esbuild", { paths: [KOK] }));
const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-kategori-")), "m.cjs");
esbuild.buildSync({ entryPoints: [path.join(KOK, "utils/ders.js")], bundle: true, format: "cjs", platform: "node", outfile: cikti, logLevel: "error" });
const { kategoriSiralamasi, DERSLER, yeniCozumMu, digerYerineDers, dersBul, dersTahminEt } = require(cikti);

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
esit("sorusuz dersler sabit sırada sonda", liste.slice(4), ["Biyoloji", "Türkçe", "Edebiyat", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü", "İngilizce", "Diğer"]);

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

// Yeni (açılmamış) çözüm kuralı: alt menü sayısı ve kartlar aynı kuralı kullanır
esit("çözüldü + açılmadı = yeni", yeniCozumMu({ durum: "Çözüldü" }), true);
esit("çözüldü + okunduMu false = yeni", yeniCozumMu({ durum: "Çözüldü", okunduMu: false }), true);
esit("çözüldü + açıldı = yeni değil", yeniCozumMu({ durum: "Çözüldü", okunduMu: true }), false);
esit("bekliyor = yeni değil", yeniCozumMu({ durum: "Bekliyor" }), false);
esit("okunduMu metin 'true' sayılmaz (açılmamış)", yeniCozumMu({ durum: "Çözüldü", okunduMu: "true" }), true);
esit("boş soru", yeniCozumMu(null), false);

// Yeni dersler ve ad eşleştirmeleri
esit("ders listesi", DERSLER, ["Matematik", "Fizik", "Kimya", "Biyoloji", "Türkçe", "Edebiyat", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü", "İngilizce", "Diğer"]);
esit("edebiyat ayrı", dersBul({ ders: "edebiyat" }), "Edebiyat");
esit("Türk Dili ve Edebiyatı → Edebiyat", dersBul({ ders: "Türk Dili ve Edebiyatı" }), "Edebiyat");
esit("felsefe", dersBul({ lesson: "FELSEFE" }), "Felsefe");
esit("din kültürü", dersBul({ subject: "Din Kültürü ve Ahlak Bilgisi" }), "Din Kültürü");
esit("ingilizce", dersBul({ subject: "english" }), "İngilizce");
esit("geometri hâlâ Matematik", dersBul({ ders: "Geometri" }), "Matematik");
esit("ders adları 30 karakteri aşmaz (kural)", DERSLER.every((d) => d.length <= 30), true);

// n8n "Diğer" yazdı ama konu dersi gösteriyor — gerçek veriden örnekler
const n8n = (topic, ek = {}) => ({ durum: "Çözüldü", ders: "Diğer", lesson: "Diğer", topic, ...ek });
esit("Estetik → Felsefe", digerYerineDers(n8n("Estetik")), "Felsefe");
esit("Varlık felsefesi → Felsefe", digerYerineDers(n8n("Varlık felsefesi")), "Felsefe");
esit("Namaz ibadeti → Din Kültürü", digerYerineDers(n8n("Namaz ibadeti")), "Din Kültürü");
esit("Present Perfect Tense → İngilizce", digerYerineDers(n8n("Present Perfect Tense")), "İngilizce");
esit("Divan edebiyatında gazel → Edebiyat", digerYerineDers(n8n("Divan edebiyatında gazel")), "Edebiyat");
esit("elle seçilen ders asla değişmez", digerYerineDers(n8n("Estetik", { dersKaynak: "kullanici" })), null);
esit("Diğer olmayan ders değişmez", digerYerineDers({ durum: "Çözüldü", ders: "Matematik", topic: "Estetik" }), null);
esit("çözülmemiş soru değişmez", digerYerineDers(n8n("Estetik", { durum: "Bekliyor" })), null);
esit("konu belirsizse Diğer kalır", digerYerineDers(n8n("Genel kültür")), null);
esit("konu yoksa Diğer kalır", digerYerineDers(n8n(undefined)), null);
esit("dersi hiç olmayan soru bu yoldan geçmez (diğer yol)", digerYerineDers({ durum: "Çözüldü", topic: "Estetik" }), "Felsefe");
// Eski tahminler bozulmadı
esit("türev → Matematik", dersTahminEt({ topic: "Türev grafiğinden fonksiyon değerlerini karşılaştırma" }), "Matematik");
esit("önermeler Matematik (Kimya ya da Felsefe değil)", dersTahminEt({ topic: "Önermeler ve bileşik önermeler" }), "Matematik");
esit("İslamiyet öncesi Türk tarihi → Tarih", dersTahminEt({ topic: "İslamiyet öncesi Türk tarihi" }), "Tarih");
esit("cümlenin ögeleri → Türkçe", dersTahminEt({ topic: "Cümlenin ögeleri: özne ve yüklem" }), "Türkçe");

console.log(`[kategori] ${gecen} geçti, ${kalan} hata`);
process.exit(kalan ? 1 : 0);
