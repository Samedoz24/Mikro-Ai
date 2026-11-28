import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { auth } from "../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  sendPasswordResetEmail,
} from "firebase/auth";

import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import {
  appleKullanilabilirMi,
  appleKimligiAl,
  APPLE_IPTAL,
} from "../utils/appleGiris";
import AsyncStorage from "@react-native-async-storage/async-storage";

import LottieView from "lottie-react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme";
import { useTheme } from "../ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import {
  girisHatasiMesaji,
  kayitHatasiMesaji,
  sifreSifirlamaHatasiMesaji,
  googleGirisHatasiMesaji,
  appleGirisHatasiMesaji,
  SIFRE_EN_AZ,
} from "../utils/authHatalari";
import {
  SINIF_SECENEKLERI,
  BEKLEYEN_PROFIL_ANAHTARI,
  kayitFormuDogrula,
  bekleyenProfilMetni,
} from "../utils/profilKurallari";
import SinifSecici from "./SinifSecici";
import RolSecici, { rolEtiketi } from "./RolSecici";
import KosullarPenceresi from "./KosullarPenceresi";
import { onayOnMetni, kosullarBasligi, ONAY_SON_METNI } from "../utils/onayMetni";

// 🚀 DÜZELTME: useIsFocused tamamen silindi! (Hatanın kaynağı burasıydı)

GoogleSignin.configure({
  webClientId:
    "758732204910-2juevkcahro9998k6u9tllfqo49sot1a.apps.googleusercontent.com",
  iosClientId:
    "758732204910-s6sdn4eamn1ged2ugvvus93tsok9tfmc.apps.googleusercontent.com",
});

// Google'ın resmi çok renkli "G" logosu; uygulamaya gömülü (dış bir sunucudan indirilmez)
const GoogleLogo = ({ size = 22 }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
  >
    <Path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <Path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <Path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <Path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
    />
  </Svg>
);

export default function LoginScreen({ setKullaniciRolu, girisReddi }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gosterilenSayfa, setGosterilenSayfa] = useState("giris");
  // Kayıt formu (28 Kasım): giriş ekranında rol sekmesi yok; rolü sistem profilden bulur.
  // Kayıtta: ad soyad, sınıf (yalnızca öğrenci), e-posta, rol (Öğrenci/Veli), şifre. Yönetici seçeneği yok.
  const [adSoyad, setAdSoyad] = useState("");
  const [sinif, setSinif] = useState(null);
  // Hesap türü boş başlar: kullanıcı Öğrenci/Veli'yi bilinçli seçmeden kayıt olamaz
  const [kayitRol, setKayitRol] = useState(null);
  const [sinifSeciciGorunur, setSinifSeciciGorunur] = useState(false);
  const [rolSeciciGorunur, setRolSeciciGorunur] = useState(false);
  // Kullanım koşulları / yaş onayı (kayıtta zorunlu). Onay cümlesi hesap türüne göre değişir; tür değişirse onay
  // sıfırlanır (kişi, gördüğü cümleye onay vermiş olmalı). onayZamani profil oluşturulurken kaydedilir.
  const [onayZamani, setOnayZamani] = useState(null);
  const [kosullarGorunur, setKosullarGorunur] = useState(false);
  const hesapTuruSec = (yeniRol) => {
    if (yeniRol !== kayitRol) setOnayZamani(null);
    setKayitRol(yeniRol);
  };

  const [yukleniyor, setYukleniyor] = useState(false);
  const [googleYukleniyor, setGoogleYukleniyor] = useState(false);
  const [appleYukleniyor, setAppleYukleniyor] = useState(false);
  const [appleVar, setAppleVar] = useState(false);
  const [sifreGoster, setSifreGoster] = useState(false);
  const sifreRef = useRef(null);

  // Kullanıcının uygulamadaki tema tercihi (Açık/Koyu/Sistem) giriş ekranında da geçerli olur
  const { tema } = useTheme();

  // Giriş başarılı olsa bile rol uyuşmazlığı yüzünden reddedildiyse form kilitli kalmasın
  useEffect(() => {
    setYukleniyor(false);
    setGoogleYukleniyor(false);
    setAppleYukleniyor(false);
  }, [girisReddi]);

  useEffect(() => {
    let etkin = true;
    appleKullanilabilirMi().then((var_) => etkin && setAppleVar(var_));
    return () => {
      etkin = false;
    };
  }, []);

  const isGercektenKaranlik = tema.arkaplan === colors.dark.arkaplan;

  const dinamikAnaRenk = tema.anaButon;

  const handleKayitOl = async () => {
    // Firebase'in şifre politikası en az 8 karakteri sunucuda da zorunlu tutar (uygulama atlanamaz); buradaki
    // kontroller kullanıcıya hemen geri bildirim içindir. Rol/sınıf/ad kuralları ayrıca firestore.rules'ta.
    const sonuc = kayitFormuDogrula({ adSoyad, sinif, rol: kayitRol, eposta: email, sifre: password, onay: !!onayZamani });
    if (sonuc.hata) {
      Alert.alert("Eksik Bilgi", sonuc.hata);
      return;
    }
    setYukleniyor(true);
    try {
      // Profil, hesap açıldıktan hemen sonra (App.js) bu bilgilerle oluşturulur: yalnızca aynı e-posta ve kısa süre
      // içinde geçerlidir; şifre saklanmaz.
      await AsyncStorage.setItem(
        BEKLEYEN_PROFIL_ANAHTARI,
        bekleyenProfilMetni(sonuc.profil, sonuc.eposta, Date.now(), onayZamani)
      );
      await createUserWithEmailAndPassword(auth, sonuc.eposta, password);
    } catch (e) {
      console.log("Kayıt hatası:", e?.code);
      await AsyncStorage.removeItem(BEKLEYEN_PROFIL_ANAHTARI);
      Alert.alert("Kayıt Yapılamadı", kayitHatasiMesaji(e));
      setYukleniyor(false);
    }
  };

  const handleGirisYap = async () => {
    const eposta = email.trim();
    if (!eposta || !password) {
      Alert.alert("Uyarı", "Lütfen e-posta ve şifre alanlarını doldurun.");
      return;
    }
    setYukleniyor(true);
    try {
      // Önceki yarım kalmış bir kaydın formu bu girişe uygulanmasın
      await AsyncStorage.removeItem(BEKLEYEN_PROFIL_ANAHTARI);
      await signInWithEmailAndPassword(auth, eposta, password);
    } catch (e) {
      console.log("Giriş hatası:", e?.code);
      Alert.alert("Giriş Yapılamadı", girisHatasiMesaji(e));
      setYukleniyor(false);
    }
  };

  const handleSifremiUnuttum = async () => {
    const eposta = email.trim();
    if (!eposta) {
      Alert.alert(
        "E-posta Gerekli",
        "Şifre sıfırlama bağlantısını gönderebilmemiz için önce e-posta adresini yaz."
      );
      return;
    }
    setYukleniyor(true);
    try {
      await sendPasswordResetEmail(auth, eposta);
    } catch (e) {
      // Hesabın var olup olmadığı açığa çıkmasın diye "kullanıcı yok" da başarı gibi gösterilir
      if (e?.code !== "auth/user-not-found") {
        console.log("Şifre sıfırlama hatası:", e?.code);
        Alert.alert("Gönderilemedi", sifreSifirlamaHatasiMesaji(e));
        setYukleniyor(false);
        return;
      }
    }
    setYukleniyor(false);
    Alert.alert(
      "Bağlantı Gönderildi",
      "Bu e-posta ile kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi. Gelen kutunu ve spam klasörünü kontrol et."
    );
  };

  const handleGoogleGiris = async () => {
    setGoogleYukleniyor(true);
    try {
      // Google ile ilk girişte profil "Profilini Tamamla" ekranında oluşturulur (form bilgisi kullanılmaz)
      await AsyncStorage.removeItem(BEKLEYEN_PROFIL_ANAHTARI);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      // v16: kullanıcı pencereyi kapatırsa hata fırlatılmaz, type: "cancelled" döner
      if (!isSuccessResponse(response)) {
        setGoogleYukleniyor(false);
        return;
      }

      const idToken =
        response.data.idToken || (await GoogleSignin.getTokens()).idToken;
      if (!idToken) throw new Error("Google kimlik belirteci alınamadı.");

      const googleBileti = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, googleBileti);
    } catch (error) {
      setGoogleYukleniyor(false);
      if (
        isErrorWithCode(error) &&
        (error.code === statusCodes.SIGN_IN_CANCELLED ||
          error.code === statusCodes.IN_PROGRESS)
      ) {
        return;
      }
      console.log("GOOGLE GİRİŞ HATASI DETAYI:", error?.code, error?.message);
      Alert.alert(
        "Google Giriş Hatası",
        isErrorWithCode(error) &&
          error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
          ? "Google Play Hizmetleri bulunamadı ya da güncel değil."
          : googleGirisHatasiMesaji(error)
      );
    }
  };

  const handleAppleGiris = async () => {
    setAppleYukleniyor(true);
    try {
      await AsyncStorage.removeItem(BEKLEYEN_PROFIL_ANAHTARI);
      const { kimlik, adSoyad: appleAdi } = await appleKimligiAl();
      // Apple adı yalnızca ilk girişte verir: "Profilini Tamamla" ekranında ad alanını doldurmak için saklanır
      if (appleAdi) await AsyncStorage.setItem("bekleyenAdSoyad", appleAdi);
      else await AsyncStorage.removeItem("bekleyenAdSoyad");
      await signInWithCredential(auth, kimlik);
    } catch (error) {
      setAppleYukleniyor(false);
      if (error?.code === APPLE_IPTAL) return;
      console.log("APPLE GİRİŞ HATASI:", error?.code);
      Alert.alert("Apple Giriş Hatası", appleGirisHatasiMesaji(error));
    }
  };

  // Apple düğmesi: koyu modda beyaz zemin + siyah logo/yazı, açık modda siyah zemin + beyaz logo/yazı
  const appleArkaplan = isGercektenKaranlik ? "#FFFFFF" : "#000000";
  const appleYazi = isGercektenKaranlik ? "#000000" : "#FFFFFF";

  const islemSuruyor = yukleniyor || googleYukleniyor || appleYukleniyor;

  const anaIslem = gosterilenSayfa === "giris" ? handleGirisYap : handleKayitOl;

  const karsilamaMetni = gosterilenSayfa === "giris" ? "Hoş Geldin" : "Hesap Oluştur";

  const altMetin =
    gosterilenSayfa === "giris"
      ? "Sormix hesabınla giriş yap. Öğrenci, veli ya da dershane yöneticisi olman fark etmez; doğru ekran otomatik açılır."
      : "Bilgilerini girerek hesabını oluştur.";

  const dinamikStil = {
    container: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    animasyonKutu: {
      width: 180,
      height: 180,
      marginBottom: 10,
    },
    baslik: {
      fontSize: 28,
      fontWeight: "900",
      marginBottom: 8,
      color: tema.metin,
      textAlign: "center",
      letterSpacing: 0.5,
    },
    altBaslik: {
      fontSize: 15,
      color: tema.ikincilMetin,
      textAlign: "center",
      marginBottom: 30,
      lineHeight: 22,
    },
    inputKutu: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      height: 60,
      backgroundColor: tema.kutuArkaplan,
      borderWidth: 1.5,
      borderColor: tema.kutuCerceve,
      borderRadius: 16,
      paddingHorizontal: 18,
      marginBottom: 16,
    },
    inputIkon: {
      marginRight: 12,
    },
    input: {
      flex: 1,
      color: tema.metin,
      fontSize: 16,
    },
    butonAna: {
      width: "100%",
      height: 60,
      backgroundColor: dinamikAnaRenk,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 16,
      marginBottom: 15,
      shadowColor: dinamikAnaRenk,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 6,
      marginTop: 10,
    },
    butonGoogle: {
      flexDirection: "row",
      width: "100%",
      height: 60,
      backgroundColor: tema.kutuArkaplan,
      borderWidth: 1.5,
      borderColor: tema.kutuCerceve,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 16,
      marginBottom: 15,
    },
    butonAnaYazisi: {
      color: "#ffffff",
      fontSize: 17,
      fontWeight: "bold",
      letterSpacing: 0.5,
    },
    butonGoogleYazisi: {
      color: tema.metin,
      fontSize: 16,
      fontWeight: "bold",
    },
    googleLogo: {
      width: 22,
      height: 22,
      marginRight: 12,
    },
    sifreGosterButon: {
      width: 40,
      height: 40,
      marginRight: -10,
      alignItems: "center",
      justifyContent: "center",
    },
    sifremiUnuttum: {
      alignSelf: "flex-end",
      marginTop: -6,
      marginBottom: 6,
      paddingVertical: 8,
    },
    sifremiUnuttumYazi: {
      color: dinamikAnaRenk,
      fontSize: 14,
      fontWeight: "600",
    },
    cizgiKutu: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      marginBottom: 15,
    },
    cizgi: {
      flex: 1,
      height: 1,
      backgroundColor: tema.kutuCerceve,
    },
    cizgiYazi: {
      marginHorizontal: 12,
      color: tema.ikincilMetin,
      fontSize: 14,
      fontWeight: "500",
    },
    onayKutusu: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      width: "100%",
      borderWidth: 1.5,
      borderRadius: 16,
      padding: 14,
      marginBottom: 6,
    },
    onayMetni: { flex: 1, fontSize: 14, lineHeight: 21 },
    bilgiSatiri: {
      width: "100%",
      textAlign: "center",
      color: tema.ikincilMetin,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 4,
    },
    hesapGecisKarti: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 25,
      paddingVertical: 16,
      paddingHorizontal: 25,
      backgroundColor: "transparent",
      borderRadius: 100,
      borderWidth: 1,
      borderColor: tema.kutuCerceve,
    },
    hesapGecisSoru: {
      color: tema.ikincilMetin,
      fontSize: 15,
      fontWeight: "500",
    },
    hesapGecisAksiyon: {
      color: dinamikAnaRenk,
      fontSize: 15,
      fontWeight: "bold",
      marginLeft: 6,
    },
  };

  const kayitMi = gosterilenSayfa === "kayit";
  // Kayıt Ol düğmesi: bütün alanlar geçerli ve onay kutusu işaretli değilse soluk ve basılamaz. Koşul, kayıttaki
  // doğrulamayla AYNI fonksiyondur (düğme aktifken kayıt reddedilmez, soluk görünürken kayıt yapılamaz).
  const kayitHazir =
    !kayitMi ||
    !kayitFormuDogrula({ adSoyad, sinif, rol: kayitRol, eposta: email, sifre: password, onay: !!onayZamani }).hata;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.arkaplan }}>
      <StatusBar
        barStyle={isGercektenKaranlik ? "light-content" : "dark-content"}
        backgroundColor={tema.arkaplan}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={dinamikStil.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={dinamikStil.animasyonKutu}>
            <LottieView
              source={require("../assets/animations/kamera.json")}
              autoPlay
              loop
              style={{ width: "100%", height: "100%" }}
            />
          </View>

          <Text style={dinamikStil.baslik}>{karsilamaMetni}</Text>
          <Text style={dinamikStil.altBaslik}>{altMetin}</Text>

          {kayitMi && (
            <View style={dinamikStil.inputKutu}>
              <Ionicons
                name="person-outline"
                size={22}
                color={tema.ikincilMetin}
                style={dinamikStil.inputIkon}
              />
              <TextInput
                style={dinamikStil.input}
                placeholderTextColor={tema.ikincilMetin}
                placeholder="Ad Soyad"
                value={adSoyad}
                onChangeText={setAdSoyad}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                maxLength={40}
                returnKeyType="next"
                editable={!islemSuruyor}
              />
            </View>
          )}

          {kayitMi && kayitRol !== "veli" && (
            <TouchableOpacity
              style={dinamikStil.inputKutu}
              onPress={() => setSinifSeciciGorunur(true)}
              disabled={islemSuruyor}
              accessibilityRole="button"
              accessibilityLabel={sinif ? `Sınıf: ${sinif}` : "Sınıfını seç"}
            >
              <Ionicons
                name="school-outline"
                size={22}
                color={tema.ikincilMetin}
                style={dinamikStil.inputIkon}
              />
              <Text style={[dinamikStil.input, { color: sinif ? tema.metin : tema.ikincilMetin }]}>
                {sinif || "Sınıfınız"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={tema.ikincilMetin} />
            </TouchableOpacity>
          )}

          <View style={dinamikStil.inputKutu}>
            <Ionicons
              name="mail-outline"
              size={22}
              color={tema.ikincilMetin}
              style={dinamikStil.inputIkon}
            />
            <TextInput
              style={dinamikStil.input}
              placeholderTextColor={tema.ikincilMetin}
              placeholder="E-posta adresiniz"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => sifreRef.current?.focus()}
              editable={!(yukleniyor || googleYukleniyor)}
            />
          </View>

          {kayitMi && (
            <TouchableOpacity
              style={dinamikStil.inputKutu}
              onPress={() => setRolSeciciGorunur(true)}
              disabled={islemSuruyor}
              accessibilityRole="button"
              accessibilityLabel={
                kayitRol ? `Hesap türü: ${rolEtiketi(kayitRol)}. Değiştirmek için dokun.` : "Hesap türünü seç"
              }
            >
              <Ionicons
                name={kayitRol === "ogrenci" ? "school-outline" : "people-outline"}
                size={22}
                color={tema.ikincilMetin}
                style={dinamikStil.inputIkon}
              />
              <Text style={[dinamikStil.input, { color: kayitRol ? tema.metin : tema.ikincilMetin }]}>
                {kayitRol ? `Hesap türü: ${rolEtiketi(kayitRol)}` : "Hesap türünüz"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={tema.ikincilMetin} />
            </TouchableOpacity>
          )}

          <View style={dinamikStil.inputKutu}>
            <Ionicons
              name="lock-closed-outline"
              size={22}
              color={tema.ikincilMetin}
              style={dinamikStil.inputIkon}
            />
            <TextInput
              ref={sifreRef}
              style={dinamikStil.input}
              placeholderTextColor={tema.ikincilMetin}
              placeholder={
                gosterilenSayfa === "giris"
                  ? "Şifreniz"
                  : `Şifre (en az ${SIFRE_EN_AZ} karakter)`
              }
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!sifreGoster}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={
                gosterilenSayfa === "giris" ? "current-password" : "new-password"
              }
              textContentType={
                gosterilenSayfa === "giris" ? "password" : "newPassword"
              }
              returnKeyType="go"
              onSubmitEditing={() => kayitHazir && anaIslem()}
              editable={!(yukleniyor || googleYukleniyor)}
            />
            <TouchableOpacity
              onPress={() => setSifreGoster((g) => !g)}
              style={dinamikStil.sifreGosterButon}
              accessibilityRole="button"
              accessibilityLabel={sifreGoster ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              <Ionicons
                name={sifreGoster ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={tema.ikincilMetin}
              />
            </TouchableOpacity>
          </View>

          {kayitMi && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setOnayZamani((z) => (z ? null : Date.now()))}
              disabled={islemSuruyor}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!onayZamani }}
              style={[
                dinamikStil.onayKutusu,
                {
                  borderColor: onayZamani ? dinamikAnaRenk : tema.kutuCerceve,
                  backgroundColor: onayZamani ? dinamikAnaRenk + "12" : "transparent",
                },
              ]}
            >
              <Ionicons
                name={onayZamani ? "checkbox" : "square-outline"}
                size={26}
                color={onayZamani ? dinamikAnaRenk : tema.ikincilMetin}
              />
              <Text style={[dinamikStil.onayMetni, { color: tema.metin }]}>
                {onayOnMetni(kayitRol)}
                <Text
                  onPress={() => setKosullarGorunur(true)}
                  style={{ color: dinamikAnaRenk, fontWeight: "700", textDecorationLine: "underline" }}
                  accessibilityRole="link"
                >
                  {kosullarBasligi(kayitRol)}
                </Text>
                {ONAY_SON_METNI}
              </Text>
            </TouchableOpacity>
          )}

          {gosterilenSayfa === "giris" && (
            <TouchableOpacity
              onPress={handleSifremiUnuttum}
              disabled={islemSuruyor}
              style={dinamikStil.sifremiUnuttum}
              accessibilityRole="button"
            >
              <Text style={dinamikStil.sifremiUnuttumYazi}>Şifremi unuttum</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              dinamikStil.butonAna,
              yukleniyor && { opacity: 0.7 },
              !kayitHazir && { opacity: 0.45, shadowOpacity: 0, elevation: 0 },
            ]}
            onPress={anaIslem}
            disabled={islemSuruyor || !kayitHazir}
            accessibilityRole="button"
            accessibilityState={{ disabled: islemSuruyor || !kayitHazir }}
            accessibilityHint={
              kayitHazir ? undefined : "Bütün alanları doldurup Kullanım Koşulları onay kutusunu işaretlemelisin."
            }
          >
            {yukleniyor ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={dinamikStil.butonAnaYazisi}>
                {gosterilenSayfa === "giris" ? "Giriş Yap" : "Kayıt Ol"}
              </Text>
            )}
          </TouchableOpacity>

          <View style={dinamikStil.cizgiKutu}>
            <View style={dinamikStil.cizgi} />
            <Text style={dinamikStil.cizgiYazi}>veya</Text>
            <View style={dinamikStil.cizgi} />
          </View>

          <TouchableOpacity
            style={[
              dinamikStil.butonGoogle,
              googleYukleniyor && { opacity: 0.7 },
            ]}
            onPress={handleGoogleGiris}
            disabled={islemSuruyor}
          >
            {googleYukleniyor ? (
              <ActivityIndicator color={tema.metin} size="small" />
            ) : (
              <>
                <View style={dinamikStil.googleLogo}>
                  <GoogleLogo size={22} />
                </View>
                <Text style={dinamikStil.butonGoogleYazisi}>
                  {gosterilenSayfa === "giris"
                    ? "Google ile Giriş Yap"
                    : "Google ile Kayıt Ol"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {appleVar && (
            <TouchableOpacity
              style={[
                dinamikStil.butonGoogle,
                {
                  backgroundColor: appleArkaplan,
                  borderColor: appleArkaplan,
                },
                appleYukleniyor && { opacity: 0.7 },
              ]}
              onPress={handleAppleGiris}
              disabled={islemSuruyor}
              accessibilityRole="button"
              accessibilityLabel={
                gosterilenSayfa === "giris"
                  ? "Apple ile Giriş Yap"
                  : "Apple ile Kayıt Ol"
              }
            >
              {appleYukleniyor ? (
                <ActivityIndicator color={appleYazi} size="small" />
              ) : (
                <>
                  <Ionicons
                    name="logo-apple"
                    size={28}
                    color={appleYazi}
                    style={[
                      dinamikStil.googleLogo,
                      // Apple simgesinin çevresinde boşluk olduğu için 28 punto, Google "G" (22) ile görsel olarak eşit durur
                      { width: 28, height: 28, marginRight: 9, textAlign: "center" },
                    ]}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                  <Text
                    style={[dinamikStil.butonGoogleYazisi, { color: appleYazi }]}
                  >
                    {gosterilenSayfa === "giris"
                      ? "Apple ile Giriş Yap"
                      : "Apple ile Kayıt Ol"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {!kayitMi && (
            <Text style={dinamikStil.bilgiSatiri}>
              Sormix'i kullanarak{" "}
              <Text
                onPress={() => setKosullarGorunur(true)}
                style={{ color: dinamikAnaRenk, fontWeight: "700", textDecorationLine: "underline" }}
                accessibilityRole="link"
              >
                Kullanım Koşulları
              </Text>
              'na uymayı kabul edersin.
            </Text>
          )}

          <TouchableOpacity
            style={dinamikStil.hesapGecisKarti}
            activeOpacity={0.6}
            onPress={() =>
              setGosterilenSayfa(
                gosterilenSayfa === "giris" ? "kayit" : "giris"
              )
            }
            disabled={islemSuruyor}
          >
            <Text style={dinamikStil.hesapGecisSoru}>
              {gosterilenSayfa === "giris"
                ? "Hesabınız yok mu?"
                : "Zaten bir hesabınız var mı?"}
            </Text>
            <Text style={dinamikStil.hesapGecisAksiyon}>
              {gosterilenSayfa === "giris" ? "Yeni Hesap Aç" : "Giriş Yap"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <KosullarPenceresi gorunur={kosullarGorunur} kapat={() => setKosullarGorunur(false)} rol={kayitRol} />
      <RolSecici
        gorunur={rolSeciciGorunur}
        kapat={() => setRolSeciciGorunur(false)}
        seciliRol={kayitRol}
        sec={hesapTuruSec}
      />
      <SinifSecici
        gorunur={sinifSeciciGorunur}
        kapat={() => setSinifSeciciGorunur(false)}
        siniflar={SINIF_SECENEKLERI}
        seciliSinif={sinif}
        sec={(secilen) => {
          setSinif(secilen);
          return true;
        }}
      />
    </SafeAreaView>
  );
}

