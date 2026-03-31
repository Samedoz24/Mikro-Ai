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

// 🎨 Renk dosyamızı çağırıyoruz
import { colors } from "../theme";

// ⚙️ Sayfa yüklenmeden önce Google ayarlarını yapıyoruz (Kopyaladığın ID'yi buraya yapıştır)
GoogleSignin.configure({
  webClientId:
    "758732204910-2juevkcahro9998k6u9tllfqo49sot1a.apps.googleusercontent.com",
  iosClientId:
    "758732204910-1nqkd7vk72ch45urq8prkb3gk6rc3fsm.apps.googleusercontent.com",
});

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gosterilenSayfa, setGosterilenSayfa] = useState("giris");

  // 🌓 Telefonun açık mı koyu mu olduğunu anlayan araç
  const sistemTemasi = useColorScheme();
  // Eğer sistemTemasi 'dark' ise dark renkleri, değilse light renkleri seç
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  const handleKayitOl = () =>
    createUserWithEmailAndPassword(auth, email, password).catch((e) =>
      Alert.alert("Hata", e.message)
    );

  const handleGirisYap = () =>
    signInWithEmailAndPassword(auth, email, password).catch((e) =>
      Alert.alert("Hata", "Yanlış bilgi.")
    );

  // 🚀 Google ile giriş yapma veya kayıt olma işlemlerini yürüten fonksiyon
  const handleGoogleGiris = async () => {
    try {
      // 1. Google servislerinin çalışıp çalışmadığını kontrol eder
      await GoogleSignin.hasPlayServices();
      // 2. Google giriş penceresini açar
      const userInfo = await GoogleSignin.signIn();
      // 3. Google'dan onay kimliğini (token) alır
      const { idToken } = await GoogleSignin.getTokens();
      // 4. Bu onay kimliğini Firebase'in anlayacağı bir bilete çevirir
      const googleBileti = GoogleAuthProvider.credential(idToken);
      // 5. Bu bilet ile Firebase'e giriş yapar
      await signInWithCredential(auth, googleBileti);
    } catch (error) {
      // Hatayı bilgisayarın terminaline detaylıca yazdırır
      console.log("GOOGLE GİRİŞ HATASI DETAYI:", error);
      // Ekrana da gerçek hata mesajını yansıtır
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
  };

  // 📄 Kayıt Ol Sayfası Görünümü
  if (gosterilenSayfa === "kayit") {
    return (
      <View style={dinamikStil.container}>
        <Text style={dinamikStil.baslik}>Yeni Hesap Aç</Text>
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
          style={dinamikStil.butonKayit}
          onPress={handleKayitOl}
        >
          <Text style={dinamikStil.butonYazisi}>Kayıt Ol ve Başla</Text>
        </TouchableOpacity>

        {/* ➕ Kayıt ol sayfasına da Google butonunu ekledik */}
        <TouchableOpacity
          style={[
            dinamikStil.butonGiris,
            { backgroundColor: "#DB4437", marginTop: 10 },
          ]}
          onPress={handleGoogleGiris}
        >
          <Text style={dinamikStil.butonYazisi}>Google ile Kayıt Ol</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ padding: 10 }}
          onPress={() => setGosterilenSayfa("giris")}
        >
          <Text style={dinamikStil.altYazi}>
            Zaten hesabın var mı? Giriş Yap
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 📄 Giriş Yap Sayfası Görünümü
  return (
    <View style={dinamikStil.container}>
      <Text style={dinamikStil.baslik}>Mikro Özel Hoca</Text>
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
      <TouchableOpacity style={dinamikStil.butonGiris} onPress={handleGirisYap}>
        <Text style={dinamikStil.butonYazisi}>Giriş Yap</Text>
      </TouchableOpacity>

      {/* ➕ Giriş yap sayfasına Google butonunu ekledik */}
      <TouchableOpacity
        style={[
          dinamikStil.butonGiris,
          { backgroundColor: "#DB4437", marginTop: 10 },
        ]}
        onPress={handleGoogleGiris}
      >
        <Text style={dinamikStil.butonYazisi}>Google ile Giriş Yap</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ padding: 10 }}
        onPress={() => setGosterilenSayfa("kayit")}
      >
        <Text style={dinamikStil.altYazi}>Hesabın yok mu? Yeni Hesap Aç</Text>
      </TouchableOpacity>
    </View>
  );
}
