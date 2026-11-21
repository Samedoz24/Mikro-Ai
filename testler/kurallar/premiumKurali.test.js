// Kural testi: istemci premium alanlarını (premiumMu, premiumKaynaklari) yazamaz. Ek araç gerekmez.
// Çalıştırma (proje kökünden):
//   firebase emulators:exec --project demo-mikro --only firestore,auth "node testler/kurallar/premiumKurali.test.js"
const KOK = require("path").resolve(__dirname, "..", "..");
const al = (m) => require(require.resolve(m, { paths: [KOK] }));
const { initializeApp } = al("firebase/app");
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = al("firebase/auth");
const { getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc } = al("firebase/firestore");

let gecen = 0, kalan = 0;
const esit = (ad, g, b) => { if (JSON.stringify(g) === JSON.stringify(b)) gecen++; else { kalan++; console.log("HATA:", ad, "beklenen", JSON.stringify(b), "gelen", JSON.stringify(g)); } };
const reddedilirMi = async (fn) => { try { await fn(); return false; } catch (e) { return e.code === "permission-denied"; } };

(async () => {
  const app = initializeApp({ apiKey: "demo", projectId: "demo-mikro", appId: "1:1:web:1" });
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8089);
  const u = (await createUserWithEmailAndPassword(auth, `premium${Date.now()}@ornek.com`, "sifre12345")).user;
  const ref = doc(db, "kullanicilar", u.uid);

  const abone = { abonelik: { aktif: true, bitis: "2099-01-01T00:00:00Z" } };
  esit("oluştururken premiumKaynaklari yazılamaz", await reddedilirMi(() => setDoc(ref, { rol: "ogrenci", premiumKaynaklari: abone })), true);
  esit("oluştururken premiumMu yazılamaz", await reddedilirMi(() => setDoc(ref, { rol: "ogrenci", premiumMu: true })), true);
  esit("normal profil oluşturulur", await reddedilirMi(() => setDoc(ref, { rol: "ogrenci", eposta: "x@ornek.com" })), false);
  esit("güncellerken premiumKaynaklari eklenemez", await reddedilirMi(() => updateDoc(ref, { premiumKaynaklari: abone })), true);
  esit("güncellerken kurum kaynağı eklenemez", await reddedilirMi(() => updateDoc(ref, { "premiumKaynaklari.kurum": true })), true);
  esit("güncellerken premiumMu yazılamaz", await reddedilirMi(() => updateDoc(ref, { premiumMu: true })), true);
  esit("normal alan güncellenir", await reddedilirMi(() => updateDoc(ref, { seriGunu: 2 })), false);

  console.log(`[kural-premium] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => { console.error("ÇÖKTÜ", e.code || e.message); process.exit(1); });
