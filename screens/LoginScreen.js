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
} from "firebase/auth";
// 🎨 Renk dosyamızı çağırıyoruz
import { colors } from "../theme";

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

  // Dinamik tasarımları temanın renklerine göre burada oluşturuyoruz
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
      <TouchableOpacity
        style={{ padding: 10 }}
        onPress={() => setGosterilenSayfa("kayit")}
      >
        <Text style={dinamikStil.altYazi}>Hesabın yok mu? Yeni Hesap Aç</Text>
      </TouchableOpacity>
    </View>
  );
}
