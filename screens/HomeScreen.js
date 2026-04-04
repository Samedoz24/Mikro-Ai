import React, { useState, useEffect } from "react";
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
  Modal,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";

// 🎉 Konfeti Animasyonu Kütüphanesi
import ConfettiCannon from "react-native-confetti-cannon";

import { auth, db, storage } from "../firebaseConfig";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../theme";

const screenWidth = Dimensions.get("window").width;

export default function HomeScreen() {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [image, setImage] = useState(null);

  // 🚀 SERİ MODAL STATE
  const [seriModalGorunur, setSeriModalGorunur] = useState(false);
  const [guncelSeriSayisi, setGuncelSeriSayisi] = useState(0);

  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;
  const user = auth.currentUser;

  useEffect(() => {
    const seriKontrol = async () => {
      if (!user) return;

      try {
        const bugun = new Date();
        bugun.setHours(0, 0, 0, 0);

        const kullaniciRef = doc(db, "kullanicilar", user.uid);
        const kullaniciSnap = await getDoc(kullaniciRef);

        if (kullaniciSnap.exists()) {
          const data = kullaniciSnap.data();
          let mevcutSeri = data.seriGunu || 0;
          let sonGiris = data.sonGirisTarihi
            ? new Date(data.sonGirisTarihi)
            : null;

          let guncellenecekVeri = {};

          if (!sonGiris) {
            guncellenecekVeri = {
              seriGunu: 1,
              sonGirisTarihi: bugun.toISOString(),
            };
            setGuncelSeriSayisi(1);
            setSeriModalGorunur(true);
          } else {
            const farkMilisaniye = bugun.getTime() - sonGiris.getTime();
            const farkGun = Math.floor(farkMilisaniye / (1000 * 3600 * 24));

            if (farkGun === 1) {
              const yeniSeri = mevcutSeri + 1;
              guncellenecekVeri = {
                seriGunu: yeniSeri,
                sonGirisTarihi: bugun.toISOString(),
              };
              setGuncelSeriSayisi(yeniSeri);
              setSeriModalGorunur(true);
            } else if (farkGun > 1) {
              guncellenecekVeri = {
                seriGunu: 1,
                sonGirisTarihi: bugun.toISOString(),
              };
              setGuncelSeriSayisi(1);
              setSeriModalGorunur(true);
            } else {
              setGuncelSeriSayisi(mevcutSeri);
            }
          }

          if (Object.keys(guncellenecekVeri).length > 0) {
            await updateDoc(kullaniciRef, guncellenecekVeri);
            await AsyncStorage.setItem(
              "seriGunu",
              String(guncellenecekVeri.seriGunu)
            );
          } else {
            await AsyncStorage.setItem("seriGunu", String(mevcutSeri));
          }
        }
      } catch (error) {
        console.log("Seri kontrol hatası:", error);
      }
    };

    seriKontrol();
  }, [user]);

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

  const fotografiIptalEt = () => setImage(null);

  const internetVarMi = async () => {
    try {
      await Promise.race([
        fetch("https://www.google.com", { method: "HEAD" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 3000)
        ),
      ]);
      return true;
    } catch (error) {
      return false;
    }
  };

  const fotografiGonder = async () => {
    if (!image) return;
    try {
      setYukleniyor(true);
      const baglanti = await internetVarMi();
      if (!baglanti) {
        setYukleniyor(false);
        Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
        return;
      }

      // 🚀 ÇÖZÜM 1: Fotoğrafı göndermeden önce veritabanındaki güncel kotayı soruyoruz
      const kullaniciRef = doc(db, "kullanicilar", auth.currentUser.uid);
      const kullaniciSnap = await getDoc(kullaniciRef);

      let mevcutKota = 3; // Eğer bir hata olursa varsayılan 3 veriyoruz
      if (kullaniciSnap.exists()) {
        const data = kullaniciSnap.data();
        if (data.kalanSoru !== undefined) {
          mevcutKota = data.kalanSoru;
        }
      }

      // 🛑 Eğer kota bittiyse işlemi durdur ve uyarı ver
      if (mevcutKota <= 0) {
        setYukleniyor(false);
        Alert.alert(
          "Günlük Kotan Doldu! ⏳",
          "Bugünkü 3 ücretsiz soru sorma hakkını bitirdin. Lütfen yarın tekrar gel veya haklarını yenilemek için profilini kontrol et."
        );
        return; // Buradan aşağısına inmez, işlemi keser
      }

      // Kota varsa yükleme işlemine devam ediyoruz
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

      if (uploadResult.status !== 200) throw new Error("Yükleme başarısız!");

      const data = JSON.parse(uploadResult.body);
      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedYol}?alt=media&token=${data.downloadTokens}`;

      await addDoc(collection(db, "sorular"), {
        kullaniciEposta: auth.currentUser.email,
        fotoLink: downloadURL,
        tarih: new Date().toISOString(),
        durum: "Bekliyor",
      });

      // 🚀 ÇÖZÜM 2: Fotoğraf başarıyla gittiyse kotayı -1 eksiltiyoruz
      await updateDoc(kullaniciRef, {
        kalanSoru: mevcutKota - 1,
      });

      Alert.alert("Başarılı", "Soru gönderildi! Kotandan 1 hak düştü.");
      fotografiIptalEt();
    } catch (error) {
      Alert.alert("Hata", "Yükleme sırasında bir hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: tema.arkaplan }]}>
      <Modal visible={seriModalGorunur} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {seriModalGorunur && (
            <ConfettiCannon
              count={200}
              origin={{ x: screenWidth / 2, y: -20 }}
              autoStart={true}
              fadeOut={true}
              fallSpeed={2500}
            />
          )}

          <View
            style={[styles.modalKutu, { backgroundColor: tema.kutuArkaplan }]}
          >
            <View style={styles.ikonCember}>
              <Ionicons name="flame" size={50} color="#FF9800" />
            </View>
            <Text style={[styles.modalBaslik, { color: tema.metin }]}>
              {guncelSeriSayisi} GÜNLÜK SERİ!
            </Text>
            <Text style={[styles.modalMesaj, { color: tema.ikincilMetin }]}>
              Harika gidiyorsun! Bugün de buradasın ve serini korudun. Hadi bir
              soru çözerek günü taçlandır!
            </Text>
            <TouchableOpacity
              onPress={() => setSeriModalGorunur(false)}
              style={[styles.modalButon, { backgroundColor: tema.anaButon }]}
            >
              <Text style={styles.modalButonYazi}>Devam Et</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              Kamerayı açmak için butona dokun
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
                <ActivityIndicator color="#fff" />
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

  // Modal Stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  modalKutu: {
    padding: 35,
    borderRadius: 30,
    alignItems: "center",
    width: "100%",
    elevation: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  ikonCember: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255, 152, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalBaslik: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  modalMesaj: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 30,
    paddingHorizontal: 10,
  },
  modalButon: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 100,
    width: "100%",
    alignItems: "center",
    elevation: 3,
  },
  modalButonYazi: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 17,
    letterSpacing: 0.5,
  },
});
