// Uygulama testi: utils/seviye.js ve utils/rozetler.js (saf mantık, emülatör gerekmez).
// Çalıştırma (proje kökünden):  node testler/uygulama/seviye.test.js
// ES modül dosyaları, projede zaten bulunan esbuild ile geçici olarak derlenip yüklenir.

const path = require("path");
const os = require("os");
const fs = require("fs");
const KOK = path.resolve(__dirname, "..", "..");
const esbuild = require(require.resolve("esbuild", { paths: [KOK] }));

const yukle = (dosya) => {
  const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-test-")), "m.cjs");
  esbuild.buildSync({ entryPoints: [path.join(KOK, dosya)], bundle: true, format: "cjs", platform: "node", outfile: cikti, logLevel: "error" });
  return require(cikti);
};

const sv = yukle("utils/seviye.js");
const rz = yukle("utils/rozetler.js");

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};

// ---------------------------------------------------------------- eğri
esit("en yüksek seviye", sv.EN_YUKSEK_SEVIYE, 100);
esit("1→2 maliyeti", sv.seviyeMaliyeti(1), 100);
esit("9→10 maliyeti", sv.seviyeMaliyeti(9), 300);
esit("10→11 maliyeti", sv.seviyeMaliyeti(10), 300);
esit("99→100 maliyeti", sv.seviyeMaliyeti(99), 2080);
esit("eşikler", [2, 5, 10, 30, 50, 70, 100].map(sv.seviyeEsigi), [100, 550, 1800, 11600, 29400, 55200, 108900]);
let artan = true;
for (let s = 2; s < 100; s++) if (sv.seviyeMaliyeti(s) < sv.seviyeMaliyeti(s - 1)) artan = false;
esit("maliyet hiç azalmaz", artan, true);
esit("ilk 10 seviye kolay (her biri ≤ 300)", [...Array(9)].every((_, i) => sv.seviyeMaliyeti(i + 1) <= 300), true);

// ---------------------------------------------------------------- seviye bilgisi
esit("0 puan", sv.seviyeBilgisi(0), { seviye: 1, puan: 0, seviyedekiPuan: 0, gerekenPuan: 100, kalanPuan: 100, yuzde: 0, enYuksekte: false });
esit("99 puan hâlâ 1", sv.seviyeBilgisi(99).seviye, 1);
esit("100 puan → 2", sv.seviyeBilgisi(100).seviye, 2);
esit("1800 → 10", sv.seviyeBilgisi(1800).seviye, 10);
esit("1799 → 9", sv.seviyeBilgisi(1799).seviye, 9);
esit("yüzde", sv.seviyeBilgisi(150).yuzde, 40); // 2. seviye: 50/125
esit("kalan", sv.seviyeBilgisi(150).kalanPuan, 75);
esit("tam 100. seviye", sv.seviyeBilgisi(108900), { seviye: 100, puan: 108900, seviyedekiPuan: 0, gerekenPuan: 0, kalanPuan: 0, yuzde: 100, enYuksekte: true });
esit("100'ü geçmez", sv.seviyeBilgisi(10_000_000).seviye, 100);
esit("negatif puan", sv.seviyeBilgisi(-50).seviye, 1);
esit("NaN puan", sv.seviyeBilgisi(NaN).seviye, 1);
esit("metin puan", sv.seviyeBilgisi("1000").seviye, 1);
let tutarli = true;
for (let p = 0; p <= 120000; p += 37) {
  const b = sv.seviyeBilgisi(p);
  if (b.yuzde < 0 || b.yuzde > 100 || b.kalanPuan < 0 || b.seviye < 1 || b.seviye > 100) tutarli = false;
  if (!b.enYuksekte && b.seviyedekiPuan + b.kalanPuan !== b.gerekenPuan) tutarli = false;
}
esit("tüm puanlarda tutarlı", tutarli, true);
let monoton = true;
let onceki = 1;
for (let p = 0; p <= 120000; p += 11) {
  const s = sv.seviyeBilgisi(p).seviye;
  if (s < onceki) monoton = false;
  onceki = s;
}
esit("puan artınca seviye düşmez", monoton, true);

// ---------------------------------------------------------------- puan
esit("puan: soru+çözüm", sv.puanHesapla({ toplamSoru: 10, okunanCozum: 4 }), 560);
esit("puan: boş", sv.puanHesapla(), 0);
esit("puan: hatalı girdi", sv.puanHesapla({ toplamSoru: -3, okunanCozum: "x" }), 0);
esit("puan: ondalık aşağı", sv.puanHesapla({ toplamSoru: 2.9 }), 100);
esit("~28 soru+çözüm ile 10. seviye", sv.seviyeBilgisi(sv.puanHesapla({ toplamSoru: 28, okunanCozum: 28 })).seviye, 10);

// ---------------------------------------------------------------- seviye rozetleri
const idler = rz.ROZETLER.map((r) => r.id);
esit("rozet kimlikleri benzersiz", new Set(idler).size, idler.length);
esit("toplam rozet", idler.length, 24);
for (const n of [10, 30, 50, 70, 100]) {
  esit(`seviye-${n} rozeti var`, idler.includes(`seviye-${n}`), true);
  esit(`seviye ${n - 1}: rozet yok`, rz.kazanilanRozetIdleri({ seviye: n - 1 }).includes(`seviye-${n}`), false);
  esit(`seviye ${n}: rozet var`, rz.kazanilanRozetIdleri({ seviye: n }).includes(`seviye-${n}`), true);
}
esit("seviye verilmezse seviye rozeti yok", rz.kazanilanRozetIdleri({}).filter((i) => i.startsWith("seviye-")), []);
esit("hatalı seviye", rz.kazanilanRozetIdleri({ seviye: "100" }).filter((i) => i.startsWith("seviye-")), []);
esit("100. seviyede beş seviye rozeti", rz.kazanilanRozetIdleri({ seviye: 100 }).filter((i) => i.startsWith("seviye-")).length, 5);
esit("eski rozetler bozulmadı", rz.kazanilanRozetIdleri({ toplamSoru: 10, seriGunu: 7, okunanCozum: 10 }), [
  "ilk-adim", "cozum-okuyucu", "merakli", "seri-2", "isinma", "hizlaniyor", "soru-avcisi", "calisan-okur", "istikrarli",
]);

console.log(`[seviye] ${gecen} geçti, ${kalan} hata`);
process.exit(kalan ? 1 : 0);
