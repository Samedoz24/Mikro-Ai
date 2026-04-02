import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  useColorScheme,
} from "react-native";
import { auth } from "../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import AsyncStorage from "@react-native-async-storage/async-storage"; // ➕ Hafıza paketi eklendi

// 🎨 Renk dosyamızı çağırıyoruz
import { colors } from "../theme";

// ⚙️ Sayfa yüklenmeden önce Google ayarlarını yapıyoruz
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

  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  // 💾 ➕ YENİ: Rolü telefonun hafızasına kaydeden fonksiyon
  const roluKaydet = async (rol) => {
    try {
      await AsyncStorage.setItem("kullaniciRolu", rol);
      setKullaniciRolu(rol);
    } catch (e) {
      console.log("Rol kaydetme hatası:", e);
    }
  };

  const handleKayitOl = async () => {
    await roluKaydet(seciliRol); // ➕ İşlemden önce rolü kaydet
    createUserWithEmailAndPassword(auth, email, password).catch((e) =>
      Alert.alert("Hata", e.message)
    );
  };

  const handleGirisYap = async () => {
    await roluKaydet(seciliRol); // ➕ İşlemden önce rolü kaydet
    signInWithEmailAndPassword(auth, email, password).catch((e) =>
      Alert.alert("Hata", "Yanlış bilgi.")
    );
  };

  const handleGoogleGiris = async () => {
    try {
      await roluKaydet(seciliRol); // ➕ İşlemden önce rolü kaydet
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();
      const googleBileti = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, googleBileti);
    } catch (error) {
      console.log("GOOGLE GİRİŞ HATASI DETAYI:", error);
      Alert.alert("Google Giriş Hatası", String(error.message));
    }
  };

  const dinamikStil = {
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      backgroundColor: tema.arkaplan,
    },
    baslik: {
      fontSize: 28,
      fontWeight: "bold",
      marginBottom: 20,
      color: tema.metin,
    },
    input: {
      width: "100%",
      height: 50,
      backgroundColor: tema.kutuArkaplan,
      borderWidth: 1,
      borderColor: tema.kutuCerceve,
      borderRadius: 8,
      paddingHorizontal: 15,
      marginBottom: 15,
      color: tema.metin,
    },
    butonGiris: {
      width: "100%",
      height: 50,
      backgroundColor: tema.anaButon,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      marginBottom: 15,
    },
    butonKayit: {
      width: "100%",
      height: 50,
      backgroundColor: tema.aiButon,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      marginBottom: 15,
    },
    butonYazisi: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
    altYazi: { color: tema.ikincilMetin, fontSize: 14, fontWeight: "600" },
    tabContainer: {
      flexDirection: "row",
      width: "100%",
      marginBottom: 20,
      backgroundColor: tema.kutuArkaplan,
      borderRadius: 8,
      padding: 4,
      borderWidth: 1,
      borderColor: tema.kutuCerceve,
    },
    tabButon: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 6,
    },
    tabYazi: { fontSize: 16, fontWeight: "bold" },
  };

  const RolSecici = () => (
    <View style={dinamikStil.tabContainer}>
      <TouchableOpacity
        style={[
          dinamikStil.tabButon,
          {
            backgroundColor:
              seciliRol === "ogrenci" ? tema.anaButon : "transparent",
          },
        ]}
        onPress={() => setSeciliRol("ogrenci")}
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
              seciliRol === "veli" ? tema.anaButon : "transparent",
          },
        ]}
        onPress={() => setSeciliRol("veli")}
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
    <View style={dinamikStil.container}>
      <Text style={dinamikStil.baslik}>
        {gosterilenSayfa === "giris" ? "Mikro Özel Hoca" : "Yeni Hesap Aç"}
      </Text>

      {/* 🎓 ROL SEÇİCİ EKLENDİ */}
      <RolSecici />

      <TextInput
        style={dinamikStil.input}
        placeholderTextColor={tema.ikincilMetin}
        placeholder="E-posta Adresiniz"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={dinamikStil.input}
        placeholderTextColor={tema.ikincilMetin}
        placeholder="Şifreniz"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
      />

      <TouchableOpacity
        style={
          gosterilenSayfa === "giris"
            ? dinamikStil.butonGiris
            : dinamikStil.butonKayit
        }
        onPress={gosterilenSayfa === "giris" ? handleGirisYap : handleKayitOl}
      >
        <Text style={dinamikStil.butonYazisi}>
          {gosterilenSayfa === "giris" ? "Giriş Yap" : "Kayıt Ol ve Başla"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          dinamikStil.butonGiris,
          { backgroundColor: "#DB4437", marginTop: 10 },
        ]}
        onPress={handleGoogleGiris}
      >
        <Text style={dinamikStil.butonYazisi}>
          {gosterilenSayfa === "giris"
            ? "Google ile Giriş Yap"
            : "Google ile Kayıt Ol"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ padding: 10 }}
        onPress={() =>
          setGosterilenSayfa(gosterilenSayfa === "giris" ? "kayit" : "giris")
        }
      >
        <Text style={dinamikStil.altYazi}>
          {gosterilenSayfa === "giris"
            ? "Hesabın yok mu? Yeni Hesap Aç"
            : "Zaten hesabın var mı? Giriş Yap"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
