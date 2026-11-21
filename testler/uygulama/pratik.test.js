// Uygulama testi: utils/cozumYukleyici.js — pratik (benzer) soruların şıkları ve doğru şık tespiti.
// Çalıştırma (proje kökünden):  node testler/uygulama/pratik.test.js
// Gerçek dosya, telefon/Firebase modülleri sahteleriyle değiştirilerek esbuild ile derlenip çalıştırılır.

const path = require("path");
const os = require("os");
const fs = require("fs");
const KOK = path.resolve(__dirname, "..", "..");
const esbuild = require(require.resolve("esbuild", { paths: [KOK] }));

const SAHTELER = {
  "@react-native-async-storage/async-storage": "export default {};",
  "firebase/storage": "export const ref = () => null; export const getDownloadURL = async () => null;",
  "../firebaseConfig": "export const storage = {};",
  "./appCheck": "export const appCheckBasligi = async () => ({});",
};
const sahte = {
  name: "sahte",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => (SAHTELER[a.path] !== undefined ? { path: a.path, namespace: "sahte" } : null));
    b.onLoad({ filter: /.*/, namespace: "sahte" }, (a) => ({ contents: SAHTELER[a.path], loader: "js" }));
  },
};

(async () => {
  const cikti = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mikro-pratik-")), "m.cjs");
  await esbuild.build({
    entryPoints: [path.join(KOK, "utils/cozumYukleyici.js")],
    bundle: true, format: "cjs", platform: "node", outfile: cikti, logLevel: "error", plugins: [sahte],
  });
  const { cozumuDuzenle } = require(cikti);

  let gecen = 0;
  let kalan = 0;
  const esit = (ad, gercek, beklenen) => {
    if (JSON.stringify(gercek) === JSON.stringify(beklenen)) gecen++;
    else {
      kalan++;
      console.log("HATA:", ad, "beklenen", JSON.stringify(beklenen), "gelen", JSON.stringify(gercek));
    }
  };
  const tek = (kaynak) => cozumuDuzenle({ similarQuestions: [{ level: "kolay", question: "Soru?", ...kaynak }] }).pratikSorular[0];

  // 1) Canlıdaki gerçek biçim (21 Kasım 2026 sorusu)
  const gercek = cozumuDuzenle({
    similarQuestions: [
      { level: "kolay", question: "q1", steps: ["s"], answer: "1", options: ["A) 0", "B) 1", "C) 2", "D) e", "E) \\frac{1}{e}"], correct_option: "B) 1" },
      { level: "orta", question: "q2", answer: "\\frac{e}{2}", options: ["A) e", "B) \\frac{e}{2}", "C) 2e", "D) \\frac{1}{e}", "E) \\frac{2}{e}"], correct_option: "B) \\frac{e}{2}" },
      { level: "zor", question: "q3", answer: "1", options: ["A) 0", "B) 1", "C) 2", "D) \\frac{1}{2}", "E) \\frac{1}{3}"], correct_option: "B) 1" },
    ],
  }).pratikSorular;
  esit("gerçek: kolay doğru şık B", gercek[0].dogruSecenek, "B");
  esit("gerçek: orta doğru şık B", gercek[1].dogruSecenek, "B");
  esit("gerçek: zor doğru şık B", gercek[2].dogruSecenek, "B");
  esit("gerçek: şık metninden tekrarlanan harf atıldı", gercek[0].secenekler, { A: "0", B: "1", C: "2", D: "e", E: "\\frac{1}{e}" });

  // 2) Farklı biçimler
  const SIKLAR = ["A) 0", "B) 1", "C) 2", "D) e", "E) 5"];
  esit("tek harf 'C'", tek({ options: SIKLAR, correct_option: "C" }).dogruSecenek, "C");
  esit("küçük harf önek 'c) 2'", tek({ options: SIKLAR, correct_option: "c) 2" }).dogruSecenek, "C");
  esit("nokta önek 'D. e'", tek({ options: SIKLAR, correct_option: "D. e" }).dogruSecenek, "D");
  esit("tire önek 'E - 5'", tek({ options: SIKLAR, correct_option: "E - 5" }).dogruSecenek, "E");
  esit("yalnızca değer '2'", tek({ options: SIKLAR, correct_option: "2" }).dogruSecenek, "C");
  esit("TUZAK: değer 'e' → E şıkkı DEĞİL, D şıkkı", tek({ options: SIKLAR, correct_option: "e" }).dogruSecenek, "D");
  esit("doğru şık yok, cevap alanından", tek({ options: SIKLAR, answer: "1" }).dogruSecenek, "B");
  esit("nesne biçimli şıklar", tek({ options: { A: "x", B: "y", C: "z" }, correct_option: "B" }).dogruSecenek, "B");
  esit("önekli olmayan şık metni bozulmadı", tek({ options: ["12", "13"], correct_option: "13" }).secenekler, { A: "12", B: "13" });
  esit("başka harfle başlayan metne dokunulmadı", tek({ options: ["B) yanlış önek", "x"], correct_option: "x" }).secenekler, { A: "B) yanlış önek", B: "x" });

  // 3) Belirlenemiyorsa test gösterilmez (her cevap 'yanlış' olmasın)
  const belirsiz = tek({ options: SIKLAR, correct_option: "7", answer: "1" + "9" });
  esit("belirsiz: şıklar kapatıldı", belirsiz.secenekler, null);
  esit("belirsiz: doğru şık null", belirsiz.dogruSecenek, null);
  esit("belirsiz: soru yine var (Çözümü Göster)", belirsiz.soru, "Soru?");
  esit("var olmayan harf 'F'", tek({ options: SIKLAR, correct_option: "F" }).secenekler, null);
  esit("aynı metinli iki şık: tahmin edilmez", tek({ options: ["A) 1", "B) 1"], correct_option: "1" }).secenekler, null);
  esit("şıksız soru: değişmedi", tek({ answer: "5" }).secenekler, null);
  esit("şıksız soru: cevap korunur", tek({ answer: "5" }).cevap, "5");

  console.log(`[pratik] ${gecen} geçti, ${kalan} hata`);
  process.exit(kalan ? 1 : 0);
})().catch((e) => {
  console.error("TEST ÇÖKTÜ:", e);
  process.exit(1);
});
