// Sunucu testi: müdür ve öğretmenler yalnızca öğrencinin dershaneye KATILDIKTAN SONRA gönderdiği soruları görür
// (functions/erisim.js ve functions/ozet.js).
// Çalıştırma (proje kökünden):
//   firebase emulators:exec --project demo-mikro --only firestore,storage "node testler/sunucu/katilimSonrasi.test.js"

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-mikro";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Yalnızca emülatörde çalışır (FIRESTORE_EMULATOR_HOST yok)");
if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error("Storage emülatörü gerekli");

const path = require("path");
const FN = path.resolve(__dirname, "..", "..", "functions");
const al = (m) => require(require.resolve(m, { paths: [FN] }));
const { initializeApp } = al("firebase-admin/app");
const { getFirestore, Timestamp } = al("firebase-admin/firestore");
initializeApp({ projectId: process.env.GCLOUD_PROJECT, storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com` });
const db = getFirestore();
const erisim = require(path.join(FN, "erisim.js"));
const ozet = require(path.join(FN, "ozet.js"));

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
    console.log("HATA:", ad, "hata bekleniyordu, başarılı oldu");
  } catch (e) {
    esit(ad, e?.message, mesaj);
  }
};
const kayitSayisi = async () => (await db.collection(`kurumlar/${K}/erisimKayitlari`).get()).size;

const K = "kurumKS";
const M = "mudurM";
const MEPOSTA = "mudur@ornek.com";
const TOKEN = { kurumRol: "mudur", kurumId: K, email: MEPOSTA };
const O = "ogrenciO";
const GUN = 86400000;
const katilma = Date.now() - 10 * GUN;
const iso = (ms) => new Date(ms).toISOString();

(async () => {
  await db.doc(`kurumlar/${K}`).set({
    ad: "Test Dershane",
    durum: "aktif",
    koltuk: 10,
    uyeSayisi: 1,
    lisansBitis: Timestamp.fromMillis(Date.now() + 100 * GUN),
  });
  await db.doc(`kurumlar/${K}/yoneticiler/${MEPOSTA}`).set({ uid: M, rol: "mudur", eposta: MEPOSTA });
  await db.doc(`kullanicilar/${O}`).set({ rol: "ogrenci", kurumId: K, adSoyad: "Öğrenci" });
  await db.doc(`kurumlar/${K}/uyeler/${O}`).set({ uid: O, katilma: Timestamp.fromMillis(katilma) });

  // Sorular: 2 katılımdan önce, 2 sonra, 1 tarihi bozuk, 1 tarihsiz, 1 tam katılım anında
  await db.doc("sorular/once1").set({ kullaniciUid: O, tarih: iso(katilma - 5 * GUN), ders: "Matematik", fotoLink: "x" });
  await db.doc("sorular/once2").set({ kullaniciUid: O, tarih: iso(katilma - 1000), ders: "Fizik" });
  await db.doc("sorular/sonra1").set({ kullaniciUid: O, tarih: iso(katilma + 2 * GUN), ders: "Kimya", okunduMu: true });
  await db.doc("sorular/sonra2").set({ kullaniciUid: O, tarih: iso(katilma + 3 * GUN), ders: "Kimya" });
  await db.doc("sorular/bozuk").set({ kullaniciUid: O, tarih: "tarih-degil", ders: "Biyoloji" });
  await db.doc("sorular/tarihsiz").set({ kullaniciUid: O, ders: "Tarih" });
  await db.doc("sorular/aninda").set({ kullaniciUid: O, tarih: iso(katilma), ders: "Kimya" });
  await db.doc("sorular/baskasi").set({ kullaniciUid: "baskaOgrenci", tarih: iso(katilma + GUN) });

  // ------------------------------------------------ müdür soru listesi
  const liste = await erisim.ogrenciSorulariGetir(M, TOKEN, { uid: O });
  esit("liste yalnızca katılım sonrası (+ tam anında)", liste.sorular.map((s) => s.id).sort(), ["aninda", "sonra1", "sonra2"]);
  esit("liste: kayıt yazıldı", await kayitSayisi(), 1);

  // ------------------------------------------------ müdür soru detayı / fotoğrafı
  const kayitOnce = await kayitSayisi();
  await hataBekle("öncesi soru detayı reddedilir", () => erisim.soruCozumuGetir(M, TOKEN, { soruId: "once1" }), "uyelik-oncesi");
  await hataBekle("öncesi (1 sn önce) reddedilir", () => erisim.soruCozumuGetir(M, TOKEN, { soruId: "once2" }), "uyelik-oncesi");
  await hataBekle("öncesi fotoğraf reddedilir", () => erisim.soruFotografiGetir(M, TOKEN, { soruId: "once1" }), "uyelik-oncesi");
  await hataBekle("tarihi bozuk soru reddedilir", () => erisim.soruCozumuGetir(M, TOKEN, { soruId: "bozuk" }), "uyelik-oncesi");
  await hataBekle("tarihsiz soru reddedilir", () => erisim.soruCozumuGetir(M, TOKEN, { soruId: "tarihsiz" }), "uyelik-oncesi");
  esit("reddedilen isteklerde erişim kaydı YAZILMADI", await kayitSayisi(), kayitOnce);

  const detay = await erisim.soruCozumuGetir(M, TOKEN, { soruId: "sonra1" });
  esit("sonrası soru detayı verilir", typeof detay, "object");
  const foto = await erisim.soruFotografiGetir(M, TOKEN, { soruId: "sonra2" });
  esit("sonrası fotoğraf isteği verilir (fotoğraf yok)", foto, { fotograf: null });

  // İnceleme Gerekli: dosya/gömülü çözüm olsa bile çözüm verilmez, işaret döner
  await db.doc("sorular/inceleme1").set({
    kullaniciUid: O, tarih: iso(katilma + 4 * GUN), ders: "Kimya", durum: "İnceleme Gerekli",
    cozumDetayi: { cardTitle: "Yanlış olabilecek çözüm" },
  });
  const incelemeDetay = await erisim.soruCozumuGetir(M, TOKEN, { soruId: "inceleme1" });
  esit("inceleme: çözüm verilmez", [incelemeDetay.cozum, incelemeDetay.kartResmi, incelemeDetay.inceleme], [null, null, true]);
  await db.doc("sorular/cozuldu1").set({
    kullaniciUid: O, tarih: iso(katilma + 4 * GUN), ders: "Kimya", durum: "Çözüldü",
    cozumDetayi: { cardTitle: "Çözüm" },
  });
  const cozulduDetay = await erisim.soruCozumuGetir(M, TOKEN, { soruId: "cozuldu1" });
  esit("çözüldü: çözüm verilir", [cozulduDetay.cozum?.cardTitle, cozulduDetay.inceleme], ["Çözüm", false]);
  await db.doc("sorular/iptal1").set({
    kullaniciUid: O, tarih: iso(katilma + 4 * GUN), ders: "Kimya", durum: "İptal Edildi",
    cozumDetayi: { cardTitle: "İptal edilen soru" },
  });
  const iptalDetay = await erisim.soruCozumuGetir(M, TOKEN, { soruId: "iptal1" });
  esit("iptal: çözüm verilmez", [iptalDetay.cozum, iptalDetay.inceleme], [null, true]);
  await db.doc("sorular/iptal1").delete();
  // Sonraki sayımları etkilemesin diye bu iki deneme sorusu silinir
  await db.doc("sorular/inceleme1").delete();
  await db.doc("sorular/cozuldu1").delete();

  // Başka kurumun öğrencisinin sorusu: üye değil → reddedilir
  await hataBekle("üye olmayan öğrencinin sorusu", () => erisim.soruCozumuGetir(M, TOKEN, { soruId: "baskasi" }), "ogrenci-yok");

  // ------------------------------------------------ öğretmen özeti
  await ozet.ozetYenile(O);
  const oz = (await db.doc(`kurumlar/${K}/ozet/${O}`).get()).data();
  esit("özet: yalnızca katılım sonrası sayıldı", oz.toplamSoru, 3);
  esit("özet: ders dağılımı", oz.dersDagilimi, { Kimya: 3 });
  esit("özet: okunan", oz.okunanCozum, 1);
  esit("özet sürümü", oz.surum, ozet.OZET_SURUMU);

  // ------------------------------------------------ eski sürüm özetlerin gece güncellemesi
  await db.doc(`kurumlar/${K}/ozet/${O}`).set({ isim: "Öğrenci", toplamSoru: 7, dersDagilimi: { Matematik: 1, Fizik: 1, Kimya: 3 } });
  esit("gece: eski özet güncellendi", await ozet.ozetleriGuncelle(), 1);
  esit("gece: doğru sayı", (await db.doc(`kurumlar/${K}/ozet/${O}`).get()).data().toplamSoru, 3);
  esit("gece: ikinci çalıştırmada iş yok", await ozet.ozetleriGuncelle(), 0);

  // ------------------------------------------------ ayrılıp tekrar katılma: ilk dönem de gizlenir
  const yeniKatilma = katilma + 2.5 * GUN; // sonra1'den sonra, sonra2'den önce
  await db.doc(`kurumlar/${K}/uyeler/${O}`).set({ uid: O, katilma: Timestamp.fromMillis(yeniKatilma) });
  const liste2 = await erisim.ogrenciSorulariGetir(M, TOKEN, { uid: O });
  esit("yeniden katılım: yalnızca yeni dönem", liste2.sorular.map((s) => s.id).sort(), ["sonra2"]);
  await hataBekle("yeniden katılım: eski dönem sorusu reddedilir", () => erisim.soruCozumuGetir(M, TOKEN, { soruId: "sonra1" }), "uyelik-oncesi");

  // ------------------------------------------------ katılma zamanı yoksa: hiçbir şey görünmez
  await db.doc(`kurumlar/${K}/uyeler/${O}`).set({ uid: O });
  esit("katılma zamanı yok: liste boş", (await erisim.ogrenciSorulariGetir(M, TOKEN, { uid: O })).sorular, []);
  await ozet.ozetYenile(O);
  esit("katılma zamanı yok: özet 0", (await db.doc(`kurumlar/${K}/ozet/${O}`).get()).data().toplamSoru, 0);

  // ------------------------------------------------ saf yardımcı
  esit("uyelikSonrasiMi: eşit", erisim.uyelikSonrasiMi({ tarih: iso(1000) }, 1000), true);
  esit("uyelikSonrasiMi: önce", erisim.uyelikSonrasiMi({ tarih: iso(999) }, 1000), false);
  esit("uyelikSonrasiMi: Timestamp", erisim.uyelikSonrasiMi({ tarih: Timestamp.fromMillis(2000) }, 1000), true);
  esit("uyelikSonrasiMi: sayı (geçersiz tür)", erisim.uyelikSonrasiMi({ tarih: 5000 }, 1000), false);

  console.log(`[katilimSonrasi] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
