// Ders (kategori) yardımcıları. Saf mantık: ağ ya da veritabanı kullanmaz, kolayca test edilir.

export const DERSLER = [
  "Matematik",
  "Fizik",
  "Kimya",
  "Biyoloji",
  "Türkçe",
  "Edebiyat",
  "Tarih",
  "Coğrafya",
  "Felsefe",
  "Din Kültürü",
  "İngilizce",
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
  "turk dili ve edebiyati": "Edebiyat",
  edebiyat: "Edebiyat",
  tarih: "Tarih",
  cografya: "Coğrafya",
  felsefe: "Felsefe",
  mantik: "Felsefe",
  din: "Din Kültürü",
  "din kulturu": "Din Kültürü",
  "din kulturu ve ahlak bilgisi": "Din Kültürü",
  ingilizce: "İngilizce",
  english: "İngilizce",
  "yabanci dil": "İngilizce",
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
    "paralelkenar", "benzerlik", "veri analizi", "dogru denklem", "dik aci", "onerme", "bilesik onerme",
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
    "noktalama", "deyim", "atasozu", "metin", "ozne", "yuklem", "nesne", "ses olay", "uslup",
    "edat", "baglac", "unlem", "ek fiil", "anlam bilgisi",
  ],
  Edebiyat: [
    "edebiyat", "siir", "roman", "hikaye", "soz sanati", "divan", "gazel", "kaside", "mesnevi",
    "nazim", "aruz", "hece olcusu", "tiyatro", "sair", "servet i funun", "fecr i ati",
    "tanzimat edebiyati", "milli edebiyat", "halk edebiyati", "edebi", "kosma",
    "destan", "masal", "makale", "fikra", "biyografi", "otobiyografi", "nesir",
  ],
  Felsefe: [
    "felsefe", "filozof", "estetik", "etik", "ahlak felsefesi", "epistemoloji",
    "bilgi felsefesi", "varlik felsefesi", "ontoloji", "metafizik", "sokrates", "platon",
    "aristoteles", "kant", "descartes", "nietzsche", "empirizm", "rasyonalizm", "varolus",
    "ozgur irade", "siyaset felsefesi", "bilim felsefesi", "din felsefesi", "sanat felsefesi",
    "idealizm", "septisizm", "psikoloji", "sosyoloji",
  ],
  "Din Kültürü": [
    "din kulturu", "ibadet", "namaz", "oruc", "zekat", "hac", "kuran", "ayet", "hadis",
    "peygamber", "hz", "tevhid", "iman", "melek", "ahiret", "kader", "vahiy", "abdest", "dua",
    "tasavvuf", "mezhep", "sunnet", "kurban", "islam", "allah", "kelime i sehadet", "sadaka",
  ],
  "İngilizce": [
    "ingilizce", "english", "grammar", "vocabulary", "tense", "present perfect", "past simple",
    "passive voice", "preposition", "conditional", "relative clause", "reading", "dialogue",
    "the", "which", "following", "sentence", "word", "paragraph", "choose",
  ],
  Tarih: [
    "osmanli", "selcuk", "ataturk", "kurtulus", "cumhuriyet", "inkilap", "padisah",
    "antlasma", "fetih", "islamiyet", "medeniyet", "orta cag", "ronesans", "fransiz ihtilal",
    "dunya savasi", "sultan", "hanedan", "lozan", "mondros", "sevr", "tanzimat", "mesrutiyet",
    "milli mucadele", "ilk cag", "uygarlik", "islamiyet oncesi", "islam tarihi",
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

// ---------------------------------------------------------------------------
// Geçmiş Sorular kategori sırası: "Tümü" önce; sonra en çok soru sorulan ders. Eşitlikte son sorusu daha
// yeni olan önce, o da eşitse DERSLER sırası. Hiç soru olmayan dersler sabit sırada sonda; "Diğer" her zaman
// en sonda. DERSLER dışındaki ders adları da kendi kategorisiyle gösterilir. Saf fonksiyon (yalnızca sıralar).
// zamanBul(soru) → ms (sıralama içindir; okunamazsa 0)
// ---------------------------------------------------------------------------
export const kategoriSiralamasi = (sorular, zamanBul = () => 0) => {
  const istatistik = new Map(); // ders -> { adet, son }
  for (const soru of Array.isArray(sorular) ? sorular : []) {
    const ders = dersBul(soru);
    const ms = Number(zamanBul(soru)) || 0;
    const kayit = istatistik.get(ders) || { adet: 0, son: 0 };
    kayit.adet += 1;
    if (ms > kayit.son) kayit.son = ms;
    istatistik.set(ders, kayit);
  }
  const sabitSira = (ders) => {
    const i = DERSLER.indexOf(ders);
    return i === -1 ? DERSLER.length : i;
  };
  const tumDersler = [...new Set([...DERSLER, ...istatistik.keys()])].filter((d) => d !== "Diğer");
  tumDersler.sort((a, b) => {
    const A = istatistik.get(a) || { adet: 0, son: 0 };
    const B = istatistik.get(b) || { adet: 0, son: 0 };
    if (B.adet !== A.adet) return B.adet - A.adet;
    if (B.son !== A.son) return B.son - A.son;
    if (sabitSira(a) !== sabitSira(b)) return sabitSira(a) - sabitSira(b);
    return a.localeCompare(b, "tr");
  });
  return ["Tümü", ...tumDersler, "Diğer"];
};

// Çözümü hazır ama öğrencinin henüz açmadığı soru ("yeni çözüm"). Alt menüdeki sayı ve Geçmiş Sorular
// kartları aynı kuralı kullanır; böylece ikisi hiçbir zaman çelişmez.
export const yeniCozumMu = (soru) => soru?.durum === "Çözüldü" && soru?.okunduMu !== true;

// n8n dersi "Diğer" yazdı ama konu başlığı dersi açıkça gösteriyor mu? (ör. "Varlık felsefesi" → Felsefe)
// Öğrencinin elle seçtiği ders (dersKaynak "kullanici") asla değiştirilmez. Tahmin yoksa null.
export const digerYerineDers = (soru) => {
  if (!soru || soru.durum !== "Çözüldü") return null;
  if (soru.dersKaynak === "kullanici") return null;
  if (dersBul(soru) !== "Diğer") return null;
  const tahmin = dersTahminEt({ topic: soru.topic || soru.konu, question: "" });
  return tahmin && tahmin !== "Diğer" ? tahmin : null;
};
