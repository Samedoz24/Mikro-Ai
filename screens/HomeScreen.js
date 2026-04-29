import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  StyleSheet,
  Platform,
  Modal,
  Dimensions,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";

// 🎉 Konfeti Animasyonu Kütüphanesi
import ConfettiCannon from "react-native-confetti-cannon";

import { auth, db, storage } from "../firebaseConfig";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🌗 Tema Sistemi
import { useTheme } from "../ThemeContext";

const screenWidth = Dimensions.get("window").width;

export default function HomeScreen() {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [image, setImage] = useState(null);

  // 🚀 SERİ MODAL STATE
  const [seriModalGorunur, setSeriModalGorunur] = useState(false);
  const [guncelSeriSayisi, setGuncelSeriSayisi] = useState(0);

  // 💎 PREMIUM MODAL STATE
  const [premiumModalGorunur, setPremiumModalGorunur] = useState(false);
  const [seciliPaket, setSeciliPaket] = useState("yillik"); // Varsayılan paket

  const { tema, temaModu } = useTheme();
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

      const kullaniciRef = doc(db, "kullanicilar", auth.currentUser.uid);
      const kullaniciSnap = await getDoc(kullaniciRef);

      let mevcutKota = 3;
      if (kullaniciSnap.exists()) {
        const data = kullaniciSnap.data();
        if (data.kalanSoru !== undefined) {
          mevcutKota = data.kalanSoru;
        }
      }

      // 💎 ÇÖZÜM: Kotası bitenleri doğrudan Premium Sayfasına yönlendiriyoruz
      if (mevcutKota <= 0) {
        setYukleniyor(false);
        setPremiumModalGorunur(true); // Premium Modal'ı tetikler
        return;
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
        console.log("🔥 Firebase Sunucu Red Sebebi (Body):", uploadResult.body);
        throw new Error(
          `Yükleme başarısız! Sunucu Kodu: ${uploadResult.status}`
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

      await updateDoc(kullaniciRef, {
        kalanSoru: mevcutKota - 1,
      });

      Alert.alert("Başarılı", "Soru gönderildi! Kotandan 1 hak düştü.");
      fotografiIptalEt();
    } catch (error) {
      console.log("📸 Fotoğraf Gönderme Hatası Detayı:", error);
      Alert.alert("Hata", "Yükleme sırasında bir hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  const premiumSatinAl = () => {
    // İleride buraya RevenueCat veya Apple/Google Pay kodları eklenecek
    Alert.alert("Hazırlanıyor", "Ödeme altyapısı çok yakında aktif olacak!");
  };

  return (
    <View style={[styles.container, { backgroundColor: tema.arkaplan }]}>
      {/* 🚀 SERİ MODALI */}
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

      {/* 💎 YENİ: PREMIUM MODALI */}
      <Modal visible={premiumModalGorunur} transparent animationType="slide">
        {/* Arka plan tıklamasıyla kapatma (activeOpacity=1 tıklama efektini engeller) */}
        <TouchableOpacity
          style={styles.premiumOverlay}
          activeOpacity={1}
          onPress={() => setPremiumModalGorunur(false)}
        >
          {/* İç kutu tıklamasını dışarı taşırmamak için boş bir Touchable */}
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.premiumKutu,
              { backgroundColor: temaModu === "dark" ? "#1E293B" : "#fff" },
            ]}
          >
            {/* Kapat (X) Butonu */}
            <TouchableOpacity
              style={styles.kapatIkon}
              onPress={() => setPremiumModalGorunur(false)}
            >
              <Ionicons name="close" size={28} color={tema.ikincilMetin} />
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                alignItems: "center",
                paddingBottom: 20,
              }}
            >
              <View style={styles.premiumIkonCember}>
                <Ionicons name="star" size={40} color="#FFD700" />
              </View>

              <Text style={[styles.premiumAnaBaslik, { color: tema.metin }]}>
                Premium'a Geç
              </Text>
              <Text style={styles.premiumAltYazi}>
                Bugünkü ücretsiz hakların bitti. Sınırları kaldır ve tüm
                özelliklere anında eriş!
              </Text>

              {/* Avantajlar Listesi */}
              <View style={styles.avantajKutusu}>
                <View style={styles.avantajSatiri}>
                  <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                  <Text style={[styles.avantajYazi, { color: tema.metin }]}>
                    Sınırsız Soru Çözümü
                  </Text>
                </View>
                <View style={styles.avantajSatiri}>
                  <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                  <Text style={[styles.avantajYazi, { color: tema.metin }]}>
                    Anında Detaylı Açıklamalar
                  </Text>
                </View>
                <View style={styles.avantajSatiri}>
                  <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                  <Text style={[styles.avantajYazi, { color: tema.metin }]}>
                    Hata Defterini PDF İndirme
                  </Text>
                </View>
                <View style={styles.avantajSatiri}>
                  <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                  <Text style={[styles.avantajYazi, { color: tema.metin }]}>
                    VIP Öncelikli Sunucu Hızı
                  </Text>
                </View>
              </View>

              {/* Abonelik Paketleri */}
              <View style={styles.paketlerKapsayici}>
                {/* Aylık Paket */}
                <TouchableOpacity
                  onPress={() => setSeciliPaket("aylik")}
                  style={[
                    styles.paketKutu,
                    {
                      borderColor:
                        seciliPaket === "aylik" ? "#FFD700" : tema.kutuCerceve,
                      backgroundColor:
                        seciliPaket === "aylik"
                          ? temaModu === "dark"
                            ? "#332a00"
                            : "#FFFBEB"
                          : tema.arkaplan,
                    },
                  ]}
                >
                  <Text style={[styles.paketIsmi, { color: tema.metin }]}>
                    1 Aylık
                  </Text>
                  <Text style={[styles.paketFiyat, { color: tema.metin }]}>
                    500 ₺
                  </Text>
                </TouchableOpacity>

                {/* 3 Aylık Paket */}
                <TouchableOpacity
                  onPress={() => setSeciliPaket("uc_aylik")}
                  style={[
                    styles.paketKutu,
                    {
                      borderColor:
                        seciliPaket === "uc_aylik"
                          ? "#FFD700"
                          : tema.kutuCerceve,
                      backgroundColor:
                        seciliPaket === "uc_aylik"
                          ? temaModu === "dark"
                            ? "#332a00"
                            : "#FFFBEB"
                          : tema.arkaplan,
                    },
                  ]}
                >
                  <View style={styles.indirimEtiketi}>
                    <Text style={styles.indirimYazisi}>%16 İndirim</Text>
                  </View>
                  <Text style={[styles.paketIsmi, { color: tema.metin }]}>
                    3 Aylık
                  </Text>
                  <Text style={[styles.paketFiyat, { color: tema.metin }]}>
                    1250 ₺
                  </Text>
                  <Text style={styles.eskiFiyat}>1500 ₺</Text>
                </TouchableOpacity>

                {/* Yıllık Paket (Popüler) */}
                <TouchableOpacity
                  onPress={() => setSeciliPaket("yillik")}
                  style={[
                    styles.paketKutu,
                    {
                      borderColor:
                        seciliPaket === "yillik" ? "#FFD700" : tema.kutuCerceve,
                      backgroundColor:
                        seciliPaket === "yillik"
                          ? temaModu === "dark"
                            ? "#332a00"
                            : "#FFFBEB"
                          : tema.arkaplan,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.indirimEtiketi,
                      { backgroundColor: "#FFD700" },
                    ]}
                  >
                    <Text style={[styles.indirimYazisi, { color: "#000" }]}>
                      En Popüler
                    </Text>
                  </View>
                  <Text style={[styles.paketIsmi, { color: tema.metin }]}>
                    12 Aylık
                  </Text>
                  <Text style={[styles.paketFiyat, { color: tema.metin }]}>
                    1500 ₺
                  </Text>
                  <Text style={styles.eskiFiyat}>1600 ₺</Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: tema.ikincilMetin,
                      marginTop: 2,
                    }}
                  >
                    %6 İndirim
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Satın Alma Butonu */}
              <TouchableOpacity
                onPress={premiumSatinAl}
                style={styles.satinAlButon}
              >
                <Text style={styles.satinAlYazi}>Devam Et</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ANA EKRAN İÇERİĞİ */}
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

  // Seri Modal Stilleri
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
  },

  // 💎 PREMIUM MODAL STİLLERİ
  premiumOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)", // Daha koyu ve dramatik arkaplan
    justifyContent: "flex-end", // Aşağıdan çıksın
  },
  premiumKutu: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: "90%",
  },
  kapatIkon: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
    padding: 5,
  },
  premiumIkonCember: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  premiumAnaBaslik: {
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  premiumAltYazi: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  avantajKutusu: {
    width: "100%",
    marginBottom: 25,
  },
  avantajSatiri: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avantajYazi: {
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 10,
  },
  paketlerKapsayici: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 25,
  },
  paketKutu: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    marginHorizontal: 4,
    position: "relative",
  },
  paketIsmi: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 5,
  },
  paketFiyat: {
    fontSize: 18,
    fontWeight: "900",
  },
  eskiFiyat: {
    fontSize: 12,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    marginTop: 4,
  },
  indirimEtiketi: {
    position: "absolute",
    top: -12,
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  indirimYazisi: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  satinAlButon: {
    backgroundColor: "#FFD700",
    width: "100%",
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  satinAlYazi: {
    color: "#000",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
