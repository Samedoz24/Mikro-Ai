// Giriş/kayıt ve profil testi (28 Kasım): utils/profilKurallari.js + ekran kaynak denetimi.
// Güvenlik noktaları: istemci rolü yalnızca öğrenci/veli ve yalnızca oluşturmada; yönetici asla formdan değil;
// sınıf yalnızca seçeneklerden ve yalnızca öğrencide; bekleyen profil yalnızca aynı e-posta + kısa süre; şifre saklanmaz.
// Çalıştırma (proje kökünden):  node testler/uygulama/profil.test.js

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

(async () => {
  const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-profil-")), "m.cjs");
  await esbuild.build({ entryPoints: [path.join(KOK, "utils/profilKurallari.js")], bundle: true, format: "cjs", platform: "node", outfile: cikti, logLevel: "error" });
  const p = require(cikti);

  // ---------------------------------------------------------------- sınıf listesi kurallarla aynı
  const kurallar = fs.readFileSync(path.join(KOK, "firestore.rules"), "utf8");
  const kuralListesi = JSON.parse(
    "[" + kurallar.match(/function sinifSecenekleri\(\) \{\s*return \[([^\]]*)\]/)[1].replace(/'/g, '"') + "]"
  );
  esit("sınıf seçenekleri firestore.rules ile birebir aynı", p.SINIF_SECENEKLERI, kuralListesi);
  esit("istemci rolleri yalnızca öğrenci/veli", p.ISTEMCI_ROLLERI, ["ogrenci", "veli"]);

  // ---------------------------------------------------------------- rol
  esit("rolsüz eski hesap öğrenci", p.rolCoz({}), "ogrenci");
  esit("veli", p.rolCoz({ rol: "veli" }), "veli");
  esit("yönetici", p.rolCoz({ rol: "yonetici" }), "yonetici");
  esit("bilinmeyen rol → null", p.rolCoz({ rol: "admin" }), null);
  esit("null rol → null", p.rolCoz({ rol: null }), null);

  // ---------------------------------------------------------------- eksik profil
  esit("tam öğrenci", p.profilEksikleri({ rol: "ogrenci", adSoyad: "Ali Can", sinif: "9. Sınıf" }), []);
  esit("adsız öğrenci", p.profilEksikleri({ rol: "ogrenci", sinif: "9. Sınıf" }), ["adSoyad"]);
  esit("sınıfsız öğrenci", p.profilEksikleri({ rol: "ogrenci", adSoyad: "Ali" }), ["sinif"]);
  esit("geçersiz sınıflı eski öğrenci", p.profilEksikleri({ adSoyad: "Ali", sinif: "12" }), ["sinif"]);
  esit("boşluktan ibaret ad eksik", p.profilEksikleri({ rol: "ogrenci", adSoyad: "   ", sinif: "Mezun" }), ["adSoyad"]);
  esit("veliye sınıf sorulmaz", p.profilEksikleri({ rol: "veli", adSoyad: "Veli Bey" }), []);
  esit("adsız veli", p.profilEksikleri({ rol: "veli" }), ["adSoyad"]);
  esit("yöneticiye profil tamamlama yok", p.profilEksikleri({ rol: "yonetici" }), []);
  esit("bilinmeyen role tamamlama yok (giriş reddedilir)", p.profilEksikleri({ rol: "x" }), []);

  // ---------------------------------------------------------------- profil formu
  esit("geçerli öğrenci", p.profilFormuDogrula({ adSoyad: "  Ece   Çağ ", sinif: "11. Sınıf", rol: "ogrenci" }), { profil: { rol: "ogrenci", adSoyad: "Ece Çağ", sinif: "11. Sınıf" } });
  esit("veli: sınıf yok sayılır", p.profilFormuDogrula({ adSoyad: "Veli Bey", sinif: "9. Sınıf", rol: "veli" }), { profil: { rol: "veli", adSoyad: "Veli Bey" } });
  esit("yönetici formdan seçilemez", p.profilFormuDogrula({ adSoyad: "Mu Dür", rol: "yonetici" }).hata !== undefined, true);
  esit("rol yok → hata", p.profilFormuDogrula({ adSoyad: "Ali Can", sinif: "9. Sınıf" }).hata !== undefined, true);
  esit("sınıfsız öğrenci → hata", p.profilFormuDogrula({ adSoyad: "Ali Can", rol: "ogrenci" }).hata, "Lütfen sınıfını seç.");
  esit("geçersiz sınıf → hata", p.profilFormuDogrula({ adSoyad: "Ali Can", sinif: "12", rol: "ogrenci" }).hata, "Lütfen sınıfını seç.");
  esit("tek harf ad → hata", p.profilFormuDogrula({ adSoyad: "A", rol: "veli" }).hata, "Lütfen adını ve soyadını yaz.");
  esit("görünmez karakterler temizlenir", p.profilFormuDogrula({ adSoyad: "A​li‮ Can", rol: "veli" }).profil.adSoyad, "Ali Can");
  esit("ad 40 karakterde kesilir", p.profilFormuDogrula({ adSoyad: "a".repeat(80), rol: "veli" }).profil.adSoyad.length, 40);
  esit("tamamlamada rol sabit: formdaki rol yok sayılır (veli öğrenci olamaz)", p.profilFormuDogrula({ adSoyad: "Veli Bey", rol: "ogrenci", rolSabit: "veli" }).profil.rol, "veli");
  esit("tamamlamada yönetici rolü sabitlenemez", p.profilFormuDogrula({ adSoyad: "Mu Dür", rolSabit: "yonetici" }).hata !== undefined, true);

  // ---------------------------------------------------------------- kayıt formu
  const iyiKayit = { adSoyad: "Ece Çağ", sinif: "10. Sınıf", rol: "ogrenci", eposta: " Ece@Ornek.com ", sifre: "12345678", onay: true };
  esit("geçerli kayıt", p.kayitFormuDogrula(iyiKayit), { profil: { rol: "ogrenci", adSoyad: "Ece Çağ", sinif: "10. Sınıf" }, eposta: "Ece@Ornek.com" });
  esit("kısa şifre", p.kayitFormuDogrula({ ...iyiKayit, sifre: "1234567" }).hata, "Şifre en az 8 karakter olmalı.");
  esit("şifre yok", p.kayitFormuDogrula({ ...iyiKayit, sifre: undefined }).hata, "Şifre en az 8 karakter olmalı.");
  for (const e of ["", "ece", "ece@", "@ornek.com", "ece @ornek.com", "ece@ornek"]) {
    esit(`geçersiz e-posta: "${e}"`, p.kayitFormuDogrula({ ...iyiKayit, eposta: e }).hata, "Lütfen geçerli bir e-posta adresi yaz.");
  }
  esit("kayıtta yönetici seçilemez", p.kayitFormuDogrula({ ...iyiKayit, rol: "yonetici" }).hata !== undefined, true);
  esit("veli kaydı sınıfsız", p.kayitFormuDogrula({ ...iyiKayit, rol: "veli", sinif: null }).profil, { rol: "veli", adSoyad: "Ece Çağ" });
  for (const o of [undefined, false, "true", 1, null]) {
    esit(`onay kutusu işaretsiz (${JSON.stringify(o)}) → kayıt olunamaz`, p.kayitFormuDogrula({ ...iyiKayit, onay: o }).hata, "Devam etmek için Kullanım Koşulları onay kutusunu işaretle.");
  }

  // ---------------------------------------------------------------- bekleyen profil
  const SIMDI = 1795900000000;
  const metin = p.bekleyenProfilMetni({ rol: "ogrenci", adSoyad: "Ece Çağ", sinif: "10. Sınıf" }, "Ece@Ornek.com", SIMDI);
  esit("şifre saklanmaz", /sifre|password|parola/i.test(metin), false);
  esit("aynı e-posta, süre içinde → profil", p.bekleyenProfilCoz(metin, "ece@ornek.com", SIMDI + 5000), { rol: "ogrenci", adSoyad: "Ece Çağ", sinif: "10. Sınıf" });
  esit("büyük/küçük harf ve boşluk farkı önemsiz", p.bekleyenProfilCoz(metin, "  ECE@ornek.COM ", SIMDI).rol, "ogrenci");
  esit("başka e-posta → null", p.bekleyenProfilCoz(metin, "baska@ornek.com", SIMDI), null);
  esit("e-posta yok (Apple gizli) → null", p.bekleyenProfilCoz(metin, null, SIMDI), null);
  esit("15 dk sonra → null", p.bekleyenProfilCoz(metin, "ece@ornek.com", SIMDI + 15 * 60 * 1000 + 1), null);
  esit("gelecekten (saat oynatma) → null", p.bekleyenProfilCoz(p.bekleyenProfilMetni({ rol: "veli", adSoyad: "Veli Bey" }, "v@x.com", SIMDI + 10 * 60 * 1000), "v@x.com", SIMDI), null);
  const kurcalanmis = JSON.stringify({ ...JSON.parse(metin), rol: "yonetici" });
  esit("kurcalanmış rol (yönetici) → null", p.bekleyenProfilCoz(kurcalanmis, "ece@ornek.com", SIMDI), null);
  const kurcalanmisSinif = JSON.stringify({ ...JSON.parse(metin), sinif: "Üniversite" });
  esit("kurcalanmış sınıf → null", p.bekleyenProfilCoz(kurcalanmisSinif, "ece@ornek.com", SIMDI), null);
  esit("bozuk JSON → null", p.bekleyenProfilCoz("{bozuk", "ece@ornek.com", SIMDI), null);
  esit("null metin → null", p.bekleyenProfilCoz(null, "ece@ornek.com", SIMDI), null);
  esit("zamansız → null", p.bekleyenProfilCoz(JSON.stringify({ rol: "veli", adSoyad: "Veli Bey", eposta: "v@x.com" }), "v@x.com", SIMDI), null);

  // ---------------------------------------------------------------- kayıtta verilen onay
  const ONAY = SIMDI - 30000;
  const onayliMetin = p.bekleyenProfilMetni({ rol: "veli", adSoyad: "Veli Bey" }, "v@x.com", SIMDI, ONAY);
  const onayli = p.bekleyenProfilCoz(onayliMetin, "v@x.com", SIMDI + 1000);
  esit("onay anı korunur", onayli.onayZamani, ONAY);
  const onayliBelge = p.yeniProfilBelgesi({ profil: onayli, eposta: "v@x.com", simdi: SIMDI });
  esit("onay profille kaydedilir (aynı biçim, kaynak kayit)", onayliBelge.yasOnayi, { onaylandi: true, surum: 1, tarih: new Date(ONAY).toISOString(), rol: "veli", kaynak: "kayit" });
  esit("onay anı belgenin kök alanı olmaz", "onayZamani" in onayliBelge, false);
  esit("onaysız bekleyen profil → onay kaydı yok (onay ekranı çıkar)", "yasOnayi" in p.yeniProfilBelgesi({ profil: p.bekleyenProfilCoz(metin, "ece@ornek.com", SIMDI), eposta: "e@x.com", simdi: SIMDI }), false);
  const sonraOnay = JSON.stringify({ ...JSON.parse(onayliMetin), onayZamani: SIMDI + 5000 });
  esit("kayıttan SONRAKİ onay anı yok sayılır", "onayZamani" in p.bekleyenProfilCoz(sonraOnay, "v@x.com", SIMDI + 6000), false);
  const eskiOnay = JSON.stringify({ ...JSON.parse(onayliMetin), onayZamani: SIMDI - 16 * 60 * 1000 });
  esit("çok eski onay anı yok sayılır", "onayZamani" in p.bekleyenProfilCoz(eskiOnay, "v@x.com", SIMDI), false);
  const metinOnay = JSON.stringify({ ...JSON.parse(onayliMetin), onayZamani: "dün" });
  esit("bozuk onay anı yok sayılır", "onayZamani" in p.bekleyenProfilCoz(metinOnay, "v@x.com", SIMDI), false);

  // ---------------------------------------------------------------- yeni profil belgesi
  const belgeO = p.yeniProfilBelgesi({ profil: { rol: "ogrenci", adSoyad: "Ece", sinif: "Mezun" }, eposta: "e@x.com", simdi: SIMDI });
  esit("öğrenci belgesi alanları", Object.keys(belgeO).sort(), ["adSoyad", "eposta", "kayitTarihi", "rol", "sinif"]);
  const belgeV = p.yeniProfilBelgesi({ profil: { rol: "veli", adSoyad: "Veli", sinif: "9. Sınıf" }, eposta: "v@x.com", simdi: SIMDI });
  esit("veli belgesinde sınıf yok", "sinif" in belgeV, false);
  esit("onaysız belgede yasOnayi yok", "yasOnayi" in belgeO, false);
  const yasakli = ["premiumMu", "premiumKaynaklari", "kurumId", "kurumRol", "bagliOgrenciIdleri", "baglantiKodu", "seriGunu", "sonSoruGunu"];
  esit("belgede sunucu alanı yok", yasakli.some((k) => k in belgeO || k in belgeV), false);

  // ---------------------------------------------------------------- yönetici denemesi
  esit("hata yok → yönetici", p.yoneticiDenemesiSonucu(null), "yonetici");
  esit("davet yok → normal akış", p.yoneticiDenemesiSonucu({ message: "davet-yok" }), "normal");
  for (const m of ["lisans-gecersiz", "davet-kullanilmis", "hesap-kullaniliyor", "eposta-dogrulanmadi", "internal", undefined]) {
    esit(`"${m}" → dur (güvenli taraf)`, p.yoneticiDenemesiSonucu({ message: m, code: "functions/x" }), "dur");
  }

  // ---------------------------------------------------------------- kaynak denetimi
  const giris = fs.readFileSync(path.join(KOK, "screens/LoginScreen.js"), "utf8");
  esit("giriş ekranında rol sekmesi/hedefRol yok", /const \[seciliRol|hedefRol|"yonetici"/.test(giris), false);
  esit("placeholder 'E-posta adresiniz'", giris.includes('placeholder="E-posta adresiniz"') && !giris.includes("E-posta Adresiniz"), true);
  esit("kayıtta rol açılır seçiciyle, boş başlar", giris.includes("<RolSecici") && giris.includes("useState(null);") && giris.includes('"Hesap türünüz"'), true);
  const rolSecici = fs.readFileSync(path.join(KOK, "screens/RolSecici.js"), "utf8");
  esit("rol seçicide yalnızca Öğrenci/Veli", (rolSecici.match(/deger: "/g) || []).length === 2 && rolSecici.includes('deger: "ogrenci"') && rolSecici.includes('deger: "veli"') && !rolSecici.includes("yonetici"), true);
  esit("veli seçilince sınıf gizlenir", giris.includes('kayitMi && kayitRol !== "veli"'), true);
  esit("tür seçilmeden kayıt olunamaz", p.kayitFormuDogrula({ adSoyad: "Ece Çağ", sinif: "9. Sınıf", rol: null, eposta: "e@x.com", sifre: "12345678", onay: true }).hata, "Lütfen Öğrenci ya da Veli seç.");
  const tamamla = fs.readFileSync(path.join(KOK, "screens/ProfilTamamla.js"), "utf8");
  esit("tamamlama ekranında yönetici seçeneği yok", tamamla.includes("yonetici"), false);
  esit("tamamlamada rol yalnızca yeni profilde seçilir", tamamla.includes("{yeniMi && (") && tamamla.includes("<RolSecici") && tamamla.includes("rolSabit: yeniMi ? undefined : rolSabit"), true);
  const app = fs.readFileSync(path.join(KOK, "App.js"), "utf8");
  esit("App: rol varsayılanı boş", app.includes("useState(null);\n  // \"Profilini Tamamla\""), true);
  esit("App: hedefRol okunmuyor (yalnızca eskisi silinir)", /getItem\("hedefRol"\)/.test(app), false);
  esit("App: hata olursa oturum kapanır (güvenli taraf)", /Kapı bekçisi hatası[\s\S]{0,200}await signOut\(auth\)/.test(app), true);
  esit("App: rol yoksa sekme açılmaz", app.includes("if (!kullaniciRolu) {"), true);
  esit("App: yönetici denemesi yalnızca doğrulanmış e-postada", app.includes("if (aktifKullanici.emailVerified === true) {"), true);
  esit("App: profil tamamlanmadan bildirim/mağaza/premium başlamaz",
    app.includes("onayGerekli || profilGerekli || kullaniciRolu !== \"ogrenci\"") &&
    app.includes("!kullanici || onayGerekli || profilGerekli) return;") &&
    app.includes("!kullanici || onayGerekli || profilGerekli || !kullaniciRolu) return;"), true);
  const oturum = fs.readFileSync(path.join(KOK, "utils/oturum.js"), "utf8");
  esit("çıkışta bekleyen profil temizlenir", oturum.includes('"bekleyenProfil"'), true);

  // ---------------------------------------------------------------- ortak onay cümlesi ve ekranlar
  const onayCikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-onay-")), "o.cjs");
  await esbuild.build({ entryPoints: [path.join(KOK, "utils/onayMetni.js")], bundle: true, format: "cjs", platform: "node", outfile: onayCikti, logLevel: "error" });
  const o = require(onayCikti);
  esit("öğrenci cümlesi (eski onay ekranıyla aynı)", o.onayOnMetni("ogrenci"), "13 yaşını doldurduğumu, 18 yaşından küçükse velimin bilgisi dahilinde kullandığımı ve ");
  esit("veli cümlesi", o.onayOnMetni("veli"), "18 yaşını doldurduğumu ve ");
  esit("yönetici cümlesi", o.onayOnMetni("yonetici").startsWith("Dershanenin yetkilisi olduğumu"), true);
  esit("tür seçilmemiş: yaş beyanı yok", o.onayOnMetni(null), "");
  esit("başlıklar", [o.kosullarBasligi("ogrenci"), o.kosullarBasligi("yonetici")], ["Kullanım Koşulları", "Yönetici Kullanım Koşulları"]);
  esit("geçerli onay", o.onayGecerliMi({ onaylandi: true, surum: 1 }), true);
  esit("eski sürüm onay geçersiz", o.onayGecerliMi({ onaylandi: true, surum: 0 }), false);
  esit("'true' metni geçersiz", o.onayGecerliMi({ onaylandi: "true", surum: 1 }), false);
  esit("onay yok geçersiz", o.onayGecerliMi(undefined), false);
  esit("kayıt: tür değişince onay sıfırlanır", giris.includes("if (yeniRol !== kayitRol) setOnayZamani(null);") && giris.includes("sec={hesapTuruSec}"), true);
  esit("kayıt: onay kutusu zorunlu", giris.includes("onay: !!onayZamani") && giris.includes('accessibilityRole="checkbox"'), true);
  esit("giriş: koşullar bağlantısı", giris.includes("'na uymayı kabul edersin."), true);
  esit("kayıt düğmesi: koşul doğrulamayla aynı fonksiyon", giris.includes("!kayitFormuDogrula({ adSoyad, sinif, rol: kayitRol, eposta: email, sifre: password, onay: !!onayZamani }).hata"), true);
  esit("kayıt düğmesi hazır değilken basılamaz ve soluk", giris.includes("disabled={islemSuruyor || !kayitHazir}") && giris.includes("!kayitHazir && { opacity: 0.45"), true);
  esit("klavyeden gönderim de engelli", giris.includes("onSubmitEditing={() => kayitHazir && anaIslem()}"), true);
  const yasOnay = fs.readFileSync(path.join(KOK, "screens/YasOnayScreen.js"), "utf8");
  esit("onay ekranı ortak cümle ve pencereyi kullanır", yasOnay.includes("onayOnMetni(rol") && yasOnay.includes("<KosullarPenceresi") && yasOnay.includes("onayKaydi({"), true);
  const pencere = fs.readFileSync(path.join(KOK, "screens/KosullarPenceresi.js"), "utf8");
  esit("koşullar penceresinde JavaScript kapalı", pencere.includes("javaScriptEnabled={false}"), true);
  esit("koşullar penceresi başka sayfaya gidemez", pencere.includes("onShouldStartLoadWithRequest"), true);

  console.log(`[profil] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.log("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
