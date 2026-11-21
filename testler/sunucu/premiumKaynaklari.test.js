// Sunucu testi: premium kaynakları (functions/premium.js) — dershane akışları, kota, eski kayıtların taşınması.
// Çalıştırma (proje kökünden):
//   firebase emulators:exec --project demo-mikro --only firestore "node testler/sunucu/premiumKaynaklari.test.js"

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-mikro";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Yalnızca emülatörde çalışır (FIRESTORE_EMULATOR_HOST yok)");

const path = require("path");
const FN = path.resolve(__dirname, "..", "..", "functions");
const al = (m) => require(require.resolve(m, { paths: [FN] }));
const { initializeApp } = al("firebase-admin/app");
const { getFirestore, Timestamp } = al("firebase-admin/firestore");
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();
const premium = require(path.join(FN, "premium.js"));
const kurum = require(path.join(FN, "kurum.js"));
const kota = require(path.join(FN, "kota.js"));
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
const profil = async (uid) => (await db.doc(`kullanicilar/${uid}`).get()).data();
const kaynaklar = async (uid) => (await profil(uid)).premiumKaynaklari;
const GUN = 86400000;
const gelecek = Timestamp.fromMillis(Date.now() + 30 * GUN);
const gecmis = Timestamp.fromMillis(Date.now() - GUN);
const K = "kurumPRM";
const KOD = "PRMKOD23";
const CIHAZ = "A1B2C3D4-E5F6-7890-ABCD-EF1234567890";

const kurumKur = async () => {
  await db.doc(`kurumlar/${K}`).set({
    ad: "Premium Test", kurumKodu: KOD, koltuk: 50, uyeSayisi: 0, durum: "aktif",
    lisansBitis: Timestamp.fromMillis(Date.now() + 100 * GUN),
  });
};

(async () => {
  for (const k of ["kullanicilar", "kurumlar", "kurumDenemeleri", "ayarlar", "kotaSayaclari"]) {
    for (const d of (await db.collection(k).get()).docs) await d.ref.delete();
  }

  // ------------------------------------------------ saf mantık
  esit("boş kaynak", premium.premiumHesapla({}), false);
  esit("kurum", premium.premiumHesapla({ kurum: true }), true);
  esit("elle", premium.premiumHesapla({ elle: true }), true);
  esit("geçerli abonelik", premium.premiumHesapla({ abonelik: { aktif: true, bitis: gelecek } }), true);
  esit("süresi geçmiş abonelik", premium.premiumHesapla({ abonelik: { aktif: true, bitis: gecmis } }), false);
  esit("bitişsiz abonelik geçersiz", premium.premiumHesapla({ abonelik: { aktif: true } }), false);
  esit("aktif değil", premium.premiumHesapla({ abonelik: { aktif: false, bitis: gelecek } }), false);
  esit("kurum: 'true' metni sayılmaz", premium.premiumHesapla({ kurum: "true" }), false);
  esit("eski kayıt (kaynaksız) premium", premium.premiumDurumu({ premiumMu: true }), true);
  esit("kaynak varken eski alan yok sayılır", premium.premiumDurumu({ premiumMu: true, premiumKaynaklari: {} }), false);

  // ------------------------------------------------ dershanedeyken abonelik → ayrılınca KORUNUR
  await kurumKur();
  await db.doc("kullanicilar/abone").set({ rol: "ogrenci", premiumMu: true, premiumKaynaklari: { abonelik: { aktif: true, bitis: gelecek, urun: "aylik" } } });
  await kurum.kurumaKatil("abone", { kod: KOD, onay: true });
  esit("abone katıldı: iki kaynak", Object.keys(await kaynaklar("abone")).sort(), ["abonelik", "kurum"]);
  esit("abone katıldı: premium", (await profil("abone")).premiumMu, true);
  await kurum.kurumdanAyril("abone");
  esit("abone ayrıldı: ABONELİK KORUNDU", Object.keys(await kaynaklar("abone")), ["abonelik"]);
  esit("abone ayrıldı: premium devam", (await profil("abone")).premiumMu, true);

  // ------------------------------------------------ premium'suz öğrenci
  await db.doc("kullanicilar/sade").set({ rol: "ogrenci" });
  await kurum.kurumaKatil("sade", { kod: KOD, onay: true });
  esit("sade katıldı: premium", (await profil("sade")).premiumMu, true);
  esit("sade katıldı: kurum kaynağı", await kaynaklar("sade"), { kurum: true });
  await kurum.kurumdanAyril("sade");
  esit("sade ayrıldı: premium kapandı", (await profil("sade")).premiumMu, false);
  esit("sade ayrıldı: kaynak alanı kaldırıldı", await kaynaklar("sade"), undefined);

  // ------------------------------------------------ eski yapıda elle premium (dershanesiz) → katılıp ayrılır
  await db.doc("kullanicilar/eskiElle").set({ rol: "ogrenci", premiumMu: true });
  await kurum.kurumaKatil("eskiElle", { kod: KOD, onay: true });
  esit("eski elle katıldı", await kaynaklar("eskiElle"), { elle: true, kurum: true });
  await kurum.kurumdanAyril("eskiElle");
  esit("eski elle ayrıldı: elle korundu", await kaynaklar("eskiElle"), { elle: true });
  esit("eski elle ayrıldı: premium", (await profil("eskiElle")).premiumMu, true);

  // ------------------------------------------------ ESKİ KODLA katılmış üyeler (kaynaksız) ayrılır
  await db.doc("kullanicilar/eskiUye").set({ rol: "ogrenci", premiumMu: true, kurumId: K });
  await db.doc(`kurumlar/${K}/uyeler/eskiUye`).set({ uid: "eskiUye", oncekiPremium: false });
  await kurum.kurumdanAyril("eskiUye");
  esit("eski üye (önceden premium değil) ayrıldı: kapandı", (await profil("eskiUye")).premiumMu, false);

  await db.doc("kullanicilar/eskiUye2").set({ rol: "ogrenci", premiumMu: true, kurumId: K });
  await db.doc(`kurumlar/${K}/uyeler/eskiUye2`).set({ uid: "eskiUye2", oncekiPremium: true });
  await kurum.kurumdanAyril("eskiUye2");
  esit("eski üye (önceden premium) ayrıldı: korundu", (await profil("eskiUye2")).premiumMu, true);
  esit("eski üye (önceden premium) ayrıldı: elle kaynağı", await kaynaklar("eskiUye2"), { elle: true });

  // ------------------------------------------------ dershane kapanır
  await db.doc("kullanicilar/kapanisAbone").set({ rol: "ogrenci", premiumKaynaklari: { abonelik: { aktif: true, bitis: gelecek } }, premiumMu: true });
  await db.doc("kullanicilar/kapanisSade").set({ rol: "ogrenci" });
  await kurum.kurumaKatil("kapanisAbone", { kod: KOD, onay: true });
  await kurum.kurumaKatil("kapanisSade", { kod: KOD, onay: true });
  await kurum.kurumuKapat(K);
  esit("kapanış: abonelik korundu", Object.keys(await kaynaklar("kapanisAbone")), ["abonelik"]);
  esit("kapanış: abone premium devam", (await profil("kapanisAbone")).premiumMu, true);
  esit("kapanış: sade premium kapandı", (await profil("kapanisSade")).premiumMu, false);

  // ------------------------------------------------ kota: bitiş tarihine bakılır
  await db.doc("kullanicilar/kotaGecerli").set({ rol: "ogrenci", premiumMu: true, premiumKaynaklari: { abonelik: { aktif: true, bitis: gelecek } } });
  await db.doc("kullanicilar/kotaBitmis").set({ rol: "ogrenci", premiumMu: true, premiumKaynaklari: { abonelik: { aktif: true, bitis: gecmis } } });
  await db.doc("kullanicilar/kotaEski").set({ rol: "ogrenci", premiumMu: true });
  esit("kota: geçerli abonelik = premium sınırı", (await kota.kotaDurumu("kotaGecerli", {}, { cihazId: CIHAZ })).sinir, 50);
  esit("kota: BİTMİŞ abonelik (premiumMu eskimiş olsa da) = ücretsiz sınır", (await kota.kotaDurumu("kotaBitmis", {}, { cihazId: CIHAZ })).sinir, 3);
  esit("kota: bitmiş abonelik premiumMu false döner", (await kota.kotaDurumu("kotaBitmis", {}, { cihazId: CIHAZ })).premiumMu, false);
  esit("kota: eski kayıt (kaynaksız) premium", (await kota.kotaDurumu("kotaEski", {}, { cihazId: CIHAZ })).sinir, 50);

  // ------------------------------------------------ eski kayıtların taşınması
  for (const k of ["kullanicilar", "ayarlar"]) for (const d of (await db.collection(k).get()).docs) await d.ref.delete();
  await kurumKur();
  await db.doc("kullanicilar/g1").set({ rol: "ogrenci", premiumMu: true }); // dershanesiz → elle
  await db.doc("kullanicilar/g2").set({ rol: "ogrenci", premiumMu: true, kurumId: K }); // üye, önceden yok → kurum
  await db.doc(`kurumlar/${K}/uyeler/g2`).set({ uid: "g2", oncekiPremium: false });
  await db.doc("kullanicilar/g3").set({ rol: "ogrenci", premiumMu: true, kurumId: K }); // üye, önceden premium → kurum+elle
  await db.doc(`kurumlar/${K}/uyeler/g3`).set({ uid: "g3", oncekiPremium: true });
  await db.doc("kullanicilar/g4").set({ rol: "ogrenci", premiumMu: true, kurumId: "yokKurum" }); // üyelik kaydı yok → elle (kaybettirilmez)
  await db.doc("kullanicilar/g5").set({ rol: "ogrenci", premiumMu: false }); // dokunulmaz
  await db.doc("kullanicilar/g6").set({ rol: "ogrenci", premiumMu: true, premiumKaynaklari: { abonelik: { aktif: true, bitis: gelecek } } }); // dokunulmaz
  esit("taşıma sonucu", await goc.premiumKaynaklariniTasi(), { tasinan: 4 });
  esit("g1 → elle", await kaynaklar("g1"), { elle: true });
  esit("g2 → kurum", await kaynaklar("g2"), { kurum: true });
  esit("g3 → kurum + elle", await kaynaklar("g3"), { kurum: true, elle: true });
  esit("g4 → elle (premium kaybettirilmez)", await kaynaklar("g4"), { elle: true });
  esit("g5 dokunulmadı", await kaynaklar("g5"), undefined);
  esit("g6 dokunulmadı", Object.keys(await kaynaklar("g6")), ["abonelik"]);
  esit("taşıma: premiumMu değişmedi", [(await profil("g1")).premiumMu, (await profil("g2")).premiumMu, (await profil("g5")).premiumMu], [true, true, false]);
  esit("ikinci taşıma atlanır", await goc.premiumKaynaklariniTasi(), { atlandi: true });

  console.log(`[premiumKaynaklari] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
