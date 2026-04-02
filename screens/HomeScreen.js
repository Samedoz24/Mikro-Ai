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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

// Firebase
import { auth, db, storage } from "../firebaseConfig";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { colors } from "../theme";

export default function HomeScreen() {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [image, setImage] = useState(null); // Sadece resmin yolunu (URI) tutacağız

  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  // 🧩 Hatasız Blob'a Çevirme Fonksiyonu (ArrayBuffer yerine bu kullanılır)
  const resmiBlobaCevir = async (uri) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        console.log("Blob çevirme hatası:", e);
        reject(new TypeError("Ağ isteği başarısız oldu."));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });
  };

  const kamerayiAc = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("İzin Gerekli", "Kamera izni vermelisin.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
        // base64: true özelliğini kaldırdık, artık hafızayı yormayacak
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Kamera hatası:", error);
    }
  };

  const fotografiIptalEt = () => {
    setImage(null);
  };

  const fotografiGonder = async () => {
    if (!image) return;

    try {
      setYukleniyor(true);

      // 1. Resmi sorunsuz bir şekilde Blob formatına çeviriyoruz
      const blobFoto = await resmiBlobaCevir(image);

      // 2. Firebase deposunda (Storage) kaydedilecek yeri belirliyoruz
      const dosyaAdi = `kullanicilar/${
        auth.currentUser.uid
      }/sorular/${Date.now()}.jpg`;
      const storageRef = ref(storage, dosyaAdi);

      // 3. Blob verisini doğrudan Firebase'e yüklüyoruz
      await uploadBytes(storageRef, blobFoto);

      // 4. Yüklenen resmin internet adresini alıyoruz
      const downloadURL = await getDownloadURL(storageRef);

      // 5. Veritabanına (Firestore) soruyu kaydediyoruz
      await addDoc(collection(db, "sorular"), {
        kullaniciEposta: auth.currentUser.email,
        fotoLink: downloadURL,
        tarih: new Date().toISOString(),
        durum: "Bekliyor",
      });

      Alert.alert("Başarılı", "Fotoğraf gönderildi.");
      fotografiIptalEt(); // Başarılı olunca ekrandaki resmi temizle
    } catch (error) {
      console.log("HATA DETAYI:", error);
      Alert.alert("Yükleme Hatası", "Bir sorun oluştu: " + error.message);
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  ikiliButonKutusu: { flexDirection: "row", justifyContent: "space-between" },
  ikiliButon: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 15,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  butonYazi: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  yukleniyorSatir: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
