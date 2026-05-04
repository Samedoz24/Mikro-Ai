import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";

import { auth } from "../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";

import { GoogleSignin } from "@react-native-google-signin/google-signin";
import AsyncStorage from "@react-native-async-storage/async-storage";

import LottieView from "lottie-react-native";
import { colors } from "../theme";
import { Ionicons } from "@expo/vector-icons";

GoogleSignin.configure({
  webClientId:
    "758732204910-2juevkcahro9998k6u9tllfqo49sot1a.apps.googleusercontent.com",
  iosClientId:
    "758732204910-1nqkd7vk72ch45urq8prkb3gk6rc3fsm.apps.googleusercontent.com",
});

export default function LoginScreen({ setKullaniciRolu }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gosterilenSayfa, setGosterilenSayfa] = useState("giris");
  const [seciliRol, setSeciliRol] = useState("ogrenci");

  const [yukleniyor, setYukleniyor] = useState(false);
  const [googleYukleniyor, setGoogleYukleniyor] = useState(false);

  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  const dinamikAnaRenk = seciliRol === "veli" ? "#4F46E5" : tema.anaButon;

  const handleKayitOl = async () => {
    if (!email || !password) {
      Alert.alert("Uyarı", "Lütfen e-posta ve şifre alanlarını doldurun.");
      return;
    }
    setYukleniyor(true);
    try {
      await AsyncStorage.setItem("hedefRol", seciliRol);
      await createUserWithEmailAndPassword(auth, email, password);
      // 🚀 Başarılıysa animasyonu durdurmuyoruz! Sayfa değişene kadar şıkça dönmeye devam edecek.
    } catch (e) {
      Alert.alert("Hata", e.message);
      setYukleniyor(false); // Sadece hata olursa kilidi açıp butonu eski haline getiriyoruz
    }
  };

  const handleGirisYap = async () => {
    if (!email || !password) {
      Alert.alert("Uyarı", "Lütfen e-posta ve şifre alanlarını doldurun.");
      return;
    }
    setYukleniyor(true);
    try {
      await AsyncStorage.setItem("hedefRol", seciliRol);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      Alert.alert("Hata", "Yanlış e-posta veya şifre girdiniz.");
      setYukleniyor(false);
    }
  };

  const handleGoogleGiris = async () => {
    setGoogleYukleniyor(true);
    try {
      await AsyncStorage.setItem("hedefRol", seciliRol);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();
      const googleBileti = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, googleBileti);
    } catch (error) {
      console.log("GOOGLE GİRİŞ HATASI DETAYI:", error);
      Alert.alert("Google Giriş Hatası", String(error.message));
      setGoogleYukleniyor(false);
    }
  };

  const karsilamaMetni =
    seciliRol === "ogrenci"
      ? gosterilenSayfa === "giris"
        ? "Hoş Geldin"
        : "Hesap Oluştur"
      : gosterilenSayfa === "giris"
      ? "Veli Girişi"
      : "Veli Hesabı Oluştur";

  const altMetin =
    seciliRol === "ogrenci"
      ? gosterilenSayfa === "giris"
        ? "Yapay zeka destekli eğitim asistanınıza erişmek için giriş yapın."
        : "Kişiselleştirilmiş öğrenim deneyimine adım atmak için hesabınızı oluşturun."
      : gosterilenSayfa === "giris"
      ? "Öğrencinizin akademik gelişimini detaylı analiz etmek için giriş yapın."
      : "Öğrencinizin eğitim sürecini yakından takip etmek için veli hesabı oluşturun.";

  const dinamikStil = {
    container: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 25,
      backgroundColor: tema.arkaplan,
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
    },
    altBaslik: {
      fontSize: 15,
      color: tema.ikincilMetin,
      textAlign: "center",
      marginBottom: 25,
      paddingHorizontal: 10,
    },
    inputKutu: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      height: 55,
      backgroundColor: tema.kutuArkaplan,
      borderWidth: 1.5,
      borderColor: tema.kutuCerceve,
      borderRadius: 12,
      paddingHorizontal: 15,
      marginBottom: 15,
    },
    inputIkon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      color: tema.metin,
      fontSize: 16,
    },
    butonAna: {
      width: "100%",
      height: 55,
      backgroundColor: dinamikAnaRenk,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 12,
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
      height: 55,
      backgroundColor: tema.kutuArkaplan,
      borderWidth: 1.5,
      borderColor: tema.kutuCerceve,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 12,
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
    tabContainer: {
      flexDirection: "row",
      width: "100%",
      marginBottom: 30,
      backgroundColor: tema.kutuArkaplan,
      borderRadius: 12,
      padding: 5,
      borderWidth: 1,
      borderColor: tema.kutuCerceve,
    },
    tabButon: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderRadius: 8,
    },
    tabYazi: { fontSize: 16, fontWeight: "bold" },
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
      marginHorizontal: 10,
      color: tema.ikincilMetin,
      fontSize: 14,
    },
    hesapGecisKarti: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: 25,
      paddingVertical: 14,
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

  const RolSecici = () => (
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
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: tema.arkaplan }}
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

        <RolSecici />

        <View style={dinamikStil.inputKutu}>
          <Ionicons
            name="mail-outline"
            size={20}
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
            editable={!(yukleniyor || googleYukleniyor)}
          />
        </View>

        <View style={dinamikStil.inputKutu}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color={tema.ikincilMetin}
            style={dinamikStil.inputIkon}
          />
          <TextInput
            style={dinamikStil.input}
            placeholderTextColor={tema.ikincilMetin}
            placeholder="Şifreniz"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
            editable={!(yukleniyor || googleYukleniyor)}
          />
        </View>

        <TouchableOpacity
          style={[dinamikStil.butonAna, yukleniyor && { opacity: 0.7 }]}
          onPress={gosterilenSayfa === "giris" ? handleGirisYap : handleKayitOl}
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
              <Image
                source={{
                  uri: "https://cdn-icons-png.flaticon.com/512/2991/2991148.png",
                }}
                style={dinamikStil.googleLogo}
              />
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
            setGosterilenSayfa(gosterilenSayfa === "giris" ? "kayit" : "giris")
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
  );
}
