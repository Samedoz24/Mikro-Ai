// Sunucu testi: functions/kota.js — "İnceleme Gerekli" sorularında öğrenci kararı ve soru hakkı iadesi.
// Çalıştırma (proje kökünden):
//   firebase emulators:exec --project demo-mikro --only firestore,auth,storage "node testler/sunucu/kotaIade.test.js"
//
// Denenenler: soruGonder iade kaydını (uid, cihaz özeti, gün) istemciye kapalı kotaKayitlari'na yazar ve soru
// belgesine cihaz bilgisi koymaz; inceleme kararını yalnızca sorunun sahibi ve yalnızca "İnceleme Gerekli" iken
// verebilir; "devam" iade yapmaz; "iptal" soruyu "İptal Edildi" yapar ve hakkı aynı gün içinde BİR KEZ iade eder;
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

  const hataKodu = async (fn) => {
    try {
      await fn();
      return "hata-yok";
    } catch (e) {
      return e?.message;
    }
  };
  const soruDurumu = async (id) => (await db.doc(`sorular/${id}`).get()).data();
  const incelemeSorusu = async (id, uid, kayitGunu, sayac = 1) => {
    await db.doc(`sorular/${id}`).set({ kullaniciUid: uid, durum: "İnceleme Gerekli", tarih: new Date(simdi).toISOString() });
    if (kayitGunu) await db.doc(`kotaKayitlari/${id}`).set({ uid, cihaz: `oz_${uid}`, gun: kayitGunu });
    await db.doc(`kotaSayaclari/h_${uid}`).set({ gun, sayi: sayac });
    await db.doc(`kotaSayaclari/c_oz_${uid}`).set({ gun, sayi: sayac });
  };

  // ================================================================ 1) soruGonder iade kaydı yazar
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

  // ================================================================ 2) girdi ve yetki kontrolleri
  esit("biçimsiz soru kimliği", await hataKodu(() => kota.soruIncelemeKarari("ogrA", { soruId: "../x", karar: "iptal" }, simdi)), "soru-gecersiz");
  esit("geçersiz karar", await hataKodu(() => kota.soruIncelemeKarari("ogrA", { soruId: sonuc.soruId, karar: "sil" }, simdi)), "karar-gecersiz");
  esit("olmayan soru", await hataKodu(() => kota.soruIncelemeKarari("ogrA", { soruId: "yokboyle", karar: "iptal" }, simdi)), "soru-yok");
  esit("Bekliyor durumunda karar verilemez", await hataKodu(() => kota.soruIncelemeKarari("ogrA", { soruId: sonuc.soruId, karar: "iptal" }, simdi)), "durum-uygun-degil");
  esit("reddedilen kararda sayaç değişmez", [await sayi("h_ogrA"), await sayi(cihazId)], [1, 1]);

  // Asıl soru incelemeye düşer (çözüm akışı yazar)
  await db.doc(`sorular/${sonuc.soruId}`).update({ durum: "İnceleme Gerekli" });
  esit("başkasının sorusu: aynı cevap (soru-yok)", await hataKodu(() => kota.soruIncelemeKarari("baskaOgr", { soruId: sonuc.soruId, karar: "iptal" }, simdi)), "soru-yok");
  esit("başkası iptal edemedi: durum aynı", (await soruDurumu(sonuc.soruId)).durum, "İnceleme Gerekli");

  // ================================================================ 3) çözmeye devam: iade yok, durum aynı
  esit("devam", await kota.soruIncelemeKarari("ogrA", { soruId: sonuc.soruId, karar: "devam" }, simdi), { durum: "İnceleme Gerekli" });
  esit("devam: karar kaydedildi, durum aynı", [(await soruDurumu(sonuc.soruId)).kullaniciKarari, (await soruDurumu(sonuc.soruId)).durum], ["devam", "İnceleme Gerekli"]);
  esit("devam: sayaçlar değişmedi", [await sayi("h_ogrA"), await sayi(cihazId)], [1, 1]);

  // ================================================================ 4) devamdan sonra iptal: iade (aynı gün, bir kez)
  esit("iptal", await kota.soruIncelemeKarari("ogrA", { soruId: sonuc.soruId, karar: "iptal" }, simdi), { durum: "İptal Edildi", iade: "iade-edildi" });
  const iptalSoru = await soruDurumu(sonuc.soruId);
  esit("iptal: durum, karar, iade işareti", [iptalSoru.durum, iptalSoru.kullaniciKarari, iptalSoru.hakIadeEdildi], ["İptal Edildi", "iptal", true]);
  esit("iptal: sayaçlar 0", [await sayi("h_ogrA"), await sayi(cihazId)], [0, 0]);
  esit("ikinci iptal yapılamaz", await hataKodu(() => kota.soruIncelemeKarari("ogrA", { soruId: sonuc.soruId, karar: "iptal" }, simdi)), "durum-uygun-degil");
  esit("iptal sonrası devam yapılamaz", await hataKodu(() => kota.soruIncelemeKarari("ogrA", { soruId: sonuc.soruId, karar: "devam" }, simdi)), "durum-uygun-degil");
  esit("tekrarlarda sayaç değişmez", [await sayi("h_ogrA"), await sayi(cihazId)], [0, 0]);
  // Çözüm akışı soruyu yeniden incelemeye alsa bile iade bir daha yapılmaz (kayıt işaretli)
  await db.doc(`sorular/${sonuc.soruId}`).update({ durum: "İnceleme Gerekli" });
  await db.doc("kotaSayaclari/h_ogrA").set({ gun, sayi: 1 });
  esit("aynı soru tekrar incelemeye düşse de ikinci iade yok", (await kota.soruIncelemeKarari("ogrA", { soruId: sonuc.soruId, karar: "iptal" }, simdi)).iade, "zaten-iade");
  esit("ikinci iade yapılmadı", await sayi("h_ogrA"), 1);

  // ================================================================ 5) ertesi gün iptal: soru iptal, hak iade edilmez
  await incelemeSorusu("dun1", "ogrC", kota.turkiyeGunu(simdi - GUN_MS), 2);
  esit("dünkü soru: gün geçti", (await kota.soruIncelemeKarari("ogrC", { soruId: "dun1", karar: "iptal" }, simdi)).iade, "gun-gecti");
  esit("dünkü soru iptal edildi, iade işareti false", [(await soruDurumu("dun1")).durum, (await soruDurumu("dun1")).hakIadeEdildi], ["İptal Edildi", false]);
  esit("bugünün sayacına dokunulmaz", [await sayi("h_ogrC"), await sayi("c_oz_ogrC")], [2, 2]);

  // ================================================================ 6) sayaç sıfırsa eksiye düşmez; başka günün sayacına dokunulmaz
  await incelemeSorusu("sifir1", "ogrB", gun, 0);
  await kota.soruIncelemeKarari("ogrB", { soruId: "sifir1", karar: "iptal" }, simdi);
  esit("sıfır sayaç eksiye düşmez", [await sayi("h_ogrB"), await sayi("c_oz_ogrB")], [0, 0]);
  await incelemeSorusu("esik1", "ogrD", gun, 3);
  await db.doc("kotaSayaclari/h_ogrD").set({ gun: kota.turkiyeGunu(simdi - GUN_MS), sayi: 3 });
  await kota.soruIncelemeKarari("ogrD", { soruId: "esik1", karar: "iptal" }, simdi);
  esit("başka güne ait hesap sayacı değişmez, bugünkü cihaz sayacı azalır", [await sayi("h_ogrD"), await sayi("c_oz_ogrD")], [3, 2]);

  // ================================================================ 7) iade kaydı olmayan (eski) soru: iptal edilir, iade yok
  await incelemeSorusu("eskiSoru", "ogrG", null, 1);
  esit("kayıtsız soru: iptal, iade yok", (await kota.soruIncelemeKarari("ogrG", { soruId: "eskiSoru", karar: "iptal" }, simdi)).iade, "kayit-yok");
  esit("kayıtsız soru: sayaç değişmez", await sayi("h_ogrG"), 1);

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
