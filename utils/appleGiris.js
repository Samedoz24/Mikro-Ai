// Apple ile Giriş (yalnızca iOS).
//
// Güvenlik:
//  - Her girişte 32 baytlık rastgele bir "nonce" üretilir. Apple'a yalnızca SHA-256 özeti gönderilir;
//    Firebase, Apple'ın imzaladığı kimlik belgesindeki özetin ham değerle eşleştiğini doğrular.
//    Böylece ele geçirilen bir kimlik belgesi başka bir girişte tekrar kullanılamaz.
//  - Apple'ın verdiği tek kullanımlık yetki kodu (authorizationCode) yalnızca hesap silinirken
//    Apple bağlantısını iptal etmek için kullanılır; hiçbir yere kaydedilmez.

import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { OAuthProvider } from "firebase/auth";
import { adSoyadTemizle } from "./profilDogrulama";

export const APPLE_IPTAL = "apple/iptal";

// Cihaz Apple ile Girişi destekliyor mu? (iOS 13+; Android ve web'de her zaman false)
export const appleKullanilabilirMi = async () => {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
};

const nonceUret = () =>
  Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, "0")).join("");

// Apple penceresini açar; Firebase kimlik bilgisini ve tek kullanımlık yetki kodunu döndürür.
// Kullanıcı pencereyi kapatırsa APPLE_IPTAL kodlu hata fırlatır.
export const appleKimligiAl = async () => {
  const hamNonce = nonceUret();
  const nonceOzeti = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    hamNonce
  );

  let cevap;
  try {
    cevap = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: nonceOzeti,
    });
  } catch (e) {
    if (e?.code === "ERR_REQUEST_CANCELED") {
      const hata = new Error("Apple ile giriş iptal edildi.");
      hata.code = APPLE_IPTAL;
      throw hata;
    }
    throw e;
  }

  if (!cevap?.identityToken) {
    const hata = new Error("Apple kimlik belgesi alınamadı.");
    hata.code = "apple/belge-yok";
    throw hata;
  }

  const kimlik = new OAuthProvider("apple.com").credential({
    idToken: cevap.identityToken,
    rawNonce: hamNonce,
  });

  // Apple adı yalnızca İLK yetkilendirmede verir; temizlenip döndürülür (yoksa boş)
  const ad = cevap.fullName
    ? [cevap.fullName.givenName, cevap.fullName.familyName].filter(Boolean).join(" ")
    : "";

  return { kimlik, yetkiKodu: cevap.authorizationCode || null, adSoyad: adSoyadTemizle(ad) };
};
