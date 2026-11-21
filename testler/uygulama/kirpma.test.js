// Uygulama testi: utils/kirpma.js (kare kırpma hesabı).
// Çalıştırma (proje kökünden):  node testler/uygulama/kirpma.test.js

const path = require("path");
const os = require("os");
const fs = require("fs");
const KOK = path.resolve(__dirname, "..", "..");
const esbuild = require(require.resolve("esbuild", { paths: [KOK] }));

const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-kirpma-")), "m.cjs");
esbuild.buildSync({ entryPoints: [path.join(KOK, "utils/kirpma.js")], bundle: true, format: "cjs", platform: "node", outfile: cikti, logLevel: "error" });
const k = require(cikti);

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};

// Yatay fotoğraf 2000x1000, çerçeve 300 nokta → temel ölçek 0.3
esit("temel ölçek", k.temelOlcek(2000, 1000, 300), 0.3);
const orta = k.ortalamaKaydirmasi(2000, 1000, 300);
esit("ortalama kaydırma (yatay)", orta, { x: 150, y: 0 });
esit("başlangıç: ortadaki kare", k.kirpmaAlani({ genislik: 2000, yukseklik: 1000, cerceve: 300, kayX: orta.x, kayY: orta.y, zoom: 1 }), { originX: 500, originY: 0, width: 1000, height: 1000 });
esit("en sola kaydırılmış", k.kirpmaAlani({ genislik: 2000, yukseklik: 1000, cerceve: 300, kayX: 0, kayY: 0, zoom: 1 }), { originX: 0, originY: 0, width: 1000, height: 1000 });
esit("en sağa kaydırılmış", k.kirpmaAlani({ genislik: 2000, yukseklik: 1000, cerceve: 300, kayX: 300, kayY: 0, zoom: 1 }), { originX: 1000, originY: 0, width: 1000, height: 1000 });
// 2x yakınlaştırma: kare 500 piksel; kaydırma (yakınlaştırılmış koordinat) 600,150 → 1000,250
esit("2x yakınlaştırma", k.kirpmaAlani({ genislik: 2000, yukseklik: 1000, cerceve: 300, kayX: 600, kayY: 150, zoom: 2 }), { originX: 1000, originY: 250, width: 500, height: 500 });

// Dikey fotoğraf 1000x2000
esit("ortalama kaydırma (dikey)", k.ortalamaKaydirmasi(1000, 2000, 300), { x: 0, y: 150 });
esit("dikey başlangıç", k.kirpmaAlani({ genislik: 1000, yukseklik: 2000, cerceve: 300, kayX: 0, kayY: 150, zoom: 1 }), { originX: 0, originY: 500, width: 1000, height: 1000 });

// Taşmalar fotoğrafın içine kısılır (iOS sekmesi / yaylanma)
esit("negatif kaydırma kısılır", k.kirpmaAlani({ genislik: 2000, yukseklik: 1000, cerceve: 300, kayX: -50, kayY: -20, zoom: 1 }), { originX: 0, originY: 0, width: 1000, height: 1000 });
esit("aşırı kaydırma kısılır", k.kirpmaAlani({ genislik: 2000, yukseklik: 1000, cerceve: 300, kayX: 9999, kayY: 9999, zoom: 1 }), { originX: 1000, originY: 0, width: 1000, height: 1000 });
esit("zoom <1 → 1 sayılır", k.kirpmaAlani({ genislik: 2000, yukseklik: 1000, cerceve: 300, kayX: 0, kayY: 0, zoom: 0.5 }).width, 1000);
esit("geçersiz boyut", k.kirpmaAlani({ genislik: 0, yukseklik: 1000, cerceve: 300, kayX: 0, kayY: 0, zoom: 1 }), null);
esit("NaN kaydırma 0 sayılır", k.kirpmaAlani({ genislik: 2000, yukseklik: 1000, cerceve: 300, kayX: NaN, kayY: NaN, zoom: 1 }).originX, 0);

// Her durumda: kare, tam sayı ve fotoğrafın içinde
let hepsiGecerli = true;
for (const [g, y] of [[2000, 1000], [1000, 2000], [1500, 1500], [4032, 3024]]) {
  for (const z of [1, 1.5, 2.7, 4]) {
    for (const kay of [-100, 0, 137, 500, 5000]) {
      const a = k.kirpmaAlani({ genislik: g, yukseklik: y, cerceve: 351, kayX: kay, kayY: kay, zoom: z });
      const tamSayi = [a.originX, a.originY, a.width, a.height].every(Number.isInteger);
      if (!tamSayi || a.width !== a.height || a.originX < 0 || a.originY < 0 || a.originX + a.width > g || a.originY + a.height > y) hepsiGecerli = false;
    }
  }
}
esit("tüm durumlarda kare, tam sayı, fotoğrafın içinde", hepsiGecerli, true);

console.log(`[kirpma] ${gecen} geçti, ${kalan} hata`);
process.exit(kalan ? 1 : 0);
