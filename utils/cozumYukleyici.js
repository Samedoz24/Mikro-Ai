import AsyncStorage from "@react-native-async-storage/async-storage";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "../firebaseConfig";

// Bulunan çözümler önbelleğe alınır; böylece aynı soruya her tıklamada Storage'dan tekrar indirilmez.
// Bulunamayan dosyalar önbelleğe ALINMAZ (çözüm sonradan üretilebilir).
// Soru "Çözüldü" durumuna geçmeden de önbelleğe yazılmaz: n8n dosyaları durumdan önce yazar,
// yarım ya da sonradan güncellenen bir dosya kalıcı olarak saklanmasın diye.
const bellek = new Map();

const zamanDamgasiBul = (soru) => {
  if (soru.fotoLink) {
    const match = soru.fotoLink.match(/(\d{13})/);
    if (match && match[1]) return match[1];
    const matchYedek = soru.fotoLink.match(/(\d+)\.(jpg|jpeg|png)/i);
    if (matchYedek && matchYedek[1]) return matchYedek[1];
  }
  return soru.id;
};

// Belgeye yazılan yol yalnızca beklenen biçimdeyse (klasör/sahip/dosya) kullanılır
const YOL_BICIMI = /^(cozumDetayi|solution-cards)\/[^/]+\/[^/]+$/;

// Bir sorunun çözüm dosyası için aranacak Storage yolları, öncelik sırasıyla:
//  1) n8n'in soru belgesine yazdığı gerçek yol (jsonPath / firebasePath)
//  2) kullanıcı UID'siyle oluşan yol (yeni sistem)
//  3) kullanıcı e-postasıyla oluşan yol (eski sistem)
const adayYollar = (soru, eposta, klasor, uzanti, kayitliYol) => {
  const zaman = zamanDamgasiBul(soru);
  const yollar = [];
  const ekle = (yol) => {
    if (yol && !yollar.includes(yol)) yollar.push(yol);
  };
  if (typeof kayitliYol === "string" && YOL_BICIMI.test(kayitliYol)) {
    ekle(kayitliYol);
  }
  if (soru.kullaniciUid) ekle(`${klasor}/${soru.kullaniciUid}/${zaman}.${uzanti}`);
  if (eposta) ekle(`${klasor}/${eposta}/${zaman}.${uzanti}`);
  return yollar;
};

// Soru silinirken temizlenecek tüm olası çözüm dosyası yolları
export const cozumYollari = (soru, eposta) => ({
  json: adayYollar(soru, eposta, "cozumDetayi", "json", soru.jsonPath),
  resim: adayYollar(soru, eposta, "solution-cards", "png", soru.firebasePath),
});

// Çözüm doğrudan soru belgesinin içinde (nesne ya da JSON metni olarak) yazılmışsa onu kullan
const gomuluCozum = (deger) => {
  if (deger && typeof deger === "object") return deger;
  if (typeof deger === "string" && deger.trim().startsWith("{")) {
    try {
      return JSON.parse(deger);
    } catch (e) {}
  }
  return null;
};

// Değeri güvenle metne çevirir (çözüm dosyası biçimi değişse de ekran çökmesin)
const metneCevir = (deger) => {
  if (deger === null || deger === undefined) return "";
  if (typeof deger === "string") return deger;
  if (typeof deger === "number" || typeof deger === "boolean") return String(deger);
  if (typeof deger === "object") {
    const ic =
      deger.text ?? deger.step ?? deger.aciklama ?? deger.description ?? deger.content ?? deger.title;
    return ic !== undefined ? metneCevir(ic) : JSON.stringify(deger);
  }
  return "";
};

const METIN_ALANLARI = [
  "cardTitle",
  "subject",
  "topic",
  "question",
  "cardExpression",
  "expression",
  "cardAnswer",
  "correct_answer",
  "solution",
  "answer",
  "sonuc",
  "result",
  "explanation",
];

// Eski ve yeni n8n biçimlerini ekranın beklediği tek biçime getirir:
// metin alanları gerçekten metin, adımlar metin dizisi olur.
export const cozumuDuzenle = (cozum) => {
  if (!cozum || typeof cozum !== "object") return cozum;
  const duzen = { ...cozum };
  METIN_ALANLARI.forEach((alan) => {
    if (alan in duzen) duzen[alan] = metneCevir(duzen[alan]);
  });
  const adimlar = cozum.cardSteps || cozum.steps;
  if (adimlar !== undefined) {
    duzen.cardSteps = (Array.isArray(adimlar) ? adimlar : [adimlar])
      .map(metneCevir)
      .filter((adim) => adim.trim() !== "");
  }
  return duzen;
};

const onbellekten = async (anahtar) => {
  if (bellek.has(anahtar)) return bellek.get(anahtar);
  try {
    const kayit = await AsyncStorage.getItem(anahtar);
    if (kayit) {
      const deger = JSON.parse(kayit);
      bellek.set(anahtar, deger);
      return deger;
    }
  } catch (e) {}
  return null;
};

const onbellegeYaz = async (anahtar, deger) => {
  bellek.set(anahtar, deger);
  try {
    await AsyncStorage.setItem(anahtar, JSON.stringify(deger));
  } catch (e) {}
};

// Yolları sırayla dener. Hiçbirinde dosya yoksa { deger: null }; dosya bulunamadığı için değil,
// gerçekten bir hata (ağ, izin) yüzünden ulaşılamadıysa { deger: null, hata } döner.
const getir = async (anahtar, yollar, jsonMu, onbellegeYazilsin) => {
  const kayitli = await onbellekten(anahtar);
  if (kayitli !== null) return { deger: kayitli };

  let sonHata = null;
  for (const yol of yollar) {
    try {
      const url = await getDownloadURL(ref(storage, yol));
      let deger = url;
      if (jsonMu) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        deger = await response.json();
      }
      if (onbellegeYazilsin) await onbellegeYaz(anahtar, deger);
      return { deger };
    } catch (e) {
      if (e?.code === "storage/object-not-found") continue;
      console.log("Çözüm dosyası alınamadı:", yol, e?.code, e?.message);
      sonHata = e?.code || "bilinmeyen";
    }
  }
  return sonHata ? { deger: null, hata: sonHata } : { deger: null };
};

/**
 * Bir sorunun çözüm JSON'unu ve çözüm kartı resmini getirir.
 * Dönüş: { cozumDetayi, cozumKartiLink, hata }
 *  hata: dosya yok değil, gerçekten bir yükleme hatası olduysa dolu gelir.
 */
export const cozumYukle = async (soru, eposta) => {
  const zaman = zamanDamgasiBul(soru);
  const yollar = cozumYollari(soru, eposta);
  const gomulu = gomuluCozum(soru.cozumDetayi);
  const onbellegeYazilsin = soru.durum === "Çözüldü";

  const [json, resim] = await Promise.all([
    gomulu
      ? Promise.resolve({ deger: gomulu })
      : getir(`cozum:json:${eposta}:${zaman}`, yollar.json, true, onbellegeYazilsin),
    getir(`cozum:resim:${eposta}:${zaman}`, yollar.resim, false, onbellegeYazilsin),
  ]);

  // Son çare: belgedeki hazır kart bağlantısı (imzalı bağlantılar kısa süre geçerli olabilir,
  // bu yüzden Storage'daki kalıcı bağlantı bulunamazsa kullanılır)
  let kartLinki = resim.deger;
  if (
    !kartLinki &&
    typeof soru.cozumKartiLink === "string" &&
    /^https?:\/\//.test(soru.cozumKartiLink)
  ) {
    kartLinki = soru.cozumKartiLink;
  }

  return {
    cozumDetayi: cozumuDuzenle(json.deger),
    cozumKartiLink: kartLinki,
    hata: json.hata || resim.hata || null,
  };
};

// Hesap silinirken ya da gerektiğinde tüm çözüm önbelleğini temizler.
export const cozumOnbelleginiTemizle = async () => {
  bellek.clear();
  try {
    const anahtarlar = await AsyncStorage.getAllKeys();
    const silinecek = anahtarlar.filter((a) => a.startsWith("cozum:"));
    if (silinecek.length > 0) await AsyncStorage.multiRemove(silinecek);
  } catch (e) {}
};

// Silinen bir sorunun çözümü cihazda kalmasın diye önbellekten kaldırılır.
export const cozumOnbellekSil = async (soru, eposta) => {
  const zaman = zamanDamgasiBul(soru);
  const anahtarlar = [
    `cozum:json:${eposta}:${zaman}`,
    `cozum:resim:${eposta}:${zaman}`,
  ];
  anahtarlar.forEach((anahtar) => bellek.delete(anahtar));
  try {
    await AsyncStorage.multiRemove(anahtarlar);
  } catch (e) {}
};
