// Uygulama testi: utils/oturum.js (çıkışta cihazdaki kişisel verinin temizlenmesi).
// Çalıştırma (proje kökünden):  node testler/uygulama/oturum.test.js
// Gerçek dosya, telefon kütüphaneleri sahteleriyle değiştirilerek esbuild ile derlenip çalıştırılır.

const path = require("path");
const os = require("os");
const fs = require("fs");
const KOK = path.resolve(__dirname, "..", "..");
const esbuild = require(require.resolve("esbuild", { paths: [KOK] }));

// Sahte modüller: çağrılar globalThis.__olaylar'a yazılır
const SAHTELER = {
  "@react-native-async-storage/async-storage": `
    export default {
      getAllKeys: async () => { if (globalThis.__anahtarHatasi) throw new Error("okunamadi"); return [...globalThis.__depo.keys()]; },
      multiRemove: async (ks) => { globalThis.__olaylar.push("multiRemove"); if (globalThis.__silmeHatasi) throw new Error("silinemedi"); ks.forEach((k) => globalThis.__depo.delete(k)); },
    };`,
  "@react-native-google-signin/google-signin": `
    export const GoogleSignin = { signOut: async () => { globalThis.__olaylar.push("googleCikis"); if (globalThis.__googleHatasi) throw new Error("g"); } };`,
  "firebase/auth": `export const signOut = async () => { globalThis.__olaylar.push("signOut"); };`,
  "../firebaseConfig": `export const auth = {};`,
  "./cozumYukleyici": `
    export const cozumOnbelleginiTemizle = async () => {
      globalThis.__olaylar.push("cozumTemizle");
      for (const k of [...globalThis.__depo.keys()]) if (k.startsWith("cozum:")) globalThis.__depo.delete(k);
    };`,
  "./notificationManager": `
    export const cancelAllNotifications = async () => { globalThis.__olaylar.push("bildirimIptal"); if (globalThis.__bildirimHatasi) throw new Error("b"); };`,
};

const sahteEklenti = {
  name: "sahte",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => (SAHTELER[a.path] !== undefined ? { path: a.path, namespace: "sahte" } : null));
    b.onLoad({ filter: /.*/, namespace: "sahte" }, (a) => ({ contents: SAHTELER[a.path], loader: "js" }));
  },
};

const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-oturum-")), "m.cjs");
(async () => {
  await esbuild.build({
    entryPoints: [path.join(KOK, "utils/oturum.js")],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: cikti,
    logLevel: "error",
    plugins: [sahteEklenti],
  });
  const oturum = require(cikti);

  let gecen = 0;
  let kalan = 0;
  const esit = (ad, gercek, beklenen) => {
    if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
    else {
      kalan++;
      console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
    }
  };

  const doldur = () => {
    globalThis.__depo = new Map(
      [
        "adSoyad", "seciliSinif", "kullaniciRolu", "bildirimAktif", "profilFoto", "seriGunu", "hedefRol", "bekleyenAdSoyad",
        "cozum:json:a@b.com:1", "cozum:resim:a@b.com:1", "duyuruOkundu:uid1:kurum1",
        "kullaniciTemaTercihi",
      ].map((k) => [k, "x"])
    );
    globalThis.__olaylar = [];
    globalThis.__anahtarHatasi = globalThis.__silmeHatasi = globalThis.__googleHatasi = globalThis.__bildirimHatasi = false;
  };

  // 1) Normal çıkış
  doldur();
  await oturum.oturumuKapat();
  esit("yalnızca tema tercihi kalır", [...globalThis.__depo.keys()], ["kullaniciTemaTercihi"]);
  esit("sıra: bildirim → önbellek → yerel sil → Google → çıkış", globalThis.__olaylar, [
    "bildirimIptal", "cozumTemizle", "multiRemove", "googleCikis", "signOut",
  ]);

  // 2) Yerel silme hata verse bile oturum kapanır
  doldur();
  globalThis.__silmeHatasi = true;
  await oturum.oturumuKapat();
  esit("silme hatasında da çıkış yapılır", globalThis.__olaylar.at(-1), "signOut");
  esit("silme hatasında da Google kapanır", globalThis.__olaylar.includes("googleCikis"), true);

  // 3) Bildirim ve Google hata verse bile her şey temizlenir ve çıkış yapılır
  doldur();
  globalThis.__bildirimHatasi = true;
  globalThis.__googleHatasi = true;
  await oturum.oturumuKapat();
  esit("bildirim+Google hatası: veri yine silindi", [...globalThis.__depo.keys()], ["kullaniciTemaTercihi"]);
  esit("bildirim+Google hatası: çıkış yapıldı", globalThis.__olaylar.at(-1), "signOut");

  // 4) Anahtar listesi okunamazsa sabit anahtarlar ve çözüm önbelleği yine silinir
  doldur();
  globalThis.__anahtarHatasi = true;
  await oturum.oturumuKapat();
  esit(
    "anahtar okuma hatası: sabitler + önbellek silindi, yalnızca önekli duyuru kaydı kalabilir",
    [...globalThis.__depo.keys()].sort(),
    ["duyuruOkundu:uid1:kurum1", "kullaniciTemaTercihi"]
  );
  esit("anahtar okuma hatası: çıkış yapıldı", globalThis.__olaylar.at(-1), "signOut");

  // 5) Hesap silmede kullanılan temizlik de aynı listeyi kullanır
  doldur();
  await oturum.yerelKullaniciVerisiniTemizle();
  esit("yerel temizlik (hesap silme)", [...globalThis.__depo.keys()], ["kullaniciTemaTercihi"]);
  esit("yerel temizlik çıkış yapmaz", globalThis.__olaylar.includes("signOut"), false);

  console.log(`[oturum] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
