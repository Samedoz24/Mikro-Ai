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

// Dosya yoksa null, başka bir hata olursa { hata } döner.
const getir = async (anahtar, yol, jsonMu, onbellegeYazilsin) => {
  const kayitli = await onbellekten(anahtar);
  if (kayitli !== null) return { deger: kayitli };

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
    if (e?.code === "storage/object-not-found") return { deger: null };
    console.log("Çözüm dosyası alınamadı:", yol, e?.code, e?.message);
    return { deger: null, hata: e?.code || "bilinmeyen" };
  }
};

/**
 * Bir sorunun çözüm JSON'unu ve çözüm kartı resmini getirir.
 * Dönüş: { cozumDetayi, cozumKartiLink, hata }
 *  hata: dosya yok değil, gerçekten bir yükleme hatası olduysa dolu gelir.
 */
export const cozumYukle = async (soru, eposta) => {
  const zaman = zamanDamgasiBul(soru);
  const onbellegeYazilsin = soru.durum === "Çözüldü";
  const [json, resim] = await Promise.all([
    getir(
      `cozum:json:${eposta}:${zaman}`,
      `cozumDetayi/${eposta}/${zaman}.json`,
      true,
      onbellegeYazilsin
    ),
    getir(
      `cozum:resim:${eposta}:${zaman}`,
      `solution-cards/${eposta}/${zaman}.png`,
      false,
      onbellegeYazilsin
    ),
  ]);

  return {
    cozumDetayi: json.deger,
    cozumKartiLink: resim.deger,
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
