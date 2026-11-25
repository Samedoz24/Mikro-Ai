// Uygulama testi: utils/premiumPlanlari.js + utils/magaza.js (RevenueCat satın alma katmanı).
// Çalıştırma (proje kökünden):  node testler/uygulama/abonelik.test.js
// Gerçek dosyalar, RevenueCat / Firebase / React Native sahteleriyle değiştirilerek esbuild ile derlenip çalıştırılır.
//
// Güvenlik açısından denenenler: satın alma yalnızca SDK kimliği = girişli uid iken başlar; giriş yokken,
// kimlik uyuşmazken, hesap değiştirilemediğinde başlamaz; çıkışta SDK kimliği bırakılır; premium'u yalnızca
// sunucu (abonelikYenile) belirler; satın alma sırasında kimlik değişirse sunucuya yanlış kişi için sorulmaz;
// deneme metni yalnızca "uygun" kullanıcıya gösterilir; yayın sürümünde önizleme fiyatı gösterilmez.

const path = require("path");
const os = require("os");
const fs = require("fs");
const KOK = path.resolve(__dirname, "..", "..");
const esbuild = require(require.resolve("esbuild", { paths: [KOK] }));

const SAHTELER = {
  "react-native": `export const Platform = { get OS() { return globalThis.__platform; } };`,
  "react-native-purchases": `
    const rc = () => globalThis.__rc;
    export const LOG_LEVEL = { INFO: "INFO", WARN: "WARN" };
    const Purchases = {
      PACKAGE_TYPE: { MONTHLY: "MONTHLY", TWO_MONTH: "TWO_MONTH", THREE_MONTH: "THREE_MONTH", SIX_MONTH: "SIX_MONTH", ANNUAL: "ANNUAL", WEEKLY: "WEEKLY", LIFETIME: "LIFETIME" },
      PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: "1", RECEIPT_ALREADY_IN_USE_ERROR: "7", PAYMENT_PENDING_ERROR: "20" },
      INTRO_ELIGIBILITY_STATUS: { INTRO_ELIGIBILITY_STATUS_UNKNOWN: 0, INTRO_ELIGIBILITY_STATUS_INELIGIBLE: 1, INTRO_ELIGIBILITY_STATUS_ELIGIBLE: 2 },
      setLogLevel: async (l) => { rc().olaylar.push("log:" + l); },
      configure: ({ apiKey, appUserID }) => { rc().olaylar.push("configure:" + appUserID); rc().anahtar = apiKey; rc().kimlik = appUserID; },
      getAppUserID: async () => rc().kimlik,
      logIn: async (u) => { rc().olaylar.push("logIn:" + u); if (rc().girisHatasi) throw new Error("giris"); rc().kimlik = u; return {}; },
      logOut: async () => { rc().olaylar.push("logOut"); rc().kimlik = "$RCAnonymousID:abc"; return {}; },
      isAnonymous: async () => String(rc().kimlik).startsWith("$RCAnonymousID"),
      getOfferings: async () => { if (rc().teklifHatasi) throw new Error("teklif"); return rc().teklifler; },
      checkTrialOrIntroductoryPriceEligibility: async () => { if (rc().uygunlukHatasi) throw new Error("u"); return rc().uygunluk; },
      purchasePackage: async (p) => {
        rc().olaylar.push("satinAl:" + p.identifier);
        if (rc().satinAlirkenKimlik) rc().kimlik = rc().satinAlirkenKimlik;
        if (rc().satinAlmaHatasi) throw rc().satinAlmaHatasi;
        return {};
      },
      restorePurchases: async () => { rc().olaylar.push("geriYukle"); if (rc().geriYuklemeHatasi) throw rc().geriYuklemeHatasi; return {}; },
    };
    export default Purchases;`,
  "firebase/functions": `
    export const httpsCallable = (f, ad) => async () => {
      globalThis.__rc.olaylar.push("sunucu:" + ad);
      if (globalThis.__rc.sunucuHatasi) { const e = new Error("s"); e.code = globalThis.__rc.sunucuHatasi; throw e; }
      return { data: globalThis.__rc.sunucuCevabi };
    };`,
  "../firebaseConfig": `export const auth = globalThis.__auth; export const functions = {};`,
};

const sahteEklenti = {
  name: "sahte",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => (SAHTELER[a.path] !== undefined ? { path: a.path, namespace: "sahte" } : null));
    b.onLoad({ filter: /.*/, namespace: "sahte" }, (a) => ({ contents: SAHTELER[a.path], loader: "js" }));
  },
};

const derle = async (gelistirme) => {
  const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-abonelik-")), "m.cjs");
  await esbuild.build({
    stdin: {
      contents: 'export * from "./utils/premiumPlanlari.js"; export * from "./utils/magaza.js";',
      resolveDir: KOK,
      loader: "js",
    },
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: cikti,
    logLevel: "error",
    define: { __DEV__: gelistirme ? "true" : "false" },
    plugins: [sahteEklenti],
  });
  return cikti;
};

// Ürün / paket üreticileri
const urun = (identifier, price, ek = {}) => ({
  identifier,
  price,
  priceString: `${price} ₺`,
  pricePerMonthString: ek.aylik ?? null,
  introPrice: ek.giris ?? null,
});
const paket = (identifier, packageType, u) => ({ identifier, packageType, product: u });

const TEKLIF = {
  current: {
    availablePackages: [
      paket("$rc_annual", "ANNUAL", urun("yillik_urun", 1999, { aylik: "166,58 ₺", giris: { price: 0, priceString: "0 ₺", cycles: 1, periodUnit: "DAY", periodNumberOfUnits: 7 } })),
      paket("$rc_weekly", "WEEKLY", urun("haftalik_urun", 400, { aylik: "1.733 ₺" })),
      paket("$rc_lifetime", "LIFETIME", urun("omur_boyu", 9999)),
      paket("$rc_monthly", "MONTHLY", urun("aylik_urun", 349, { aylik: "349 ₺" })),
      paket("$rc_monthly_kopya", "MONTHLY", urun("aylik_kopya", 299)),
      paket("$rc_three_month", "THREE_MONTH", urun("uc_aylik_urun", 799, { aylik: "266,33 ₺" })),
      paket("$rc_six_month", "SIX_MONTH", urun("bozuk", 0)),
    ],
  },
};

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};
const hataKodu = async (is) => {
  try {
    await is();
    return "hata-yok";
  } catch (e) {
    return e?.code ?? e?.message;
  }
};

const sifirla = (ek = {}) => {
  globalThis.__rc = {
    olaylar: [],
    kimlik: globalThis.__rc?.kimlik ?? null,
    teklifler: TEKLIF,
    uygunluk: { yillik_urun: { status: 2 } },
    sunucuCevabi: { premium: true, abonelik: true },
    ...ek,
  };
};

(async () => {
  globalThis.__auth = { currentUser: null };
  sifirla();

  // ------------------------------------------------ yayın sürümü
  const m = require(await derle(false));

  // 1) Android: mağaza kapalı, SDK'ya hiç dokunulmaz, önizleme fiyatı yok
  globalThis.__platform = "android";
  globalThis.__auth.currentUser = { uid: "uidA" };
  esit("android: plan yok", await m.planlariGetir(), { planlar: [], onizleme: false, satinAlinabilir: false });
  esit("android: satın alma kapalı", await hataKodu(() => m.satinAl("aylik")), m.SATIN_ALMA_HAZIR_DEGIL);
  esit("android: geri yükleme kapalı", await hataKodu(() => m.satinAlimlariGeriYukle()), m.SATIN_ALMA_HAZIR_DEGIL);
  esit("android: SDK'ya dokunulmadı", globalThis.__rc.olaylar, []);

  globalThis.__platform = "ios";

  // 2) Giriş yokken: plan gösterilmez, satın alma başlamaz, SDK yapılandırılmaz
  globalThis.__auth.currentUser = null;
  sifirla();
  esit("giriş yok: plan yok", (await m.planlariGetir()).satinAlinabilir, false);
  esit("giriş yok: geri yükleme kapalı", await hataKodu(() => m.satinAlimlariGeriYukle()), m.SATIN_ALMA_HAZIR_DEGIL);
  esit("giriş yok: SDK yapılandırılmadı", globalThis.__rc.olaylar, []);

  // 3) Geçersiz kimlikle SDK yapılandırılmaz (anonim / bozuk kimlik RevenueCat'e gitmez)
  esit("geçersiz uid", await hataKodu(() => m.magazaKullanicisiniAyarla("$RCAnonymousID:x")), "magaza/hazir-degil");
  esit("boş uid", await hataKodu(() => m.magazaKullanicisiniAyarla("")), "magaza/hazir-degil");
  esit("geçersiz uid: SDK'ya dokunulmadı", globalThis.__rc.olaylar, []);

  // 4) Girişli öğrenci: tek configure, kimlik = uid, yayında günlük WARN
  globalThis.__auth.currentUser = { uid: "uidA" };
  esit("ayarla", await m.magazaKullanicisiniAyarla("uidA"), true);
  esit("configure uid ile", globalThis.__rc.olaylar, ["log:WARN", "configure:uidA"]);
  esit("genel anahtar (appl_) kullanılıyor", globalThis.__rc.anahtar.startsWith("appl_"), true);
  sifirla();
  await m.magazaKullanicisiniAyarla("uidA");
  esit("aynı kullanıcı: tekrar configure / logIn yok", globalThis.__rc.olaylar, []);

  // 5) Planlar: paket türüne göre, sıralı; ömür boyu, kopya ve fiyatsız paket elenir; deneme yalnızca uygun olana
  sifirla();
  const p1 = await m.planlariGetir();
  const plan = (liste, id) => liste.find((x) => x.id === id);
  esit("plan kimlikleri", p1.planlar.map((p) => p.id), ["haftalik", "aylik", "uc_aylik", "yillik"]);
  esit("satın alınabilir", [p1.onizleme, p1.satinAlinabilir], [false, true]);
  esit("aylıkta aylık fiyat satırı yok", plan(p1.planlar, "aylik").aylikFiyatYazi, null);
  esit("haftalıkta aylık fiyat satırı yok", plan(p1.planlar, "haftalik").aylikFiyatYazi, null);
  esit("haftalıkta tasarruf yok", m.tasarrufYuzdesi(p1.planlar, "haftalik"), 0);
  esit("3 aylıkta aylık fiyat satırı var", plan(p1.planlar, "uc_aylik").aylikFiyatYazi, "266,33 ₺");
  esit("yıllık: mağaza fiyatı", [plan(p1.planlar, "yillik").fiyat, plan(p1.planlar, "yillik").fiyatYazi, plan(p1.planlar, "yillik").aylikFiyatYazi], [1999, "1999 ₺", "166,58 ₺"]);
  esit("yıllık: deneme metni", plan(p1.planlar, "yillik").deneme, "İlk 7 gün ücretsiz");
  esit("tasarruf yüzdesi (yıllık)", m.tasarrufYuzdesi(p1.planlar, "yillik"), 52);

  sifirla({ uygunluk: { yillik_urun: { status: 1 } } });
  esit("deneme hakkı yoksa metin yok", plan((await m.planlariGetir()).planlar, "yillik").deneme, null);
  sifirla({ uygunlukHatasi: true });
  const p2 = await m.planlariGetir();
  esit("uygunluk öğrenilemezse metin yok ama planlar var", [p2.planlar.length, plan(p2.planlar, "yillik").deneme], [4, null]);

  sifirla({ teklifler: { current: null } });
  esit("teklif yok (yayın): boş, önizleme yok", await m.planlariGetir(), { planlar: [], onizleme: false, satinAlinabilir: false });
  esit("teklif yokken satın alma kapalı", await hataKodu(() => m.satinAl("aylik")), m.SATIN_ALMA_HAZIR_DEGIL);
  sifirla({ teklifHatasi: true });
  esit("teklif hatası: boş", (await m.planlariGetir()).planlar, []);

  // 6) Başarılı satın alma: önce mağaza, sonra sunucu doğrulaması; sonuç sunucudan
  sifirla();
  await m.planlariGetir();
  sifirla();
  esit("satın alma sonucu sunucudan", await m.satinAl("yillik"), { dogrulandi: true, premium: true, abonelik: true });
  esit("sıra: satın al → sunucu", globalThis.__rc.olaylar, ["satinAl:$rc_annual", "sunucu:abonelikYenile"]);

  sifirla({ sunucuCevabi: { premium: "evet", abonelik: 1 } });
  esit("sunucu cevabı yalnızca true ise kabul", await m.satinAl("yillik"), { dogrulandi: true, premium: false, abonelik: false });

  // 7) Sunucu doğrulayamazsa satın alma yine geçerli; hata fırlatılmaz, premium iddia edilmez
  sifirla({ sunucuHatasi: "functions/resource-exhausted" });
  esit("sunucu hatası", await m.satinAl("aylik"), { dogrulandi: false, premium: false, abonelik: false });

  // 8) Satın alma sırasında SDK kimliği değişirse sunucuya sorulmaz
  sifirla({ satinAlirkenKimlik: "baskasi" });
  esit("kimlik değişti: doğrulanmadı", await m.satinAl("aylik"), { dogrulandi: false, premium: false, abonelik: false });
  esit("kimlik değişti: sunucu çağrılmadı", globalThis.__rc.olaylar.includes("sunucu:abonelikYenile"), false);

  // 9) SDK kimliği girişli kullanıcıdan farklıysa satın alma BAŞLAMAZ
  sifirla({ kimlik: "baskasi" });
  esit("kimlik uyuşmazlığı: reddedildi", await hataKodu(() => m.satinAl("aylik")), m.SATIN_ALMA_HAZIR_DEGIL);
  esit("kimlik uyuşmazlığı: satın alma yok", globalThis.__rc.olaylar.some((o) => o.startsWith("satinAl")), false);
  esit("kimlik uyuşmazlığı: geri yükleme yok", await hataKodu(() => m.satinAlimlariGeriYukle()), m.SATIN_ALMA_HAZIR_DEGIL);
  esit("kimlik uyuşmazlığı: hiçbir mağaza işlemi yok", globalThis.__rc.olaylar.filter((o) => /satinAl|geriYukle|sunucu/.test(o)), []);

  // 10) Hesap değişince önce logIn, sonra satın alma yeni kimlikle
  sifirla({ kimlik: "uidA" });
  await m.magazaKullanicisiniAyarla("uidA");
  globalThis.__auth.currentUser = { uid: "uidB" };
  sifirla();
  await m.satinAl("aylik");
  esit("hesap değişimi: logIn sonra satın al", globalThis.__rc.olaylar, ["logIn:uidB", "satinAl:$rc_monthly", "sunucu:abonelikYenile"]);

  // 11) logIn başarısızsa satın alma başlamaz
  globalThis.__auth.currentUser = { uid: "uidC" };
  sifirla({ girisHatasi: true });
  esit("logIn hatası: reddedildi", await hataKodu(() => m.satinAl("aylik")), m.SATIN_ALMA_HAZIR_DEGIL);
  esit("logIn hatası: satın alma yok", globalThis.__rc.olaylar, ["logIn:uidC"]);
  sifirla();
  esit("logIn sonraki denemede düzelirse çalışır", (await m.satinAl("aylik")).dogrulandi, true);

  // 12) Vazgeçme ve onay bekleyen satın alma
  sifirla({ satinAlmaHatasi: { userCancelled: true } });
  esit("vazgeçti (userCancelled)", await hataKodu(() => m.satinAl("aylik")), m.SATIN_ALMA_IPTAL);
  sifirla({ satinAlmaHatasi: { code: "1" } });
  esit("vazgeçti (kod 1)", await hataKodu(() => m.satinAl("aylik")), m.SATIN_ALMA_IPTAL);
  sifirla({ satinAlmaHatasi: { code: "20" } });
  esit("onay bekliyor", await hataKodu(() => m.satinAl("aylik")), m.SATIN_ALMA_BEKLEMEDE);
  esit("onay bekliyor: sunucu çağrılmadı", globalThis.__rc.olaylar.includes("sunucu:abonelikYenile"), false);
  sifirla({ satinAlmaHatasi: Object.assign(new Error("magaza"), { code: "2" }) });
  esit("diğer hata aynen iletilir", await hataKodu(() => m.satinAl("aylik")), "2");
  sifirla();
  esit("listede olmayan plan (fiyatsız 6 aylık)", await hataKodu(() => m.satinAl("alti_aylik")), m.SATIN_ALMA_HAZIR_DEGIL);
  esit("bilinmeyen plan", await hataKodu(() => m.satinAl("omur_boyu")), m.SATIN_ALMA_HAZIR_DEGIL);
  sifirla();
  await m.satinAl("haftalik");
  esit("haftalık satın alınabilir", globalThis.__rc.olaylar, ["satinAl:$rc_weekly", "sunucu:abonelikYenile"]);

  // 12b) Abonelik başka hesaba bağlı (kod 7): doğru hata, sunucuya sorulmaz
  sifirla({ satinAlmaHatasi: { code: "7" } });
  esit("satın almada başka hesapta", await hataKodu(() => m.satinAl("aylik")), m.SATIN_ALMA_BASKA_HESAPTA);
  esit("başka hesapta: sunucu çağrılmadı", globalThis.__rc.olaylar.includes("sunucu:abonelikYenile"), false);
  sifirla({ geriYuklemeHatasi: { code: "7" } });
  esit("geri yüklemede başka hesapta", await hataKodu(() => m.satinAlimlariGeriYukle()), m.SATIN_ALMA_BASKA_HESAPTA);
  esit("geri yükleme başka hesapta: sunucu çağrılmadı", globalThis.__rc.olaylar.includes("sunucu:abonelikYenile"), false);
  sifirla({ geriYuklemeHatasi: Object.assign(new Error("ag"), { code: "10" }) });
  esit("geri yüklemede diğer hata aynen iletilir", await hataKodu(() => m.satinAlimlariGeriYukle()), "10");

  // 13) Geri yükleme: mağaza → sunucu
  sifirla({ sunucuCevabi: { premium: false, abonelik: false } });
  esit("geri yükleme sonucu", await m.satinAlimlariGeriYukle(), { dogrulandi: true, premium: false, abonelik: false });
  esit("geri yükleme sırası", globalThis.__rc.olaylar, ["geriYukle", "sunucu:abonelikYenile"]);

  // 13b) Normal çıkış: SDK kimliği BIRAKILMAZ (anonim kimliğe yenileme bildirilmesin); işlemler yine kapalı
  const kimlikOnce = globalThis.__rc.kimlik;
  sifirla();
  await m.magazaGirisiniUnut();
  esit("normal çıkış: logOut yok", globalThis.__rc.olaylar, []);
  esit("normal çıkış: SDK kimliği aynı kaldı", globalThis.__rc.kimlik, kimlikOnce);
  const oncekiKullanici = globalThis.__auth.currentUser;
  globalThis.__auth.currentUser = null;
  esit("normal çıkış sonrası satın alma yok", await hataKodu(() => m.satinAl("aylik")), m.SATIN_ALMA_HAZIR_DEGIL);
  esit("normal çıkış sonrası geri yükleme yok", await hataKodu(() => m.satinAlimlariGeriYukle()), m.SATIN_ALMA_HAZIR_DEGIL);
  esit("normal çıkış sonrası mağaza işlemi yok", globalThis.__rc.olaylar, []);
  globalThis.__auth.currentUser = oncekiKullanici;
  sifirla();
  await m.satinAl("aylik");
  esit("aynı kişi tekrar girince logIn gerekmez", globalThis.__rc.olaylar, ["satinAl:$rc_monthly", "sunucu:abonelikYenile"]);
  await m.magazaGirisiniUnut();
  globalThis.__auth.currentUser = { uid: "uidBaska" };
  sifirla();
  await m.satinAl("aylik");
  esit("başka kişi girince önce logIn, sonra satın alma", globalThis.__rc.olaylar, ["logIn:uidBaska", "satinAl:$rc_monthly", "sunucu:abonelikYenile"]);
  globalThis.__auth.currentUser = oncekiKullanici;

  // 14) Hesap silme: SDK kimliği bırakılır; sonrasında giriş yoksa hiçbir işlem başlamaz
  sifirla();
  await m.magazaOturumunuKapat();
  esit("çıkış: logOut", globalThis.__rc.olaylar, ["logOut"]);
  sifirla();
  await m.magazaOturumunuKapat();
  esit("zaten anonimse logOut çağrılmaz", globalThis.__rc.olaylar, []);
  globalThis.__auth.currentUser = null;
  sifirla();
  esit("çıkış sonrası satın alma yok", await hataKodu(() => m.satinAl("aylik")), m.SATIN_ALMA_HAZIR_DEGIL);
  esit("çıkış sonrası geri yükleme yok", await hataKodu(() => m.satinAlimlariGeriYukle()), m.SATIN_ALMA_HAZIR_DEGIL);
  esit("çıkış sonrası mağaza işlemi yok", globalThis.__rc.olaylar, []);

  // 15) Hızlı hesap değişimi: işlemler sırayla çalışır, son kimlik geçerli olur
  sifirla();
  await Promise.all([
    m.magazaKullanicisiniAyarla("uidD"),
    m.magazaOturumunuKapat(),
    m.magazaKullanicisiniAyarla("uidE"),
  ]);
  esit("sıralı: D → çıkış → E", globalThis.__rc.olaylar, ["logIn:uidD", "logOut", "logIn:uidE"]);
  esit("son kimlik E", globalThis.__rc.kimlik, "uidE");

  // 16) Deneme metni biçimleri
  esit("ücretli tanıtım", m.denemeMetni({ price: 49.99, priceString: "49,99 ₺", cycles: 3, periodUnit: "MONTH", periodNumberOfUnits: 1 }), "İlk 3 ay: 49,99 ₺");
  esit("bilinmeyen birim", m.denemeMetni({ price: 0, cycles: 1, periodUnit: "X", periodNumberOfUnits: 1 }), null);
  esit("giriş fiyatı yok", m.denemeMetni(null), null);

  // ------------------------------------------------ geliştirme sürümü
  globalThis.__rc = { olaylar: [], kimlik: null, teklifler: { current: null }, uygunluk: {}, sunucuCevabi: {} };
  const g = require(await derle(true));
  globalThis.__platform = "android";
  const o = await g.planlariGetir();
  esit("geliştirme: önizleme planları, satın alma kapalı", [o.onizleme, o.satinAlinabilir, o.planlar.length], [true, false, 3]);
  esit("geliştirme: önizlemede satın alma yok", await hataKodu(() => g.satinAl("aylik")), g.SATIN_ALMA_HAZIR_DEGIL);
  globalThis.__platform = "ios";
  globalThis.__auth.currentUser = { uid: "uidF" };
  await g.magazaKullanicisiniAyarla("uidF");
  esit("geliştirme: günlük INFO", globalThis.__rc.olaylar, ["log:INFO", "configure:uidF"]);

  console.log(`[abonelik-uygulama] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
