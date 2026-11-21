// Kural testi: sorular — soru sahipliği (kimlik ya da DOĞRULANMIŞ e-posta). Ek araç gerekmez: uygulamanın
// firebase istemcisi ve functions klasörünün firebase-admin paketi kullanılır.
// Çalıştırma (proje kökünden):
//   firebase emulators:exec --project demo-mikro --only firestore,auth "node testler/kurallar/soruSahibi.test.js"
const KOK = require("path").resolve(__dirname, "..", "..");
const al = (m) => require(require.resolve(m, { paths: [KOK] }));
const { initializeApp, deleteApp } = al("firebase/app");
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } = al("firebase/auth");
const { getFirestore, connectFirestoreEmulator, collection, query, where, getDocs, doc, updateDoc, getDoc, deleteDoc } = al("firebase/firestore");
const A = (m) => require(require.resolve(m, { paths: [KOK + "/functions"] }));
const adminApp = A("firebase-admin/app"); const adminFs = A("firebase-admin/firestore"); const adminAuth = A("firebase-admin/auth");

let gecen = 0, kalan = 0;
const esit = (ad, g, b) => { if (JSON.stringify(g) === JSON.stringify(b)) gecen++; else { kalan++; console.log("HATA:", ad, "beklenen", JSON.stringify(b), "gelen", JSON.stringify(g)); } };
const reddedilirMi = async (fn) => { try { await fn(); return false; } catch (e) { return e.code === "permission-denied"; } };

let n = 0;
const istemci = async (eposta, sifre, olustur) => {
  const app = initializeApp({ apiKey: "demo", projectId: "demo-mikro", appId: "1:1:web:1" }, "i" + n++);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8089);
  const u = olustur ? (await createUserWithEmailAndPassword(auth, eposta, sifre)).user : (await signInWithEmailAndPassword(auth, eposta, sifre)).user;
  return { app, db, u };
};

(async () => {
  adminApp.initializeApp({ projectId: "demo-mikro" }, "admin");
  const adb = adminFs.getFirestore(adminApp.getApp("admin"));
  const aauth = adminAuth.getAuth(adminApp.getApp("admin"));

  // Dogrulanmamis hesap (D) ve dogrulanmis hesap (V)
  const d = await istemci("dogrulanmamis@ornek.com", "sifre12345", true);
  const vIlk = await istemci("dogrulanmis@ornek.com", "sifre12345", true);
  await aauth.updateUser(vIlk.u.uid, { emailVerified: true });
  await deleteApp(vIlk.app);
  const v = await istemci("dogrulanmis@ornek.com", "sifre12345", false); // yeni belirteç: email_verified=true

  await adb.doc("sorular/dUid").set({ kullaniciUid: d.u.uid, kullaniciEposta: "dogrulanmamis@ornek.com" });
  await adb.doc("sorular/dEski").set({ kullaniciEposta: "dogrulanmamis@ornek.com" }); // kimliksiz eski soru
  await adb.doc("sorular/vEski").set({ kullaniciEposta: "dogrulanmis@ornek.com" });

  // Dogrulanmamis: kimlikle sorgu izinli, e-postayla sorgu REDDEDILIR
  esit("doğrulanmamış: kimlikle sorgu", (await getDocs(query(collection(d.db, "sorular"), where("kullaniciUid", "==", d.u.uid)))).docs.map((x) => x.id), ["dUid"]);
  esit("doğrulanmamış: e-postayla sorgu reddedilir", await reddedilirMi(() => getDocs(query(collection(d.db, "sorular"), where("kullaniciEposta", "==", "dogrulanmamis@ornek.com")))), true);
  esit("doğrulanmamış: kimliksiz eski soruyu okuyamaz", await reddedilirMi(() => getDoc(doc(d.db, "sorular/dEski"))), true);
  esit("doğrulanmamış: kimliksiz eski soruyu güncelleyemez", await reddedilirMi(() => updateDoc(doc(d.db, "sorular/dEski"), { okunduMu: true })), true);
  esit("doğrulanmamış: kimliksiz eski soruyu silemez", await reddedilirMi(() => deleteDoc(doc(d.db, "sorular/dEski"))), true);
  esit("doğrulanmamış: kendi (kimlikli) sorusunu günceller", await reddedilirMi(() => updateDoc(doc(d.db, "sorular/dUid"), { okunduMu: true })), false);

  // Dogrulanmis: e-postayla eski soruya erisir
  esit("doğrulanmış: e-postayla sorgu izinli", (await getDocs(query(collection(v.db, "sorular"), where("kullaniciEposta", "==", "dogrulanmis@ornek.com")))).docs.map((x) => x.id), ["vEski"]);
  esit("doğrulanmış: eski soruyu günceller", await reddedilirMi(() => updateDoc(doc(v.db, "sorular/vEski"), { okunduMu: true })), false);
  // Dogrulanmis kullanici baskasinin e-postasiyla eslesen soruya erisemez
  esit("doğrulanmış: başkasının eski sorusunu okuyamaz", await reddedilirMi(() => getDoc(doc(v.db, "sorular/dEski"))), true);
  // Kimlikle baskasinin sorusu
  esit("doğrulanmamış: başkasının kimliğiyle sorgu reddedilir", await reddedilirMi(() => getDocs(query(collection(d.db, "sorular"), where("kullaniciUid", "==", v.u.uid)))), true);

  console.log(`[kural-soruSahibi] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => { console.error("ÇÖKTÜ", e.code || e.message); process.exit(1); });
