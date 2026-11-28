// Uygulama testi (28 Kasım düzeltmeleri, A grubu):
//   1) "İşleniyor" durumunun tanınması (utils/soruDurumu.js isleniyorMu, renk/emoji sabitleri)
//   2) Öğretmen → "Rehber Öğretmen" (ekranda görünen yazılar; iç rol adı "ogretmen" DEĞİŞMEZ)
//   3) Tanıtım sayfası yalnızca yeni öğrenciye (utils/tanitim.js)
//   4) Soru destek e-postası (utils/destek.js): yalnızca soru kimliği, kodlama, sızma denemeleri
// Çalıştırma (proje kökünden):  node testler/uygulama/gorunumDuzeltmeleri.test.js

const path = require("path");
const os = require("os");
const fs = require("fs");
const KOK = path.resolve(__dirname, "..", "..");
const esbuild = require(require.resolve("esbuild", { paths: [KOK] }));

const derle = (dosya) => {
  const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-gorunum-")), "m.cjs");
  esbuild.buildSync({ entryPoints: [path.join(KOK, dosya)], bundle: true, format: "cjs", platform: "node", outfile: cikti, logLevel: "error" });
  return require(cikti);
};

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};

// ------------------------------------------------ 1) İşleniyor
const durum = derle("utils/soruDurumu.js");
for (const d of ["İşleniyor", "işleniyor", "ISLENIYOR", "Isleniyor", "isleniyor", "  İşleniyor  ", "İŞLENİYOR", "ışleniyor", "İşlenıyor"]) {
  esit(`işleniyor tanınır: "${d}"`, durum.isleniyorMu({ durum: d }), true);
}
for (const d of ["Bekliyor", "Çözüldü", "İnceleme Gerekli", "İptal Edildi", "İşlendi", "İşleniyor gibi", "", "İşleniyor.", "işleniyorr"]) {
  esit(`işleniyor DEĞİL: "${d}"`, durum.isleniyorMu({ durum: d }), false);
}
for (const s of [null, undefined, {}, { durum: 5 }, { durum: null }, { durum: ["İşleniyor"] }]) {
  esit(`bozuk girdi çökmez: ${JSON.stringify(s)}`, durum.isleniyorMu(s), false);
}
esit("emoji 🔄", durum.ISLENIYOR_EMOJI, "🔄");
esit("renk turuncu", durum.ISLENIYOR_RENGI, "#F97316");
esit("metin", durum.ISLENIYOR_METNI, "İşleniyor");
// Diğer durumlar etkilenmedi
esit("inceleme hâlâ tanınır", durum.incelemedeMi({ durum: "İnceleme Gerekli" }), true);
esit("iptal hâlâ tanınır", durum.iptalMi({ durum: "İptal Edildi" }), true);

// ------------------------------------------------ 2) Rehber Öğretmen (kaynak taraması)
// Ekranda görünen metinlerde (yorum satırları ve console.log hariç) "rehber" olmadan "öğretmen" kalmamalı.
// İstisna: öğrencinin kendi öğretmeninden söz eden yapay zekâ uyarısı (YapayZekaBilgi.js).
const tarananlar = [
  ...fs.readdirSync(path.join(KOK, "screens")).filter((f) => f.endsWith(".js")).map((f) => `screens/${f}`),
  ...fs.readdirSync(path.join(KOK, "utils")).filter((f) => f.endsWith(".js")).map((f) => `utils/${f}`),
  "App.js",
];
const ihlaller = [];
for (const dosya of tarananlar) {
  if (dosya === "screens/YapayZekaBilgi.js") continue;
  fs.readFileSync(path.join(KOK, dosya), "utf8").split("\n").forEach((satir, i) => {
    const t = satir.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.includes("console.log")) return;
    const temiz = t.replace(/rehber öğretmen/gi, "").replace(/Rehber Öğretmen/g, "");
    if (/[Öö]ğretmen/.test(temiz)) ihlaller.push(`${dosya}:${i + 1}: ${t.slice(0, 90)}`);
  });
}
esit("ekranda 'rehber'siz öğretmen yazısı kalmadı", ihlaller, []);
// Rol etiketleri
const etiketKaynagi = fs.readFileSync(path.join(KOK, "utils/useYoneticiYetkisi.js"), "utf8");
esit("ROL_ETIKETLERI Rehber Öğretmen", /ogretmen: "Rehber Öğretmen"/.test(etiketKaynagi), true);
const ekipKaynagi = fs.readFileSync(path.join(KOK, "screens/EkipKarti.js"), "utf8");
esit("EkipKarti ROL_ADLARI Rehber Öğretmen", /ogretmen: "Rehber Öğretmen"/.test(ekipKaynagi), true);
// İç rol adı değişmedi (yetkiler bozulmasın): kurallar ve sunucu hâlâ 'ogretmen' kullanır
const kurallar = fs.readFileSync(path.join(KOK, "firestore.rules"), "utf8");
esit("kurallarda iç rol adı 'ogretmen' duruyor", kurallar.includes("'ogretmen'"), true);
esit("kurallarda 'rehber' iç adı YOK", /rehber/i.test(kurallar), false);
const rapor = derle("utils/kurumRapor.js");
const davet = rapor.ogretmenDavetMetni("Deneme Dershanesi", "a@b.com");
esit("davet mesajı rehber öğretmen", davet.includes("Sormix rehber öğretmen daveti") && davet.includes("rehber öğretmen olarak ekledik"), true);

// ------------------------------------------------ 3) Tanıtım
const { tanitimGosterilsinMi } = derle("utils/tanitim.js");
esit("öğrenciye tanıtım gösterilir", tanitimGosterilsinMi("ogrenci"), true);
esit("veliye tanıtım GÖSTERİLMEZ", tanitimGosterilsinMi("veli"), false);
esit("yöneticiye gösterilmez", tanitimGosterilsinMi("yonetici"), false);
esit("bilinmeyen rol: gösterilmez", tanitimGosterilsinMi(undefined), false);
esit("'Ogrenci' (büyük harf) gösterilmez", tanitimGosterilsinMi("Ogrenci"), false);
const appKaynagi = fs.readFileSync(path.join(KOK, "App.js"), "utf8");
esit("App.js tanıtımı role göre açıyor", appKaynagi.includes("setGosterOnboarding(tanitimGosterilsinMi(yeniRol))"), true);
esit("App.js'te koşulsuz tanıtım açma kalmadı", appKaynagi.includes("setGosterOnboarding(true)"), false);

// ------------------------------------------------ 4) Destek e-postası
const { soruDestekBaglantisi, DESTEK_EPOSTASI } = derle("utils/destek.js");
const coz = (baglanti) => {
  const [adres, sorgu] = baglanti.replace(/^mailto:/, "").split("?");
  const p = new URLSearchParams(sorgu);
  return { adres, anahtarlar: [...p.keys()], konu: p.get("subject"), govde: p.get("body") };
};
esit("adres", DESTEK_EPOSTASI, "cesa@cesaai.tech");
const iyi = coz(soruDestekBaglantisi("AbC123xyz"));
esit("geçerli: adres doğru", iyi.adres, "cesa@cesaai.tech");
esit("geçerli: yalnızca konu ve gövde", iyi.anahtarlar, ["subject", "body"]);
esit("geçerli: konuda kimlik", iyi.konu, "Sormix Soru Bildirimi (AbC123xyz)");
esit("geçerli: gövdede kimlik", iyi.govde.startsWith("Soru numarası: AbC123xyz\n\n"), true);
esit("Türkçe karakter korunur", iyi.govde.includes("şöyle bir sorun var"), true);
// Sızma / bozuk kimlik denemeleri: kimlik HİÇ eklenmez, ek parametre oluşmaz
for (const kotu of ["a&cc=saldirgan@x.com", "a?bcc=x@y.com", "a\nBcc: x@y.com", "../../etc", "a b", "a%26cc%3Dx", "x".repeat(65), "", null, undefined, 42, {}, ["abc"]]) {
  const c = coz(soruDestekBaglantisi(kotu));
  const ad = `kötü kimlik: ${JSON.stringify(kotu)?.slice(0, 30)}`;
  esit(`${ad} → adres değişmez`, c.adres, "cesa@cesaai.tech");
  esit(`${ad} → yalnızca konu/gövde`, c.anahtarlar, ["subject", "body"]);
  esit(`${ad} → kimliksiz konu`, c.konu, "Sormix Soru Bildirimi");
  esit(`${ad} → gövdede numara yok`, c.govde.includes("Soru numarası"), false);
}
esit("64 karakterlik kimlik kabul", coz(soruDestekBaglantisi("x".repeat(64))).konu.includes("x".repeat(64)), true);
// Ham bağlantıda kodlanmamış boşluk/satır sonu yok (mailto bozulmasın)
const ham = soruDestekBaglantisi("AbC123");
esit("ham bağlantıda boşluk/satır sonu yok", /[\s]/.test(ham), false);
// Kişisel veri eklenmediği: kaynakta e-posta/uid/ad alanlarına başvuru yok
const destekKaynagi = fs.readFileSync(path.join(KOK, "utils/destek.js"), "utf8").split("\n").filter((s) => !s.trim().startsWith("//")).join("\n").replace(/DESTEK_EPOSTASI/g, "");
esit("destek.js kişisel alan kullanmıyor", /\b(uid|email|eposta|adSoyad|fotoLink|kullanici\w*|currentUser)\b/i.test(destekKaynagi), false);
// Ekran: düğme yalnızca soru kimliğini veriyor
const gecmisKaynagi = fs.readFileSync(path.join(KOK, "screens/HistoryScreen.js"), "utf8");
esit("HistoryScreen destek çağrısı yalnızca kimlikle", gecmisKaynagi.includes("soruDestekBaglantisi(seciliSoru?.id)"), true);

console.log(`[gorunumDuzeltmeleri] ${gecen} geçti, ${kalan} hata`);
process.exit(kalan ? 1 : 0);
