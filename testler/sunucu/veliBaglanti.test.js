// Sunucu testi: functions/veliBaglanti.js (veli–öğrenci bağlantısı, kod üretimi, deneme sınırı).
// Firestore emülatörüne Admin SDK ile bağlanır; functions klasörünün kendi bağımlılıklarını kullanır.
//
// Çalıştırma:
//   firebase emulators:exec --only firestore "node testler/sunucu/veliBaglanti.test.js"

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-mikro";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Yalnızca emülatörde çalışır (FIRESTORE_EMULATOR_HOST yok)");

const path = require("path");
const FN = path.resolve(__dirname, "..", "..", "functions");
const al = (m) => require(require.resolve(m, { paths: [FN] }));
const { initializeApp } = al("firebase-admin/app");
const { getFirestore } = al("firebase-admin/firestore");
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();
const vb = require(path.join(FN, "veliBaglanti.js"));
const veli = require(path.join(FN, "veli.js"));

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
const temizle = async () => {
  for (const k of ["kullanicilar", "baglantiKodlari", "veliDenemeleri"]) {
    const s = await db.collection(k).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
};

(async () => {
  // ---------------------------------------------------------------- saf yardımcılar
  const kodlar = new Set();
  for (let i = 0; i < 2000; i++) kodlar.add(vb.kodUret());
  esit("kod biçimi", [...kodlar].every((k) => /^[A-Z0-9]{6}$/.test(k)), true);
  esit("kodlar tekrar etmiyor (2000 üretim)", kodlar.size > 1990, true);
  esit("kodTemizle küçük harf+boşluk", vb.kodTemizle(" abc 123 "), "ABC123");
  esit("kodTemizle kısa", vb.kodTemizle("ABC12"), null);
  esit("kodTemizle özel karakter", vb.kodTemizle("ABC12/"), null);
  esit("kodTemizle sayı", vb.kodTemizle(123456), null);
  esit("kodTemizle çok uzun", vb.kodTemizle("A".repeat(1000)), null);
  const t = Date.UTC(2026, 10, 5, 10, 30);
  esit("deneme durumu boş", vb.denemeDurumu(null, t), { saat: "2026-11-05T10", gun: "2026-11-05", saatYanlis: 0, gunYanlis: 0 });
  esit("yeni saatte saatlik sıfırlanır", vb.denemeDurumu({ saat: "2026-11-05T09", saatYanlis: 10, gun: "2026-11-05", gunYanlis: 12 }, t).saatYanlis, 0);
  esit("aynı günde günlük sürer", vb.denemeDurumu({ saat: "2026-11-05T09", saatYanlis: 10, gun: "2026-11-05", gunYanlis: 12 }, t).gunYanlis, 12);

  // ---------------------------------------------------------------- kod alma
  await temizle();
  await db.doc("kullanicilar/ogr1").set({ rol: "ogrenci", eposta: "ogr1@ornek.com", adSoyad: "Ayşe Yılmaz" });
  await db.doc("kullanicilar/veli1").set({ rol: "veli" });
  const { kod } = await vb.baglantiKoduAl("ogr1");
  esit("öğrenci kod alır", /^[A-Z0-9]{6}$/.test(kod), true);
  esit("kod kaydı öğrenciye ait", (await db.doc(`baglantiKodlari/${kod}`).get()).data().uid, "ogr1");
  esit("profilde kod yazıldı", (await db.doc("kullanicilar/ogr1").get()).data().baglantiKodu, kod);
  esit("ikinci çağrı aynı kodu verir", (await vb.baglantiKoduAl("ogr1")).kod, kod);
  await hataBekle("veli kod alamaz", () => vb.baglantiKoduAl("veli1"), "rol-uygun-degil");
  await hataBekle("profilsiz kod alamaz", () => vb.baglantiKoduAl("yok"), "profil-yok");

  // Eski hesap taşıma: profilde kod var, kaydı yok
  await db.doc("kullanicilar/eskiOgr").set({ rol: "ogrenci", baglantiKodu: "ESK111" });
  esit("eski kod korunur", (await vb.baglantiKoduAl("eskiOgr")).kod, "ESK111");
  esit("eski kodun kaydı oluşturuldu", (await db.doc("baglantiKodlari/ESK111").get()).data().uid, "eskiOgr");
  // Profildeki kod başkasına aitse yeni kod üretilir (ele geçirme yok)
  await db.doc("kullanicilar/sahte").set({ rol: "ogrenci", baglantiKodu: kod });
  const sahteKod = (await vb.baglantiKoduAl("sahte")).kod;
  esit("başkasının kodu verilmez", sahteKod !== kod, true);
  esit("asıl kod sahibinde kalır", (await db.doc(`baglantiKodlari/${kod}`).get()).data().uid, "ogr1");

  // ---------------------------------------------------------------- bağlama
  const s1 = await vb.veliBagla("veli1", { kod: kod.toLowerCase() });
  esit("veli bağlanır", s1, { ogrenci: { id: "ogr1", isim: "Ayşe Yılmaz" }, zatenVar: false });
  const v1 = (await db.doc("kullanicilar/veli1").get()).data();
  esit("kimlik listesi", v1.bagliOgrenciIdleri, ["ogr1"]);
  esit("öğrenci listesi", v1.bagliOgrenciler, [{ id: "ogr1", isim: "Ayşe Yılmaz" }]);
  esit("ikinci kez: zaten var", (await vb.veliBagla("veli1", { kod })).zatenVar, true);
  esit("liste tekrarlanmadı", (await db.doc("kullanicilar/veli1").get()).data().bagliOgrenciIdleri, ["ogr1"]);

  await hataBekle("öğrenci veli gibi bağlanamaz", () => vb.veliBagla("ogr1", { kod: sahteKod }), "rol-uygun-degil");
  await hataBekle("profilsiz bağlanamaz", () => vb.veliBagla("hayalet", { kod }), "profil-yok");
  await hataBekle("biçimsiz kod", () => vb.veliBagla("veli1", { kod: "12" }), "kod-gecersiz");
  await hataBekle("kod nesne", () => vb.veliBagla("veli1", { kod: { a: 1 } }), "kod-gecersiz");
  await hataBekle("girdi yok", () => vb.veliBagla("veli1", undefined), "kod-gecersiz");

  // Kendi hesabı (veli rolündeki birinin kodu olamaz ama yine de denetlenir)
  await db.doc("baglantiKodlari/KND111").set({ uid: "veli1" });
  await hataBekle("kendi hesabı bağlanamaz", () => vb.veliBagla("veli1", { kod: "KND111" }), "kendi-hesabi");

  // Kod sahibi öğrenci değilse (rolü veli olmuş) bulunamadı
  await db.doc("kullanicilar/eskiVeli").set({ rol: "veli" });
  await db.doc("baglantiKodlari/RLV111").set({ uid: "eskiVeli" });
  await db.doc("kullanicilar/veli2").set({ rol: "veli" });
  await hataBekle("öğrenci olmayanın kodu", () => vb.veliBagla("veli2", { kod: "RLV111" }), "kod-bulunamadi");
  // Silinmiş öğrencinin kodu
  await db.doc("baglantiKodlari/SLN111").set({ uid: "silinmis" });
  await hataBekle("silinmiş öğrencinin kodu", () => vb.veliBagla("veli2", { kod: "SLN111" }), "kod-bulunamadi");

  // ---------------------------------------------------------------- deneme sınırı
  await db.doc("kullanicilar/tarayici").set({ rol: "veli" });
  let reddedilen = 0;
  for (let i = 0; i < vb.SAATLIK_YANLIS; i++) {
    try {
      await vb.veliBagla("tarayici", { kod: `ZZ${String(1000 + i)}` });
    } catch (e) {
      if (e.message === "kod-bulunamadi") reddedilen++;
    }
  }
  esit("10 yanlış deneme bulunamadı", reddedilen, vb.SAATLIK_YANLIS);
  await hataBekle("11. deneme engellenir", () => vb.veliBagla("tarayici", { kod: "ZZ9999" }), "cok-fazla-deneme");
  await hataBekle("sınırdayken DOĞRU kod da engellenir", () => vb.veliBagla("tarayici", { kod }), "cok-fazla-deneme");
  esit("sınırdayken bağlanmadı", (await db.doc("kullanicilar/tarayici").get()).data().bagliOgrenciIdleri, undefined);
  // Bir saat sonra saatlik sınır açılır, günlük sayaç sürer
  const birSaatSonra = Date.now() + 60 * 60 * 1000;
  esit("bir saat sonra doğru kod çalışır", (await vb.veliBagla("tarayici", { kod }, birSaatSonra)).zatenVar, false);
  // Günlük sınır
  await db.doc("veliDenemeleri/gunluk").set({ saat: "x", saatYanlis: 0, gun: new Date().toISOString().slice(0, 10), gunYanlis: vb.GUNLUK_YANLIS });
  await db.doc("kullanicilar/gunluk").set({ rol: "veli" });
  await hataBekle("günlük sınır", () => vb.veliBagla("gunluk", { kod }), "cok-fazla-deneme");
  // Doğru kod ve zaten var sayaç artırmaz
  await db.doc("kullanicilar/veli3").set({ rol: "veli" });
  await vb.veliBagla("veli3", { kod });
  await vb.veliBagla("veli3", { kod });
  esit("doğru kod sayaç artırmaz", (await db.doc("veliDenemeleri/veli3").get()).exists, false);

  // Eşzamanlı yanlış denemeler sayacı atlatamaz
  await db.doc("kullanicilar/esz").set({ rol: "veli" });
  await Promise.allSettled(Array.from({ length: 25 }, (_, i) => vb.veliBagla("esz", { kod: `QQ${1000 + i}` })));
  const esz = (await db.doc("veliDenemeleri/esz").get()).data();
  esit("eşzamanlı 25 denemede sayaç en fazla 10", esz.saatYanlis <= vb.SAATLIK_YANLIS, true);

  // ---------------------------------------------------------------- öğrenci sınırı
  await db.doc("kullanicilar/kalabalik").set({ rol: "veli", bagliOgrenciIdleri: Array.from({ length: 10 }, (_, i) => `o${i}`), bagliOgrenciler: [] });
  await hataBekle("10 öğrenci sınırı", () => vb.veliBagla("kalabalik", { kod }), "ogrenci-siniri");

  // ---------------------------------------------------------------- isim güvenliği
  await db.doc("kullanicilar/uzunIsim").set({ rol: "ogrenci", adSoyad: "x".repeat(500) + "‮" });
  const uzunKod = (await vb.baglantiKoduAl("uzunIsim")).kod;
  await db.doc("kullanicilar/veli4").set({ rol: "veli" });
  esit("isim 60 karakterle sınırlı", (await vb.veliBagla("veli4", { kod: uzunKod })).ogrenci.isim.length, 60);
  await db.doc("kullanicilar/isimsiz").set({ rol: "ogrenci", eposta: "can.demir@ornek.com" });
  const isimsizKod = (await vb.baglantiKoduAl("isimsiz")).kod;
  esit("isimsizse e-posta başı", (await vb.veliBagla("veli4", { kod: isimsizKod })).ogrenci.isim, "can.demir");

  // Apple "E-postamı Gizle": rastgele adres başı isim olarak gösterilmez
  await db.doc("kullanicilar/gizli").set({ rol: "ogrenci", eposta: "dm6rnpjjww@privaterelay.appleid.com" });
  const gizliKod = (await vb.baglantiKoduAl("gizli")).kod;
  esit("gizli e-postada isim Öğrenci", (await vb.veliBagla("veli4", { kod: gizliKod })).ogrenci.isim, "Öğrenci");
  await db.doc("kullanicilar/gizliIsimli").set({ rol: "ogrenci", adSoyad: "Elif Kaya", eposta: "x1@privaterelay.appleid.com" });
  const gizliIsimliKod = (await vb.baglantiKoduAl("gizliIsimli")).kod;
  esit("gizli e-posta + ad: ad görünür", (await vb.veliBagla("veli4", { kod: gizliIsimliKod })).ogrenci.isim, "Elif Kaya");
  const isimMod = require(path.join(FN, "isim.js"));
  esit("büyük harfli gizli adres", isimMod.gorunenIsim({ eposta: "AB@PRIVATERELAY.APPLEID.COM" }), "Öğrenci");
  esit("benzer ama gizli olmayan alan adı", isimMod.gorunenIsim({ eposta: "ali@privaterelay.appleid.com.tr" }), "ali");
  esit("veli varsayılanı", isimMod.gorunenIsim({ eposta: "q@privaterelay.appleid.com" }, "Veli"), "Veli");

  // ---------------------------------------------------------------- kaldırma
  esit("kaldırma", await vb.veliBaglantisiKaldir("veli1", { ogrenciId: "ogr1" }), { kaldirildi: true });
  const v1b = (await db.doc("kullanicilar/veli1").get()).data();
  esit("kaldırınca iki liste boş", [v1b.bagliOgrenciIdleri, v1b.bagliOgrenciler], [[], []]);
  esit("olmayanı kaldırma", await vb.veliBaglantisiKaldir("veli1", { ogrenciId: "ogr1" }), { kaldirildi: false });
  await hataBekle("geçersiz kimlik", () => vb.veliBaglantisiKaldir("veli1", { ogrenciId: "../x" }), "ogrenci-gecersiz");
  esit("başkasının listesine dokunmaz", (await db.doc("kullanicilar/veli3").get()).data().bagliOgrenciIdleri, ["ogr1"]);

  // ---------------------------------------------------------------- hesap silinince temizlik
  await veli.veliBaglantilariniTemizle("ogr1");
  esit("silinen öğrenci velilerden çıkar", (await db.doc("kullanicilar/veli3").get()).data().bagliOgrenciIdleri, []);
  esit("kod kayıtları silinir", await vb.kodKayitlariniSil("ogr1"), 1);
  esit("kod artık yok", (await db.doc(`baglantiKodlari/${kod}`).get()).exists, false);

  console.log(`[veliBaglanti] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
