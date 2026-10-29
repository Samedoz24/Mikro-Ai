// Ders (kategori) yardımcıları. Saf mantık: ağ ya da veritabanı kullanmaz, kolayca test edilir.

export const DERSLER = [
  "Matematik",
  "Fizik",
  "Kimya",
  "Biyoloji",
  "Türkçe",
  "Tarih",
  "Coğrafya",
  "Diğer",
];

// Küçük harfe çevirir, Türkçe harfleri ve aksanları sadeleştirir, noktalamayı boşluğa çevirir
const norm = (metin) =>
  String(metin ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// n8n ya da kullanıcı farklı yazsa da ("matematik", "TÜRKÇE", "Geometri") bilinen derse çevirir
const DERS_ESLESMELERI = {
  matematik: "Matematik",
  geometri: "Matematik",
  fizik: "Fizik",
  kimya: "Kimya",
  biyoloji: "Biyoloji",
  turkce: "Türkçe",
  "turk dili ve edebiyati": "Türkçe",
  edebiyat: "Türkçe",
  tarih: "Tarih",
  cografya: "Coğrafya",
  diger: "Diğer",
};

export const dersAdiniDuzelt = (deger) => {
  const metin = String(deger ?? "").trim();
  if (!metin) return "";
  return DERS_ESLESMELERI[norm(metin)] || metin;
};

// Belgede ders bilgisi var mı? (n8n "ders", "subject" ya da "lesson" yazabilir)
export const dersBilgisiVar = (soru) =>
  Boolean(String(soru?.ders || soru?.subject || soru?.lesson || "").trim());

// Bir sorunun dersi. Belgede ders yoksa soru kaybolmasın diye "Diğer" sayılır.
export const dersBul = (soru) =>
  dersAdiniDuzelt(soru?.ders || soru?.subject || soru?.lesson) || "Diğer";

// ---------------------------------------------------------------------------
// Konu başlığından / soru metninden ders tahmini (yapay zekâ ders bilgisi vermediğinde)
// ---------------------------------------------------------------------------

// Anahtar sözcükler (norm biçiminde). 3 harf ve altı sözcükler tam eşleşir, diğerleri
// sözcük başı eşleşir ("denklem" -> denklemler, denklemin).
const ANAHTAR = {
  Matematik: [
    "denklem", "esitsizlik", "fonksiyon", "turev", "integral", "limit", "logaritma", "uslu",
    "koklu", "polinom", "olasilik", "permutasyon", "kombinasyon", "geometri", "ucgen",
    "cember", "dortgen", "trigonometri", "sinus", "kosinus", "matris", "determinant", "kume",
    "asal", "ebob", "ekok", "oran", "yuzde", "faiz", "ardisik", "dizi", "carpan", "kesir",
    "ondalik", "parabol", "problem", "grafik", "ortalama", "medyan", "aritmetik", "rakam",
    "basamak", "karekok", "koordinat", "prizma", "piramit", "silindir", "pisagor", "yamuk",
    "paralelkenar", "benzerlik", "veri analizi", "dogru denklem", "dik aci",
  ],
  Fizik: [
    "kuvvet", "ivme", "enerji", "momentum", "surtunme", "basinc", "elektrik", "akim",
    "direnc", "devre", "manyetik", "dalga", "optik", "lens", "ayna", "termodinamik",
    "sicaklik", "fotoelektrik", "newton", "vektor", "hareket", "yercekimi", "kutle",
    "volt", "amper", "ohm", "frekans", "genlik", "kirilma", "yansima", "serbest dusme",
    "bileske", "tork", "kaldirac", "yogunluk", "elektromanyetik", "radyoaktif", "nukleer",
  ],
  Kimya: [
    "mol", "element", "bilesik", "periyodik", "asit", "baz", "tuz", "cozelti", "derisim",
    "tepkime", "elektroliz", "organik", "hidrokarbon", "alkan", "alken", "alkin", "gaz",
    "kovalent", "iyonik", "yukseltgenme", "indirgenme", "oksitlenme", "kimyasal", "molekul",
    "iyon", "katalizor", "cozunurluk", "ph", "avogadro", "izotop",
  ],
  Biyoloji: [
    "hucre", "dna", "rna", "protein", "enzim", "fotosentez", "solunum", "kalitim", "gen",
    "kromozom", "mitoz", "mayoz", "ekosistem", "sindirim", "dolasim", "sinir", "hormon",
    "bitki", "hayvan", "canli", "evrim", "bakteri", "virus", "doku", "organel",
    "metabolizma", "besin zinciri", "populasyon", "ekoloji", "omurgali", "tohum", "mantar",
  ],
  Türkçe: [
    "sozcuk", "cumle", "paragraf", "anlatim", "fiil", "isim", "sifat", "zarf", "yazim",
    "noktalama", "deyim", "atasozu", "edebiyat", "siir", "roman", "metin", "ozne", "yuklem",
    "nesne", "ses olay", "soz sanati", "hikaye", "uslup", "edat", "baglac", "unlem",
  ],
  Tarih: [
    "osmanli", "selcuk", "ataturk", "kurtulus", "cumhuriyet", "inkilap", "padisah",
    "antlasma", "fetih", "islamiyet", "medeniyet", "orta cag", "ronesans", "fransiz ihtilal",
    "dunya savasi", "sultan", "hanedan", "lozan", "mondros", "sevr", "tanzimat", "mesrutiyet",
    "milli mucadele", "ilk cag", "uygarlik",
  ],
  Coğrafya: [
    "iklim", "harita", "nufus", "yer sekilleri", "akarsu", "goller", "dag", "ova", "enlem",
    "boylam", "olcek", "yagis", "yagmur", "bitki ortusu", "toprak", "maden", "goc",
    "yerlesme", "kita", "okyanus", "deprem", "volkan", "ruzgar", "nem", "turizm", "tarim",
    "sanayi", "ulasim", "paralel", "meridyen",
  ],
};

const eslesir = (doldurulmus, kelime) =>
  kelime.length <= 3
    ? doldurulmus.includes(` ${kelime} `)
    : doldurulmus.includes(` ${kelime}`);

/**
 * Konu başlığı (ağırlık 3) ve soru metninden (ağırlık 1) dersi tahmin eder.
 * Belirgin bir kazanan yoksa null döner; çağıran taraf soruyu "Diğer"de bırakır.
 */
export const dersTahminEt = ({ topic, question } = {}) => {
  const konu = ` ${norm(topic)} `;
  const soru = ` ${norm(question).slice(0, 600)} `;

  const puanlar = Object.entries(ANAHTAR)
    .map(([ders, kelimeler]) => {
      let puan = 0;
      kelimeler.forEach((kelime) => {
        if (eslesir(konu, kelime)) puan += 3;
        if (eslesir(soru, kelime)) puan += 1;
      });
      return { ders, puan };
    })
    .sort((a, b) => b.puan - a.puan);

  const [birinci, ikinci] = puanlar;
  if (birinci.puan >= 2 && birinci.puan >= ikinci.puan * 1.5) return birinci.ders;
  return null;
};
