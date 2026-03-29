import React, { useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

// 📚 Firebase Bağlantıları
import { auth, db, storage } from "../firebaseConfig";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// 🎨 Tema Dosyamız
import { colors } from "../theme";

export default function HomeScreen() {
  const [izin, izinIste] = useCameraPermissions();
  const [fotograf, setFotograf] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const kameraRef = useRef(null);

  // 🌓 Tema Ayarları
  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  // 📸 Fotoğraf Çekme Fonksiyonu
  const fotografCek = async () => {
    if (kameraRef.current) {
      const options = { quality: 0.5, base64: true };
      const data = await kameraRef.current.takePictureAsync(options);
      setFotograf(data.uri);
    }
  };

  // 🤖 Hocaya Sor (Buluta Yükleme ve Kaydetme)
  const askTeacher = async () => {
    if (!fotograf) return;
    setYukleniyor(true);

    try {
      // 1. ADIM: Fotoğrafı dijital veriye (Blob) çevir
      const response = await fetch(fotograf);
      const blob = await response.blob();

      // 2. ADIM: Storage için benzersiz bir dosya adı oluştur
      const dosyaAdi = `kullanicilar/${
        auth.currentUser.uid
      }/sorular/${Date.now()}.jpg`;
      const depoRef = ref(storage, dosyaAdi);

      // 3. ADIM: Fotoğrafı Firebase Storage'a yükle
      await uploadBytes(depoRef, blob);

      // 4. ADIM: Yüklenen fotoğrafın internet linkini (URL) al
      const downloadURL = await getDownloadURL(depoRef);

      // 5. ADIM: Bu linki Firestore veritabanına kaydet
      await addDoc(collection(db, "sorular"), {
        kullaniciEposta: auth.currentUser.email,
        tarih: new Date().toISOString(),
        durum: "Çözüm Bekleniyor ⏳",
        fotoLink: downloadURL, // Artık gerçek internet adresi!
      });

      Alert.alert("Başarılı", "Soru ve Fotoğraf Hocaya Ulaştı! ✅");
      setFotograf(null);
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Sistem Hatası",
        "Yükleme sırasında bir sorun oluştu: " + error.message
      );
    } finally {
      setYukleniyor(false);
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
      fontSize: 24,
      fontWeight: "bold",
      marginBottom: 20,
      color: tema.metin,
    },
    kameraKutusu: {
      width: "100%",
      height: 400,
      borderRadius: 15,
      marginBottom: 20,
      backgroundColor: "#000",
      overflow: "hidden",
    },
    kamera: { flex: 1, width: "100%" },
    butonKamera: {
      width: "100%",
      height: 60,
      backgroundColor: tema.kameraButon,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 30,
    },
    butonAi: {
      width: "100%",
      height: 60,
      backgroundColor: "#6C5CE7",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 30,
    },
    butonYazisi: { color: "#2D3436", fontSize: 16, fontWeight: "bold" },
    butonAiYazisi: { color: "#ffffff", fontSize: 16, fontWeight: "bold" },
    butonIptal: { marginTop: 15, padding: 10 },
    butonIptalYazisi: {
      color: tema.ikincilMetin,
      fontSize: 14,
      fontWeight: "600",
    },
  };

  if (!izin?.granted) {
    return (
      <View style={dinamikStil.container}>
        <Text style={dinamikStil.baslik}>Kamera İzni Gerekli</Text>
        <TouchableOpacity style={dinamikStil.butonAi} onPress={izinIste}>
          <Text style={dinamikStil.butonAiYazisi}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (fotograf) {
    return (
      <View style={dinamikStil.container}>
        <Text style={dinamikStil.baslik}>Soru Hazır! ✅</Text>
        <Image source={{ uri: fotograf }} style={dinamikStil.kameraKutusu} />
        {yukleniyor ? (
          <View style={{ alignItems: "center" }}>
            <ActivityIndicator size="large" color="#6C5CE7" />
            <Text style={{ marginTop: 10, color: tema.metin }}>
              Buluta Yükleniyor...
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity style={dinamikStil.butonAi} onPress={askTeacher}>
              <Text style={dinamikStil.butonAiYazisi}>Hocaya Sor 🤖</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dinamikStil.butonIptal}
              onPress={() => setFotograf(null)}
            >
              <Text style={dinamikStil.butonIptalYazisi}>
                Vazgeç / Yeniden Çek
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={dinamikStil.container}>
      <Text style={dinamikStil.baslik}>Sorunu Çek, Çözelim! 📸</Text>
      <View style={dinamikStil.kameraKutusu}>
        <CameraView style={dinamikStil.kamera} facing="back" ref={kameraRef} />
      </View>
      <TouchableOpacity style={dinamikStil.butonKamera} onPress={fotografCek}>
        <Text style={dinamikStil.butonYazisi}>Fotoğraf Çek</Text>
      </TouchableOpacity>
    </View>
  );
}
