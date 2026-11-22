// Sunucu testi: functions/abonelik.js — RevenueCat bildirimi, imza/yetki doğrulama, eşitleme, hız sınırı, hesap silme.
// Gerçek RevenueCat'e istek GİTMEZ: REST API sahte fetch ile taklit edilir.
// Çalıştırma (proje kökünden):
//   firebase emulators:exec --project demo-mikro --only firestore,storage "node testler/sunucu/abonelik.test.js"

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-mikro";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Yalnızca emülatörde çalışır (FIRESTORE_EMULATOR_HOST yok)");
if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error("Storage emülatörü gerekli (FIREBASE_STORAGE_EMULATOR_HOST yok)");

const path = require("path");
const crypto = require("crypto");
const FN = path.resolve(__dirname, "..", "..", "functions");
const al = (m) => require(require.resolve(m, { paths: [FN] }));
const { initializeApp } = al("firebase-admin/app");
const { getFirestore } = al("firebase-admin/firestore");
initializeApp({ projectId: process.env.GCLOUD_PROJECT, storageBucket: `${process.env.GCLOUD_PROJECT}.appspot.com` });
const db = getFirestore();
const a = require(path.join(FN, "abonelik.js"));
const { silinenHesabiTemizle } = require(path.join(FN, "hesapTemizlik.js"));

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};
const firlatirMi = async (fn) => {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
};

const GIZLI_IMZA = "imza-gizli-anahtari-0123456789abcdef";
const GIZLI_YETKI = "yetki-basligi-gizli-0123456789abcdef";
const SIMDI = Date.now();
const imzala = (govde, t = Math.floor(SIMDI / 1000), gizli = GIZLI_IMZA) =>
  `t=${t},v1=${crypto.createHmac("sha256", gizli).update(`${t}.${govde}`).digest("hex")}`;
const GUN = 24 * 60 * 60 * 1000;

// --- sahte RevenueCat REST API
const musteriler = new Map(); // uid -> active_entitlements.items
let apiHatasi = null; // örn. 500
const istekler = [];
const sahteFetch = async (adres, ayar) => {
  istekler.push({ adres, yontem: ayar.method, yetki: ayar.headers.Authorization });
  if (apiHatasi) return { status: apiHatasi, json: async () => ({}) };
  const uid = decodeURIComponent(adres.split("/customers/")[1]);
  if (ayar.method === "DELETE") return { status: musteriler.delete(uid) ? 200 : 404, json: async () => ({}) };
  if (!musteriler.has(uid)) return { status: 404, json: async () => ({}) };
  return { status: 200, json: async () => ({ object: "customer", id: uid, active_entitlements: { object: "list", items: musteriler.get(uid) } }) };
};
const getir = (uid) => a.musteriGetir(uid, { projeId: "projeX", anahtar: "okuma-anahtari", fetchFn: sahteFetch });
const esitle = (uid, simdi) => a.abonelikEsitle(uid, { getir, simdi: simdi ? () => simdi : undefined });

// --- sahte HTTP isteği / yanıtı
// yetkiYok: true → Authorization başlığı hiç gönderilmez (varsayılan değer devreye girmesin diye ayrı bayrak)
const istekYap = async ({ govde, yetki = GIZLI_YETKI, yetkiYok = false, imza, yontem = "POST", esitleFn }) => {
  if (yetkiYok) yetki = undefined;
  const ham = govde === undefined ? undefined : Buffer.from(govde);
  const basliklar = { authorization: yetki, "x-revenuecat-webhook-signature": imza === undefined && govde !== undefined ? imzala(govde) : imza };
  const req = { method: yontem, rawBody: ham, get: (ad) => basliklar[ad.toLowerCase()] };
  const yanit = { kod: null };
  const res = { status: (k) => ((yanit.kod = k), res), send: () => res };
  const cagrilar = [];
  await a.bildirimIsle(req, res, {
    yetkiGizli: GIZLI_YETKI,
    imzaGizli: GIZLI_IMZA,
    esitle: esitleFn || (async (uid) => cagrilar.push(uid)),
  });
  return { kod: yanit.kod, cagrilar };
};
const olay = (ek) => JSON.stringify({ api_version: "1.0", event: { id: "e1", type: "INITIAL_PURCHASE", app_user_id: "kullaniciA", ...ek } });

const temizle = async () => {
  for (const k of ["kullanicilar", "abonelikEsitleme"]) {
    const snap = await db.collection(k).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
  musteriler.clear();
  apiHatasi = null;
  istekler.length = 0;
};
const kullanici = (uid) => db.doc(`kullanicilar/${uid}`).get().then((d) => (d.exists ? d.data() : null));

(async () => {
  await temizle();

  // ================================================================ 1) imza doğrulama (saf)
  const g = olay();
  esit("geçerli imza", a.imzaDogrula(Buffer.from(g), imzala(g), GIZLI_IMZA, SIMDI), true);
  esit("yanlış gizli anahtar", a.imzaDogrula(Buffer.from(g), imzala(g, undefined, "baska-gizli-anahtar-0123456789"), GIZLI_IMZA, SIMDI), false);
  esit("gövde değiştirilmiş", a.imzaDogrula(Buffer.from(g.replace("kullaniciA", "kullaniciB")), imzala(g), GIZLI_IMZA, SIMDI), false);
  const eskiT = Math.floor(SIMDI / 1000) - 6 * 60;
  esit("6 dk eski imza (tekrar oynatma)", a.imzaDogrula(Buffer.from(g), imzala(g, eskiT), GIZLI_IMZA, SIMDI), false);
  esit("4 dk eski imza kabul", a.imzaDogrula(Buffer.from(g), imzala(g, Math.floor(SIMDI / 1000) - 240), GIZLI_IMZA, SIMDI), true);
  esit("6 dk ileri tarihli imza", a.imzaDogrula(Buffer.from(g), imzala(g, Math.floor(SIMDI / 1000) + 360), GIZLI_IMZA, SIMDI), false);
  esit("eski zaman damgası + yeni t ile değiştirme", a.imzaDogrula(Buffer.from(g), imzala(g, eskiT).replace(`t=${eskiT}`, `t=${Math.floor(SIMDI / 1000)}`), GIZLI_IMZA, SIMDI), false);
  esit("başlık yok", a.imzaDogrula(Buffer.from(g), undefined, GIZLI_IMZA, SIMDI), false);
  esit("boş başlık", a.imzaDogrula(Buffer.from(g), "", GIZLI_IMZA, SIMDI), false);
  esit("t yok", a.imzaDogrula(Buffer.from(g), imzala(g).replace(/^t=\d+,/, ""), GIZLI_IMZA, SIMDI), false);
  esit("v1 yok", a.imzaDogrula(Buffer.from(g), `t=${Math.floor(SIMDI / 1000)}`, GIZLI_IMZA, SIMDI), false);
  esit("onaltılık olmayan imza", a.imzaDogrula(Buffer.from(g), `t=${Math.floor(SIMDI / 1000)},v1=${"z".repeat(64)}`, GIZLI_IMZA, SIMDI), false);
  esit("kısa imza", a.imzaDogrula(Buffer.from(g), `t=${Math.floor(SIMDI / 1000)},v1=abcd`, GIZLI_IMZA, SIMDI), false);
  esit("birden çok v1, biri doğru", a.imzaDogrula(Buffer.from(g), `${imzala(g)},v1=${"0".repeat(64)}`, GIZLI_IMZA, SIMDI), true);
  esit("boş gizli anahtarla asla kabul edilmez", a.imzaDogrula(Buffer.from(g), imzala(g, undefined, ""), "", SIMDI), false);
  esit("kısa gizli anahtar kabul edilmez", a.imzaDogrula(Buffer.from(g), imzala(g, undefined, "kisa"), "kisa", SIMDI), false);
  esit("gövde Buffer değil", a.imzaDogrula(g, imzala(g), GIZLI_IMZA, SIMDI), false);
  esit("aşırı uzun başlık", a.imzaDogrula(Buffer.from(g), imzala(g) + ",x=" + "a".repeat(2000), GIZLI_IMZA, SIMDI), false);

  // ================================================================ 2) yetki başlığı (saf)
  esit("doğru yetki", a.yetkiDogrula(GIZLI_YETKI, GIZLI_YETKI), true);
  esit("yanlış yetki", a.yetkiDogrula("yanlis-deger-0123456789abcdef0123", GIZLI_YETKI), false);
  esit("yetki yok", a.yetkiDogrula(undefined, GIZLI_YETKI), false);
  esit("Bearer önekli yanlış biçim", a.yetkiDogrula(`Bearer ${GIZLI_YETKI}`, GIZLI_YETKI), false);
  esit("boş beklenen değerle asla kabul edilmez", a.yetkiDogrula("", ""), false);
  esit("kısa beklenen değer kabul edilmez", a.yetkiDogrula("abc", "abc"), false);

  // ================================================================ 3) bildirimdeki kimlikler (saf)
  esit("anonim kimlik elenir", a.bildirimKimlikleri({ app_user_id: "$RCAnonymousID:abc123", original_app_user_id: "$RCAnonymousID:abc123" }), []);
  esit("aktarma: eski ve yeni sahip", a.bildirimKimlikleri({ type: "TRANSFER", transferred_from: ["eskiSahip"], transferred_to: ["yeniSahip"] }), ["eskiSahip", "yeniSahip"]);
  esit("tekrarlar birleştirilir", a.bildirimKimlikleri({ app_user_id: "u1", original_app_user_id: "u1", aliases: ["u1", "u2"] }), ["u1", "u2"]);
  esit("biçimsiz kimlikler elenir", a.bildirimKimlikleri({ app_user_id: "../kullanicilar/x", aliases: ["a/b", 5, null, {}, "gecerli1"] }), ["gecerli1"]);
  esit("en fazla 20 kimlik", a.bildirimKimlikleri({ aliases: Array.from({ length: 50 }, (_, i) => `k${i}`) }).length, 20);
  esit("boş olay", a.bildirimKimlikleri(null), []);

  // ================================================================ 4) RevenueCat cevabından abonelik (saf)
  const kalem = (id, ms) => ({ active_entitlements: { items: [{ object: "customer.active_entitlement", entitlement_id: id, expires_at: ms }] } });
  esit("geçerli premium", a.abonelikHesapla(kalem("premium", SIMDI + 30 * GUN), SIMDI)?.aktif, true);
  esit("bitmiş premium", a.abonelikHesapla(kalem("premium", SIMDI - 1000), SIMDI), null);
  esit("başka yetki sayılmaz", a.abonelikHesapla(kalem("baska", SIMDI + 30 * GUN), SIMDI), null);
  esit("süresiz (null) sayılmaz", a.abonelikHesapla(kalem("premium", null), SIMDI), null);
  esit("metin tarih sayılmaz", a.abonelikHesapla(kalem("premium", "yarin"), SIMDI), null);
  esit("müşteri yok", a.abonelikHesapla(null, SIMDI), null);
  const uzun = a.abonelikHesapla(kalem("premium", SIMDI + 5000 * GUN), SIMDI);
  esit("absürt uzun bitiş 400 güne kısılır", uzun.bitis.getTime() <= SIMDI + 400 * GUN, true);

  // ================================================================ 5) REST API çağrıları
  musteriler.set("kullaniciA", [{ entitlement_id: "premium", expires_at: SIMDI + 30 * GUN }]);
  const m = await getir("kullaniciA");
  esit("v2 adresi ve Bearer anahtar", [istekler[0].adres, istekler[0].yetki], ["https://api.revenuecat.com/v2/projects/projeX/customers/kullaniciA", "Bearer okuma-anahtari"]);
  esit("müşteri okunur", m.id, "kullaniciA");
  esit("müşteri yoksa null", await getir("yokKisi"), null);
  apiHatasi = 500;
  esit("API hatası fırlatılır", await firlatirMi(() => getir("kullaniciA")), true);
  apiHatasi = 401;
  esit("geçersiz anahtar (401) fırlatılır", await firlatirMi(() => getir("kullaniciA")), true);
  apiHatasi = null;
  esit("anahtarsız çalışmaz", await firlatirMi(() => a.musteriGetir("kullaniciA", { projeId: "p", anahtar: "", fetchFn: sahteFetch })), true);
  esit("projesiz çalışmaz", await firlatirMi(() => a.musteriGetir("kullaniciA", { projeId: "", anahtar: "x", fetchFn: sahteFetch })), true);
  esit("biçimsiz kimlikle istek atılmaz", await firlatirMi(() => getir("../../x")), true);

  // ================================================================ 6) eşitleme (emülatör)
  await temizle();
  await db.doc("kullanicilar/kullaniciA").set({ rol: "ogrenci", premiumMu: false });
  musteriler.set("kullaniciA", [{ entitlement_id: "premium", expires_at: SIMDI + 30 * GUN }]);
  esit("satın alma → güncellendi", (await esitle("kullaniciA")).durum, "guncellendi");
  let k = await kullanici("kullaniciA");
  esit("premium açıldı", k.premiumMu, true);
  esit("kaynak abonelik", k.premiumKaynaklari?.abonelik?.aktif, true);
  esit("aynı bildirim ikinci kez: sonuç aynı", [(await esitle("kullaniciA")).premium, (await kullanici("kullaniciA")).premiumMu], [true, true]);

  musteriler.set("kullaniciA", []); // süre bitti / iade
  await esitle("kullaniciA");
  k = await kullanici("kullaniciA");
  esit("süre bitince premium kapanır", k.premiumMu, false);
  esit("abonelik kaynağı silinir", k.premiumKaynaklari === undefined, true);

  await db.doc("kullanicilar/kullaniciA").update({ premiumKaynaklari: { kurum: true }, premiumMu: true });
  musteriler.set("kullaniciA", [{ entitlement_id: "premium", expires_at: SIMDI + 30 * GUN }]);
  await esitle("kullaniciA");
  musteriler.set("kullaniciA", []);
  await esitle("kullaniciA");
  k = await kullanici("kullaniciA");
  esit("dershane premium'u abonelik bitince korunur", [k.premiumMu, k.premiumKaynaklari], [true, { kurum: true }]);

  musteriler.delete("kullaniciA");
  await db.doc("kullanicilar/kullaniciA").update({ premiumKaynaklari: { abonelik: { aktif: true, bitis: new Date(SIMDI + GUN) } }, premiumMu: true });
  await esitle("kullaniciA");
  esit("RevenueCat'te müşteri yoksa (404) abonelik kapanır", (await kullanici("kullaniciA")).premiumMu, false);

  esit("kullanıcı belgesi yoksa hiçbir şey oluşturulmaz", [(await esitle("hayaletKisi")).durum, await kullanici("hayaletKisi")], ["kullanici-yok", null]);
  esit("kullanıcı yoksa API'ye hiç sorulmaz", istekler.some((i) => i.adres.endsWith("/hayaletKisi")), false);

  // Sırasız: daha yeni sorgu yazıldıktan sonra gelen eski sorgu sonucu ezemez
  await db.doc("kullanicilar/kullaniciA").set({ rol: "ogrenci", premiumMu: false });
  musteriler.set("kullaniciA", []);
  await esitle("kullaniciA", SIMDI + 10000);
  musteriler.set("kullaniciA", [{ entitlement_id: "premium", expires_at: SIMDI + 30 * GUN }]);
  esit("eski sorgu yeniyi ezemez", (await esitle("kullaniciA", SIMDI)).durum, "eski-sorgu");
  esit("eski sorgudan sonra premium hâlâ kapalı", (await kullanici("kullaniciA")).premiumMu, false);

  // API hatasında hiçbir şey yazılmaz
  await db.doc("kullanicilar/kullaniciA").set({ rol: "ogrenci", premiumMu: true, premiumKaynaklari: { abonelik: { aktif: true, bitis: new Date(SIMDI + GUN) } } });
  await db.doc("abonelikEsitleme/kullaniciA").delete();
  apiHatasi = 503;
  esit("API hatasında eşitleme fırlatır", await firlatirMi(() => esitle("kullaniciA")), true);
  apiHatasi = null;
  esit("API hatasında mevcut durum korunur", (await kullanici("kullaniciA")).premiumMu, true);
  esit("API hatasında eşitleme kaydı yazılmaz", (await db.doc("abonelikEsitleme/kullaniciA").get()).exists, false);

  // ================================================================ 7) bildirim alıcısı (HTTP)
  await temizle();
  await db.doc("kullanicilar/kullaniciA").set({ rol: "ogrenci", premiumMu: false });
  musteriler.set("kullaniciA", [{ entitlement_id: "premium", expires_at: SIMDI + 30 * GUN }]);
  const gercekEsitle = (uid) => esitle(uid);
  let r = await istekYap({ govde: olay(), esitleFn: gercekEsitle });
  esit("geçerli bildirim → 200", r.kod, 200);
  esit("geçerli bildirim → premium", (await kullanici("kullaniciA")).premiumMu, true);

  await temizle();
  await db.doc("kullanicilar/kullaniciA").set({ rol: "ogrenci", premiumMu: false });
  musteriler.set("kullaniciA", [{ entitlement_id: "premium", expires_at: SIMDI + 30 * GUN }]);
  r = await istekYap({ govde: olay(), imza: imzala(olay(), undefined, "saldirganin-anahtari-0123456789"), esitleFn: gercekEsitle });
  esit("sahte imza → 401", r.kod, 401);
  esit("sahte imza → hiçbir şey yazılmaz", (await kullanici("kullaniciA")).premiumMu, false);
  esit("sahte imza → API'ye bile sorulmaz", istekler.length, 0);
  r = await istekYap({ govde: olay(), yetki: "yanlis-yetki-degeri-0123456789abc", esitleFn: gercekEsitle });
  esit("yanlış yetki başlığı → 401", r.kod, 401);
  r = await istekYap({ govde: olay(), yetkiYok: true, esitleFn: gercekEsitle });
  esit("yetki başlığı yok → 401", r.kod, 401);
  r = await istekYap({ govde: olay(), imza: imzala(olay(), Math.floor(SIMDI / 1000) - 3600), esitleFn: gercekEsitle });
  esit("1 saat önceki bildirimin tekrar gönderilmesi → 401", r.kod, 401);
  esit("reddedilen bildirimlerden sonra premium hâlâ kapalı", (await kullanici("kullaniciA")).premiumMu, false);

  r = await istekYap({ govde: olay(), yontem: "GET" });
  esit("GET → 405", [r.kod, r.cagrilar], [405, []]);
  r = await istekYap({ govde: undefined });
  esit("gövdesiz → 400", r.kod, 400);
  const buyuk = JSON.stringify({ event: { type: "RENEWAL", app_user_id: "kullaniciA", dolgu: "x".repeat(70 * 1024) } });
  r = await istekYap({ govde: buyuk });
  esit("64 KB üstü gövde → 400 (imza hesaplanmadan)", [r.kod, r.cagrilar], [400, []]);
  r = await istekYap({ govde: "{bozuk json" });
  esit("imzalı ama bozuk JSON → 400", [r.kod, r.cagrilar], [400, []]);
  r = await istekYap({ govde: JSON.stringify({ event: { app_user_id: "kullaniciA" } }) });
  esit("türsüz olay → 400", [r.kod, r.cagrilar], [400, []]);
  r = await istekYap({ govde: olay({ type: "TEST" }) });
  esit("TEST olayı → 200, eşitleme yok", [r.kod, r.cagrilar], [200, []]);
  r = await istekYap({ govde: olay({ type: "TRANSFER", app_user_id: undefined, transferred_from: ["eskiSahip"], transferred_to: ["yeniSahip"] }) });
  esit("aktarma → iki kullanıcı da eşitlenir", [r.kod, r.cagrilar], [200, ["eskiSahip", "yeniSahip"]]);
  r = await istekYap({ govde: olay({ app_user_id: "$RCAnonymousID:x", original_app_user_id: "$RCAnonymousID:x" }) });
  esit("anonim kullanıcı → 200, eşitleme yok", [r.kod, r.cagrilar], [200, []]);
  r = await istekYap({ govde: olay(), esitleFn: async () => { throw new Error("revenuecat-okuma-503"); } });
  esit("eşitleme hatası → 500 (RevenueCat yeniden dener)", r.kod, 500);

  // ================================================================ 8) abonelikYenile hız sınırı
  await temizle();
  esit("ilk yenileme izinli", await a.yenilemeHakkiKullan("kullaniciA", SIMDI), true);
  esit("5 sn sonra reddedilir", await a.yenilemeHakkiKullan("kullaniciA", SIMDI + 5000), false);
  esit("11 sn sonra izinli", await a.yenilemeHakkiKullan("kullaniciA", SIMDI + 11000), true);
  esit("başka kullanıcı etkilenmez", await a.yenilemeHakkiKullan("kullaniciB", SIMDI + 11000), true);

  // ================================================================ 9) hesap silme: RevenueCat kaydı ve eşitleme kaydı
  await temizle();
  musteriler.set("silinecek1", []);
  await db.doc("abonelikEsitleme/silinecek1").set({ sorguMs: SIMDI });
  const silinenler = [];
  const sonuc = await silinenHesabiTemizle("silinecek1", { rol: "ogrenci" }, {
    revenueCatSil: (uid) => { silinenler.push(uid); return a.musteriSil(uid, { projeId: "projeX", anahtar: "silme-anahtari", fetchFn: sahteFetch }); },
  });
  esit("RevenueCat müşteri kaydı silinir", [silinenler, musteriler.has("silinecek1"), sonuc.revenueCat], [["silinecek1"], false, true]);
  esit("silme isteği silme anahtarıyla", istekler.find((i) => i.yontem === "DELETE")?.yetki, "Bearer silme-anahtari");
  esit("eşitleme kaydı silinir", (await db.doc("abonelikEsitleme/silinecek1").get()).exists, false);
  esit("RevenueCat'te kaydı olmayan hesap silinince hata yok", (await silinenHesabiTemizle("hicAlmamis", { rol: "ogrenci" }, {
    revenueCatSil: (uid) => a.musteriSil(uid, { projeId: "projeX", anahtar: "silme-anahtari", fetchFn: sahteFetch }),
  })).revenueCat, false);
  apiHatasi = 500;
  esit("RevenueCat silme hatası fırlatılır (tetikleyici yeniden dener)", await firlatirMi(() => silinenHesabiTemizle("silinecek2", { rol: "ogrenci" }, {
    revenueCatSil: (uid) => a.musteriSil(uid, { projeId: "projeX", anahtar: "silme-anahtari", fetchFn: sahteFetch }),
  })), true);
  apiHatasi = null;

  await temizle();
  console.log(`[abonelik] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("ÇÖKTÜ", e?.stack || e?.message);
  process.exit(1);
});
