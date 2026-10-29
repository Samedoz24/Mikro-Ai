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
} from "../utils/authHatalari";

// 🚀 DÜZELTME: useIsFocused tamamen silindi! (Hatanın kaynağı burasıydı)

GoogleSignin.configure({
  webClientId:
    "758732204910-2juevkcahro9998k6u9tllfqo49sot1a.apps.googleusercontent.com",
  iosClientId:
    "758732204910-1nqkd7vk72ch45urq8prkb3gk6rc3fsm.apps.googleusercontent.com",
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
  const [seciliRol, setSeciliRol] = useState("ogrenci");

  const [yukleniyor, setYukleniyor] = useState(false);
  const [googleYukleniyor, setGoogleYukleniyor] = useState(false);
  const [sifreGoster, setSifreGoster] = useState(false);
  const sifreRef = useRef(null);

  // Kullanıcının uygulamadaki tema tercihi (Açık/Koyu/Sistem) giriş ekranında da geçerli olur
  const { tema } = useTheme();

  // Giriş başarılı olsa bile rol uyuşmazlığı yüzünden reddedildiyse form kilitli kalmasın
  useEffect(() => {
    setYukleniyor(false);
    setGoogleYukleniyor(false);
  }, [girisReddi]);

  const isGercektenKaranlik = tema.arkaplan === colors.dark.arkaplan;

  const dinamikAnaRenk =
    seciliRol === "veli"
      ? "#4F46E5"
      : seciliRol === "yonetici"
      ? "#0F766E"
      : tema.anaButon;

  const handleKayitOl = async () => {
    const eposta = email.trim();
    if (!eposta || !password) {
      Alert.alert("Uyarı", "Lütfen e-posta ve şifre alanlarını doldurun.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Uyarı", "Şifre en az 6 karakter olmalı.");
      return;
    }
    setYukleniyor(true);
    try {
      await AsyncStorage.setItem("hedefRol", seciliRol);
      await createUserWithEmailAndPassword(auth, eposta, password);
    } catch (e) {
      console.log("Kayıt hatası:", e?.code);
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
      await AsyncStorage.setItem("hedefRol", seciliRol);
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
      await AsyncStorage.setItem("hedefRol", seciliRol);
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

  const anaIslem = gosterilenSayfa === "giris" ? handleGirisYap : handleKayitOl;

  const karsilamaMetni =
    seciliRol === "ogrenci"
      ? gosterilenSayfa === "giris"
        ? "Hoş Geldin"
        : "Hesap Oluştur"
      : seciliRol === "yonetici"
      ? gosterilenSayfa === "giris"
        ? "Yönetici Girişi"
        : "Yönetici Hesabı Oluştur"
      : gosterilenSayfa === "giris"
      ? "Veli Girişi"
      : "Veli Hesabı Oluştur";

  const altMetin =
    seciliRol === "ogrenci"
      ? gosterilenSayfa === "giris"
        ? "Yapay zeka destekli eğitim asistanınıza erişmek için giriş yapın."
        : "Kişiselleştirilmiş öğrenim deneyimine adım atmak için hesabınızı oluşturun."
      : seciliRol === "yonetici"
      ? "Yalnızca dershane tarafından davet edilen müdür ve öğretmenler içindir. Davet edilen e-posta adresinle giriş yap."
      : gosterilenSayfa === "giris"
      ? "Öğrencinizin akademik gelişimini detaylı analiz etmek için giriş yapın."
      : "Öğrencinizin eğitim sürecini yakından takip etmek için veli hesabı oluşturun.";

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
    tabContainer: {
      flexDirection: "row",
      width: "100%",
      marginBottom: 30,
      backgroundColor: tema.kutuArkaplan,
      borderRadius: 16,
      padding: 6,
      borderWidth: 1,
      borderColor: tema.kutuCerceve,
    },
    tabButon: {
      flex: 1,
      paddingVertical: 14,
      alignItems: "center",
      borderRadius: 12,
    },
    tabYazi: { fontSize: 15, fontWeight: "bold" },
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

  const rolSecici = () => (
    <View style={dinamikStil.tabContainer}>
      <TouchableOpacity
        style={[
          dinamikStil.tabButon,
          {
            backgroundColor:
              seciliRol === "ogrenci" ? dinamikAnaRenk : "transparent",
          },
        ]}
        onPress={() => setSeciliRol("ogrenci")}
        disabled={yukleniyor || googleYukleniyor}
      >
        <Text
          style={[
            dinamikStil.tabYazi,
            { color: seciliRol === "ogrenci" ? "#fff" : tema.ikincilMetin },
          ]}
        >
          Öğrenci
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          dinamikStil.tabButon,
          {
            backgroundColor:
              seciliRol === "veli" ? dinamikAnaRenk : "transparent",
          },
        ]}
        onPress={() => setSeciliRol("veli")}
        disabled={yukleniyor || googleYukleniyor}
      >
        <Text
          style={[
            dinamikStil.tabYazi,
            { color: seciliRol === "veli" ? "#fff" : tema.ikincilMetin },
          ]}
        >
          Veli
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          dinamikStil.tabButon,
          {
            backgroundColor:
              seciliRol === "yonetici" ? dinamikAnaRenk : "transparent",
          },
        ]}
        onPress={() => setSeciliRol("yonetici")}
        disabled={yukleniyor || googleYukleniyor}
      >
        <Text
          style={[
            dinamikStil.tabYazi,
            { color: seciliRol === "yonetici" ? "#fff" : tema.ikincilMetin },
          ]}
        >
          Yönetici
        </Text>
      </TouchableOpacity>
    </View>
  );

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
              source={
                seciliRol === "ogrenci"
                  ? require("../assets/animations/kamera.json")
                  : require("../assets/animations/veli.json")
              }
              autoPlay
              loop
              style={{ width: "100%", height: "100%" }}
            />
          </View>

          <Text style={dinamikStil.baslik}>{karsilamaMetni}</Text>
          <Text style={dinamikStil.altBaslik}>{altMetin}</Text>

          {rolSecici()}

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
              placeholder="E-posta Adresiniz"
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
              placeholder="Şifreniz"
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
              onSubmitEditing={anaIslem}
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

          {gosterilenSayfa === "giris" && (
            <TouchableOpacity
              onPress={handleSifremiUnuttum}
              disabled={yukleniyor || googleYukleniyor}
              style={dinamikStil.sifremiUnuttum}
              accessibilityRole="button"
            >
              <Text style={dinamikStil.sifremiUnuttumYazi}>Şifremi unuttum</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[dinamikStil.butonAna, yukleniyor && { opacity: 0.7 }]}
            onPress={anaIslem}
            disabled={yukleniyor || googleYukleniyor}
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
            disabled={yukleniyor || googleYukleniyor}
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

          <TouchableOpacity
            style={dinamikStil.hesapGecisKarti}
            activeOpacity={0.6}
            onPress={() =>
              setGosterilenSayfa(
                gosterilenSayfa === "giris" ? "kayit" : "giris"
              )
            }
            disabled={yukleniyor || googleYukleniyor}
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
    </SafeAreaView>
  );
}
