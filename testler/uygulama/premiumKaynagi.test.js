// Uygulama testi: utils/premiumKaynagi.js (Hesabım > Abonelik kartı: Premium'un kaynağına göre görünüm).
// Çalıştırma (proje kökünden):  node testler/uygulama/premiumKaynagi.test.js
// Not: Bu dosya yalnızca GÖRÜNÜMÜ belirler; Premium/kota kararı sunucudadır (functions/premium.js, testleri ayrı).

const path = require("path");
const os = require("os");
const fs = require("fs");
const KOK = path.resolve(__dirname, "..", "..");
const esbuild = require(require.resolve("esbuild", { paths: [KOK] }));
const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-premiumkaynagi-")), "m.cjs");
esbuild.buildSync({ entryPoints: [path.join(KOK, "utils/premiumKaynagi.js")], bundle: true, format: "cjs", platform: "node", outfile: cikti, logLevel: "error" });
const { premiumKaynagiCoz, abonelikKarti } = require(cikti);

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};

const SIMDI = Date.UTC(2026, 10, 26, 12);
const GUN = 86400000;
const ts = (ms) => ({ toMillis: () => ms }); // Firestore Timestamp benzeri

// ------------------------------------------------ premiumKaynagiCoz
esit("kaynak yok", premiumKaynagiCoz(null, SIMDI), { kurum: false, abonelik: false, elle: false });
esit("yalnızca dershane", premiumKaynagiCoz({ kurum: true }, SIMDI), { kurum: true, abonelik: false, elle: false });
esit("geçerli abonelik (Timestamp)", premiumKaynagiCoz({ abonelik: { aktif: true, bitis: ts(SIMDI + GUN) } }, SIMDI).abonelik, true);
esit("geçerli abonelik (Date)", premiumKaynagiCoz({ abonelik: { aktif: true, bitis: new Date(SIMDI + GUN) } }, SIMDI).abonelik, true);
esit("süresi geçmiş abonelik", premiumKaynagiCoz({ abonelik: { aktif: true, bitis: ts(SIMDI - 1) } }, SIMDI).abonelik, false);
esit("aktif değil", premiumKaynagiCoz({ abonelik: { aktif: false, bitis: ts(SIMDI + GUN) } }, SIMDI).abonelik, false);
esit("bitişsiz abonelik geçersiz", premiumKaynagiCoz({ abonelik: { aktif: true } }, SIMDI).abonelik, false);
esit("bozuk bitiş", premiumKaynagiCoz({ abonelik: { aktif: true, bitis: "yarin" } }, SIMDI).abonelik, false);
esit("kurum: 'true' metni sayılmaz", premiumKaynagiCoz({ kurum: "true" }, SIMDI).kurum, false);
esit("elle", premiumKaynagiCoz({ elle: true }, SIMDI).elle, true);

// ------------------------------------------------ abonelikKarti
const SINIR = { ucretsizSinir: 3, premiumSinir: 50 };
const kart = (premiumMu, kaynaklar) => abonelikKarti({ premiumMu, kaynak: premiumKaynagiCoz(kaynaklar, SIMDI), ...SINIR });

const ucretsiz = kart(false, null);
esit("ücretsiz: rozet", ucretsiz.rozet, "Ücretsiz");
esit("ücretsiz: yönet düğmesi yok (Premium'a Geç gösterilir)", ucretsiz.yonetDugmesi, false);
esit("ücretsiz: metin", ucretsiz.aciklama, "Günde 3 soru. Premium ile günde 50 soru ve PDF indirme.");

const dershane = kart(true, { kurum: true });
esit("dershane: rozet", dershane.rozet, "Premium · Dershane");
esit("dershane: Aboneliği Yönet GÖSTERİLMEZ (Apple aboneliği yok)", dershane.yonetDugmesi, false);
esit("dershane: kaynak metinde", dershane.aciklama.startsWith("Premium'un dershanenden geliyor."), true);

const ikisi = kart(true, { kurum: true, abonelik: { aktif: true, bitis: ts(SIMDI + GUN) } });
esit("dershane + abonelik: yönet düğmesi var", ikisi.yonetDugmesi, true);
esit("dershane + abonelik: iptal bilgisi", ikisi.aciklama.includes("dilersen aboneliğini iptal edebilirsin"), true);

const dershaneBitmisAbonelik = kart(true, { kurum: true, abonelik: { aktif: true, bitis: ts(SIMDI - GUN) } });
esit("dershane + süresi geçmiş abonelik: yönet düğmesi yok", dershaneBitmisAbonelik.yonetDugmesi, false);

const abone = kart(true, { abonelik: { aktif: true, bitis: ts(SIMDI + GUN) } });
esit("yalnızca abonelik: rozet", abone.rozet, "Premium");
esit("yalnızca abonelik: yönet düğmesi var", abone.yonetDugmesi, true);
esit("yalnızca abonelik: metin", abone.aciklama, "Günde 50 soru ve PDF indirme aktif.");

const elle = kart(true, { elle: true });
esit("elle: yönet düğmesi yok", elle.yonetDugmesi, false);
esit("kaynak bilgisi yok ama premium: yönet düğmesi yok", kart(true, null).yonetDugmesi, false);

esit("sınır bilinmiyorsa genel metin", abonelikKarti({ premiumMu: true, kaynak: premiumKaynagiCoz({ elle: true }, SIMDI) }).aciklama, "Premium soru hakkı ve PDF indirme aktif.");

console.log(`[premiumKaynagi] ${gecen} geçti, ${kalan} hata`);
process.exit(kalan ? 1 : 0);
