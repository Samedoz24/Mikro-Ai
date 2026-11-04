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
  StatusBar,
  Linking,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
// 🚀 YENİ: Sayfa odağını anlamak için eklendi
import { useIsFocused } from "@react-navigation/native";

import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";

import * as Application from "expo-application";
import ConfettiCannon from "react-native-confetti-cannon";

import { auth, db, storage } from "../firebaseConfig";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../ThemeContext";
// 🚀 YENİ: Gerçek karanlık mod kontrolü için colors eklendi
import { colors } from "../theme";
import { usePremium } from "../PremiumContext";
import { kotaYenilenmeHatirlatmasiKur } from "../utils/notificationManager";
import { takvimGunFarki, yerelTarih } from "../utils/tarih";
import YapayZekaBilgi from "./YapayZekaBilgi";
import {
  SIK_SECENEKLERI,
  BILINMIYOR,
  secimGecerliMi,
  gonderilebilirMi,
  secimEtiketi,
} from "../utils/sikSecimi";
import { kotaDurumu, maksimumKota } from "../utils/kota";

const screenWidth = Dimensions.get("window").width;

export default function HomeScreen() {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [image, setImage] = useState(null);
  // Öğrencinin işaretlediği cevap (A-E ya da "Bilinmiyor"); seçilmeden Gönder açılmaz
  const [secim, setSecim] = useState(null);

  const [seriModalGorunur, setSeriModalGorunur] = useState(false);
  const [guncelSeriSayisi, setGuncelSeriSayisi] = useState(0);


  const { tema, temaModu } = useTheme();
  const { premiumAc } = usePremium();
  const user = auth.currentUser;

  // 🚀 YENİ: Sayfa odakta mı ve gerçekten karanlık mı kontrolleri
  const isFocused = useIsFocused();
  const isGercektenKaranlik = tema.arkaplan === colors.dark.arkaplan;

  useEffect(() => {
    const seriKontrol = async () => {
      if (!user) return;

      try {
        const bugunDate = new Date();
        bugunDate.setHours(0, 0, 0, 0);

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
              sonGirisTarihi: bugunDate.toISOString(),
            };
            setGuncelSeriSayisi(1);
            setSeriModalGorunur(true);
          } else {
            // Takvim günü farkı: yaz saati/saat dilimi değişimleri günü 23-25 saat yapabilir
            const farkGun = takvimGunFarki(sonGiris, bugunDate);

            if (farkGun === 1) {
              const yeniSeri = mevcutSeri + 1;
              guncellenecekVeri = {
                seriGunu: yeniSeri,
                sonGirisTarihi: bugunDate.toISOString(),
              };
              setGuncelSeriSayisi(yeniSeri);
              setSeriModalGorunur(true);
            } else if (farkGun > 1) {
              guncellenecekVeri = {
                seriGunu: 1,
                sonGirisTarihi: bugunDate.toISOString(),
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
        if (permission.canAskAgain === false) {
          // İzin kalıcı reddedilmiş: sistem artık sormaz, kullanıcıyı Ayarlar'a yönlendir
          Alert.alert(
            "Kamera İzni Gerekli",
            "Soru fotoğrafı çekebilmek için kamera iznine ihtiyacımız var. Ayarlar'dan izin verebilirsin.",
            [
              { text: "Vazgeç", style: "cancel" },
              { text: "Ayarlar'ı Aç", onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert("İzin Gerekli", "Kamera izni vermelisin.");
        }
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 4],
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
        setSecim(null);
      }
    } catch (error) {
      console.log("Kamera hatası:", error);
      Alert.alert(
        "Kamera Açılamadı",
        "Kamera şu an açılamıyor. Lütfen tekrar dene."
      );
    }
  };

  const fotografiIptalEt = () => {
    setImage(null);
    setSecim(null);
  };

  // Gerçekten ihtiyaç duyduğumuz sunucuya (Firebase Storage) ulaşılabiliyor mu?
  // Herhangi bir HTTP yanıtı "ulaşılabilir" demektir; üçüncü taraf bir siteye istek atılmaz.
  const internetVarMi = async () => {
    const kontrol = new AbortController();
    const zamanAsimi = setTimeout(() => kontrol.abort(), 5000);
    try {
      await fetch("https://firebasestorage.googleapis.com/", {
        method: "HEAD",
        signal: kontrol.signal,
      });
      return true;
    } catch (error) {
      return false;
    } finally {
      clearTimeout(zamanAsimi);
    }
  };

  const getDeviceId = async () => {
    if (Platform.OS === "android") {
      return Application.getAndroidId();
    } else {
      return await Application.getIosIdForVendorAsync();
    }
  };

  const fotografiGonder = async () => {
    if (!image) return;
    // Seçim yapılmadan gönderilemez (düğme de kapalıdır; bu, kapalı düğmeyi atlatan bir yolu önler)
    const gonderilenSecim = secim;
    if (!secimGecerliMi(gonderilenSecim)) {
      Alert.alert(
        "Cevabını İşaretle",
        "Göndermeden önce sorunun cevabını (A-E) ya da Bilinmiyor'u seçmelisin."
      );
      return;
    }
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
      const isPremium = kullaniciSnap.exists()
        ? kullaniciSnap.data().premiumMu === true
        : false;

      const maxKota = maksimumKota(isPremium);
      const cihazId = await getDeviceId();

      const bugunYerel = yerelTarih();

      const cihazRef = doc(db, "cihazHaklari", cihazId);
      const cihazSnap = await getDoc(cihazRef);

      const mevcutKota = kotaDurumu(
        cihazSnap.exists() ? cihazSnap.data() : null,
        bugunYerel,
        maxKota
      ).kalan;

      if (mevcutKota <= 0) {
        setYukleniyor(false);
        await kotaYenilenmeHatirlatmasiKur(isPremium);
        if (isPremium) {
          Alert.alert(
            "Günlük Limit Doldu",
            "Premium adil kullanım kotanızı (Günlük 50 Soru) doldurdunuz. Lütfen yarın tekrar deneyin."
          );
        } else {
          premiumAc("kota");
        }
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
        throw new Error(
          `Yükleme başarısız! Sunucu Kodu: ${uploadResult.status}`
        );
      }

      const data = JSON.parse(uploadResult.body);
      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedYol}?alt=media&token=${data.downloadTokens}`;

      await addDoc(collection(db, "sorular"), {
        kullaniciUid: auth.currentUser.uid,
        kullaniciEposta: auth.currentUser.email,
        fotoLink: downloadURL,
        tarih: new Date().toISOString(),
        durum: "Bekliyor",
        ogrenciSecimi: gonderilenSecim,
      });

      // Soru zaten gönderildi; kota güncellemesi başarısız olsa bile kullanıcıya "hata" gösterip
      // aynı soruyu tekrar göndermesine (çift kayıt) yol açmayız.
      try {
        await setDoc(
          cihazRef,
          {
            kalanSoru: mevcutKota - 1,
            tarih: bugunYerel,
            toplamHak: maxKota,
          },
          { merge: true }
        );
      } catch (kotaHatasi) {
        console.log("Kota güncellenemedi:", kotaHatasi?.code);
      }

      // Son hak kullanıldıysa ertesi sabah "hakların yenilendi" bildirimi kurulur
      if (mevcutKota - 1 <= 0) {
        await kotaYenilenmeHatirlatmasiKur(isPremium);
      }

      Alert.alert(
        "Başarılı",
        `Soru gönderildi! Cihazının kotasından 1 hak düştü. (Kalan Hak: ${
          mevcutKota - 1
        })`
      );
      fotografiIptalEt();
    } catch (error) {
      console.log("📸 Fotoğraf Gönderme Hatası Detayı:", error);
      Alert.alert("Hata", "Yükleme sırasında bir hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  const gonderilebilir = gonderilebilirMi({
    fotograf: image,
    secim,
    yukleniyor,
  });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: tema.arkaplan }]}>
      {/* 🚀 DÜZELTME: Sadece bu sayfadaysak StatusBar çalışır ve çakışma yapmaz */}
      {isFocused && (
        <StatusBar
          barStyle={isGercektenKaranlik ? "light-content" : "dark-content"}
          backgroundColor={tema.arkaplan}
        />
      )}

      <View style={styles.innerContainer}>
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
                Harika gidiyorsun! Bugün de buradasın ve serini korudun. Hadi
                bir soru çözerek günü taçlandır!
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
          <YapayZekaBilgi tema={tema} style={styles.bilgiDugmesi} />
          <Text style={[styles.baslik, { color: tema.metin }]}>
            Soru Tarayıcı
          </Text>
          <Text style={[styles.altYazi, { color: tema.ikincilMetin }]}>
            Çözemediğin sorunun fotoğrafını çek, yapay zeka özel hocan anında
            anlatsın.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={!image ? kamerayiAc : undefined}
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
        </TouchableOpacity>

        {image && (
          <View
            style={styles.secimAlani}
            accessibilityRole="radiogroup"
            accessibilityLabel="Sorunun cevabı"
          >
            <Text style={[styles.secimBaslik, { color: tema.metin }]}>
              Sorunun cevabı ne?
            </Text>
            <Text style={[styles.secimAciklama, { color: tema.ikincilMetin }]}>
              Cevabı biliyorsan işaretle, bilmiyorsan Bilinmiyor'u seç.
            </Text>
            <View style={styles.sikSatiri}>
              {SIK_SECENEKLERI.map((sik, i) => {
                const secili = secim === sik;
                return (
                  <TouchableOpacity
                    key={sik}
                    onPress={() => setSecim(sik)}
                    disabled={yukleniyor}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: secili, disabled: yukleniyor }}
                    accessibilityLabel={secimEtiketi(sik, secili)}
                    style={[
                      styles.sik,
                      i > 0 && { marginLeft: 8 },
                      {
                        backgroundColor: secili ? tema.anaButon : "transparent",
                        borderColor: secili ? tema.anaButon : tema.kutuCerceve,
                        opacity: yukleniyor ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sikYazi,
                        { color: secili ? "#FFFFFF" : tema.metin },
                      ]}
                    >
                      {sik}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={() => setSecim(BILINMIYOR)}
              disabled={yukleniyor}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{
                selected: secim === BILINMIYOR,
                disabled: yukleniyor,
              }}
              accessibilityLabel={secimEtiketi(BILINMIYOR, secim === BILINMIYOR)}
              style={[
                styles.bilinmiyor,
                {
                  backgroundColor:
                    secim === BILINMIYOR ? tema.anaButon : "transparent",
                  borderColor:
                    secim === BILINMIYOR ? tema.anaButon : tema.kutuCerceve,
                  opacity: yukleniyor ? 0.5 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.sikYazi,
                  { color: secim === BILINMIYOR ? "#FFFFFF" : tema.metin },
                ]}
              >
                Bilinmiyor
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
                    marginRight: 15,
                    opacity: yukleniyor ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={styles.butonYazi}>İptal Et</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={fotografiGonder}
                disabled={!gonderilebilir}
                accessibilityRole="button"
                accessibilityState={{ disabled: !gonderilebilir }}
                accessibilityLabel={
                  secimGecerliMi(secim)
                    ? "Gönder"
                    : "Gönder, önce cevabı ya da Bilinmiyor'u seçmelisin"
                }
                style={[
                  styles.ikiliButon,
                  {
                    backgroundColor: yukleniyor
                      ? tema.ikincilMetin
                      : tema.anaButon,
                    // Seçim yapılmadıysa soluk; seçince eski rengine döner
                    opacity: !yukleniyor && !gonderilebilir ? 0.35 : 1,
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 15,
    paddingBottom: 20,
  },
  header: { marginBottom: 35, alignItems: "center" },
  // Başlığın sağ üstünde; başlığın ortalanmasını bozmaz
  bilgiDugmesi: { position: "absolute", right: 0, top: 4, zIndex: 1 },
  baslik: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  altYazi: {
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 5,
    lineHeight: 22,
  },
  onizlemeKutusu: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 18,
  },
  bosDurum: { alignItems: "center", padding: 20 },
  ikon: { marginBottom: 15, opacity: 0.8 },
  bosDurumYazi: { fontSize: 16, textAlign: "center", fontWeight: "500" },
  foto: { width: "100%", height: "100%", resizeMode: "cover" },
  secimAlani: { marginBottom: 16 },
  secimBaslik: { fontSize: 16, fontWeight: "bold", marginBottom: 2 },
  secimAciklama: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  sikSatiri: { flexDirection: "row" },
  sik: {
    flex: 1,
    height: 46,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sikYazi: { fontSize: 16, fontWeight: "700" },
  bilinmiyor: {
    marginTop: 8,
    height: 44,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  butonAlani: { paddingBottom: Platform.OS === "ios" ? 10 : 20 },
  tekliButon: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  ikiliButonKutusu: { flexDirection: "row", justifyContent: "space-between" },
  ikiliButon: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  butonYazi: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
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
  modalButonYazi: { color: "#fff", fontWeight: "bold", fontSize: 17 },
});
