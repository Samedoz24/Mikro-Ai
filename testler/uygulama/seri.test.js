// Seri testi (28 Kasım): seri yalnızca soru gönderilince ve yalnızca sunucuda artar.
//   A) Sunucu saf mantığı: functions/kota.js seriIlerlet / gorunenSeri / oncekiGun / seriKaydiCoz
//   B) Uygulama saf mantığı: utils/seri.js (görünen seri, bugün gönderildi mi, kutlama, metin)
//   C) Kutlama yayını: utils/seriKutlama.js
//   D) Seri hatırlatma bildirimi: utils/notificationManager.js (sahte bildirim/depolama ile)
//   E) Kaynak denetimi: uygulama seriyi YAZMIYOR; kurallar alanları kilitliyor
// Çalıştırma (proje kökünden):  node testler/uygulama/seri.test.js   (emülatör gerekmez)

const path = require("path");
const os = require("os");
const fs = require("fs");
const KOK = path.resolve(__dirname, "..", "..");
const esbuild = require(require.resolve("esbuild", { paths: [KOK] }));

let gecen = 0;
let kalan = 0;
const esit = (ad, gercek, beklenen) => {
  if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
  else {
    kalan++;
    console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
  }
};
const derle = async (dosya, sahteler = {}) => {
  const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-seri-")), "m.cjs");
  await esbuild.build({
    entryPoints: [path.join(KOK, dosya)],
    bundle: true,
    format: "cjs",
    platform: "node",
    outfile: cikti,
    logLevel: "error",
    plugins: [
      {
        name: "sahte",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => (sahteler[a.path] !== undefined ? { path: a.path, namespace: "sahte" } : null));
          b.onLoad({ filter: /.*/, namespace: "sahte" }, (a) => ({ contents: sahteler[a.path], loader: "js" }));
        },
      },
    ],
  });
  return require(cikti);
};

(async () => {
  // ================================================================ A) Sunucu
  const kota = require(path.join(KOK, "functions/kota.js"));
  const G = "2026-11-28";
  esit("önceki gün", kota.oncekiGun(G), "2026-11-27");
  esit("ay başı", kota.oncekiGun("2026-12-01"), "2026-11-30");
  esit("yıl başı", kota.oncekiGun("2027-01-01"), "2026-12-31");
  esit("artık yıl 1 Mart", kota.oncekiGun("2028-03-01"), "2028-02-29");
  esit("normal yıl 1 Mart", kota.oncekiGun("2027-03-01"), "2027-02-28");
  // Türkiye günü sınırı: UTC 20:59 → aynı gün, UTC 21:00 → ertesi gün
  esit("TR gün 23:59", kota.turkiyeGunu(Date.UTC(2026, 10, 28, 20, 59, 59)), "2026-11-28");
  esit("TR gün 00:00", kota.turkiyeGunu(Date.UTC(2026, 10, 28, 21, 0, 0)), "2026-11-29");

  esit("kayıt yok → 1", kota.seriIlerlet(undefined, G), { seri: 1, sonGun: G, artti: true });
  esit("eski giriş serisi (sonGun yok) → 1 (herkes sıfırdan)", kota.seriIlerlet({ seri: 45 }, G), { seri: 1, sonGun: G, artti: true });
  esit("dün → +1", kota.seriIlerlet({ seri: 4, sonGun: "2026-11-27" }, G), { seri: 5, sonGun: G, artti: true });
  esit("bugün → değişmez", kota.seriIlerlet({ seri: 5, sonGun: G }, G), { seri: 5, sonGun: G, artti: false });
  esit("2 gün önce → 1", kota.seriIlerlet({ seri: 9, sonGun: "2026-11-26" }, G), { seri: 1, sonGun: G, artti: true });
  esit("gelecek tarih → 1", kota.seriIlerlet({ seri: 9, sonGun: "2026-12-30" }, G), { seri: 1, sonGun: G, artti: true });
  esit("bozuk seri → 1", kota.seriIlerlet({ seri: "9", sonGun: "2026-11-27" }, G), { seri: 1, sonGun: G, artti: true });
  esit("negatif seri → 1", kota.seriIlerlet({ seri: -3, sonGun: "2026-11-27" }, G), { seri: 1, sonGun: G, artti: true });
  esit("ondalık seri → 1", kota.seriIlerlet({ seri: 2.5, sonGun: "2026-11-27" }, G), { seri: 1, sonGun: G, artti: true });
  esit("bozuk gün → 1", kota.seriIlerlet({ seri: 4, sonGun: "27.11.2026" }, G), { seri: 1, sonGun: G, artti: true });
  esit("bugün ama seri 0 → 1 (tutarsız kayıt düzelir)", kota.seriIlerlet({ seri: 0, sonGun: G }, G), { seri: 1, sonGun: G, artti: true });
  esit("üst sınır aşılmaz", kota.seriIlerlet({ seri: 100000, sonGun: "2026-11-27" }, G).seri, 100000);
  esit("aşırı büyük kayıt geçersiz → 1", kota.seriIlerlet({ seri: 100001, sonGun: "2026-11-27" }, G).seri, 1);
  esit("ay geçişinde +1", kota.seriIlerlet({ seri: 30, sonGun: "2026-11-30" }, "2026-12-01").seri, 31);
  esit("yıl geçişinde +1", kota.seriIlerlet({ seri: 2, sonGun: "2026-12-31" }, "2027-01-01").seri, 3);
  // Ardışık günler simülasyonu
  let k;
  for (const [g, beklenen] of [["2026-11-01", 1], ["2026-11-01", 1], ["2026-11-02", 2], ["2026-11-03", 3], ["2026-11-05", 1], ["2026-11-06", 2]]) {
    k = kota.seriIlerlet(k, g);
    esit(`simülasyon ${g}`, k.seri, beklenen);
  }
  esit("görünen: bugün", kota.gorunenSeri({ seri: 5, sonGun: G }, G), 5);
  esit("görünen: dün (henüz bugün gönderilmedi, seri sürüyor)", kota.gorunenSeri({ seri: 5, sonGun: "2026-11-27" }, G), 5);
  esit("görünen: 2 gün önce → 0 (sıfırlandı)", kota.gorunenSeri({ seri: 5, sonGun: "2026-11-26" }, G), 0);
  esit("görünen: kayıt yok → 0", kota.gorunenSeri(null, G), 0);

  // ================================================================ B) Uygulama
  const s = await derle("utils/seri.js");
  const SIMDI = Date.UTC(2026, 10, 28, 12, 0, 0); // TR 15:00, 28 Kasım
  esit("uygulama TR günü sunucuyla aynı", s.turkiyeGunu(SIMDI), kota.turkiyeGunu(SIMDI));
  esit("uygulama önceki gün sunucuyla aynı", s.oncekiGun("2028-03-01"), kota.oncekiGun("2028-03-01"));
  esit("görünen bugün", s.gorunenSeri({ seriGunu: 7, sonSoruGunu: "2026-11-28" }, SIMDI), 7);
  esit("görünen dün", s.gorunenSeri({ seriGunu: 7, sonSoruGunu: "2026-11-27" }, SIMDI), 7);
  esit("görünen 2 gün önce → 0", s.gorunenSeri({ seriGunu: 7, sonSoruGunu: "2026-11-26" }, SIMDI), 0);
  esit("eski giriş serisi (sonSoruGunu yok) → 0", s.gorunenSeri({ seriGunu: 40 }, SIMDI), 0);
  esit("bozuk seri → 0", s.gorunenSeri({ seriGunu: "7", sonSoruGunu: "2026-11-28" }, SIMDI), 0);
  esit("NaN seri → 0", s.gorunenSeri({ seriGunu: NaN, sonSoruGunu: "2026-11-28" }, SIMDI), 0);
  esit("boş gün → 0", s.gorunenSeri({ seriGunu: 3, sonSoruGunu: "" }, SIMDI), 0);
  esit("profil yok → 0", s.gorunenSeri(undefined, SIMDI), 0);
  // TR gece yarısı sınırı: 23:59'da "dün" geçerli, 00:00'da artık 2 gün önce
  esit("TR 23:59 dünkü seri sürüyor", s.gorunenSeri({ seriGunu: 3, sonSoruGunu: "2026-11-27" }, Date.UTC(2026, 10, 28, 20, 59)), 3);
  esit("TR 00:00 seri bozuldu", s.gorunenSeri({ seriGunu: 3, sonSoruGunu: "2026-11-27" }, Date.UTC(2026, 10, 28, 21, 0)), 0);
  esit("bugün gönderildi", s.bugunSoruGonderildiMi({ sonSoruGunu: "2026-11-28" }, SIMDI), true);
  esit("bugün gönderilmedi", s.bugunSoruGonderildiMi({ sonSoruGunu: "2026-11-27" }, SIMDI), false);
  esit("kutlama: arttı", s.kutlanacakSeri({ seri: { gun: 4, artti: true } }), 4);
  esit("kutlama: artmadı → yok", s.kutlanacakSeri({ seri: { gun: 4, artti: false } }), null);
  esit("kutlama: eski sunucu yanıtı (seri yok) → yok", s.kutlanacakSeri({ soruId: "a", kalan: 2 }), null);
  esit("kutlama: bozuk değer → yok", s.kutlanacakSeri({ seri: { gun: "4", artti: true } }), null);
  esit("kutlama: 0 → yok", s.kutlanacakSeri({ seri: { gun: 0, artti: true } }), null);
  esit("kutlama: 'true' metni → yok", s.kutlanacakSeri({ seri: { gun: 3, artti: "true" } }), null);
  esit("metin 1. gün", s.seriKutlamaMetni(1).startsWith("Serin başladı!"), true);
  esit("metin 5. gün", s.seriKutlamaMetni(5).includes("serini 5 güne çıkardın"), true);

  // ================================================================ C) Kutlama yayını
  const kb = await derle("utils/seriKutlama.js");
  esit("gecikme 10 sn", kb.KUTLAMA_GECIKMESI_MS, 10000);
  const alinan = [];
  const birak = kb.seriKutlamasiniDinle((g) => alinan.push(g));
  kb.seriKutlamasiIste(3);
  birak();
  kb.seriKutlamasiIste(9); // dinleyici bırakıldı: gelmemeli
  esit("dinleyici yalnızca kayıtlıyken alır", alinan, [3]);
  const kutlamaKaynagi = fs.readFileSync(path.join(KOK, "screens/SeriKutlama.js"), "utf8");
  esit("kutlama 10 sn gecikmeyle", kutlamaKaynagi.includes("setTimeout(") && kutlamaKaynagi.includes("KUTLAMA_GECIKMESI_MS"), true);
  esit("kullanıcı değişince bekleyen kutlama iptal", kutlamaKaynagi.includes("}, [kullaniciUid]);") && kutlamaKaynagi.includes("clearTimeout"), true);
  const appKaynagi = fs.readFileSync(path.join(KOK, "App.js"), "utf8");
  esit("kökte yalnızca öğrenci için", appKaynagi.includes('<SeriKutlama kullaniciUid={kullaniciRolu === "ogrenci" && kullanici ? kullanici.uid : null} />'), true);

  // ================================================================ D) Seri hatırlatma bildirimi
  const bildirim = await derle("utils/notificationManager.js", {
    "expo-notifications": `
      export const SchedulableTriggerInputTypes = { DATE: "date" };
      export const AndroidImportance = { MAX: 5, HIGH: 4, DEFAULT: 3 };
      export const setNotificationHandler = () => {};
      export const setNotificationChannelAsync = async () => {};
      export const getPermissionsAsync = async () => ({ status: globalThis.__izin || "granted" });
      export const requestPermissionsAsync = async () => ({ status: "granted" });
      export const getExpoPushTokenAsync = async () => ({ data: "x" });
      export const cancelScheduledNotificationAsync = async (id) => { globalThis.__olaylar.push(["iptal", id]); };
      export const cancelAllScheduledNotificationsAsync = async () => {};
      export const getAllScheduledNotificationsAsync = async () => [];
      export const scheduleNotificationAsync = async (b) => { globalThis.__olaylar.push(["planla", b.identifier, b.content.title, b.content.body, b.trigger.date.getTime()]); };`,
    "@react-native-async-storage/async-storage": `
      export default {
        getItem: async (k) => (globalThis.__depo.has(k) ? globalThis.__depo.get(k) : null),
        setItem: async (k, v) => { globalThis.__depo.set(k, v); },
        multiGet: async (ks) => ks.map((k) => [k, globalThis.__depo.has(k) ? globalThis.__depo.get(k) : null]),
        removeItem: async (k) => { globalThis.__depo.delete(k); },
      };`,
    "expo-device": `export const isDevice = true;`,
    "expo-constants": `export default { expoConfig: { extra: { eas: { projectId: "x" } } } };`,
    "react-native": `export const Platform = { OS: "ios" };`,
  });
  // Yerel saat 19:30 hatırlatması: test ortamının saat dilimini Türkiye'ye sabitle
  const seriPlani = async ({ seriGunu, sonSoruGunu, saat, izin = "granted", kapali = false }) => {
    globalThis.__olaylar = [];
    globalThis.__depo = new Map();
    globalThis.__izin = izin;
    if (seriGunu !== undefined) globalThis.__depo.set("seriGunu", String(seriGunu));
    if (sonSoruGunu !== undefined) globalThis.__depo.set("sonSoruGunu", sonSoruGunu);
    if (kapali) globalThis.__depo.set("bildirimAktif", "false");
    await bildirim.seriHatirlatmasiniGuncelle(new Date(saat));
    return globalThis.__olaylar.filter((o) => o[0] === "planla" && o[1] === "streak-v4");
  };
  const TR = (gun, s, d = 0) => Date.UTC(2026, 10, gun, s - 3, d); // TR yerel saat → UTC ms
  // 1) Dün soru gönderilmiş, bugün henüz gönderilmemiş, saat 15:00 → BUGÜN 19:30, seriyle
  let p = await seriPlani({ seriGunu: 4, sonSoruGunu: "2026-11-27", saat: TR(28, 15) });
  esit("dün gönderdi, bugün yok, 15:00 → bugün 19:30", p.map((o) => o[4]), [TR(28, 19, 30)]);
  esit("… seri metni", p.map((o) => [o[2], o[3]]), [["🔥 Serin Bozulmak Üzere!", "4 günlük serini kaybetmemek için bugün bir soru gönder."]]);
  // 2) Bugün soru gönderilmiş → YARIN 19:30, seri sürüyor
  p = await seriPlani({ seriGunu: 5, sonSoruGunu: "2026-11-28", saat: TR(28, 15) });
  esit("bugün gönderdi → yarın 19:30", p.map((o) => o[4]), [TR(29, 19, 30)]);
  esit("… yarın da seri metni", p[0]?.[3], "5 günlük serini kaybetmemek için bugün bir soru gönder.");
  // 3) Dün gönderilmiş, bugün yok, saat 21:00 (19:30 geçti) → yarın 19:30, seri gece bozulacağı için genel metin
  p = await seriPlani({ seriGunu: 4, sonSoruGunu: "2026-11-27", saat: TR(28, 21) });
  esit("19:30 geçti → yarın", p.map((o) => o[4]), [TR(29, 19, 30)]);
  esit("… genel metin", p[0]?.[2], "📚 Bugün Bir Soru Çözelim mi?");
  // 4) Seri yok → bugün 19:30 genel metin
  p = await seriPlani({ saat: TR(28, 10) });
  esit("seri yok → bugün genel", p.map((o) => [o[2], o[4]]), [["📚 Bugün Bir Soru Çözelim mi?", TR(28, 19, 30)]]);
  // 5) Bildirimler kapalı / izin yok → hiçbir şey kurulmaz
  p = await seriPlani({ seriGunu: 4, sonSoruGunu: "2026-11-27", saat: TR(28, 15), kapali: true });
  esit("kullanıcı kapattı → kurulmaz", p.length, 0);
  p = await seriPlani({ seriGunu: 4, sonSoruGunu: "2026-11-27", saat: TR(28, 15), izin: "denied" });
  esit("izin yok → kurulmaz", p.length, 0);
  // 6) Eski metin kalmadı
  const bildirimKaynagi = fs.readFileSync(path.join(KOK, "utils/notificationManager.js"), "utf8");
  esit("'uğraman yeterli' metni kaldırıldı", bildirimKaynagi.includes("uğraman yeterli"), false);

  // ================================================================ E) Kaynak denetimi
  for (const dosya of ["screens/HomeScreen.js", "screens/ProfileScreen.js", "App.js"]) {
    const k = fs.readFileSync(path.join(KOK, dosya), "utf8");
    esit(`${dosya}: seri Firestore'a yazılmıyor`, /(updateDoc|setDoc)\([^;]*(seriGunu|sonSoruGunu)/s.test(k.replace(/AsyncStorage\.multiSet\([^;]*;/gs, "")), false);
    esit(`${dosya}: eski giriş tarihi alanı yok`, k.includes("sonGirisTarihi"), false);
  }
  const kurallar = fs.readFileSync(path.join(KOK, "firestore.rules"), "utf8");
  esit("kurallar: seriGunu sunucu alanı", /sunucuAlanlari\(\) \{[^}]*'seriGunu'[^}]*'sonSoruGunu'/s.test(kurallar), true);
  esit("kurallar: seriSayaclari kapalı", /match \/seriSayaclari\/\{uid\} \{\s*allow read, write: if false;/s.test(kurallar), true);

  console.log(`[seri] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.log("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
