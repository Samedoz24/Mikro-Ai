// Firestore güvenlik kuralları testi: kullanicilar (profil alanları dahil) ve istemciye kapalı koleksiyonlar.
//
// Ek araç gerekmez (paket kurulmaz):
//   - kullanıcılar: uygulamadaki firebase istemcisi, emülatörün sahte kimlik özelliğiyle (mockUserToken)
//   - hazırlık verisi (kurallar dışı): functions klasöründeki firebase-admin (yalnızca emülatöre bağlanır)
// Çalıştırma (proje kökünden):
//   firebase emulators:exec --project demo-mikro --only firestore "node testler/kurallar/kullanicilar.test.js"

// Güvenlik: yalnızca emülatörde çalışır; gerçek projeye asla bağlanmaz ("demo-" proje kimliği).
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Yalnızca emülatörde çalışır (FIRESTORE_EMULATOR_HOST yok)");
const PROJE = "demo-kurallar-kullanicilar";
process.env.GCLOUD_PROJECT = PROJE;

const path = require("path");
const KOK = path.resolve(__dirname, "..", "..");
const FN = path.join(KOK, "functions");
const istemci = (m) => require(require.resolve(m, { paths: [KOK] }));
const sunucu = (m) => require(require.resolve(m, { paths: [FN] }));

const { initializeApp } = istemci("firebase/app");
const {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteField, collection, query, where,
  getDocs, arrayUnion, arrayRemove, terminate,
} = istemci("firebase/firestore");
const yonetici = sunucu("firebase-admin/app");
const yoneticiDb = sunucu("firebase-admin/firestore");

const [HOST, PORT] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
const KOVA = "project-21-3e377.firebasestorage.app";
const fotoAdresi = (uid, token = "2226a9a7-b5b9-4cea-8984-e7cd014a910f") =>
  `https://firebasestorage.googleapis.com/v0/b/${KOVA}/o/profil_fotograflari%2F${uid}.jpg?alt=media&token=${token}`;

// --- @firebase/rules-unit-testing yerine aynı işi yapan küçük yardımcılar
const acik = [];
let sayac = 0;
// Bir kullanıcının Firestore'u: kimlik emülatöre sahte belirteçle verilir (uid null → oturumsuz)
const db = (uid, claims = {}) => {
  const app = initializeApp({ apiKey: "demo", projectId: PROJE, appId: "1:1:web:1" }, `k${++sayac}`);
  const f = getFirestore(app);
  connectFirestoreEmulator(f, HOST, Number(PORT), uid ? { mockUserToken: { sub: uid, user_id: uid, ...claims } } : {});
  acik.push(f);
  return f;
};
const assertSucceeds = async (p) => p;
const assertFails = async (p) => {
  try {
    await p;
  } catch (e) {
    if (e?.code === "permission-denied") return;
    throw new Error(`izin reddi beklenirken başka hata: ${e?.code || e?.message}`);
  }
  throw new Error("işlem reddedilmeliydi ama başarılı oldu");
};
// Kurallar dışı hazırlık: firebase-admin (emülatörde kurallar yönetici erişimine uygulanmaz)
yonetici.initializeApp({ projectId: PROJE });
const admin = yoneticiDb.getFirestore();
const hazirla = (fn) =>
  fn({
    set: (yol, veri) => admin.doc(yol).set(veri),
  });
const clearFirestore = async () => {
  const r = await fetch(`http://${HOST}:${PORT}/emulator/v1/projects/${PROJE}/databases/(default)/documents`, { method: "DELETE" });
  if (!r.ok) throw new Error(`emülatör temizlenemedi: ${r.status}`);
};

let gecen = 0;
let kalan = 0;
const dene = async (ad, fn) => {
  try {
    await fn();
    gecen++;
  } catch (e) {
    kalan++;
    console.log("HATA:", ad, "-", e?.message?.split("\n")[0]);
  }
};

(async () => {
  await clearFirestore();

  const ali = db("ali", { email: "ali@ornek.com" });
  const ayse = db("ayse", { email: "ayse@ornek.com" });
  const anonim = db(null);

  // ---------------------------------------------------------------- oluşturma
  await dene("öğrenci kendi belgesini oluşturur", () =>
    assertSucceeds(setDoc(doc(ali, "kullanicilar/ali"), { eposta: "ali@ornek.com", rol: "ogrenci" })));
  await clearFirestore();
  await dene("veli rolüyle oluşturur", () =>
    assertSucceeds(setDoc(doc(ali, "kullanicilar/ali"), { rol: "veli" })));
  await clearFirestore();
  await dene("yonetici rolü yazamaz", () => assertFails(setDoc(doc(ali, "kullanicilar/ali"), { rol: "yonetici" })));
  await dene("premiumMu yazamaz", () => assertFails(setDoc(doc(ali, "kullanicilar/ali"), { rol: "ogrenci", premiumMu: true })));
  await dene("kurumId yazamaz", () => assertFails(setDoc(doc(ali, "kullanicilar/ali"), { kurumId: "k1" })));
  await dene("başkasının belgesini oluşturamaz", () => assertFails(setDoc(doc(ali, "kullanicilar/ayse"), { rol: "ogrenci" })));
  await dene("oturumsuz oluşturamaz", () => assertFails(setDoc(doc(anonim, "kullanicilar/ali"), { rol: "ogrenci" })));
  await dene("oluştururken geçerli fotoğraf", () =>
    assertSucceeds(setDoc(doc(ali, "kullanicilar/ali"), { rol: "ogrenci", profilFoto: fotoAdresi("ali") })));
  await clearFirestore();
  await dene("oluştururken dış site fotoğrafı reddedilir", () =>
    assertFails(setDoc(doc(ali, "kullanicilar/ali"), { rol: "ogrenci", profilFoto: "https://kotu.site/x.jpg" })));
  await dene("oluştururken 61 karakter isim reddedilir", () =>
    assertFails(setDoc(doc(ali, "kullanicilar/ali"), { rol: "ogrenci", adSoyad: "a".repeat(61) })));
  await dene("oluştururken geçerli isim", () =>
    assertSucceeds(setDoc(doc(ali, "kullanicilar/ali"), { rol: "ogrenci", adSoyad: "Ali Yılmaz" })));

  // ---------------------------------------------------------------- profil fotoğrafı güncelleme
  const fotoReddi = [
    ["dış site", "https://kotu.site/foto.jpg"],
    ["başkasının fotoğrafı", fotoAdresi("ayse")],
    ["sahte alan adı", fotoAdresi("ali").replace("googleapis.com", "googleapis.com.kotu.site")],
    ["http (şifresiz)", fotoAdresi("ali").replace("https://", "http://")],
    ["başka kova", fotoAdresi("ali").replace(KOVA, "baska-proje.appspot.com")],
    ["yol geçişi", fotoAdresi("ali").replace("profil_fotograflari%2Fali", "profil_fotograflari%2F..%2Fali")],
    ["başka klasör", fotoAdresi("ali").replace("profil_fotograflari", "kullanicilar")],
    ["sona ek parametre", fotoAdresi("ali") + "&x=https://kotu.site"],
    ["önüne ek", "x" + fotoAdresi("ali")],
    ["kısa anahtar", fotoAdresi("ali", "abc")],
    ["anahtarda geçersiz karakter", fotoAdresi("ali", "2226a9a7-b5b9-4cea-8984-e7cd014a910<")],
    ["png uzantısı", fotoAdresi("ali").replace(".jpg?", ".png?")],
    ["sayı", 12345],
    ["liste", [fotoAdresi("ali")]],
    ["boş metin", ""],
    ["javascript adresi", "javascript:alert(1)"],
  ];
  for (const [ad, deger] of fotoReddi) {
    await dene(`fotoğraf reddedilir: ${ad}`, () => assertFails(updateDoc(doc(ali, "kullanicilar/ali"), { profilFoto: deger })));
  }
  await dene("kendi fotoğrafı kabul", () => assertSucceeds(updateDoc(doc(ali, "kullanicilar/ali"), { profilFoto: fotoAdresi("ali") })));
  await dene("fotoğraf silinebilir", () => assertSucceeds(updateDoc(doc(ali, "kullanicilar/ali"), { profilFoto: deleteField() })));

  // ---------------------------------------------------------------- isim güncelleme
  await dene("40 karakter isim", () => assertSucceeds(updateDoc(doc(ali, "kullanicilar/ali"), { adSoyad: "ç".repeat(40) })));
  await dene("60 karakter isim", () => assertSucceeds(updateDoc(doc(ali, "kullanicilar/ali"), { adSoyad: "a".repeat(60) })));
  await dene("61 karakter isim reddedilir", () => assertFails(updateDoc(doc(ali, "kullanicilar/ali"), { adSoyad: "a".repeat(61) })));
  await dene("10.000 karakter isim reddedilir", () => assertFails(updateDoc(doc(ali, "kullanicilar/ali"), { adSoyad: "a".repeat(10000) })));
  await dene("boş isim reddedilir", () => assertFails(updateDoc(doc(ali, "kullanicilar/ali"), { adSoyad: "" })));
  await dene("sayı isim reddedilir", () => assertFails(updateDoc(doc(ali, "kullanicilar/ali"), { adSoyad: 5 })));
  await dene("nesne isim reddedilir", () => assertFails(updateDoc(doc(ali, "kullanicilar/ali"), { adSoyad: { a: 1 } })));
  await dene("isim silinebilir", () => assertSucceeds(updateDoc(doc(ali, "kullanicilar/ali"), { adSoyad: deleteField() })));

  // ---------------------------------------------------------------- eski kayıtlar kilitlenmez
  await hazirla((a) => a.set("kullanicilar/eski", { rol: "ogrenci", profilFoto: "https://eski.site/x.jpg", adSoyad: "b".repeat(100) }));
  const eski = db("eski");
  await dene("eski hatalı kayıtta başka alan güncellenir", () => assertSucceeds(updateDoc(doc(eski, "kullanicilar/eski"), { sinif: "10. Sınıf" })));
  await dene("eski hatalı fotoğraf düzeltilebilir", () => assertSucceeds(updateDoc(doc(eski, "kullanicilar/eski"), { profilFoto: fotoAdresi("eski") })));
  await dene("eski uzun isim kısaltılabilir", () => assertSucceeds(updateDoc(doc(eski, "kullanicilar/eski"), { adSoyad: "Kısa" })));

  // ---------------------------------------------------------------- mevcut korumalar (gerileme yok)
  await dene("premiumMu güncellenemez", () => assertFails(updateDoc(doc(ali, "kullanicilar/ali"), { premiumMu: true })));
  await dene("kurumId güncellenemez", () => assertFails(updateDoc(doc(ali, "kullanicilar/ali"), { kurumId: "k1" })));
  await dene("kurumRol güncellenemez", () => assertFails(updateDoc(doc(ali, "kullanicilar/ali"), { kurumRol: "mudur" })));
  await dene("yonetici rolüne geçemez", () => assertFails(updateDoc(doc(ali, "kullanicilar/ali"), { rol: "yonetici" })));
  await dene("öğrenci→veli geçebilir", () => assertSucceeds(updateDoc(doc(ali, "kullanicilar/ali"), { rol: "veli" })));
  await hazirla((a) => a.set("kullanicilar/mudur1", { rol: "yonetici" }));
  await dene("yönetici rolünden çıkamaz", () => assertFails(updateDoc(doc(db("mudur1"), "kullanicilar/mudur1"), { rol: "ogrenci" })));
  await dene("başkasının belgesini güncelleyemez", () => assertFails(updateDoc(doc(ayse, "kullanicilar/ali"), { adSoyad: "x" })));
  await dene("kendi belgesini okur", () => assertSucceeds(getDoc(doc(ali, "kullanicilar/ali"))));
  await dene("başkasının belgesini okuyamaz", () => assertFails(getDoc(doc(ayse, "kullanicilar/ali"))));
  await dene("kullanıcı listesi alınamaz", () => assertFails(getDocs(collection(ali, "kullanicilar"))));
  await dene("oturumsuz okuyamaz", () => assertFails(getDoc(doc(anonim, "kullanicilar/ali"))));

  // ---------------------------------------------------------------- veli bağlantısı yalnızca sunucuda
  // Açık (düzeltildi): istemci kendi belgesine öğrenci kimliği yazıp o öğrencinin verisini okuyabiliyordu.
  const veliSahnesi = async (a) => {
    await a.set("kullanicilar/kurban", { rol: "ogrenci", eposta: "kurban@ornek.com", baglantiKodu: "ABC123" });
    await a.set("sorular/k1", { kullaniciUid: "kurban", kullaniciEposta: "kurban@ornek.com", fotoLink: "x" });
    await a.set("baglantiKodlari/ABC123", { uid: "kurban" });
    await a.set("kullanicilar/saldirgan", { rol: "veli" });
    await a.set("kullanicilar/gercekVeli", { rol: "veli", bagliOgrenciIdleri: ["kurban"], bagliOgrenciler: [{ id: "kurban", isim: "K" }] });
  };
  await hazirla(veliSahnesi);
  const saldirgan = db("saldirgan", { email: "s@ornek.com" });
  await dene("saldırgan kendini veli yapamaz (arrayUnion)", () =>
    assertFails(updateDoc(doc(saldirgan, "kullanicilar/saldirgan"), { bagliOgrenciIdleri: arrayUnion("kurban") })));
  await dene("saldırgan listeyi doğrudan yazamaz", () =>
    assertFails(updateDoc(doc(saldirgan, "kullanicilar/saldirgan"), { bagliOgrenciIdleri: ["kurban"] })));
  await dene("saldırgan bagliOgrenciler yazamaz", () =>
    assertFails(updateDoc(doc(saldirgan, "kullanicilar/saldirgan"), { bagliOgrenciler: [{ id: "kurban", isim: "x" }] })));
  await dene("setDoc merge ile de yazamaz", () =>
    assertFails(setDoc(doc(saldirgan, "kullanicilar/saldirgan"), { bagliOgrenciIdleri: ["kurban"] }, { merge: true })));
  await clearFirestore();
  await dene("yeni belgeyle veli listesi oluşturamaz", () =>
    assertFails(setDoc(doc(saldirgan, "kullanicilar/saldirgan"), { rol: "veli", bagliOgrenciIdleri: ["kurban"] })));
  await hazirla(veliSahnesi);
  await dene("saldırgan öğrenci profilini okuyamaz", () => assertFails(getDoc(doc(saldirgan, "kullanicilar/kurban"))));
  await dene("saldırgan öğrencinin sorularını okuyamaz", () =>
    assertFails(getDocs(query(collection(saldirgan, "sorular"), where("kullaniciUid", "==", "kurban")))));
  await dene("bağlantı kodu okunamaz", () => assertFails(getDoc(doc(saldirgan, "baglantiKodlari/ABC123"))));
  await dene("bağlantı kodu listelenemez", () => assertFails(getDocs(collection(saldirgan, "baglantiKodlari"))));
  await dene("öğrenci kendi kod kaydını da okuyamaz", () => assertFails(getDoc(doc(db("kurban"), "baglantiKodlari/ABC123"))));
  await dene("bağlantı kodu oluşturulamaz", () =>
    assertFails(setDoc(doc(saldirgan, "baglantiKodlari/ZZZ999"), { uid: "saldirgan", olusturma: "x" })));
  await dene("başkasının kodu ele geçirilemez", () =>
    assertFails(setDoc(doc(saldirgan, "baglantiKodlari/ABC123"), { uid: "saldirgan", olusturma: "x" })));
  await dene("öğrenci profilindeki kodu değiştiremez", () =>
    assertFails(updateDoc(doc(db("kurban"), "kullanicilar/kurban"), { baglantiKodu: "QQQ111" })));
  await dene("deneme sayacı okunamaz", () => assertFails(getDoc(doc(saldirgan, "veliDenemeleri/saldirgan"))));
  await dene("deneme sayacı sıfırlanamaz", () => assertFails(setDoc(doc(saldirgan, "veliDenemeleri/saldirgan"), { saatYanlis: 0 })));
  // Sunucunun kurduğu gerçek bağlantı çalışmaya devam eder
  const gercekVeli = db("gercekVeli", { email: "v@ornek.com" });
  await dene("gerçek veli öğrenci profilini okur", () => assertSucceeds(getDoc(doc(gercekVeli, "kullanicilar/kurban"))));
  await dene("gerçek veli soruları okur", () =>
    assertSucceeds(getDocs(query(collection(gercekVeli, "sorular"), where("kullaniciUid", "==", "kurban")))));
  await dene("gerçek veli listeden kendisi de silemez (sunucu üzerinden)", () =>
    assertFails(updateDoc(doc(gercekVeli, "kullanicilar/gercekVeli"), { bagliOgrenciIdleri: arrayRemove("kurban") })));
  await dene("gerçek veli diğer alanlarını güncelleyebilir", () =>
    assertSucceeds(updateDoc(doc(gercekVeli, "kullanicilar/gercekVeli"), { whatsappNo: "5551112233" })));

  // ---------------------------------------------------------------- istemciye kapalı koleksiyonlar
  for (const yol of ["kotaSayaclari/h_ali", "ayarlar/kota", "cihazHaklari/x", "platformYoneticileri/a@b.com", "abonelikEsitleme/ali", "kotaKayitlari/s1"]) {
    await dene(`${yol} okunamaz`, () => assertFails(getDoc(doc(ali, yol))));
    await dene(`${yol} yazılamaz`, () => assertFails(setDoc(doc(ali, yol), { sayi: 0 })));
  }
  await dene("soru belgesi istemciden oluşturulamaz", () =>
    assertFails(setDoc(doc(ali, "sorular/s1"), { kullaniciUid: "ali", kullaniciEposta: "ali@ornek.com", durum: "Bekliyor" })));

  // Soru durumunu sahibi değiştiremez: "İnceleme Gerekli" yazıp soru hakkı iadesi yaptıramaz
  await hazirla((a) => a.set("sorular/sIade", { kullaniciUid: "ali", kullaniciEposta: "ali@ornek.com", durum: "Bekliyor" }));
  await dene("sahibi soru durumunu İnceleme Gerekli yapamaz", () =>
    assertFails(updateDoc(doc(ali, "sorular/sIade"), { durum: "İnceleme Gerekli" })));
  await hazirla((a) => a.set("sorular/sKarar", { kullaniciUid: "ali", kullaniciEposta: "ali@ornek.com", durum: "İnceleme Gerekli" }));
  await dene("sahibi soruyu doğrudan iptal edemez (sunucu üzerinden)", () =>
    assertFails(updateDoc(doc(ali, "sorular/sKarar"), { durum: "İptal Edildi" })));
  await dene("sahibi karar / iade alanı yazamaz", () =>
    assertFails(updateDoc(doc(ali, "sorular/sKarar"), { kullaniciKarari: "iptal", hakIadeEdildi: true })));
  await hazirla((a) => a.set("sorular/sEk", { kullaniciUid: "ali", kullaniciEposta: "ali@ornek.com", durum: "İnceleme Gerekli", ekDenemeKullanildi: true }));
  await dene("sahibi ek deneme işaretini sıfırlayamaz", () =>
    assertFails(updateDoc(doc(ali, "sorular/sEk"), { ekDenemeKullanildi: false })));
  await dene("sahibi soruyu doğrudan Bekliyor'a alamaz", () =>
    assertFails(updateDoc(doc(ali, "sorular/sEk"), { durum: "Bekliyor" })));

  // Soru okuma: sahibi okur, başkası okuyamaz
  await hazirla((a) => a.set("sorular/s2", { kullaniciUid: "ayse", kullaniciEposta: "ayse@ornek.com", durum: "Çözüldü" }));
  await dene("soru sahibi okur", () => assertSucceeds(getDoc(doc(ayse, "sorular/s2"))));
  await dene("başkası soruyu okuyamaz", () => assertFails(getDoc(doc(ali, "sorular/s2"))));
  await dene("başkasının sorularını sorgulayamaz", () =>
    assertFails(getDocs(query(collection(ali, "sorular"), where("kullaniciUid", "==", "ayse")))));

  await Promise.all(acik.map((f) => terminate(f)));
  await clearFirestore();
  console.log(`[kullanicilar] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("ÇÖKTÜ", e?.code || e?.message);
  process.exit(1);
});
