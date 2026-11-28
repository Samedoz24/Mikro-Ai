// PDF testi (28 Kasım): iki PDF de (öğrencinin Hata Defteri, müdürün öğrenci raporu)
//   - A4 boyutunda ve HER sayfada kenar boşluğuyla üretilir (utils/pdfYazdir.js)
//   - bölünme kuralları (başlık+fotoğraf+soru birlikte; adım/sonuç kutuları bölünmez)
//   - Türkçe karakterler korunur, dershane adı Türkçe kurala göre büyük harf (i → İ)
//   - dışarıdan gelen metinler kaçırılır (HTML enjeksiyonu yok)
//   - paylaşımdan sonra geçici PDF silinir (öğrenci PDF'i dahil)
// Çalıştırma (proje kökünden):  node testler/uygulama/pdf.test.js

const path = require("path");
const os = require("os");
const fs = require("fs");
const KOK = path.resolve(__dirname, "..", "..");
const esbuild = require(require.resolve("esbuild", { paths: [KOK] }));

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};
const derle = async (dosya, sahteler = {}) => {
  const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-pdf-")), "m.cjs");
  await esbuild.build({
    entryPoints: [path.join(KOK, dosya)],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: cikti,
    logLevel: "error",
    plugins: [
      {
        name: "sahte",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => (sahteler[a.path] !== undefined ? { path: a.path, namespace: "sahte" } : null));
          b.onLoad({ filter: /.*/, namespace: "sahte" }, (a) => ({ contents: sahteler[a.path], loader: "js" }));
        },
      },
    ],
  });
  return require(cikti);
};
const BASKI_SAHTESI = {
  "expo-print": `export const printToFileAsync = async (secenek) => { globalThis.__baski = secenek; return { uri: "file:///gecici/Print/abc.pdf" }; };`,
};

(async () => {
  // ================================================================ 1) Ortak baskı ayarı
  const yaz = await derle("utils/pdfYazdir.js", BASKI_SAHTESI);
  await yaz.pdfOlustur("<p>x</p>");
  const b = globalThis.__baski;
  esit("A4 genişlik/yükseklik (nokta)", [b.width, b.height], [595, 842]);
  esit("her sayfada kenar boşluğu (iOS margins)", b.margins, { top: 40, bottom: 44, left: 36, right: 36 });
  esit("base64 üretilmez", b.base64, false);
  esit("Android için @page A4", /@page \{ size: A4; margin: 40pt 36pt 44pt 36pt; \}/.test(yaz.PDF_SAYFA_STILI), true);

  // ================================================================ 2) Öğrencinin Hata Defteri
  const p = await derle("utils/pdfIcerik.js", BASKI_SAHTESI);
  esit("stil A4 sayfa stilini içerir", p.PDF_STILI.includes("@page { size: A4"), true);
  esit("gövdede 40px dolgu kalmadı (kenar sayfadan)", /body \{[^}]*padding: 40px/.test(p.PDF_STILI), false);
  esit("soru üst bloğu bölünmez", /\.soru-ust \{[^}]*break-inside: avoid/.test(p.PDF_STILI), true);
  for (const sinif of ["soru-metni", "adim", "sonuc", "aciklama", "cozum-yok"]) {
    esit(`.${sinif} bölünmez`, new RegExp(`\\.${sinif} \\{[^}]*break-inside: avoid`).test(p.PDF_STILI), true);
  }
  esit("bölüm başlığı ilk adımdan ayrılmaz", /\.bolum-baslik \{[^}]*break-after: avoid/.test(p.PDF_STILI), true);

  const cozum = {
    question: "Bir ABC üçgeninde ∠BAC=50° ise ∠LKM kaçtır? <script>alert(1)</script>",
    cardSteps: ["Öncelikle şunu düşünelim: ğüşıöç İĞÜŞÖÇ", "x < 5 ve y > 2"],
    cardAnswer: "D) 65°",
    explanation: "Açıklama: ılık iğne",
  };
  const blok = p.soruBlokHtml({ sira: 1, dersAdi: "Matematik", tarih: "28.11.2026", fotoLink: 'https://x.test/a.jpg?t="1"', cozum, mesaj: "" });
  const ustBas = blok.indexOf('<div class="soru-ust">');
  const ust = blok.slice(ustBas, blok.indexOf('<div class="soru-metni">'));
  esit("başlık ve fotoğraf üst blokta", ["soru-baslik", "soru-foto"].every((s) => ust.includes(s)), true);
  esit("soru metni üst bloğun hemen ardından, adımlardan önce", ustBas < blok.indexOf("soru-metni") && blok.indexOf("soru-metni") < blok.indexOf("ÇÖZÜM ADIMLARI"), true);
  esit("soru metni bir kez", (blok.match(/class="soru-metni"/g) || []).length, 1);
  esit("Türkçe karakterler korunur", blok.includes("ğüşıöç İĞÜŞÖÇ") && blok.includes("ılık iğne") && blok.includes("∠BAC=50°"), true);
  esit("betik kaçırılır", blok.includes("<script>"), false);
  esit("küçüktür/büyüktür kaçırılır", blok.includes("x &lt; 5 ve y &gt; 2"), true);
  esit("fotoğraf adresindeki tırnak kaçırılır", blok.includes('src="https://x.test/a.jpg?t=&quot;1&quot;"'), true);
  esit("sonuç ve adımlar var", blok.includes("KESİN SONUÇ") && blok.includes("ADIM 2"), true);
  // Yalnızca soru metni olan çözüm: "içeriği okunamadı" kutusu çıkmaz (soru üstte gösterilir)
  const yalnizSoru = p.soruBlokHtml({ sira: 2, dersAdi: "Fizik", tarih: "1.1.2026", fotoLink: null, cozum: { question: "Soru?" }, mesaj: "" });
  esit("yalnız soru: okunamadı kutusu yok", yalnizSoru.includes("okunamadı"), false);
  esit("yalnız soru: fotoğraf yok kutusu", yalnizSoru.includes("Fotoğraf Yok"), true);
  const bos = p.soruBlokHtml({ sira: 3, dersAdi: "Kimya", tarih: "1.1.2026", fotoLink: null, cozum: { foo: 1 }, mesaj: "" });
  esit("tanınmayan çözüm: okunamadı kutusu", bos.includes("içeriği okunamadı"), true);
  const cozumsuz = p.soruBlokHtml({ sira: 4, dersAdi: "Kimya", tarih: "1.1.2026", fotoLink: null, cozum: null, mesaj: "⏳ beklemede <b>" });
  esit("çözümsüz: mesaj kaçırılır", cozumsuz.includes("beklemede &lt;b&gt;"), true);
  const belge = p.belgeHtml({ kategori: "Tümü <i>", toplam: 4, govde: blok });
  esit("Sormix notu var", belge.includes("Bu belge Sormix uygulaması tarafından otomatik oluşturulmuştur."), true);
  esit("Sormix notu başlığın altında (sonda tek sayfa kaplamaz)", belge.indexOf("Sormix uygulaması") < belge.indexOf('<div class="soru-kutusu">'), true);
  esit("eski uygulama adı alt yazıda yok", belge.includes("Akıllı Hata Defterim uygulaması"), false);
  esit("utf-8 ve Türkçe dil", belge.includes('<meta charset="utf-8">') && belge.includes('<html lang="tr">'), true);
  esit("kategori kaçırılır", belge.includes("Tümü &lt;i&gt;"), true);
  esit("ekran genişliği viewport'u yok (baskıyı daraltmasın)", belge.includes("device-width"), false);

  // ================================================================ 3) Müdür raporu
  const r = await derle("utils/ogrenciRaporu.js", BASKI_SAHTESI);
  const SIMDI = Date.UTC(2026, 10, 28, 12);
  const satir = {
    isim: "Ayşe Işık <b>",
    toplam: 12,
    okunan: 6,
    son7: 3,
    son30: 12,
    gunler: { "2026-11-27": 2, "2026-11-20": 1 },
    dersler: [{ ders: "Türkçe", adet: 5 }, { ders: "Matematik", adet: 7 }],
    konular: [{ konu: "Üslü sayılar", ders: "Matematik", adet: 3 }],
  };
  const rapor = r.ogrenciRaporuHtml({ kurumAdi: "istanbul ilim dershanesi <i>", satir, simdi: SIMDI });
  esit("dershane adı Türkçe büyük harf (i → İ) ve kaçırılmış", rapor.includes("İSTANBUL İLİM DERSHANESİ &lt;İ&gt;"), true);
  esit("CSS büyük harf çevirisi kalmadı", rapor.includes("text-transform: uppercase"), false);
  esit("rapor A4 sayfa stili", rapor.includes("@page { size: A4"), true);
  esit("raporda gövde dolgusu yok", /body \{[^}]*padding: 36px/.test(rapor), false);
  esit("öğrenci adı kaçırılır, Türkçe korunur", rapor.includes("Ayşe Işık &lt;b&gt;"), true);
  esit("başlıklar Türkçe", ["Öğrenci Gelişim Raporu", "Ders dağılımı", "En çok sorduğu konular", "günlük soru sayısı", "Çalışılan gün"].every((s) => rapor.includes(s)), true);
  esit("grafik bölümü bölünmez", rapor.includes('<div class="bolum">') && /\.bolum \{[^}]*break-inside: avoid/.test(rapor), true);
  esit("başlık bölümden ayrılmaz", /h2 \{[^}]*break-after: avoid/.test(rapor), true);
  esit("kartlar bölünmez", /\.kartlar \{[^}]*break-inside: avoid/.test(rapor), true);
  esit("raporda viewport yok", rapor.includes("device-width"), false);
  esit("dosya adı ASCII ve güvenli", r.raporDosyaAdi("Ayşe Işık/../", SIMDI), "Sormix-Rapor-Ayse-Isik-2026-11-28.pdf");

  // ================================================================ 4) Paylaşım ve geçici dosya temizliği
  const paylas = await derle("utils/raporPaylas.js", {
    "react-native": `export const Platform = { get OS() { return globalThis.__platform || "ios"; } };`,
    "./pdfYazdir": `export const pdfOlustur = async (html) => { globalThis.__olaylar.push(["pdf", html.length > 0]); return { uri: "file:///gecici/Print/abc.pdf" }; };`,
    "expo-sharing": `
      export const isAvailableAsync = async () => globalThis.__paylasimVar !== false;
      export const shareAsync = async (uri, s) => { globalThis.__olaylar.push(["paylas", uri, s.mimeType]); if (globalThis.__paylasimHatasi) throw new Error("iptal"); };`,
    "expo-file-system/legacy": `
      export const cacheDirectory = "file:///onbellek/";
      export const readDirectoryAsync = async () => globalThis.__dizin || [];
      export const copyAsync = async ({ from, to }) => { globalThis.__olaylar.push(["kopya", from, to]); };
      export const deleteAsync = async (yol) => { globalThis.__olaylar.push(["sil", yol]); };`,
  });
  const calistir = async (ayar, girdi) => {
    globalThis.__olaylar = [];
    globalThis.__platform = ayar.platform;
    globalThis.__paylasimVar = ayar.paylasimVar;
    globalThis.__paylasimHatasi = ayar.hata;
    globalThis.__dizin = ayar.dizin;
    let sonuc;
    try {
      sonuc = await paylas.raporuPaylas(girdi);
    } catch (e) {
      sonuc = { hata: e.message };
    }
    return { sonuc, olaylar: globalThis.__olaylar };
  };
  const ogr = { html: "<p>x</p>", dosyaAdi: "Sormix-HataDefteri-2026-11-28.pdf", baslik: "Hata Defterimi Paylaş" };
  let s = await calistir({ platform: "ios" }, ogr);
  esit("öğrenci PDF adı korunur", s.olaylar.find((o) => o[0] === "kopya")?.[2], "file:///onbellek/Sormix-HataDefteri-2026-11-28.pdf");
  esit("iOS: paylaşımdan sonra iki geçici dosya da silinir", s.olaylar.filter((o) => o[0] === "sil").map((o) => o[1]), ["file:///gecici/Print/abc.pdf", "file:///onbellek/Sormix-HataDefteri-2026-11-28.pdf"]);
  esit("PDF türünde paylaşılır", s.olaylar.find((o) => o[0] === "paylas")?.[2], "application/pdf");
  s = await calistir({ platform: "ios", hata: true }, ogr);
  esit("paylaşım iptalinde de silinir", s.olaylar.filter((o) => o[0] === "sil").length, 2);
  s = await calistir({ platform: "android" }, ogr);
  esit("Android: kopya hemen silinmez (hedef uygulama okuyor olabilir)", s.olaylar.filter((o) => o[0] === "sil").map((o) => o[1]), ["file:///gecici/Print/abc.pdf"]);
  s = await calistir({ platform: "ios", paylasimVar: false }, ogr);
  esit("paylaşım yoksa bilgi döner ve dosyalar silinir", [s.sonuc.desteklenmiyor, s.olaylar.filter((o) => o[0] === "sil").length], [true, 2]);
  s = await calistir({ platform: "ios" }, { html: "x", dosyaAdi: "baska.pdf", baslik: "r" });
  esit("bilinmeyen ada önek eklenir", s.olaylar.find((o) => o[0] === "kopya")?.[2], "file:///onbellek/Sormix-Rapor-baska.pdf");
  s = await calistir({ platform: "android", dizin: ["Sormix-HataDefteri-eski.pdf", "Sormix-Rapor-eski.pdf", "Mikro-Rapor-eski.pdf", "baska.txt"] }, ogr);
  esit("önceki geçici PDF'ler temizlenir (başka dosyaya dokunulmaz)", s.olaylar.filter((o) => o[0] === "sil").map((o) => o[1]).slice(0, 3).sort(), ["file:///onbellek/Mikro-Rapor-eski.pdf", "file:///onbellek/Sormix-HataDefteri-eski.pdf", "file:///onbellek/Sormix-Rapor-eski.pdf"]);

  // ================================================================ 5) Kaynak denetimi: bütün PDF'ler ortak ayarla
  const printKullananlar = [];
  for (const klasor of ["screens", "utils"]) {
    for (const f of fs.readdirSync(path.join(KOK, klasor)).filter((x) => x.endsWith(".js"))) {
      if (fs.readFileSync(path.join(KOK, klasor, f), "utf8").includes("printToFileAsync")) printKullananlar.push(`${klasor}/${f}`);
    }
  }
  esit("PDF yalnızca ortak yardımcıyla üretilir", printKullananlar, ["utils/pdfYazdir.js"]);
  const gecmis = fs.readFileSync(path.join(KOK, "screens/HistoryScreen.js"), "utf8");
  esit("Hata Defteri ortak paylaşımı kullanır", gecmis.includes("await raporuPaylas({"), true);

  console.log(`[pdf] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.log("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
