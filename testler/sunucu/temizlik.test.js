// Sunucu testi: functions/temizlik.js — sahipsiz veri raporu ve onaylı silme.
// Çalıştırma (proje kökünden):
//   firebase emulators:exec --project demo-mikro --only firestore,auth,storage "node testler/sunucu/temizlik.test.js"

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-mikro";
for (const d of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
  if (!process.env[d]) throw new Error(`Emülatör gerekli (${d} yok)`);
}

const path = require("path");
const FN = path.resolve(__dirname, "..", "..", "functions");
const al = (m) => require(require.resolve(m, { paths: [FN] }));
const { initializeApp } = al("firebase-admin/app");
const { getFirestore } = al("firebase-admin/firestore");
const { getAuth } = al("firebase-admin/auth");
const { getStorage } = al("firebase-admin/storage");
initializeApp({ projectId: process.env.GCLOUD_PROJECT, storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com` });
const db = getFirestore();
const kova = getStorage().bucket();
const temizlik = require(path.join(FN, "temizlik.js"));

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
const dosyaYaz = (yol) => kova.file(yol).save(Buffer.from("x"));
const iso = (ms) => new Date(ms).toISOString();

const S = "SILINMISKULLANICI0001"; // Firebase'de hesabı olmayan kimlik
const K = "kurumTEM";

(async () => {
  // Temiz başlangıç
  for (const k of ["kullanicilar", "sorular", "baglantiKodlari", "ayarlar", "kotaSayaclari"]) {
    for (const d of (await db.collection(k).get()).docs) await d.ref.delete();
  }
  for (const k of (await getAuth().listUsers()).users) await getAuth().deleteUser(k.uid);
  await db.recursiveDelete(db.collection("kurumlar")); // önceki testlerin dershane verisi
  await kova.deleteFiles({ force: true }).catch(() => {});

  const a = await getAuth().createUser({ email: "var@ornek.com", password: "sifre12345" });
  const A = a.uid;
  await getAuth().createUser({ email: "eski@ornek.com.tr", password: "sifre12345" }); // önek çakışması denetimi
  const olusturma = Date.parse(a.metadata.creationTime);

  await db.doc(`kullanicilar/${A}`).set({ rol: "ogrenci", kurumId: K });
  await db.doc(`kullanicilar/${S}`).set({ rol: "ogrenci", kurumId: K, eposta: "var@ornek.com" });
  await db.doc("baglantiKodlari/KODSSS").set({ uid: S });
  await db.doc("baglantiKodlari/KODAAA").set({ uid: A });
  await db.doc(`kotaSayaclari/h_${S}`).set({ sayi: 1 });

  await db.doc("sorular/aKimlik").set({ kullaniciUid: A, tarih: iso(Date.now()) });
  await db.doc("sorular/sKimlik").set({ kullaniciUid: S, kullaniciEposta: "var@ornek.com", tarih: iso(Date.now()) });
  await db.doc("sorular/eskiEposta").set({ kullaniciEposta: "eski@ornek.com", tarih: iso(Date.now() - 1e9) });
  await db.doc("sorular/varEpostaSonra").set({ kullaniciEposta: "var@ornek.com", tarih: iso(olusturma + 60000) });
  await db.doc("sorular/varEpostaOnce").set({ kullaniciEposta: "var@ornek.com", tarih: iso(olusturma - 30 * 86400000) });
  await db.doc("sorular/yeniEposta").set({ kullaniciEposta: "yeni@ornek.com", tarih: iso(Date.now() + 3600000) });

  await db.doc(`kurumlar/${K}`).set({ ad: "T", durum: "aktif", uyeSayisi: 2 });
  await db.doc(`kurumlar/${K}/uyeler/${A}`).set({ uid: A });
  await db.doc(`kurumlar/${K}/uyeler/${S}`).set({ uid: S });
  await db.doc(`kurumlar/${K}/ozet/${S}`).set({ isim: "S" });

  for (const y of [
    `kullanicilar/${S}/sorular/1.jpg`,
    `kullanicilar/${A}/sorular/1.jpg`,
    `cozumDetayi/${A}/1.json`,
    `cozumDetayi/${S}/1.json`,
    "cozumDetayi/eski@ornek.com/1.json",
    "cozumDetayi/eski@ornek.com.tr/1.json",
    "solution-cards/eski@ornek.com/1.png",
    "cozumDetayi/var@ornek.com/1.json",
    "cozumDetayi/yeni@ornek.com/1.json",
    "solution-cards/codex-test/1.png",
    `profil_fotograflari/${S}.jpg`,
    `profil_fotograflari/${A}.jpg`,
  ]) {
    await dosyaYaz(y);
  }

  // ---------------------------------------------------------------- 1) RAPOR
  const r1 = await temizlik.sahipsizVeriAdimi();
  esit("ilk adım rapor", r1.islem, "rapor");
  const belge = (await db.doc("ayarlar/temizlik").get()).data();
  esit("durum rapor-hazir", belge.durum, "rapor-hazir");
  esit("rapor: sahipsiz kimlikler", belge.rapor.kimlikler, [S]);
  esit("rapor: e-postalı sahipsiz sorular", belge.rapor.epostaSorulari, ["eskiEposta", "varEpostaOnce", "yeniEposta"]);
  esit("rapor: üyelikler", belge.rapor.uyelikler, [{ kurumId: K, uid: S }]);
  esit("rapor: e-posta klasörleri", belge.rapor.epostaKlasorleri, [
    "cozumDetayi/eski@ornek.com",
    "cozumDetayi/yeni@ornek.com",
    "solution-cards/eski@ornek.com",
  ]);
  esit("rapor: belirsiz klasör yalnızca raporlandı", belge.rapor.belirsizKlasorler, ["solution-cards/codex-test"]);

  // Rapor aşamasında HİÇBİR ŞEY silinmedi
  esit("rapor: profil duruyor", await varMi(`kullanicilar/${S}`), true);
  esit("rapor: soru duruyor", await varMi("sorular/eskiEposta"), true);
  esit("rapor: dosya duruyor", await dosyaVarMi("cozumDetayi/eski@ornek.com/1.json"), true);

  // Onaysız ikinci çalıştırma: bir şey yapmaz
  esit("onaysız: işlem yok", (await temizlik.sahipsizVeriAdimi()).islem, "yok");
  esit("onaysız: hâlâ duruyor", await varMi("sorular/eskiEposta"), true);

  // Rapordan sonra yeni@ornek.com ile hesap açıldı → o e-postanın verisi korunmalı
  await getAuth().createUser({ email: "yeni@ornek.com", password: "sifre12345" });

  // ---------------------------------------------------------------- 2) ONAYLI SİLME
  await db.doc("ayarlar/temizlik").update({ durum: "onaylandi" });
  const r2 = await temizlik.sahipsizVeriAdimi();
  esit("silme sonucu", r2.sonuc, { kimlik: 1, soru: 2, uyelik: 0, klasor: 2, atlanan: 2 });
  esit("durum tamamlandi", (await db.doc("ayarlar/temizlik").get()).data().durum, "tamamlandi");

  // Silinenler
  esit("sahipsiz profil silindi", await varMi(`kullanicilar/${S}`), false);
  esit("sahipsiz kod silindi", await varMi("baglantiKodlari/KODSSS"), false);
  esit("sahipsiz kota sayacı silindi", await varMi(`kotaSayaclari/h_${S}`), false);
  esit("sahipsiz kimlikli soru silindi", await varMi("sorular/sKimlik"), false);
  esit("e-postası hesapsız soru silindi", await varMi("sorular/eskiEposta"), false);
  esit("hesaptan önceki eski soru silindi", await varMi("sorular/varEpostaOnce"), false);
  esit("sahipsiz üyelik silindi", await varMi(`kurumlar/${K}/uyeler/${S}`), false);
  esit("sahipsiz özet silindi", await varMi(`kurumlar/${K}/ozet/${S}`), false);
  esit("koltuk düştü", (await db.doc(`kurumlar/${K}`).get()).data().uyeSayisi, 1);
  esit("sahipsiz kimlik klasörü silindi", await dosyaVarMi(`kullanicilar/${S}/sorular/1.jpg`), false);
  esit("sahipsiz çözüm (kimlik) silindi", await dosyaVarMi(`cozumDetayi/${S}/1.json`), false);
  esit("sahipsiz profil fotoğrafı silindi", await dosyaVarMi(`profil_fotograflari/${S}.jpg`), false);
  esit("sahipsiz e-posta klasörü silindi", await dosyaVarMi("cozumDetayi/eski@ornek.com/1.json"), false);
  esit("sahipsiz e-posta kart klasörü silindi", await dosyaVarMi("solution-cards/eski@ornek.com/1.png"), false);

  // Korunanlar
  esit("var olan profil korundu", await varMi(`kullanicilar/${A}`), true);
  esit("var olan kod korundu", await varMi("baglantiKodlari/KODAAA"), true);
  esit("var olan soru korundu", await varMi("sorular/aKimlik"), true);
  esit("hesaptan sonraki e-postalı soru korundu", await varMi("sorular/varEpostaSonra"), true);
  esit("RAPORDAN SONRA hesap açılan e-postanın sorusu korundu", await varMi("sorular/yeniEposta"), true);
  esit("RAPORDAN SONRA hesap açılan e-postanın klasörü korundu", await dosyaVarMi("cozumDetayi/yeni@ornek.com/1.json"), true);
  esit("var olan üyelik korundu", await varMi(`kurumlar/${K}/uyeler/${A}`), true);
  esit("var olan dosyalar korundu", await dosyaVarMi(`kullanicilar/${A}/sorular/1.jpg`), true);
  esit("var olan çözüm korundu", await dosyaVarMi(`cozumDetayi/${A}/1.json`), true);
  esit("var olanın e-posta klasörü korundu", await dosyaVarMi("cozumDetayi/var@ornek.com/1.json"), true);
  esit("var olanın profil fotoğrafı korundu", await dosyaVarMi(`profil_fotograflari/${A}.jpg`), true);
  esit("önek çakışması: eski@ornek.com.tr klasörü korundu", await dosyaVarMi("cozumDetayi/eski@ornek.com.tr/1.json"), true);
  esit("belirsiz klasör SİLİNMEDİ", await dosyaVarMi("solution-cards/codex-test/1.png"), true);

  // Tamamlandıktan sonra: bir şey yapmaz
  esit("tamamlandı: işlem yok", (await temizlik.sahipsizVeriAdimi()).islem, "yok");

  console.log(`[temizlik] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
