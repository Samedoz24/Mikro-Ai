// Sunucu testi: functions/kota.js — "İnceleme Gerekli" sorularında soru hakkı iadesi.
// Çalıştırma (proje kökünden):
//   firebase emulators:exec --project demo-mikro --only firestore,auth,storage "node testler/sunucu/kotaIade.test.js"
//
// Denenenler: soruGonder iade kaydını (uid, cihaz özeti, gün) istemciye kapalı kotaKayitlari'na yazar ve soru
// belgesine cihaz bilgisi koymaz; iade yalnızca "İnceleme Gerekli"ye YENİ geçişte, aynı gün içinde ve BİR KEZ yapılır;
// sayaç eksiye düşmez; başka güne ait sayaca dokunulmaz; eski kayıtlar ve silinen hesabın kayıtları silinir.

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-mikro";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Firestore emülatörü gerekli");
if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error("Storage emülatörü gerekli");

const path = require("path");
const FN = path.resolve(__dirname, "..", "..", "functions");
const al = (m) => require(require.resolve(m, { paths: [FN] }));
const { initializeApp } = al("firebase-admin/app");
const { getFirestore } = al("firebase-admin/firestore");
const { getStorage } = al("firebase-admin/storage");
initializeApp({ projectId: process.env.GCLOUD_PROJECT, storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com` });
const db = getFirestore();
const kova = getStorage().bucket();
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

const CIHAZ = "A1B2C3D4-E5F6-7890-ABCD-EF1234567890";
const GUN_MS = 24 * 60 * 60 * 1000;
const sayi = async (id) => (await db.doc(`kotaSayaclari/${id}`).get()).data()?.sayi ?? null;
const fotoYukle = (yol) =>
  kova.file(yol).save(Buffer.from("x"), {
    contentType: "image/jpeg",
    metadata: { metadata: { firebaseStorageDownloadTokens: "test-anahtar" } },
  });

const temizle = async () => {
  for (const k of ["kotaKayitlari", "kotaSayaclari", "sorular", "kullanicilar"]) {
    const snap = await db.collection(k).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
};

(async () => {
  await temizle();
  const simdi = Date.now();
  const gun = kota.turkiyeGunu(simdi);
  const cihazId = `c_${kota.cihazOzeti(CIHAZ)}`;

  // ================================================================ 1) iadeGerekirMi (saf)
  esit("Bekliyor → İnceleme Gerekli", kota.iadeGerekirMi({ durum: "Bekliyor" }, { durum: "İnceleme Gerekli" }), true);
  esit("İşleniyor → İnceleme Gerekli", kota.iadeGerekirMi({ durum: "İşleniyor" }, { durum: "İnceleme Gerekli" }), true);
  esit("zaten İnceleme Gerekli (başka alan değişti)", kota.iadeGerekirMi({ durum: "İnceleme Gerekli" }, { durum: "İnceleme Gerekli" }), false);
  esit("Çözüldü", kota.iadeGerekirMi({ durum: "Bekliyor" }, { durum: "Çözüldü" }), false);
  esit("silinen soru", kota.iadeGerekirMi({ durum: "Bekliyor" }, undefined), false);
  esit("yeni oluşturulan İnceleme Gerekli", kota.iadeGerekirMi(undefined, { durum: "İnceleme Gerekli" }), true);
  esit("benzer ama farklı metin iade vermez", kota.iadeGerekirMi({ durum: "Bekliyor" }, { durum: "inceleme gerekli" }), false);

  // ================================================================ 2) soruGonder iade kaydı yazar
  await db.doc("kullanicilar/ogrA").set({ rol: "ogrenci" });
  const foto = `kullanicilar/ogrA/sorular/${simdi}.jpg`;
  await fotoYukle(foto);
  const sonuc = await kota.soruGonder("ogrA", { email: "a@b.com" }, { fotoYolu: foto, ogrenciSecimi: "A", cihazId: CIHAZ }, simdi);
  const kayit = (await db.doc(`kotaKayitlari/${sonuc.soruId}`).get()).data();
  esit("iade kaydı: uid, cihaz özeti, gün", [kayit.uid, kayit.cihaz, kayit.gun], ["ogrA", kota.cihazOzeti(CIHAZ), gun]);
  esit("iade kaydında ham cihaz kimliği yok", JSON.stringify(kayit).includes(CIHAZ), false);
  const soru = (await db.doc(`sorular/${sonuc.soruId}`).get()).data();
  esit("soru belgesinde cihaz bilgisi yok", Object.keys(soru).some((k) => /cihaz/i.test(k)), false);
  esit("sayaçlar 1", [await sayi("h_ogrA"), await sayi(cihazId)], [1, 1]);

  // ================================================================ 3) aynı gün iade: bir kez
  esit("iade edildi", (await kota.kotaIadeEt(sonuc.soruId, simdi)).durum, "iade-edildi");
  esit("sayaçlar 0", [await sayi("h_ogrA"), await sayi(cihazId)], [0, 0]);
  esit("ikinci iade yapılmaz", (await kota.kotaIadeEt(sonuc.soruId, simdi)).durum, "zaten-iade");
  esit("sayaçlar hâlâ 0 (eksiye düşmez)", [await sayi("h_ogrA"), await sayi(cihazId)], [0, 0]);

  // ================================================================ 4) sayaç zaten 0 ise eksiye düşmez
  await db.doc("kotaKayitlari/sifir1").set({ uid: "ogrB", cihaz: "ozetB", gun });
  await db.doc("kotaSayaclari/h_ogrB").set({ gun, sayi: 0 });
  esit("sıfır sayaç: iade kaydı işlenir", (await kota.kotaIadeEt("sifir1", simdi)).durum, "iade-edildi");
  esit("sıfır sayaç eksiye düşmez", await sayi("h_ogrB"), 0);

  // ================================================================ 5) ertesi gün iade yapılmaz
  await db.doc("kotaKayitlari/dun1").set({ uid: "ogrC", cihaz: "ozetC", gun: kota.turkiyeGunu(simdi - GUN_MS) });
  await db.doc("kotaSayaclari/h_ogrC").set({ gun, sayi: 2 }); // bugünün sayacı
  esit("dünkü soru: gün geçti", (await kota.kotaIadeEt("dun1", simdi)).durum, "gun-gecti");
  esit("bugünün sayacına dokunulmaz", await sayi("h_ogrC"), 2);
  esit("gün geçen kayıt tekrar denenmez", (await kota.kotaIadeEt("dun1", simdi)).durum, "zaten-iade");

  // ================================================================ 6) sayaç başka güne aitse dokunulmaz
  await db.doc("kotaKayitlari/esik1").set({ uid: "ogrD", cihaz: "ozetD", gun });
  await db.doc("kotaSayaclari/h_ogrD").set({ gun: kota.turkiyeGunu(simdi - GUN_MS), sayi: 3 });
  await kota.kotaIadeEt("esik1", simdi);
  esit("başka güne ait sayaç değişmez", await sayi("h_ogrD"), 3);

  // ================================================================ 7) geçersiz / olmayan kayıt
  esit("olmayan kayıt", (await kota.kotaIadeEt("yokboyle", simdi)).durum, "kayit-yok");
  esit("biçimsiz soru kimliği", (await kota.kotaIadeEt("../kotaSayaclari/h_ogrA", simdi)).durum, "kayit-yok");

  // ================================================================ 8) temizlik
  await db.doc("kotaKayitlari/eski2").set({ uid: "ogrE", cihaz: "x", gun: kota.turkiyeGunu(simdi - 3 * GUN_MS) });
  await db.doc("kotaKayitlari/bugun2").set({ uid: "ogrE", cihaz: "x", gun });
  const silinenEski = await kota.eskiKotaKayitlariniSil(simdi);
  esit("eski kayıtlar silindi (dun1 + eski2)", silinenEski, 2);
  esit("bugünkü kayıt kaldı", (await db.doc("kotaKayitlari/bugun2").get()).exists, true);
  await db.doc("kotaKayitlari/baskasi").set({ uid: "ogrF", cihaz: "x", gun });
  await kota.kotaKayitlariniSil("ogrE");
  esit("silinen hesabın kayıtları silindi", (await db.doc("kotaKayitlari/bugun2").get()).exists, false);
  esit("başkasının kaydına dokunulmadı", (await db.doc("kotaKayitlari/baskasi").get()).exists, true);

  await temizle();
  console.log(`[kotaIade] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
