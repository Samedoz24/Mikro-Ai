// Sunucu testi: tüm callable fonksiyonlarda App Check zorunluluğu (functions/index.js, enforceAppCheck).
// Çalıştırma (proje kökünden, emülatör gerekmez):  node testler/sunucu/appCheck.test.js
//
// Gerçek Firebase Functions istek işleyicisi kullanılır; yalnızca Google'ın belge doğrulayıcısı
// (getAppCheck().verifyToken) sahte bir doğrulayıcıyla değiştirilir, böylece ağ gerekmez.
// Kontrol edilenler: belgesiz istek reddedilir, sahte belge reddedilir, geçerli belgeyle istek fonksiyona ulaşır.

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-mikro";
delete process.env.FIREBASE_DEBUG_MODE; // doğrulamayı atlayan hata ayıklama modu kapalı olmalı
delete process.env.FIREBASE_DEBUG_FEATURES;

const path = require("path");
const FN = path.resolve(__dirname, "..", "..", "functions");
const al = (m) => require(require.resolve(m, { paths: [FN] }));

// Sahte doğrulayıcı: yalnızca "gecerli-belge" kabul edilir
const GECERLI = "gecerli-belge";
const appCheckModulu = al("firebase-admin/app-check");
appCheckModulu.getAppCheck = () => ({
  verifyToken: async (belge) => {
    if (belge !== GECERLI) throw new Error("gecersiz belge");
    return { appId: "1:000:ios:test", token: { app_id: "1:000:ios:test" } };
  },
});

const fonksiyonlar = require(path.join(FN, "index.js"));

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};

// Uygulamanın yaptığı gibi bir callable isteği gönderir; { durum, hata } döner
const cagir = (fn, basliklar = {}) =>
  new Promise((coz) => {
    const h = { "content-type": "application/json", ...basliklar };
    const kucuk = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
    const req = {
      method: "POST",
      headers: kucuk,
      header: (ad) => kucuk[ad.toLowerCase()],
      get: (ad) => kucuk[ad.toLowerCase()],
      body: { data: {} },
      url: "/",
      originalUrl: "/",
    };
    let durum = 200;
    const res = {
      status(k) { durum = k; return this; },
      set() { return this; },
      setHeader() {},
      getHeader() {},
      on() {},
      vary() {},
      end() { coz({ durum, hata: null }); },
      send(govde) {
        const g = typeof govde === "string" ? JSON.parse(govde) : govde;
        coz({ durum, hata: g?.error ? { status: g.error.status, message: g.error.message } : null });
      },
    };
    res.json = res.send;
    Promise.resolve(fn(req, res)).catch((e) => coz({ durum: -1, hata: { message: e.message } }));
  });

(async () => {
  const callable = Object.entries(fonksiyonlar).filter(([, f]) => f?.__endpoint?.callableTrigger);
  const digerleri = Object.entries(fonksiyonlar).filter(([, f]) => !f?.__endpoint?.callableTrigger);

  esit("callable fonksiyon sayısı", callable.length, 29);
  esit("callable olmayan (zamanlanmış/tetikleyici) sayısı", digerleri.length, 5);

  for (const [ad, fn] of callable) {
    // 1) Belge yok → reddedilir
    const yok = await cagir(fn);
    esit(`${ad}: belgesiz istek App Check'te reddedilir`, [yok.durum, yok.hata?.status, yok.hata?.message], [401, "UNAUTHENTICATED", "Unauthenticated"]);

    // 2) Sahte belge → reddedilir
    const sahte = await cagir(fn, { "X-Firebase-AppCheck": "sahte-belge" });
    esit(`${ad}: sahte belge App Check'te reddedilir`, [sahte.durum, sahte.hata?.status, sahte.hata?.message], [401, "UNAUTHENTICATED", "Unauthenticated"]);

    // 3) Geçerli belge, giriş yok → App Check'i geçer, fonksiyonun kendi kontrolüne ulaşır.
    //    App Check reddi mesajı "Unauthenticated"dır; fonksiyonlarımız bu mesajı hiç kullanmaz (giriş yoksa
    //    "giris-gerekli" der). Böylece reddin App Check'ten mi fonksiyondan mı geldiği ayırt edilir.
    const gecerli = await cagir(fn, { "X-Firebase-AppCheck": GECERLI });
    esit(`${ad}: geçerli belge App Check'i geçer`, gecerli.hata?.message === "Unauthenticated", false);
    esit(`${ad}: geçerli belgeyle fonksiyon kendi giriş kontrolüne ulaşır`, gecerli.hata?.message, "giris-gerekli");
  }

  console.log(`[appCheck] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})();
