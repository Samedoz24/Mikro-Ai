// Sunucu testi: functions/goc.js — eski (yalnızca e-postayla sahiplenilmiş) sorulara kimlik ekleme.
// Çalıştırma (proje kökünden):
//   firebase emulators:exec --project demo-mikro --only firestore,auth "node testler/sunucu/goc.test.js"

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-mikro";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Firestore emülatörü gerekli");
if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("Auth emülatörü gerekli");

const path = require("path");
const FN = path.resolve(__dirname, "..", "..", "functions");
const al = (m) => require(require.resolve(m, { paths: [FN] }));
const { initializeApp } = al("firebase-admin/app");
const { getFirestore } = al("firebase-admin/firestore");
const { getAuth } = al("firebase-admin/auth");
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();
const goc = require(path.join(FN, "goc.js"));

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};
const uidi = async (id) => (await db.doc(`sorular/${id}`).get()).data().kullaniciUid;
const iso = (ms) => new Date(ms).toISOString();
const DK = 60 * 1000;

(async () => {
  // Aynı emülatörde önce çalışan testlerin bıraktığı veri temizlenir (test bağımsız olsun)
  for (const d of (await db.collection("sorular").get()).docs) await d.ref.delete();
  await db.doc("ayarlar/goc").delete();
  for (const k of (await getAuth().listUsers()).users) {
    if (["ayse@ornek.com", "baskasi@ornek.com"].includes(k.email)) await getAuth().deleteUser(k.uid);
  }

  const a = await getAuth().createUser({ email: "ayse@ornek.com", password: "sifre12345" });
  const b = await getAuth().createUser({ email: "baskasi@ornek.com", password: "sifre12345" });
  const olusturma = Date.parse(a.metadata.creationTime);

  await db.doc("sorular/sonra").set({ kullaniciEposta: "ayse@ornek.com", tarih: iso(olusturma + 5 * DK) });
  await db.doc("sorular/buyukHarf").set({ kullaniciEposta: "  AYSE@Ornek.com ", tarih: iso(olusturma + 6 * DK) });
  await db.doc("sorular/payIcinde").set({ kullaniciEposta: "ayse@ornek.com", tarih: iso(olusturma - 5 * DK) });
  await db.doc("sorular/hesaptanOnce").set({ kullaniciEposta: "ayse@ornek.com", tarih: iso(olusturma - 2 * 24 * 60 * DK) });
  await db.doc("sorular/tarihsiz").set({ kullaniciEposta: "ayse@ornek.com" });
  await db.doc("sorular/bozukTarih").set({ kullaniciEposta: "ayse@ornek.com", tarih: "dun" });
  await db.doc("sorular/hesapYok").set({ kullaniciEposta: "silinmis@ornek.com", tarih: iso(Date.now()) });
  await db.doc("sorular/epostasiz").set({ tarih: iso(Date.now()) });
  await db.doc("sorular/zatenVar").set({ kullaniciEposta: "ayse@ornek.com", kullaniciUid: b.uid, tarih: iso(Date.now()) });
  await db.doc("sorular/gecersizEposta").set({ kullaniciEposta: "bu-eposta-degil", tarih: iso(Date.now()) });

  const sonuc = await goc.eskiSorularaKimlikEkle();
  esit("sonuç", sonuc, { eklenen: 3, sahipsiz: 6 });

  esit("hesaptan sonra sorulan → kimlik yazıldı", await uidi("sonra"), a.uid);
  esit("büyük harf/boşluklu e-posta eşleşti", await uidi("buyukHarf"), a.uid);
  esit("saat payı içinde (5 dk önce) eşleşti", await uidi("payIcinde"), a.uid);
  esit("HESAPTAN ÖNCE sorulan soru VERİLMEDİ", await uidi("hesaptanOnce"), undefined);
  esit("tarihsiz soru verilmedi", await uidi("tarihsiz"), undefined);
  esit("bozuk tarihli soru verilmedi", await uidi("bozukTarih"), undefined);
  esit("hesabı olmayan e-posta: sahipsiz", await uidi("hesapYok"), undefined);
  esit("e-postasız: sahipsiz", await uidi("epostasiz"), undefined);
  esit("geçersiz e-posta: sahipsiz (hata yok)", await uidi("gecersizEposta"), undefined);
  esit("var olan kimlik DEĞİŞTİRİLMEDİ", await uidi("zatenVar"), b.uid);

  const bayrak = (await db.doc("ayarlar/goc").get()).data();
  esit("bayrak kondu", bayrak.eskiSorularKimlik, true);
  esit("ikinci çalıştırma atlanır", await goc.eskiSorularaKimlikEkle(), { atlandi: true });

  // Saf karar fonksiyonu
  const h = { uid: "u", olusturmaMs: 1_000_000 };
  esit("karar: sonra", goc.kimlikYazilabilirMi(1_000_001, h), true);
  esit("karar: payın sınırı", goc.kimlikYazilabilirMi(1_000_000 - goc.SAAT_PAYI_MS, h), true);
  esit("karar: payın 1 ms dışı", goc.kimlikYazilabilirMi(1_000_000 - goc.SAAT_PAYI_MS - 1, h), false);
  esit("karar: hesap yok", goc.kimlikYazilabilirMi(5, null), false);
  esit("karar: zaman yok", goc.kimlikYazilabilirMi(null, h), false);

  console.log(`[goc] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
