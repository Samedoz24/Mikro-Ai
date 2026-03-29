import React from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useColorScheme,
  Alert,
} from "react-native";
import { auth } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { colors } from "../theme";

export default function ProfileScreen() {
  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  const handleCikisYap = () => {
    signOut(auth).catch((e) => Alert.alert("Hata", e.message));
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
      fontSize: 24,
      fontWeight: "bold",
      marginBottom: 20,
      color: tema.metin,
    },
    bilgiKutusu: {
      width: "100%",
      padding: 20,
      backgroundColor: tema.kutuArkaplan,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: tema.kutuCerceve,
      marginBottom: 20,
    },
    bilgiYazisi: { fontSize: 16, color: tema.metin, marginBottom: 5 },
    butonCikis: {
      width: "100%",
      height: 50,
      backgroundColor: tema.hataKirmizi,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
    },
    butonYazisi: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
  };

  return (
    <View style={dinamikStil.container}>
      <Text style={dinamikStil.baslik}>Öğrenci Profili</Text>

      <View style={dinamikStil.bilgiKutusu}>
        <Text style={dinamikStil.bilgiYazisi}>
          Hesap: {auth.currentUser?.email}
        </Text>
        <Text style={dinamikStil.bilgiYazisi}>
          Veli E-postası: Henüz eklenmedi
        </Text>
      </View>

      <TouchableOpacity style={dinamikStil.butonCikis} onPress={handleCikisYap}>
        <Text style={dinamikStil.butonYazisi}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}
