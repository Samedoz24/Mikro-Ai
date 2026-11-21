// Sunucu testi: öğrencinin kendi veli bağlantıları üzerindeki denetimi (functions/veliBaglanti.js):
// ogrenciVelileriGetir, ogrenciVeliKaldir, baglantiKoduYenile.
// Çalıştırma:
//   firebase emulators:exec --project demo-mikro --only firestore "node testler/sunucu/veliKontrol.test.js"

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-mikro";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Yalnızca emülatörde çalışır (FIRESTORE_EMULATOR_HOST yok)");

const path = require("path");
const FN = path.resolve(__dirname, "..", "..", "functions");
const al = (m) => require(require.resolve(m, { paths: [FN] }));
const { initializeApp } = al("firebase-admin/app");
const { getFirestore, Timestamp } = al("firebase-admin/firestore");
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();
const vb = require(path.join(FN, "veliBaglanti.js"));

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
const veriAl = async (yol) => (await db.doc(yol).get()).data();

(async () => {
  await temizle();
  // Öğrenciler: O1 (ana), O2; veliler: V1 (O1+O2), V2 (O1), V3 (yalnız O2)
  await db.doc("kullanicilar/O1").set({ rol: "ogrenci", adSoyad: "Ayşe", eposta: "ayse@ornek.com" });
  await db.doc("kullanicilar/O2").set({ rol: "ogrenci", adSoyad: "Mehmet" });
  await db.doc("kullanicilar/V1").set({
    rol: "veli",
    adSoyad: "Fatma Hanım",
    eposta: "fatma@ornek.com",
    bagliOgrenciIdleri: ["O1", "O2"],
    bagliOgrenciler: [{ id: "O1", isim: "Ayşe" }, { id: "O2", isim: "Mehmet" }],
  });
  await db.doc("kullanicilar/V2").set({
    rol: "veli",
    eposta: "baskasi@ornek.com",
    bagliOgrenciIdleri: ["O1"],
    bagliOgrenciler: [{ id: "O1", isim: "Ayşe" }],
  });
  await db.doc("kullanicilar/V3").set({ rol: "veli", bagliOgrenciIdleri: ["O2"], bagliOgrenciler: [{ id: "O2", isim: "Mehmet" }] });
  await db.doc("kullanicilar/Y1").set({ rol: "yonetici" });

  // ------------------------------------------------ ogrenciVelileriGetir
  const liste = await vb.ogrenciVelileriGetir("O1");
  esit(
    "O1'in velileri (yalnızca id ve isim)",
    liste.veliler.sort((a, b) => a.id.localeCompare(b.id)),
    [{ id: "V1", isim: "Fatma Hanım" }, { id: "V2", isim: "baskasi" }]
  );
  esit("velinin e-postası/diğer öğrencileri verilmez", Object.keys(liste.veliler[0]).sort(), ["id", "isim"]);
  esit("O2'nin velileri", (await vb.ogrenciVelileriGetir("O2")).veliler.map((v) => v.id).sort(), ["V1", "V3"]);
  await hataBekle("veli kendi listesini öğrenci gibi isteyemez", () => vb.ogrenciVelileriGetir("V1"), "rol-uygun-degil");
  await hataBekle("yönetici isteyemez", () => vb.ogrenciVelileriGetir("Y1"), "rol-uygun-degil");
  await hataBekle("profili olmayan", () => vb.ogrenciVelileriGetir("YOK"), "profil-yok");

  // ------------------------------------------------ ogrenciVeliKaldir
  esit("O1, V2'yi kaldırır", await vb.ogrenciVeliKaldir("O1", { veliId: "V2" }), { kaldirildi: true });
  esit("V2 artık O1'i görmez (id)", (await veriAl("kullanicilar/V2")).bagliOgrenciIdleri, []);
  esit("V2 artık O1'i görmez (isim)", (await veriAl("kullanicilar/V2")).bagliOgrenciler, []);
  esit("tekrar kaldırma: değişiklik yok", await vb.ogrenciVeliKaldir("O1", { veliId: "V2" }), { kaldirildi: false });

  esit("O1, V1'i kaldırır", await vb.ogrenciVeliKaldir("O1", { veliId: "V1" }), { kaldirildi: true });
  const v1 = await veriAl("kullanicilar/V1");
  esit("V1'in O2 bağlantısı DURUYOR (yalnızca çağıran çıkar)", v1.bagliOgrenciIdleri, ["O2"]);
  esit("V1 isim listesinde O2 duruyor", v1.bagliOgrenciler, [{ id: "O2", isim: "Mehmet" }]);

  esit("O1, kendisine bağlı olmayan V3'ü kaldıramaz", await vb.ogrenciVeliKaldir("O1", { veliId: "V3" }), { kaldirildi: false });
  esit("V3'ün O2 bağlantısı bozulmadı", (await veriAl("kullanicilar/V3")).bagliOgrenciIdleri, ["O2"]);
  esit("olmayan veli", await vb.ogrenciVeliKaldir("O1", { veliId: "YOKVELI" }), { kaldirildi: false });
  await hataBekle("geçersiz veli kimliği (../)", () => vb.ogrenciVeliKaldir("O1", { veliId: "../V3" }), "veli-gecersiz");
  await hataBekle("geçersiz veli kimliği (yok)", () => vb.ogrenciVeliKaldir("O1", {}), "veli-gecersiz");
  await hataBekle("geçersiz veli kimliği (sayı)", () => vb.ogrenciVeliKaldir("O1", { veliId: 5 }), "veli-gecersiz");
  await hataBekle("kendini kaldırma", () => vb.ogrenciVeliKaldir("O1", { veliId: "O1" }), "veli-gecersiz");
  esit("O1'in velisi kalmadı", (await vb.ogrenciVelileriGetir("O1")).veliler, []);

  // ------------------------------------------------ baglantiKoduYenile
  const ilk = (await vb.baglantiKoduAl("O1")).kod;
  esit("ilk kod kaydı", (await veriAl(`baglantiKodlari/${ilk}`)).uid, "O1");
  await hataBekle("hemen yenileme reddedilir (bekleme)", () => vb.baglantiKoduYenile("O1"), "cok-sik");
  esit("bekleme reddinde eski kod duruyor", (await veriAl(`baglantiKodlari/${ilk}`))?.uid, "O1");

  // Bekleme süresi geçmiş gibi: zaman 2 dakika ileride
  const yeni = (await vb.baglantiKoduYenile("O1", Date.now() + 2 * 60 * 1000)).kod;
  esit("yeni kod farklı", yeni !== ilk, true);
  esit("yeni kod biçimi", /^[A-Z0-9]{6}$/.test(yeni), true);
  esit("ESKİ KOD GEÇERSİZ (kayıt silindi)", await veriAl(`baglantiKodlari/${ilk}`), undefined);
  esit("yeni kod kaydı", (await veriAl(`baglantiKodlari/${yeni}`)).uid, "O1");
  esit("profilde yeni kod", (await veriAl("kullanicilar/O1")).baglantiKodu, yeni);

  // Eski kodla bağlanma artık başarısız
  await db.doc("kullanicilar/V9").set({ rol: "veli" });
  await hataBekle("eski kodla veli bağlanamaz", () => vb.veliBagla("V9", { kod: ilk }), "kod-bulunamadi");
  esit("yeni kodla bağlanır", (await vb.veliBagla("V9", { kod: yeni })).ogrenci.id, "O1");

  // Profilde başkasının kodu yazıyorsa (eski/bozuk veri): başkasının kod kaydına dokunulmaz
  const o2Kod = (await vb.baglantiKoduAl("O2")).kod;
  await db.doc("kullanicilar/O1").update({ baglantiKodu: o2Kod });
  const o1Yeni = (await vb.baglantiKoduYenile("O1", Date.now() + 10 * 60 * 1000)).kod;
  esit("O2'nin kod kaydı DURUYOR", (await veriAl(`baglantiKodlari/${o2Kod}`)).uid, "O2");
  esit("O1 yeni kod aldı", (await veriAl(`baglantiKodlari/${o1Yeni}`)).uid, "O1");

  // Eski (oluşturma zamanı olmayan) kayıt: bekleme uygulanamaz, yenileme izinli
  await db.doc("kullanicilar/O3").set({ rol: "ogrenci", baglantiKodu: "ESKI01" });
  await db.doc("baglantiKodlari/ESKI01").set({ uid: "O3" });
  const o3 = (await vb.baglantiKoduYenile("O3")).kod;
  esit("zaman damgasız eski kod silindi", await veriAl("baglantiKodlari/ESKI01"), undefined);
  esit("O3 yeni kod", (await veriAl(`baglantiKodlari/${o3}`)).uid, "O3");

  // Bekleme: tam 59 saniye sonra hâlâ reddedilir
  const kayit = await veriAl(`baglantiKodlari/${o3}`);
  const olusturmaMs = kayit.olusturma.toMillis();
  await hataBekle("59 sn sonra hâlâ bekleme", () => vb.baglantiKoduYenile("O3", olusturmaMs + 59 * 1000), "cok-sik");

  await hataBekle("veli kod yenileyemez", () => vb.baglantiKoduYenile("V1"), "rol-uygun-degil");
  await hataBekle("profili olmayan", () => vb.baglantiKoduYenile("YOK"), "profil-yok");
  esit("Timestamp türü", typeof Timestamp.now().toMillis(), "number");

  console.log(`[veliKontrol] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
