import React, { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  StyleSheet,
  useColorScheme,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";

import { auth, db, storage } from "../firebaseConfig";
import { collection, addDoc } from "firebase/firestore";
import { colors } from "../theme";

export default function HomeScreen() {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [image, setImage] = useState(null);

  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  // 📷 Kamerayı Açma ve Çekim Kalitesini Ayarlama
  const kamerayiAc = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("İzin Gerekli", "Kamera izni vermelisin.");
        return;
      }

      const kaliteAyari = Platform.OS === "ios" ? 0.2 : 0.5;

      const result = await ImagePicker.launchCameraAsync({
        quality: kaliteAyari,
        base64: false,
        allowsEditing: true,
        aspect: [3, 4],
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Kamera hatası:", error);
    }
  };

  // ❌ Çekilen Fotoğrafı İptal Etme
  const fotografiIptalEt = () => setImage(null);

  // 🌐 Kendi İnternet Kontrol Fonksiyonumuz (Native paket gerektirmez)
  const internetVarMi = async () => {
    try {
      // Google'a görünmez bir sinyal atıyoruz, 3 saniye içinde cevap gelmezse "Timeout" hatası verdiriyoruz
      await Promise.race([
        fetch("https://www.google.com", { method: "HEAD" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 3000)
        ),
      ]);
      return true; // Sinyal gittiyse internet var
    } catch (error) {
      return false; // Hata verdiyse veya 3 saniyede gitmediyse internet yok
    }
  };

  // 🚀 Fotoğrafı Güvenli Şekilde Gönderme
  const fotografiGonder = async () => {
    if (!image) return;

    try {
      // 🛡️ İlk iş olarak interneti kontrol ediyoruz
      setYukleniyor(true); // Önce butonu "Kontrol ediliyor..." gibi göstermek için döndürüyoruz
      const baglanti = await internetVarMi();

      if (!baglanti) {
        setYukleniyor(false);
        Alert.alert(
          "Bağlantı Hatası",
          "Lütfen internet bağlantınızı kontrol edip tekrar deneyin."
        );
        return; // İnternet yoksa işlemi anında iptal et
      }

      const dosyaYolu = `kullanicilar/${
        auth.currentUser.uid
      }/sorular/${Date.now()}.jpg`;
      const encodedYol = encodeURIComponent(dosyaYolu);
      const bucket =
        storage.app.options.storageBucket ||
        "project-21-3e377.firebasestorage.app";

      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodedYol}`;

      const token = await auth.currentUser.getIdToken();

      const uploadResult = await FileSystem.uploadAsync(url, image, {
        httpMethod: "POST",
        headers: {
          "Content-Type": "image/jpeg",
          Authorization: `Bearer ${token}`,
        },
      });

      if (uploadResult.status !== 200) {
        throw new Error(
          `Yükleme başarısız! Sunucu kodu: ${uploadResult.status}`
        );
      }

      const data = JSON.parse(uploadResult.body);

      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedYol}?alt=media&token=${data.downloadTokens}`;

      await addDoc(collection(db, "sorular"), {
        kullaniciEposta: auth.currentUser.email,
        fotoLink: downloadURL,
        tarih: new Date().toISOString(),
        durum: "Bekliyor",
      });

      Alert.alert("Başarılı", "Soru fotoğrafı başarıyla gönderildi!");
      fotografiIptalEt();
    } catch (error) {
      console.log("HATA DETAY:", error);
      Alert.alert("Yükleme Hatası", "Yükleme sırasında bir hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: tema.arkaplan }]}>
      <View style={styles.header}>
        <Text style={[styles.baslik, { color: tema.metin }]}>
          Soru Tarayıcı
        </Text>
        <Text style={[styles.altYazi, { color: tema.ikincilMetin }]}>
          Çözemediğin sorunun fotoğrafını çek, yapay zeka özel hocan anında
          anlatsın.
        </Text>
      </View>

      <View
        style={[
          styles.onizlemeKutusu,
          {
            backgroundColor: tema.kutuArkaplan,
            borderColor: tema.anaButon,
            borderStyle: image ? "solid" : "dashed",
          },
        ]}
      >
        {image ? (
          <Image source={{ uri: image }} style={styles.foto} />
        ) : (
          <View style={styles.bosDurum}>
            <Ionicons
              name="camera-outline"
              size={60}
              color={tema.ikincilMetin}
              style={styles.ikon}
            />
            <Text style={[styles.bosDurumYazi, { color: tema.ikincilMetin }]}>
              Kamerayı açmak için aşağıdaki butona dokun
            </Text>
          </View>
        )}
      </View>

      <View style={styles.butonAlani}>
        {!image ? (
          <TouchableOpacity
            onPress={kamerayiAc}
            style={[styles.tekliButon, { backgroundColor: tema.anaButon }]}
          >
            <Text style={styles.butonYazi}>Kamerayı Aç</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.ikiliButonKutusu}>
            <TouchableOpacity
              onPress={fotografiIptalEt}
              disabled={yukleniyor}
              style={[
                styles.ikiliButon,
                {
                  backgroundColor: tema.hataKirmizi,
                  marginRight: 10,
                  opacity: yukleniyor ? 0.5 : 1,
                },
              ]}
            >
              <Text style={styles.butonYazi}>İptal Et</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={fotografiGonder}
              disabled={yukleniyor}
              style={[
                styles.ikiliButon,
                {
                  backgroundColor: yukleniyor
                    ? tema.ikincilMetin
                    : tema.anaButon,
                },
              ]}
            >
              {yukleniyor ? (
                <View style={styles.yukleniyorSatir}>
                  <ActivityIndicator color="#fff" style={{ marginRight: 5 }} />
                  <Text style={styles.butonYazi}>İletiliyor...</Text>
                </View>
              ) : (
                <Text style={styles.butonYazi}>Gönder</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginTop: 20, marginBottom: 30, alignItems: "center" },
  baslik: { fontSize: 28, fontWeight: "bold", marginBottom: 10 },
  altYazi: {
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 10,
    lineHeight: 22,
  },
  onizlemeKutusu: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 30,
  },
  bosDurum: { alignItems: "center", padding: 20 },
  ikon: { marginBottom: 15, opacity: 0.8 },
  bosDurumYazi: { fontSize: 16, textAlign: "center", fontWeight: "500" },
  foto: { width: "100%", height: "100%", resizeMode: "cover" },
  butonAlani: { paddingBottom: 20 },
  tekliButon: {
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: "center",
    elevation: 5,
  },
  ikiliButonKutusu: { flexDirection: "row", justifyContent: "space-between" },
  ikiliButon: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: "center",
    elevation: 5,
  },
  butonYazi: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  yukleniyorSatir: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
