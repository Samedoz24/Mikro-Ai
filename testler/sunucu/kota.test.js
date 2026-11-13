// Sunucu testi: functions/kota.js kotaDurumu (kalan hak, sınırlar, roller, girdi doğrulama).
// Çalıştırma:
//   firebase emulators:exec --only firestore "node testler/sunucu/kota.test.js"

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-mikro";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Yalnızca emülatörde çalışır (FIRESTORE_EMULATOR_HOST yok)");

const path = require("path");
const FN = path.resolve(__dirname, "..", "..", "functions");
const al = (m) => require(require.resolve(m, { paths: [FN] }));
const { initializeApp } = al("firebase-admin/app");
const { getFirestore } = al("firebase-admin/firestore");
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();
const kota = require(path.join(FN, "kota.js"));

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};
const hataBekle = async (ad, fn, mesaj) => {
  try {
    await fn();
    kalan++;
    console.log("HATA:", ad, "hata bekleniyordu");
  } catch (e) {
    esit(ad, e?.message, mesaj);
  }
};

const CIHAZ = "A1B2C3D4-E5F6-7890-ABCD-EF1234567890";

(async () => {
  const gun = kota.turkiyeGunu();

  // Varsayılan sınırlar (ayar belgesi yok)
  await db.doc("kullanicilar/ogr").set({ rol: "ogrenci" });
  esit("varsayılan ücretsiz", await kota.kotaDurumu("ogr", {}, { cihazId: CIHAZ }), {
    kalan: 3, sinir: 3, premiumMu: false, ucretsizSinir: 3, premiumSinir: 50,
  });

  // Ayar belgesinden sınırlar
  await db.doc("ayarlar/kota").set({ ucretsiz: 5, premium: 80 });
  esit("ayardan ücretsiz", await kota.kotaDurumu("ogr", {}, { cihazId: CIHAZ }), {
    kalan: 5, sinir: 5, premiumMu: false, ucretsizSinir: 5, premiumSinir: 80,
  });
  await db.doc("kullanicilar/prem").set({ rol: "ogrenci", premiumMu: true });
  const p = await kota.kotaDurumu("prem", {}, { cihazId: "B1B2C3D4" });
  esit("premium sınırı", [p.sinir, p.kalan, p.premiumMu, p.ucretsizSinir, p.premiumSinir], [80, 80, true, 5, 80]);

  // Geçersiz ayar değerleri varsayılana düşer
  await db.doc("ayarlar/kota").set({ ucretsiz: -1, premium: "çok" });
  const g = await kota.kotaDurumu("ogr", {}, { cihazId: CIHAZ });
  esit("geçersiz ayar → varsayılan", [g.ucretsizSinir, g.premiumSinir], [3, 50]);
  await db.doc("ayarlar/kota").set({ ucretsiz: 100000, premium: 1.5 });
  const g2 = await kota.kotaDurumu("ogr", {}, { cihazId: CIHAZ });
  esit("aşırı/ondalık ayar → varsayılan", [g2.ucretsizSinir, g2.premiumSinir], [3, 50]);
  await db.doc("ayarlar/kota").delete();

  // Kullanım: hesap ve cihazdan büyük olanı düşer; başka günün sayacı sayılmaz
  await db.doc("kotaSayaclari/h_ogr").set({ gun, sayi: 1 });
  esit("hesap kullanımı", (await kota.kotaDurumu("ogr", {}, { cihazId: CIHAZ })).kalan, 2);
  await db.doc(`kotaSayaclari/c_${kota.cihazOzeti(CIHAZ)}`).set({ gun, sayi: 3 });
  esit("cihaz kullanımı daha büyük", (await kota.kotaDurumu("ogr", {}, { cihazId: CIHAZ })).kalan, 0);
  await db.doc(`kotaSayaclari/c_${kota.cihazOzeti(CIHAZ)}`).set({ gun: "2000-01-01", sayi: 3 });
  esit("eski gün sayılmaz", (await kota.kotaDurumu("ogr", {}, { cihazId: CIHAZ })).kalan, 2);
  await db.doc("kotaSayaclari/h_ogr").set({ gun, sayi: 99 });
  esit("kalan eksiye düşmez", (await kota.kotaDurumu("ogr", {}, { cihazId: CIHAZ })).kalan, 0);

  // Roller ve girdi
  await db.doc("kullanicilar/veli").set({ rol: "veli" });
  await hataBekle("veli", () => kota.kotaDurumu("veli", {}, { cihazId: CIHAZ }), "rol-uygun-degil");
  await db.doc("kullanicilar/yon").set({ rol: "yonetici" });
  await hataBekle("yönetici", () => kota.kotaDurumu("yon", {}, { cihazId: CIHAZ }), "rol-uygun-degil");
  await hataBekle("profilsiz", () => kota.kotaDurumu("yok", {}, { cihazId: CIHAZ }), "profil-yok");
  await db.doc("kullanicilar/eski").set({ eposta: "e@x.com" });
  esit("rolü olmayan eski hesap öğrenci sayılır", (await kota.kotaDurumu("eski", {}, { cihazId: CIHAZ })).sinir, 3);
  await hataBekle("cihaz yok", () => kota.kotaDurumu("ogr", {}, {}), "cihaz-gecersiz");
  await hataBekle("cihaz kısa", () => kota.kotaDurumu("ogr", {}, { cihazId: "abc" }), "cihaz-gecersiz");
  await hataBekle("cihaz özel karakter", () => kota.kotaDurumu("ogr", {}, { cihazId: "../../x/y/z" }), "cihaz-gecersiz");
  await hataBekle("cihaz nesne", () => kota.kotaDurumu("ogr", {}, { cihazId: { a: 1 } }), "cihaz-gecersiz");
  await hataBekle("girdi yok", () => kota.kotaDurumu("ogr", {}, undefined), "cihaz-gecersiz");

  // Saf yardımcılar
  esit("türkiye günü gece yarısı", kota.turkiyeGunu(Date.UTC(2026, 10, 13, 21, 30)), "2026-11-14");
  esit("kalanHak", kota.kalanHak(3, 1, 2), 1);

  console.log(`[kota] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
