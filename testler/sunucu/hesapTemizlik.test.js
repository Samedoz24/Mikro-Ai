// Sunucu testi: functions/hesapTemizlik.js — silinen hesabın verisinin sunucuda temizlenmesi.
// Çalıştırma (proje kökünden):
//   firebase emulators:exec --project demo-mikro --only firestore,storage "node testler/sunucu/hesapTemizlik.test.js"

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-mikro";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Yalnızca emülatörde çalışır (FIRESTORE_EMULATOR_HOST yok)");
if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error("Storage emülatörü gerekli (FIREBASE_STORAGE_EMULATOR_HOST yok)");

const path = require("path");
const FN = path.resolve(__dirname, "..", "..", "functions");
const al = (m) => require(require.resolve(m, { paths: [FN] }));
const { initializeApp } = al("firebase-admin/app");
const { getFirestore, FieldValue } = al("firebase-admin/firestore");
const { getStorage } = al("firebase-admin/storage");
initializeApp({ projectId: process.env.GCLOUD_PROJECT, storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com` });
const db = getFirestore();
const kova = getStorage().bucket();
const { silinenHesabiTemizle } = require(path.join(FN, "hesapTemizlik.js"));

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};
const varMi = async (yol) => (await db.doc(yol).get()).exists;
const dosyaVarMi = async (yol) => (await kova.file(yol).exists())[0];
const dosyaYaz = (yol) => kova.file(yol).save(Buffer.from("x"), { contentType: "image/jpeg" });

const A = "ogrenciA";
const AB = "ogrenciAB"; // önek çakışması denetimi: A silinirken AB'ye dokunulmamalı
const B = "ogrenciB";
const V = "veliV";
const Y = "yoneticiY";
const K = "kurumK";
const G = "GRUPABCD";
const KURBAN_EPOSTA = "kurban@ornek.com";

const kur = async () => {
  await db.doc(`kurumlar/${K}`).set({ ad: "Deneme", durum: "aktif", koltuk: 10, uyeSayisi: 2 });
  await db.doc(`kurumlar/${K}/uyeler/${A}`).set({ uid: A, grupId: G, oncekiPremium: false });
  await db.doc(`kurumlar/${K}/ozet/${A}`).set({ isim: "A", grupId: G, toplamSoru: 2 });
  await db.doc(`kurumlar/${K}/gruplar/${G}`).set({ ad: "9-A" });
  await db.doc(`kurumlar/${K}/gruplar/${G}/ozet/${A}`).set({ isim: "A", grupId: G });
  await db.doc(`kurumlar/${K}/uyeler/${B}`).set({ uid: B });
  await db.doc(`kurumlar/${K}/ozet/${B}`).set({ isim: "B" });

  await db.doc(`kullanicilar/${V}`).set({
    rol: "veli",
    bagliOgrenciIdleri: [A, B],
    bagliOgrenciler: [{ id: A, isim: "A" }, { id: B, isim: "B" }],
  });
  await db.doc("baglantiKodlari/KODAAA").set({ uid: A });
  await db.doc("baglantiKodlari/KODBBB").set({ uid: B });

  await db.doc("sorular/s1").set({ kullaniciUid: A, kullaniciEposta: "a@ornek.com" });
  await db.doc("sorular/s2").set({ kullaniciUid: A, kullaniciEposta: null }); // e-postasız soru
  await db.doc("sorular/s3").set({ kullaniciUid: B, kullaniciEposta: "b@ornek.com" });
  await db.doc("sorular/s4").set({ kullaniciUid: AB });

  for (const y of [
    `kullanicilar/${A}/sorular/1.jpg`,
    `cozumDetayi/${A}/1.json`,
    `solution-cards/${A}/1.png`,
    `profil_fotograflari/${A}.jpg`,
    `kullanicilar/${AB}/sorular/1.jpg`,
    `cozumDetayi/${AB}/1.json`,
    `profil_fotograflari/${AB}.jpg`,
    `kullanicilar/${B}/sorular/1.jpg`,
    `cozumDetayi/${KURBAN_EPOSTA}/1.json`,
  ]) {
    await dosyaYaz(y);
  }
};

(async () => {
  await kur();

  // A'nın profili silindi; profilinde (istemcinin yazabildiği) başka birinin e-postası yazıyor olsa bile
  const sonuc = await silinenHesabiTemizle(A, { kurumId: K, rol: "ogrenci", eposta: KURBAN_EPOSTA });
  esit("sonuç", sonuc, { veli: 1, kod: 1, kurum: true, soru: 2 });

  // Dershane
  esit("üyelik silindi", await varMi(`kurumlar/${K}/uyeler/${A}`), false);
  esit("özet silindi", await varMi(`kurumlar/${K}/ozet/${A}`), false);
  esit("grup özeti silindi", await varMi(`kurumlar/${K}/gruplar/${G}/ozet/${A}`), false);
  esit("koltuk boşaldı", (await db.doc(`kurumlar/${K}`).get()).data().uyeSayisi, 1);
  esit("diğer öğrencinin üyeliği duruyor", await varMi(`kurumlar/${K}/uyeler/${B}`), true);
  esit("diğer öğrencinin özeti duruyor", await varMi(`kurumlar/${K}/ozet/${B}`), true);
  esit("grup duruyor", await varMi(`kurumlar/${K}/gruplar/${G}`), true);

  // Veli ve kod
  const veli = (await db.doc(`kullanicilar/${V}`).get()).data();
  esit("veli listesinden çıktı", veli.bagliOgrenciIdleri, [B]);
  esit("veli isim listesinden çıktı", veli.bagliOgrenciler, [{ id: B, isim: "B" }]);
  esit("A'nın kodu silindi", await varMi("baglantiKodlari/KODAAA"), false);
  esit("B'nin kodu duruyor", await varMi("baglantiKodlari/KODBBB"), true);

  // Sorular
  esit("A'nın sorusu silindi", await varMi("sorular/s1"), false);
  esit("A'nın e-postasız sorusu silindi", await varMi("sorular/s2"), false);
  esit("B'nin sorusu duruyor", await varMi("sorular/s3"), true);
  esit("AB'nin sorusu duruyor", await varMi("sorular/s4"), true);

  // Storage
  esit("A soru fotoğrafı silindi", await dosyaVarMi(`kullanicilar/${A}/sorular/1.jpg`), false);
  esit("A çözüm dosyası silindi", await dosyaVarMi(`cozumDetayi/${A}/1.json`), false);
  esit("A çözüm kartı silindi", await dosyaVarMi(`solution-cards/${A}/1.png`), false);
  esit("A profil fotoğrafı silindi", await dosyaVarMi(`profil_fotograflari/${A}.jpg`), false);
  esit("AB soru fotoğrafı duruyor (önek)", await dosyaVarMi(`kullanicilar/${AB}/sorular/1.jpg`), true);
  esit("AB çözüm dosyası duruyor (önek)", await dosyaVarMi(`cozumDetayi/${AB}/1.json`), true);
  esit("AB profil fotoğrafı duruyor", await dosyaVarMi(`profil_fotograflari/${AB}.jpg`), true);
  esit("B dosyası duruyor", await dosyaVarMi(`kullanicilar/${B}/sorular/1.jpg`), true);
  esit("profildeki sahte e-postanın klasörü DURUYOR", await dosyaVarMi(`cozumDetayi/${KURBAN_EPOSTA}/1.json`), true);

  // Tekrar çalıştırma: hata yok, değişiklik yok
  const ikinci = await silinenHesabiTemizle(A, { kurumId: K, rol: "ogrenci" });
  esit("ikinci çalıştırma", ikinci, { veli: 0, kod: 0, kurum: false, soru: 0 });
  esit("koltuk tekrar düşmedi", (await db.doc(`kurumlar/${K}`).get()).data().uyeSayisi, 1);

  // Yönetici hesabı: dershane kayıtlarına dokunulmaz
  await db.doc(`kurumlar/${K}/uyeler/${Y}`).set({ uid: Y });
  const yon = await silinenHesabiTemizle(Y, { kurumId: K, rol: "yonetici" });
  esit("yönetici: dershane sonlandırılmadı", yon.kurum, false);
  esit("yönetici: kayıt yerinde", await varMi(`kurumlar/${K}/uyeler/${Y}`), true);
  esit("yönetici: koltuk değişmedi", (await db.doc(`kurumlar/${K}`).get()).data().uyeSayisi, 1);

  // Geçersiz kimlik: hiçbir şey yapılmaz
  esit("geçersiz kimlik (../)", await silinenHesabiTemizle("../ogrenciB", {}), null);
  esit("geçersiz kimlik (boş)", await silinenHesabiTemizle("", {}), null);
  esit("geçersiz kimlik (eğik çizgi)", await silinenHesabiTemizle("a/b", {}), null);
  esit("B hâlâ yerinde", await varMi("sorular/s3"), true);

  // Profilde kurumId yoksa (dershanesiz öğrenci) dershaneye dokunulmaz
  await db.doc(`kurumlar/${K}/uyeler/ogrenciC`).set({ uid: "ogrenciC" });
  const c = await silinenHesabiTemizle("ogrenciC", { rol: "ogrenci" });
  esit("dershanesiz: kurum false", c.kurum, false);
  esit("dershanesiz: başka kurum kaydına dokunulmadı", await varMi(`kurumlar/${K}/uyeler/ogrenciC`), true);

  await db.doc(`kurumlar/${K}`).update({ kontrol: FieldValue.delete() });
  console.log(`[hesapTemizlik] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
