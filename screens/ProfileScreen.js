import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Switch,
  Image,
  ActivityIndicator,
} from "react-native";

// Firebase Kütüphaneleri
import { auth, db, storage } from "../firebaseConfig";
import { signOut, deleteUser } from "firebase/auth";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  collection,
  query,
  where,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

// 📷 Resim ve Dosya Kütüphaneleri
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

// 🔔 BİLDİRİM YÖNETİCİSİ VE KÜTÜPHANESİ
import * as Notifications from "expo-notifications";
import {
  registerForPushNotificationsAsync,
  scheduleDailyReminder,
  cancelAllNotifications,
} from "../utils/notificationManager";

// 🌗 TEMA YÖNETİCİSİ
import { useTheme } from "../ThemeContext";

export default function ProfileScreen() {
  const user = auth.currentUser;

  const { tema, temaModu, temaDegistir } = useTheme();

  const [rol, setRol] = useState("ogrenci");
  const [sinifModalGorunur, setSinifModalGorunur] = useState(false);
  const [seciliSinif, setSeciliSinif] = useState("Sınıf Seçilmedi");

  const [temaModalGorunur, setTemaModalGorunur] = useState(false);

  const [adSoyad, setAdSoyad] = useState("");
  const [bildirimAktif, setBildirimAktif] = useState(true);

  const [profilFoto, setProfilFoto] = useState(null);
  const [kaydetmeBasarili, setKaydetmeBasarili] = useState(false);
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false);

  const [kalanSoru, setKalanSoru] = useState(3);
  const [seriGunu, setSeriGunu] = useState(0);
  const [baglantiKodu, setBaglantiKodu] = useState("Yükleniyor...");

  const [toplamSoru, setToplamSoru] = useState(0);
  const [dersIstatistikleri, setDersIstatistikleri] = useState([]);
  const [istatistikYukleniyor, setIstatistikYukleniyor] = useState(true);

  const rastgeleKodUret = () => {
    const karakterler = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let kod = "";
    for (let i = 0; i < 6; i++) {
      kod += karakterler.charAt(Math.floor(Math.random() * karakterler.length));
    }
    return kod;
  };

  useEffect(() => {
    let abonelik = () => {};

    const verileriCanliDinle = async () => {
      if (!user) return;

      const bugununTarihi = new Date().toISOString().split("T")[0];

      const kayitliRol = await AsyncStorage.getItem("kullaniciRolu");
      setRol(kayitliRol || "ogrenci");

      const kayitliSinif = await AsyncStorage.getItem("seciliSinif");
      if (kayitliSinif) setSeciliSinif(kayitliSinif);

      const kayitliAdSoyad = await AsyncStorage.getItem("adSoyad");
      if (kayitliAdSoyad) setAdSoyad(kayitliAdSoyad);

      const kayitliFoto = await AsyncStorage.getItem("profilFoto");
      if (kayitliFoto) setProfilFoto(kayitliFoto);

      const kayitliSeri = await AsyncStorage.getItem("seriGunu");
      if (kayitliSeri) setSeriGunu(parseInt(kayitliSeri));

      const bildirimAyar = await AsyncStorage.getItem("bildirimAktif");
      if (bildirimAyar !== null) setBildirimAktif(JSON.parse(bildirimAyar));

      const kullaniciRef = doc(db, "kullanicilar", user.uid);

      abonelik = onSnapshot(
        kullaniciRef,
        async (kullaniciSnap) => {
          if (kullaniciSnap.exists()) {
            const data = kullaniciSnap.data();

            if (data.sinif) setSeciliSinif(data.sinif);
            if (data.adSoyad) setAdSoyad(data.adSoyad);
            if (data.bildirimAktif !== undefined)
              setBildirimAktif(data.bildirimAktif);

            if (data.baglantiKodu) {
              setBaglantiKodu(data.baglantiKodu);
            } else {
              const yeniKod = rastgeleKodUret();
              setBaglantiKodu(yeniKod);
              try {
                await updateDoc(kullaniciRef, { baglantiKodu: yeniKod });
              } catch (e) {
                console.log("Kod ekleme hatası", e);
              }
            }

            if (data.seriGunu !== undefined) {
              setSeriGunu(data.seriGunu);
              await AsyncStorage.setItem("seriGunu", String(data.seriGunu));
            } else {
              setSeriGunu(1);
              try {
                await updateDoc(kullaniciRef, { seriGunu: 1 });
              } catch (e) {
                console.log("Seri ekleme hatası", e);
              }
            }

            if (data.profilFoto) {
              setProfilFoto(data.profilFoto);
              await AsyncStorage.setItem("profilFoto", data.profilFoto);
            }

            let guncelKota = data.kalanSoru !== undefined ? data.kalanSoru : 3;
            let veritabaniTarihi = data.sonSoruTarihi || "";

            if (veritabaniTarihi !== bugununTarihi) {
              guncelKota = 3;
              try {
                await updateDoc(kullaniciRef, {
                  kalanSoru: 3,
                  sonSoruTarihi: bugununTarihi,
                });
              } catch (e) {
                console.log("Kota güncelleme hatası:", e.message);
              }
            }

            setKalanSoru(guncelKota);
          } else {
            const yeniKod = rastgeleKodUret();
            setBaglantiKodu(yeniKod);

            try {
              await setDoc(kullaniciRef, {
                eposta: user.email,
                rol: kayitliRol || "ogrenci",
                baglantiKodu: yeniKod,
                kayitTarihi: new Date().toISOString(),
                bildirimAktif: true,
                seriGunu: 1,
                kalanSoru: 3,
                sonSoruTarihi: bugununTarihi,
              });
              setKalanSoru(3);
            } catch (yazmaHatasi) {
              console.log(
                "Kullanıcı belge oluşturma hatası:",
                yazmaHatasi.message
              );
            }
          }
        },
        (error) => {
          console.log("Firebase Canlı Dinleme Hatası:", error.message);
        }
      );
    };

    verileriCanliDinle();

    return () => abonelik();
  }, [user]);

  useEffect(() => {
    if (!user?.email) return;

    const q = query(
      collection(db, "sorular"),
      where("kullaniciEposta", "==", user.email)
    );

    const abonelik = onSnapshot(
      q,
      (snapshot) => {
        let total = 0;
        const dersSayaclari = {};

        snapshot.forEach((doc) => {
          total++;
          const data = doc.data();
          const ders = data.subject || data.ders || "Diğer";
          dersSayaclari[ders] = (dersSayaclari[ders] || 0) + 1;
        });

        setToplamSoru(total);

        if (total > 0) {
          const istatistikDizisi = Object.keys(dersSayaclari).map(
            (dersAdi) => ({
              ders: dersAdi,
              sayi: dersSayaclari[dersAdi],
              yuzde: Math.round((dersSayaclari[dersAdi] / total) * 100),
            })
          );

          istatistikDizisi.sort((a, b) => b.sayi - a.sayi);
          setDersIstatistikleri(istatistikDizisi);
        } else {
          setDersIstatistikleri([]);
        }

        setIstatistikYukleniyor(false);
      },
      (error) => {
        console.log("İstatistik çekme hatası:", error);
        setIstatistikYukleniyor(false);
      }
    );

    return () => abonelik();
  }, [user]);

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

  const isimKaydet = async () => {
    if (adSoyad !== "") {
      await AsyncStorage.setItem("adSoyad", adSoyad);
      if (user) {
        const kullaniciRef = doc(db, "kullanicilar", user.uid);
        await updateDoc(kullaniciRef, { adSoyad: adSoyad });
      }

      setKaydetmeBasarili(true);
      setTimeout(() => setKaydetmeBasarili(false), 2500);
    }
  };

  const fotoAksiyonMenusu = () => {
    if (profilFoto) {
      Alert.alert("Profil Fotoğrafı", "Ne yapmak istersiniz?", [
        { text: "İptal", style: "cancel" },
        { text: "Fotoğrafı Değiştir", onPress: profilFotografiSec },
        {
          text: "Fotoğrafı Kaldır",
          onPress: profilFotografiKaldir,
          style: "destructive",
        },
      ]);
    } else {
      profilFotografiSec();
    }
  };

  const profilFotografiKaldir = async () => {
    setFotoYukleniyor(true);
    const baglanti = await internetVarMi();
    if (!baglanti) {
      setFotoYukleniyor(false);
      Alert.alert(
        "Bağlantı Hatası",
        "İnternet bağlantınız olmadığı için fotoğraf kaldırılamadı."
      );
      return;
    }

    try {
      setProfilFoto(null);
      await AsyncStorage.removeItem("profilFoto");

      if (user) {
        const kullaniciRef = doc(db, "kullanicilar", user.uid);
        await updateDoc(kullaniciRef, { profilFoto: deleteField() });

        const fotoRef = ref(storage, `profil_fotograflari/${user.uid}.jpg`);
        await deleteObject(fotoRef).catch((err) =>
          console.log("Dosya zaten yok:", err)
        );
      }
    } catch (error) {
      console.log("Fotoğraf kaldırma hatası:", error);
      Alert.alert("Hata", "Fotoğraf kaldırılırken bir sorun oluştu.");
    } finally {
      setFotoYukleniyor(false);
    }
  };

  const profilFotografiSec = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "İzin Gerekli",
        "Fotoğraf seçebilmek için galeri erişim izni vermelisiniz."
      );
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
    });

    if (!result.canceled) {
      setFotoYukleniyor(true);
      const baglanti = await internetVarMi();
      if (!baglanti) {
        setFotoYukleniyor(false);
        Alert.alert(
          "Bağlantı Hatası",
          "Lütfen internet bağlantınızı kontrol edip tekrar deneyin."
        );
        return;
      }

      const secilenFotoUri = result.assets[0].uri;
      setProfilFoto(secilenFotoUri);

      try {
        if (user) {
          const dosyaYolu = `profil_fotograflari/${user.uid}.jpg`;
          const encodedYol = encodeURIComponent(dosyaYolu);
          const bucket =
            storage.app.options.storageBucket ||
            "project-21-3e377.firebasestorage.app";
          const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodedYol}`;
          const token = await user.getIdToken();

          const uploadResult = await FileSystem.uploadAsync(
            url,
            secilenFotoUri,
            {
              httpMethod: "POST",
              headers: {
                "Content-Type": "image/jpeg",
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (uploadResult.status !== 200) {
            throw new Error(
              `Yükleme başarısız! Sunucu kodu: ${uploadResult.status}`
            );
          }

          const data = JSON.parse(uploadResult.body);
          const indirmeURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedYol}?alt=media&token=${data.downloadTokens}`;

          const kullaniciRef = doc(db, "kullanicilar", user.uid);
          await updateDoc(kullaniciRef, { profilFoto: indirmeURL });
          await AsyncStorage.setItem("profilFoto", indirmeURL);
          setProfilFoto(indirmeURL);
        }
      } catch (error) {
        console.log("Fotoğraf yükleme hatası:", error);
        Alert.alert("Hata", "Fotoğraf buluta yüklenirken sorun oluştu.");
        setProfilFoto(null);
      } finally {
        setFotoYukleniyor(false);
      }
    }
  };

  const bildirimAyariniDegistir = async (deger) => {
    setBildirimAktif(deger);
    await AsyncStorage.setItem("bildirimAktif", JSON.stringify(deger));

    if (user) {
      const kullaniciRef = doc(db, "kullanicilar", user.uid);
      await updateDoc(kullaniciRef, { bildirimAktif: deger });

      if (deger) {
        const izinVerildi = await registerForPushNotificationsAsync();
        if (izinVerildi) {
          await scheduleDailyReminder();
          Alert.alert(
            "Bildirimler Açıldı",
            "Her akşam saat 19:00'da sana hatırlatma göndereceğiz."
          );
        } else {
          setBildirimAktif(false);
          Alert.alert(
            "İzin Gerekli",
            "Bildirim almak için telefon ayarlarından izin vermelisin."
          );
        }
      } else {
        await cancelAllNotifications();
      }
    }
  };

  const cikisYap = () => {
    Alert.alert(
      "Çıkış",
      "Hesabınızdan çıkış yapmak istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Evet",
          onPress: async () => {
            try {
              await cancelAllNotifications();
              await AsyncStorage.multiRemove([
                "adSoyad",
                "seciliSinif",
                "kullaniciRolu",
                "bildirimAktif",
                "profilFoto",
                "seriGunu",
              ]);
              await signOut(auth);
            } catch (error) {
              console.log("Çıkış hatası:", error);
            }
          },
        },
      ]
    );
  };

  const hesabiSil = () => {
    Alert.alert(
      "Hesabı Sil",
      "Tüm verileriniz kalıcı olarak silinecektir. Bu işlem geri alınamaz.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              if (user) {
                await cancelAllNotifications();
                await deleteDoc(doc(db, "kullanicilar", user.uid));
                await AsyncStorage.multiRemove([
                  "adSoyad",
                  "seciliSinif",
                  "kullaniciRolu",
                  "bildirimAktif",
                  "profilFoto",
                  "seriGunu",
                ]);
                await deleteUser(user);
              }
            } catch (error) {
              if (error.code === "auth/requires-recent-login") {
                Alert.alert(
                  "Güvenlik Doğrulaması",
                  "Güvenliğiniz için hesabınızı silmeden önce yeniden giriş yapmanız gerekiyor. Lütfen çıkış yapıp tekrar giriş yapın.",
                  [
                    { text: "İptal", style: "cancel" },
                    {
                      text: "Çıkış Yap",
                      onPress: cikisYap,
                      style: "destructive",
                    },
                  ]
                );
              } else {
                Alert.alert("Hata", "Hesap silinirken hata oluştu.");
              }
            }
          },
        },
      ]
    );
  };

  const siniflar = [
    "1. Sınıf",
    "2. Sınıf",
    "3. Sınıf",
    "4. Sınıf",
    "5. Sınıf",
    "6. Sınıf",
    "7. Sınıf",
    "8. Sınıf",
    "9. Sınıf",
    "10. Sınıf",
    "11. Sınıf",
    "12. Sınıf",
    "Mezun",
  ];

  const getAvatarHarf = () => {
    if (adSoyad && adSoyad.trim().length > 0) {
      return adSoyad.charAt(0).toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || "?";
  };

  const kullaniciPuan = toplamSoru * 50 + seriGunu * 20;
  const kullaniciSeviye = Math.floor(kullaniciPuan / 1000) + 1;

  const rozetler = [
    {
      id: 1,
      baslik: "İlk Adım",
      ikon: "🌱",
      aciklama: "İlk soru",
      kazanildi: toplamSoru >= 1,
    },
    {
      id: 2,
      baslik: "Isınma Turu",
      ikon: "⚡",
      aciklama: "3 günlük seri",
      kazanildi: seriGunu >= 3,
    },
    {
      id: 3,
      baslik: "İstikrarlı",
      ikon: "📅",
      aciklama: "7 günlük seri",
      kazanildi: seriGunu >= 7,
    },
    {
      id: 4,
      baslik: "Soru Avcısı",
      ikon: "🎯",
      aciklama: "10 soru çözdün",
      kazanildi: toplamSoru >= 10,
    },
    {
      id: 5,
      baslik: "Çırak",
      ikon: "🛠️",
      aciklama: "25 soru çözdün",
      kazanildi: toplamSoru >= 25,
    },
    {
      id: 6,
      baslik: "Bilge Baykuş",
      ikon: "🦉",
      aciklama: "50 soru çözdün",
      kazanildi: toplamSoru >= 50,
    },
    {
      id: 7,
      baslik: "Efsane",
      ikon: "👑",
      aciklama: "100 soru barajı",
      kazanildi: toplamSoru >= 100,
    },
    {
      id: 8,
      baslik: "Usta",
      ikon: "⚔️",
      aciklama: "250 soru çözdün",
      kazanildi: toplamSoru >= 250,
    },
    {
      id: 9,
      baslik: "Profesör",
      ikon: "🎓",
      aciklama: "500 soru çözdün",
      kazanildi: toplamSoru >= 500,
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tema.arkaplan }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { backgroundColor: tema.anaButon }]}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={fotoAksiyonMenusu}
          disabled={fotoYukleniyor}
        >
          {profilFoto ? (
            <Image source={{ uri: profilFoto }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{getAvatarHarf()}</Text>
          )}
          <View
            style={[styles.kameraIkonKutu, { backgroundColor: tema.anaButon }]}
          >
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        {fotoYukleniyor && (
          <Text
            style={{
              color: "#fff",
              fontSize: 12,
              marginTop: -10,
              marginBottom: 10,
            }}
          >
            Yükleniyor...
          </Text>
        )}

        <Text style={styles.userName}>
          {adSoyad || user?.email?.split("@")[0]}
        </Text>
        <Text style={styles.userEmail}>{user?.email}</Text>

        {/* 🎯 GÜNCELLENEN: Seviye Dışarı Alındı */}
        {rol === "ogrenci" && (
          <View style={styles.seviyeVeXpKapsayici}>
            <Text style={styles.seviyeYazisi}>Seviye {kullaniciSeviye}</Text>
            <View style={styles.xpKutusu}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.xpYazisi}>{kullaniciPuan} XP</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {rol === "ogrenci" && (
          <>
            <Text style={[styles.sectionTitle, { color: tema.metin }]}>
              🏆 Kazanılan Rozetler
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 20 }}
            >
              {rozetler.map((rozet) => (
                <View
                  key={rozet.id}
                  style={[
                    styles.rozetKutu,
                    {
                      backgroundColor: rozet.kazanildi
                        ? temaModu === "dark"
                          ? "#1E293B"
                          : "#F0F9FF"
                        : tema.kutuArkaplan,
                      borderColor: rozet.kazanildi
                        ? tema.anaButon
                        : tema.kutuCerceve,
                      opacity: rozet.kazanildi ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 24, marginBottom: 4 }}>
                    {rozet.ikon}
                  </Text>
                  <Text style={[styles.rozetBaslik, { color: tema.metin }]}>
                    {rozet.baslik}
                  </Text>
                  <Text
                    style={[styles.rozetAciklama, { color: tema.ikincilMetin }]}
                  >
                    {rozet.aciklama}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: tema.metin }]}>
          Kişisel Bilgiler
        </Text>
        <View
          style={[
            styles.kutu,
            {
              backgroundColor: tema.kutuArkaplan,
              borderColor: tema.kutuCerceve,
            },
          ]}
        >
          <TextInput
            style={{ color: tema.metin, fontSize: 16 }}
            placeholder="Ad Soyad Giriniz"
            placeholderTextColor={tema.ikincilMetin}
            value={adSoyad}
            onChangeText={setAdSoyad}
            autoCorrect={false}
            spellCheck={false}
            onEndEditing={isimKaydet}
          />
          {kaydetmeBasarili && (
            <Text
              style={{
                color: "#2ecc71",
                fontSize: 13,
                marginTop: 8,
                fontWeight: "bold",
              }}
            >
              ✓ Bilgiler güncellendi
            </Text>
          )}
        </View>

        {rol === "ogrenci" && (
          <>
            <Text
              style={[
                styles.sectionTitle,
                { color: tema.metin, marginTop: 20 },
              ]}
            >
              Gelişim Durumum
            </Text>
            <View
              style={[
                styles.streakKutu,
                {
                  backgroundColor: tema.kutuArkaplan,
                  borderColor: tema.anaButon,
                },
              ]}
            >
              <Text style={styles.streakIkon}>🔥</Text>
              <View>
                <Text style={[styles.streakBaslik, { color: tema.metin }]}>
                  {seriGunu} Günlük Seri
                </Text>
                <Text
                  style={[styles.streakAltYazi, { color: tema.ikincilMetin }]}
                >
                  Her gün soru çözerek serini koru!
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.kutu,
                {
                  backgroundColor: tema.kutuArkaplan,
                  borderColor: tema.kutuCerceve,
                },
              ]}
            >
              <Text
                style={[
                  styles.kutuBaslik,
                  { color: tema.metin, marginBottom: 15 },
                ]}
              >
                📊 Soru Çözüm İstatistikleri
              </Text>

              {istatistikYukleniyor ? (
                <ActivityIndicator size="small" color={tema.anaButon} />
              ) : (
                <View>
                  <Text
                    style={{
                      color: tema.ikincilMetin,
                      marginBottom: 15,
                      fontSize: 14,
                    }}
                  >
                    Toplam Çözülen Soru:{" "}
                    <Text
                      style={{
                        color: tema.metin,
                        fontWeight: "bold",
                        fontSize: 16,
                      }}
                    >
                      {toplamSoru}
                    </Text>
                  </Text>

                  {dersIstatistikleri.length > 0 ? (
                    dersIstatistikleri.map((ist, index) => (
                      <View key={index} style={{ marginBottom: 12 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 5,
                          }}
                        >
                          <Text
                            style={{
                              color: tema.metin,
                              fontSize: 13,
                              fontWeight: "500",
                            }}
                          >
                            {ist.ders}
                          </Text>
                          <Text
                            style={{
                              color: tema.anaButon,
                              fontSize: 13,
                              fontWeight: "bold",
                            }}
                          >
                            %{ist.yuzde}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.barArkaplan,
                            { backgroundColor: tema.kutuCerceve, height: 6 },
                          ]}
                        >
                          <View
                            style={[
                              styles.barDolu,
                              {
                                backgroundColor: tema.anaButon,
                                width: `${ist.yuzde}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text
                      style={{
                        color: tema.ikincilMetin,
                        fontSize: 13,
                        fontStyle: "italic",
                      }}
                    >
                      Henüz yeterli istatistik oluşmadı. Soru çözmeye başla!
                    </Text>
                  )}
                </View>
              )}
            </View>

            <View
              style={[
                styles.kutu,
                {
                  backgroundColor: tema.kutuArkaplan,
                  borderColor: tema.kutuCerceve,
                },
              ]}
            >
              <View style={styles.kutuUstBaslik}>
                <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                  Günlük Soru Kotası
                </Text>
                <Text style={[styles.kotaSayi, { color: tema.anaButon }]}>
                  {kalanSoru} / 3
                </Text>
              </View>
              <View
                style={[
                  styles.barArkaplan,
                  { backgroundColor: tema.kutuCerceve },
                ]}
              >
                <View
                  style={[
                    styles.barDolu,
                    {
                      backgroundColor: tema.anaButon,
                      width: `${(kalanSoru / 3) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setSinifModalGorunur(true)}
              style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
            >
              <Ionicons
                name="school-outline"
                size={22}
                color={tema.anaButon}
                style={styles.menuIcon}
              />
              <View style={styles.menuMetinAlan}>
                <Text style={[styles.menuBaslik, { color: tema.metin }]}>
                  Sınıf Bilgim
                </Text>
                <Text style={[styles.menuAlt, { color: tema.ikincilMetin }]}>
                  {seciliSinif}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={tema.ikincilMetin}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Veli Bağlantı Kodu",
                  `Bu kodu veline vererek seni takip etmesini sağlayabilirsin:\n\n${baglantiKodu}`
                )
              }
              style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
            >
              <Ionicons
                name="link-outline"
                size={22}
                color={tema.anaButon}
                style={styles.menuIcon}
              />
              <View style={styles.menuMetinAlan}>
                <Text style={[styles.menuBaslik, { color: tema.metin }]}>
                  Veli Bağlantı Kodum
                </Text>
                <Text style={[styles.menuAlt, { color: tema.ikincilMetin }]}>
                  {baglantiKodu}
                </Text>
              </View>
              <Ionicons
                name="copy-outline"
                size={18}
                color={tema.ikincilMetin}
              />
            </TouchableOpacity>
          </>
        )}

        <Text
          style={[styles.sectionTitle, { color: tema.metin, marginTop: 20 }]}
        >
          Tercihler
        </Text>

        <TouchableOpacity
          onPress={() => setTemaModalGorunur(true)}
          style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
        >
          <Ionicons
            name="color-palette-outline"
            size={22}
            color={tema.anaButon}
            style={styles.menuIcon}
          />
          <View style={styles.menuMetinAlan}>
            <Text style={[styles.menuBaslik, { color: tema.metin }]}>
              Görünüm Modu
            </Text>
            <Text style={[styles.menuAlt, { color: tema.ikincilMetin }]}>
              {temaModu === "light"
                ? "Açık Mod"
                : temaModu === "dark"
                ? "Koyu Mod"
                : "Sistem Ayarı"}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={tema.ikincilMetin}
          />
        </TouchableOpacity>

        <View style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={tema.anaButon}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuBaslik, { color: tema.metin, flex: 1 }]}>
            Bildirimleri Al
          </Text>
          <Switch
            value={bildirimAktif}
            onValueChange={bildirimAyariniDegistir}
            trackColor={{ false: tema.kutuCerceve, true: tema.anaButon }}
          />
        </View>

        <Text
          style={[styles.sectionTitle, { color: tema.metin, marginTop: 20 }]}
        >
          Destek ve Bilgi
        </Text>

        <TouchableOpacity
          onPress={() =>
            Alert.alert("Bilgi", "Kullanım rehberi yakında eklenecektir.")
          }
          style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
        >
          <Ionicons
            name="help-circle-outline"
            size={22}
            color={tema.metin}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuBaslik, { color: tema.metin }]}>
            Nasıl Kullanılır?
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            Alert.alert("Bilgi", "Kullanım koşulları yakında eklenecektir.")
          }
          style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={tema.metin}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuBaslik, { color: tema.metin }]}>
            Kullanım Koşulları
          </Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center", marginTop: 10 }}>
          <Text style={{ color: tema.ikincilMetin, fontSize: 12 }}>
            Versiyon 1.0.2
          </Text>
        </View>

        <Text
          style={[styles.sectionTitle, { color: tema.metin, marginTop: 25 }]}
        >
          Hesap Ayarları
        </Text>
        <TouchableOpacity
          onPress={cikisYap}
          style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
        >
          <Ionicons
            name="log-out-outline"
            size={22}
            color={tema.metin}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuBaslik, { color: tema.metin }]}>
            Oturumu Kapat
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={hesabiSil}
          style={[
            styles.menuItem,
            {
              backgroundColor: tema.kutuArkaplan,
              borderColor: tema.hataKirmizi,
              borderWidth: 1,
            },
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={22}
            color={tema.hataKirmizi}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuBaslik, { color: tema.hataKirmizi }]}>
            Hesabımı Sil
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={sinifModalGorunur}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalArkaplan}>
          <View
            style={[styles.modalKutu, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Text style={[styles.modalBaslik, { color: tema.metin }]}>
              Sınıfını Güncelle
            </Text>
            <ScrollView style={{ maxHeight: 350 }}>
              {siniflar.map((sinif, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalSecenek,
                    { borderBottomColor: tema.kutuCerceve },
                  ]}
                  onPress={async () => {
                    setSeciliSinif(sinif);
                    setSinifModalGorunur(false);
                    await AsyncStorage.setItem("seciliSinif", sinif);
                    if (user) {
                      const kullaniciRef = doc(db, "kullanicilar", user.uid);
                      await updateDoc(kullaniciRef, { sinif: sinif });
                    }
                  }}
                >
                  <Text
                    style={[styles.modalSecenekYazi, { color: tema.metin }]}
                  >
                    {sinif}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setSinifModalGorunur(false)}
              style={styles.modalKapatButon}
            >
              <Text style={{ color: tema.hataKirmizi, fontWeight: "bold" }}>
                Kapat
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={temaModalGorunur}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalArkaplan}>
          <View
            style={[styles.modalKutu, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Text style={[styles.modalBaslik, { color: tema.metin }]}>
              Görünüm Modu Seç
            </Text>

            <TouchableOpacity
              style={[
                styles.modalSecenek,
                { borderBottomColor: tema.kutuCerceve },
              ]}
              onPress={() => {
                temaDegistir("light");
                setTemaModalGorunur(false);
              }}
            >
              <Text
                style={[
                  styles.modalSecenekYazi,
                  {
                    color: temaModu === "light" ? tema.anaButon : tema.metin,
                    fontWeight: temaModu === "light" ? "bold" : "normal",
                  },
                ]}
              >
                ☀️ Açık Mod
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalSecenek,
                { borderBottomColor: tema.kutuCerceve },
              ]}
              onPress={() => {
                temaDegistir("dark");
                setTemaModalGorunur(false);
              }}
            >
              <Text
                style={[
                  styles.modalSecenekYazi,
                  {
                    color: temaModu === "dark" ? tema.anaButon : tema.metin,
                    fontWeight: temaModu === "dark" ? "bold" : "normal",
                  },
                ]}
              >
                🌙 Koyu Mod
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalSecenek,
                { borderBottomColor: "transparent" },
              ]}
              onPress={() => {
                temaDegistir("system");
                setTemaModalGorunur(false);
              }}
            >
              <Text
                style={[
                  styles.modalSecenekYazi,
                  {
                    color: temaModu === "system" ? tema.anaButon : tema.metin,
                    fontWeight: temaModu === "system" ? "bold" : "normal",
                  },
                ]}
              >
                📱 Sistem Ayarı
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setTemaModalGorunur(false)}
              style={styles.modalKapatButon}
            >
              <Text style={{ color: tema.hataKirmizi, fontWeight: "bold" }}>
                Kapat
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingVertical: 45,
    alignItems: "center",
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    position: "relative",
  },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarText: { fontSize: 38, color: "#fff", fontWeight: "bold" },
  kameraIkonKutu: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  userName: { fontSize: 22, color: "#fff", fontWeight: "bold" },
  userEmail: { fontSize: 14, color: "rgba(255,255,255,0.85)" },

  seviyeVeXpKapsayici: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  seviyeYazisi: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    marginRight: 12,
  },
  xpKutusu: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  xpYazisi: { color: "#fff", fontWeight: "bold", marginLeft: 5, fontSize: 14 },

  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },

  rozetKutu: {
    width: 105,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    marginRight: 10,
  },
  rozetBaslik: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 5,
  },
  rozetAciklama: { fontSize: 10, textAlign: "center", marginTop: 2 },

  streakKutu: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1.5,
  },
  streakIkon: { fontSize: 32, marginRight: 15 },
  streakBaslik: { fontSize: 17, fontWeight: "bold" },
  streakAltYazi: { fontSize: 12, marginTop: 2 },
  kutu: { padding: 18, borderRadius: 15, marginBottom: 15, borderWidth: 1 },
  kutuUstBaslik: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  kutuBaslik: { fontSize: 15, fontWeight: "bold" },
  kotaSayi: { fontSize: 16, fontWeight: "bold" },
  barArkaplan: {
    height: 8,
    borderRadius: 4,
    width: "100%",
    overflow: "hidden",
  },
  barDolu: { height: "100%", borderRadius: 4 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  menuIcon: { marginRight: 15 },
  menuMetinAlan: { flex: 1 },
  menuBaslik: { fontSize: 15, fontWeight: "600" },
  menuAlt: { fontSize: 12, marginTop: 3 },
  modalArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 25,
  },
  modalKutu: { borderRadius: 20, padding: 20, width: "100%" },
  modalBaslik: {
    fontSize: 19,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  modalSecenek: { paddingVertical: 16, borderBottomWidth: 0.5 },
  modalSecenekYazi: { fontSize: 16, textAlign: "center" },
  modalKapatButon: { marginTop: 20, padding: 10, alignItems: "center" },
});
