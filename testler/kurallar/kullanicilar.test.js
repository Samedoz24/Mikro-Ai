// Firestore güvenlik kuralları testi: kullanicilar (profil alanları dahil) ve istemciye kapalı koleksiyonlar.
//
// Çalıştırma (test araçları ayrı bir klasörde kurulu olmalı; uygulamanın node_modules'u kullanılmaz):
//   ARAC=/test/araclari/klasoru  firebase emulators:exec --only firestore "node testler/kurallar/kullanicilar.test.js"
// ARAC klasöründe: @firebase/rules-unit-testing@3, firebase@10 (firebase-tools ile emülatör başlatılır).

const path = require("path");
const fs = require("fs");

const ARAC = process.env.ARAC;
if (!ARAC) throw new Error("ARAC ortam değişkeni (test araçları klasörü) gerekli");
const al = (m) => require(require.resolve(m, { paths: [ARAC] }));

const { initializeTestEnvironment, assertSucceeds, assertFails } = al("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteField, collection, query, where, getDocs } = al("firebase/firestore");

const KOK = path.resolve(__dirname, "..", "..");
const KOVA = "project-21-3e377.firebasestorage.app";
const fotoAdresi = (uid, token = "2226a9a7-b5b9-4cea-8984-e7cd014a910f") =>
  `https://firebasestorage.googleapis.com/v0/b/${KOVA}/o/profil_fotograflari%2F${uid}.jpg?alt=media&token=${token}`;

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
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8089").split(":");
  const env = await initializeTestEnvironment({
    projectId: "kurallar-testi",
    firestore: { rules: fs.readFileSync(path.join(KOK, "firestore.rules"), "utf8"), host, port: Number(port) },
  });

  const db = (uid, claims) => (uid ? env.authenticatedContext(uid, claims) : env.unauthenticatedContext()).firestore();
  const hazirla = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));

  const ali = db("ali", { email: "ali@ornek.com" });
  const ayse = db("ayse", { email: "ayse@ornek.com" });
  const anonim = db(null);

  // ---------------------------------------------------------------- oluşturma
  await dene("öğrenci kendi belgesini oluşturur", () =>
    assertSucceeds(setDoc(doc(ali, "kullanicilar/ali"), { eposta: "ali@ornek.com", rol: "ogrenci" })));
  await env.clearFirestore();
  await dene("veli rolüyle oluşturur", () =>
    assertSucceeds(setDoc(doc(ali, "kullanicilar/ali"), { rol: "veli" })));
  await env.clearFirestore();
  await dene("yonetici rolü yazamaz", () => assertFails(setDoc(doc(ali, "kullanicilar/ali"), { rol: "yonetici" })));
  await dene("premiumMu yazamaz", () => assertFails(setDoc(doc(ali, "kullanicilar/ali"), { rol: "ogrenci", premiumMu: true })));
  await dene("kurumId yazamaz", () => assertFails(setDoc(doc(ali, "kullanicilar/ali"), { kurumId: "k1" })));
  await dene("başkasının belgesini oluşturamaz", () => assertFails(setDoc(doc(ali, "kullanicilar/ayse"), { rol: "ogrenci" })));
  await dene("oturumsuz oluşturamaz", () => assertFails(setDoc(doc(anonim, "kullanicilar/ali"), { rol: "ogrenci" })));
  await dene("oluştururken geçerli fotoğraf", () =>
    assertSucceeds(setDoc(doc(ali, "kullanicilar/ali"), { rol: "ogrenci", profilFoto: fotoAdresi("ali") })));
  await env.clearFirestore();
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
  await hazirla((a) => setDoc(doc(a, "kullanicilar/eski"), { rol: "ogrenci", profilFoto: "https://eski.site/x.jpg", adSoyad: "b".repeat(100) }));
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
  await hazirla((a) => setDoc(doc(a, "kullanicilar/mudur1"), { rol: "yonetici" }));
  await dene("yönetici rolünden çıkamaz", () => assertFails(updateDoc(doc(db("mudur1"), "kullanicilar/mudur1"), { rol: "ogrenci" })));
  await dene("başkasının belgesini güncelleyemez", () => assertFails(updateDoc(doc(ayse, "kullanicilar/ali"), { adSoyad: "x" })));
  await dene("kendi belgesini okur", () => assertSucceeds(getDoc(doc(ali, "kullanicilar/ali"))));
  await dene("başkasının belgesini okuyamaz", () => assertFails(getDoc(doc(ayse, "kullanicilar/ali"))));
  await dene("kullanıcı listesi alınamaz", () => assertFails(getDocs(collection(ali, "kullanicilar"))));
  await dene("oturumsuz okuyamaz", () => assertFails(getDoc(doc(anonim, "kullanicilar/ali"))));

  // ---------------------------------------------------------------- veli bağlantısı yalnızca sunucuda
  // Açık (düzeltildi): istemci kendi belgesine öğrenci kimliği yazıp o öğrencinin verisini okuyabiliyordu.
  await hazirla(async (a) => {
    await setDoc(doc(a, "kullanicilar/kurban"), { rol: "ogrenci", eposta: "kurban@ornek.com", baglantiKodu: "ABC123" });
    await setDoc(doc(a, "sorular/k1"), { kullaniciUid: "kurban", kullaniciEposta: "kurban@ornek.com", fotoLink: "x" });
    await setDoc(doc(a, "baglantiKodlari/ABC123"), { uid: "kurban" });
    await setDoc(doc(a, "kullanicilar/saldirgan"), { rol: "veli" });
    await setDoc(doc(a, "kullanicilar/gercekVeli"), { rol: "veli", bagliOgrenciIdleri: ["kurban"], bagliOgrenciler: [{ id: "kurban", isim: "K" }] });
  });
  const saldirgan = db("saldirgan", { email: "s@ornek.com" });
  const { arrayUnion, arrayRemove } = al("firebase/firestore");
  await dene("saldırgan kendini veli yapamaz (arrayUnion)", () =>
    assertFails(updateDoc(doc(saldirgan, "kullanicilar/saldirgan"), { bagliOgrenciIdleri: arrayUnion("kurban") })));
  await dene("saldırgan listeyi doğrudan yazamaz", () =>
    assertFails(updateDoc(doc(saldirgan, "kullanicilar/saldirgan"), { bagliOgrenciIdleri: ["kurban"] })));
  await dene("saldırgan bagliOgrenciler yazamaz", () =>
    assertFails(updateDoc(doc(saldirgan, "kullanicilar/saldirgan"), { bagliOgrenciler: [{ id: "kurban", isim: "x" }] })));
  await dene("setDoc merge ile de yazamaz", () =>
    assertFails(setDoc(doc(saldirgan, "kullanicilar/saldirgan"), { bagliOgrenciIdleri: ["kurban"] }, { merge: true })));
  await env.clearFirestore();
  await dene("yeni belgeyle veli listesi oluşturamaz", () =>
    assertFails(setDoc(doc(saldirgan, "kullanicilar/saldirgan"), { rol: "veli", bagliOgrenciIdleri: ["kurban"] })));
  await hazirla(async (a) => {
    await setDoc(doc(a, "kullanicilar/kurban"), { rol: "ogrenci", eposta: "kurban@ornek.com", baglantiKodu: "ABC123" });
    await setDoc(doc(a, "sorular/k1"), { kullaniciUid: "kurban", kullaniciEposta: "kurban@ornek.com", fotoLink: "x" });
    await setDoc(doc(a, "baglantiKodlari/ABC123"), { uid: "kurban" });
    await setDoc(doc(a, "kullanicilar/saldirgan"), { rol: "veli" });
    await setDoc(doc(a, "kullanicilar/gercekVeli"), { rol: "veli", bagliOgrenciIdleri: ["kurban"], bagliOgrenciler: [{ id: "kurban", isim: "K" }] });
  });
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
  for (const yol of ["kotaSayaclari/h_ali", "ayarlar/kota", "cihazHaklari/x", "platformYoneticileri/a@b.com"]) {
    await dene(`${yol} okunamaz`, () => assertFails(getDoc(doc(ali, yol))));
    await dene(`${yol} yazılamaz`, () => assertFails(setDoc(doc(ali, yol), { sayi: 0 })));
  }
  await dene("soru belgesi istemciden oluşturulamaz", () =>
    assertFails(setDoc(doc(ali, "sorular/s1"), { kullaniciUid: "ali", kullaniciEposta: "ali@ornek.com", durum: "Bekliyor" })));

  // Soru okuma: sahibi okur, başkası okuyamaz
  await hazirla((a) => setDoc(doc(a, "sorular/s2"), { kullaniciUid: "ayse", kullaniciEposta: "ayse@ornek.com", durum: "Çözüldü" }));
  await dene("soru sahibi okur", () => assertSucceeds(getDoc(doc(ayse, "sorular/s2"))));
  await dene("başkası soruyu okuyamaz", () => assertFails(getDoc(doc(ali, "sorular/s2"))));
  await dene("başkasının sorularını sorgulayamaz", () =>
    assertFails(getDocs(query(collection(ali, "sorular"), where("kullaniciUid", "==", "ayse")))));

  await env.cleanup();
  console.log(`[kullanicilar] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
