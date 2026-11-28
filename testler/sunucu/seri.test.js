// Sunucu testi (28 Kasım): seri yalnızca soru gönderilince ve yalnızca sunucuda (functions/kota.js soruGonder).
// Denenenler: ilk soru 1; aynı gün ikinci soru ve tekrar istek değiştirmez; ertesi gün +1; gün atlanınca 1;
// profildeki (istemcinin/eski sürümün yazdığı) seri yok sayılır, yalnızca istemciye kapalı seriSayaclari'na
// güvenilir; aynı anda iki soru seriyi bir kez artırır (transaction); iptal + iade seriyi geri almaz;
// hesap silme seri kaydını siler; gösterim kopyası (seriGunu, sonSoruGunu) yazılır.
// Çalıştırma: firebase emulators:exec --project demo-mikro --only firestore,storage "node testler/sunucu/seri.test.js"

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
let fotoSirasi = 0;
// Her çağrıda yeni fotoğraf (aynı fotoğraf = aynı soru tekrarı)
const yeniFoto = async (uid, ms) => {
  const yol = `kullanicilar/${uid}/sorular/${ms + ++fotoSirasi}.jpg`;
  await kova.file(yol).save(Buffer.from("x"), {
    contentType: "image/jpeg",
    metadata: { metadata: { firebaseStorageDownloadTokens: "test-anahtar" } },
  });
  return yol;
};
const gonder = (uid, yol, ms, cihaz = CIHAZ) =>
  kota.soruGonder(uid, { email: `${uid}@ornek.com` }, { fotoYolu: yol, ogrenciSecimi: "A", cihazId: cihaz }, ms);
const seriKaydi = async (uid) => {
  const d = (await db.doc(`seriSayaclari/${uid}`).get()).data();
  return d ? { seri: d.seri, sonGun: d.sonGun } : null;
};
const profilSeri = async (uid) => {
  const d = (await db.doc(`kullanicilar/${uid}`).get()).data();
  return { seriGunu: d?.seriGunu ?? null, sonSoruGunu: d?.sonSoruGunu ?? null };
};
const temizle = async () => {
  for (const k of ["kotaKayitlari", "kotaSayaclari", "sorular", "kullanicilar", "seriSayaclari"]) {
    const snap = await db.collection(k).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
};

(async () => {
  await temizle();
  // Öğle saati (TR 15:00): gün içi kaymalardan etkilenmesin
  const T0 = Date.UTC(2026, 10, 28, 12, 0, 0);
  const gun = (n) => kota.turkiyeGunu(T0 + n * GUN_MS);

  // ================================================================ 1) İlk soru, eski giriş serisi yok sayılır
  await db.doc("kullanicilar/ogrS").set({ rol: "ogrenci", seriGunu: 99, sonGirisTarihi: "2026-11-27T00:00:00.000Z" });
  let r = await gonder("ogrS", await yeniFoto("ogrS", T0), T0);
  esit("ilk soru: yanıt seri 1, arttı", r.seri, { gun: 1, artti: true });
  esit("ilk soru: asıl kayıt", await seriKaydi("ogrS"), { seri: 1, sonGun: gun(0) });
  esit("ilk soru: gösterim kopyası", await profilSeri("ogrS"), { seriGunu: 1, sonSoruGunu: gun(0) });
  esit("eski yanıt alanları korunur (geriye uyum)", [typeof r.soruId, r.kalan, r.zatenVar], ["string", 2, false]);

  // ================================================================ 2) Aynı gün ikinci soru ve tekrar istek
  const ayniFoto = await yeniFoto("ogrS", T0);
  r = await gonder("ogrS", ayniFoto, T0 + 60000);
  esit("aynı gün 2. soru: değişmez", r.seri, { gun: 1, artti: false });
  r = await gonder("ogrS", ayniFoto, T0 + 120000);
  esit("tekrar istek: değişmez, arttı değil", [r.zatenVar, r.seri], [true, { gun: 1, artti: false }]);
  esit("kayıt hâlâ 1", await seriKaydi("ogrS"), { seri: 1, sonGun: gun(0) });

  // ================================================================ 3) Ertesi gün +1, sonra gün atlanınca 1
  r = await gonder("ogrS", await yeniFoto("ogrS", T0), T0 + GUN_MS);
  esit("ertesi gün: 2, arttı", r.seri, { gun: 2, artti: true });
  esit("ertesi gün: kopya", await profilSeri("ogrS"), { seriGunu: 2, sonSoruGunu: gun(1) });
  r = await gonder("ogrS", await yeniFoto("ogrS", T0), T0 + 2 * GUN_MS);
  esit("3. gün: 3", r.seri, { gun: 3, artti: true });
  r = await gonder("ogrS", await yeniFoto("ogrS", T0), T0 + 4 * GUN_MS);
  esit("bir gün atlandı: 1'e döner", r.seri, { gun: 1, artti: true });
  esit("atlama sonrası kayıt", await seriKaydi("ogrS"), { seri: 1, sonGun: gun(4) });
  // Tekrar istek (eski soru) seri bilgisini görünen seriyle verir
  r = await gonder("ogrS", ayniFoto, T0 + 4 * GUN_MS + 1000);
  esit("eski sorunun tekrarı: görünen seri, arttı değil", [r.zatenVar, r.seri], [true, { gun: 1, artti: false }]);

  // ================================================================ 4) Profildeki sahte/eski değer yok sayılır
  // (Kurallar yayınlanmadan önce biri profiline seriGunu/sonSoruGunu yazmış olsa bile sunucu ona güvenmez)
  await db.doc("kullanicilar/ogrH").set({ rol: "ogrenci", seriGunu: 500, sonSoruGunu: gun(-1) });
  r = await gonder("ogrH", await yeniFoto("ogrH", T0), T0, "B1B2C3D4-0000-0000-0000-000000000001");
  esit("sahte profil serisi yok sayılır → 1", r.seri, { gun: 1, artti: true });
  esit("sahte kopya düzeltilir", await profilSeri("ogrH"), { seriGunu: 1, sonSoruGunu: gun(0) });
  // Asıl kayıt bozuksa (elle bozulmuş) güvenli: 1
  await db.doc("seriSayaclari/ogrH").set({ seri: "çok", sonGun: gun(0) });
  r = await gonder("ogrH", await yeniFoto("ogrH", T0), T0 + GUN_MS, "B1B2C3D4-0000-0000-0000-000000000001");
  esit("bozuk asıl kayıt → 1", r.seri, { gun: 1, artti: true });

  // ================================================================ 5) Aynı anda iki soru: seri bir kez artar
  await db.doc("kullanicilar/ogrP").set({ rol: "ogrenci" });
  const [f1, f2] = [await yeniFoto("ogrP", T0), await yeniFoto("ogrP", T0)];
  const ikisi = await Promise.all([
    gonder("ogrP", f1, T0, "C1C2C3C4-0000-0000-0000-000000000001"),
    gonder("ogrP", f2, T0, "C1C2C3C4-0000-0000-0000-000000000001"),
  ]);
  esit("eşzamanlı: ikisi de seri 1", ikisi.map((x) => x.seri.gun), [1, 1]);
  esit("eşzamanlı: yalnızca biri 'arttı'", ikisi.filter((x) => x.seri.artti).length, 1);
  esit("eşzamanlı: kayıt 1", await seriKaydi("ogrP"), { seri: 1, sonGun: gun(0) });

  // ================================================================ 6) Kota dolunca seri değişmez
  await db.doc("kullanicilar/ogrK").set({ rol: "ogrenci" });
  const cK = "D1D2D3D4-0000-0000-0000-000000000001";
  for (let i = 0; i < 3; i++) await gonder("ogrK", await yeniFoto("ogrK", T0), T0 + i, cK);
  let red = null;
  try {
    await gonder("ogrK", await yeniFoto("ogrK", T0), T0 + 10, cK);
  } catch (e) {
    red = e.message;
  }
  esit("4. soru reddedilir", red, "kota-doldu");
  esit("kota reddinde seri değişmez", await seriKaydi("ogrK"), { seri: 1, sonGun: gun(0) });

  // ================================================================ 7) Öğrenci olmayan seri alamaz
  await db.doc("kullanicilar/veliV").set({ rol: "veli" });
  red = null;
  try {
    await gonder("veliV", await yeniFoto("veliV", T0), T0);
  } catch (e) {
    red = e.message;
  }
  esit("veli soru gönderemez", red, "rol-uygun-degil");
  esit("veliye seri kaydı yazılmaz", await seriKaydi("veliV"), null);

  // ================================================================ 8) İptal + iade seriyi geri almaz
  await db.doc("kullanicilar/ogrI").set({ rol: "ogrenci" });
  const cI = "E1E2E3E4-0000-0000-0000-000000000001";
  r = await gonder("ogrI", await yeniFoto("ogrI", T0), T0, cI);
  await db.doc(`sorular/${r.soruId}`).update({ durum: kota.INCELEME_DURUMU });
  const karar = await kota.soruIncelemeKarari("ogrI", { soruId: r.soruId, karar: "iptal" }, T0 + 1000);
  esit("iptal edildi ve hak iade edildi", [karar.durum, karar.iade], [kota.IPTAL_DURUMU, "iade-edildi"]);
  esit("iptal sonrası seri kalır", await seriKaydi("ogrI"), { seri: 1, sonGun: gun(0) });
  esit("iptal sonrası kopya kalır", await profilSeri("ogrI"), { seriGunu: 1, sonSoruGunu: gun(0) });

  // ================================================================ 9) Hesap silme seri kaydını siler
  await kota.kotaKayitlariniSil("ogrS");
  esit("hesap silme: seri kaydı silindi", await seriKaydi("ogrS"), null);
  esit("başkasının kaydı duruyor", (await seriKaydi("ogrI")) !== null, true);

  await temizle();
  console.log(`[seri-sunucu] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.log("TEST ÇÖKTÜ:", e?.message || e);
  process.exit(1);
});
