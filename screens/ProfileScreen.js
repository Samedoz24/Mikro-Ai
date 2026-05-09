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
  Platform,
  Pressable,
  StatusBar,
  Share,
  Linking,
  KeyboardAvoidingView,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useIsFocused } from "@react-navigation/native";

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
  getDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Application from "expo-application";
import * as Notifications from "expo-notifications";
import {
  registerForPushNotificationsAsync,
  scheduleDailyReminder,
  cancelAllNotifications,
} from "../utils/notificationManager";

import { useTheme } from "../ThemeContext";
import { colors } from "../theme";

export default function ProfileScreen() {
  const user = auth.currentUser;
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const { tema, temaModu, temaDegistir } = useTheme();
  const isGercektenKaranlik = tema.arkaplan === colors.dark.arkaplan;

  const [rol, setRol] = useState("ogrenci");
  const [sinifModalGorunur, setSinifModalGorunur] = useState(false);
  const [seciliSinif, setSeciliSinif] = useState("Sınıf Seçilmedi");

  const [temaModalGorunur, setTemaModalGorunur] = useState(false);

  const [adSoyad, setAdSoyad] = useState("");
  const [isimDuzenleniyor, setIsimDuzenleniyor] = useState(false);

  const [bildirimAktif, setBildirimAktif] = useState(true);

  const [profilFoto, setProfilFoto] = useState(null);
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false);

  const [kalanSoru, setKalanSoru] = useState(3);
  const [maxKota, setMaxKota] = useState(3);
  const [seriGunu, setSeriGunu] = useState(0);
  const [baglantiKodu, setBaglantiKodu] = useState("Yükleniyor...");

  const [toplamSoru, setToplamSoru] = useState(0);
  const [dersIstatistikleri, setDersIstatistikleri] = useState([]);
  const [istatistikYukleniyor, setIstatistikYukleniyor] = useState(true);

  const [webViewModalGorunur, setWebViewModalGorunur] = useState(false);
  const [webViewBaslik, setWebViewBaslik] = useState("");
  const [webViewHtml, setWebViewHtml] = useState("");

  const [hesapSilModalGorunur, setHesapSilModalGorunur] = useState(false);
  const [silOnayMetni, setSilOnayMetni] = useState("");
  const [hesapSiliniyor, setHesapSiliniyor] = useState(false);

  const rastgeleKodUret = () => {
    const karakterler = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let kod = "";
    for (let i = 0; i < 6; i++) {
      kod += karakterler.charAt(Math.floor(Math.random() * karakterler.length));
    }
    return kod;
  };

  useEffect(() => {
    let cihazAbonelik = () => {};

    const cihazKotasiDinle = async () => {
      if (!user) return;

      try {
        const kullaniciRef = doc(db, "kullanicilar", user.uid);
        const kullaniciSnap = await getDoc(kullaniciRef);
        const isPremium = kullaniciSnap.exists()
          ? kullaniciSnap.data().premiumMu === true
          : false;

        const guncelMaxKota = isPremium ? 50 : 3;
        setMaxKota(guncelMaxKota);

        const cihazId =
          Platform.OS === "android"
            ? Application.getAndroidId()
            : await Application.getIosIdForVendorAsync();

        const bugun = new Date().toISOString().split("T")[0];
        const cihazRef = doc(db, "cihazHaklari", cihazId);

        cihazAbonelik = onSnapshot(cihazRef, async (cihazSnap) => {
          if (cihazSnap.exists()) {
            const data = cihazSnap.data();
            if (data.tarih === bugun) {
              let dbKalan =
                data.kalanSoru !== undefined ? data.kalanSoru : guncelMaxKota;
              let dbToplam = data.toplamHak || 3;

              if (dbToplam !== guncelMaxKota) {
                const harcananSoru = dbToplam - dbKalan;
                dbKalan = Math.max(0, guncelMaxKota - harcananSoru);
                await setDoc(
                  cihazRef,
                  {
                    kalanSoru: dbKalan,
                    toplamHak: guncelMaxKota,
                  },
                  { merge: true }
                );
              }
              setKalanSoru(dbKalan);
            } else {
              setKalanSoru(guncelMaxKota);
              await setDoc(
                cihazRef,
                {
                  kalanSoru: guncelMaxKota,
                  tarih: bugun,
                  toplamHak: guncelMaxKota,
                },
                { merge: true }
              );
            }
          } else {
            setKalanSoru(guncelMaxKota);
            await setDoc(
              cihazRef,
              {
                kalanSoru: guncelMaxKota,
                tarih: bugun,
                toplamHak: guncelMaxKota,
              },
              { merge: true }
            );
          }
        });
      } catch (error) {
        console.log("Cihaz kotası dinleme hatası:", error);
      }
    };

    cihazKotasiDinle();
    return () => cihazAbonelik();
  }, [user]);

  useEffect(() => {
    let abonelik = () => {};

    const verileriCanliDinle = async () => {
      if (!user) return;

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

            if (data.premiumMu !== undefined) {
              setMaxKota(data.premiumMu ? 50 : 3);
            }

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
              });
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
    }
    setIsimDuzenleniyor(false);
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

  const bizeUlasin = () => {
    Linking.openURL(
      "mailto:destek@mikroai.com?subject=Mikro AI Destek Talebi&body=Merhaba, şöyle bir konu hakkında yardıma ihtiyacım var: "
    ).catch(() => {
      Alert.alert(
        "Hata",
        "Telefonunuzda kurulu bir mail uygulaması bulunamadı."
      );
    });
  };

  const uygulamayiPaylas = async () => {
    try {
      await Share.share({
        message:
          "Mikro AI ile çözemediğim soru kalmadı! 🚀 Yapay zeka destekli bu harika eğitim uygulaması çok yakında App Store ve Google Play'de. Hazır ol!",
      });
    } catch (error) {
      console.log("Paylaşım hatası:", error);
    }
  };

  const guvenliHesabiSil = async () => {
    if (silOnayMetni !== "SİL") {
      Alert.alert("Hata", "Lütfen kutucuğa büyük harflerle SİL yazın.");
      return;
    }

    setHesapSiliniyor(true);
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
      setHesapSiliniyor(false);
      setHesapSilModalGorunur(false);
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
  };

  const htmlSablonUret = (baslik, altBaslik, icerikHtml) => {
    // 🚀 DÜZELTME: isGercektenKaranlik kullanıldı
    const isDark = isGercektenKaranlik;
    const bg = isDark ? "#121212" : "#FFFFFF";
    const metinRenk = isDark ? "#E5E7EB" : "#1F2937";
    const ikincilMetinRenk = isDark ? "#9CA3AF" : "#4B5563";
    const kutuBg = isDark ? "#1F2937" : "#F8FAFC";
    const cerceveRenk = isDark ? "#374151" : "#E2E8F0";
    const anaRenk = isDark ? "#818CF8" : "#4F46E5";

    return `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
        <style>
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: ${bg};
            color: ${metinRenk};
            padding: 24px;
            margin: 0;
            line-height: 1.6;
          }
          .header-group { margin-bottom: 30px; }
          h1 {
            font-size: 28px;
            font-weight: 800;
            color: ${metinRenk};
            margin: 0 0 8px 0;
            letter-spacing: -0.8px;
          }
          .sub-title {
            font-size: 16px;
            color: ${anaRenk};
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
          }
          h2 {
            font-size: 19px;
            font-weight: 700;
            color: ${metinRenk};
            margin-top: 32px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
          }
          h2::before {
            content: "";
            width: 4px;
            height: 20px;
            background-color: ${anaRenk};
            margin-right: 12px;
            border-radius: 2px;
          }
          p, li {
            font-size: 15px;
            color: ${ikincilMetinRenk};
            margin-bottom: 16px;
          }
          ul {
            padding: 0;
            list-style: none;
            margin-bottom: 24px;
          }
          li {
            position: relative;
            padding-left: 28px;
            margin-bottom: 14px;
          }
          li::before {
            content: "→";
            position: absolute;
            left: 0;
            color: ${anaRenk};
            font-weight: bold;
          }
          .card {
            background-color: ${kutuBg};
            border: 1px solid ${cerceveRenk};
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 28px;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
          }
          .highlight {
            color: ${metinRenk};
            font-weight: 700;
            background-color: ${anaRenk}20;
            padding: 2px 6px;
            border-radius: 6px;
          }
          .footer-note {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid ${cerceveRenk};
            font-size: 13px;
            text-align: center;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="header-group">
          <div class="sub-title">${altBaslik}</div>
          <h1>${baslik}</h1>
        </div>
        ${icerikHtml}
        <div class="footer-note">Mikro AI Eğitim Teknolojileri</div>
      </body>
      </html>
    `;
  };

  const acNasilKullanilir = () => {
    const icerik = `
      <div class="card">
        <p>Mikro AI, çözemediğin soruları saniyeler içinde analiz eden ve sana özel adım adım çözüm yolları üreten akıllı eğitim asistanındır.</p>
      </div>
      
      <h2>📸 1. Soruyu Gönder</h2>
      <ul>
        <li>Ana ekrandaki <span class="highlight">Kamerayı Aç</span> butonunu kullan.</li>
        <li>Soruyu net bir şekilde kadraja al ve fotoğrafını çek.</li>
        <li>Karmaşıklığı önlemek için ekranda sadece <span class="highlight">tek bir soru</span> olmasına dikkat et.</li>
      </ul>

      <h2>🧠 2. Analiz ve Çözüm</h2>
      <ul>
        <li>Yapay zeka sorunun konusunu ve çözüm mantığını anında çıkarır.</li>
        <li>Kullanılan formülleri ve mantıksal adımları detaylıca oku.</li>
        <li>Çözümü cihazına indirmek için <span class="highlight">Çözüm Kartını İndir</span> butonuna dokun.</li>
      </ul>

      <h2>🎯 3. Benzer Sorularla Pekiştir</h2>
      <ul>
        <li>Çözümün altındaki zorluk seviyelerini seçerek benzer sorular üret.</li>
        <li>Pratik testleri çözerek konuyu tam olarak öğrendiğinden emin ol.</li>
      </ul>

      <h2>📊 4. Hata Defteri Yönetimi</h2>
      <ul>
        <li>Tüm geçmişin otomatik olarak arşivlenir.</li>
        <li>PDF oluşturma özelliği ile kendine özel <span class="highlight">çalışma fasikülleri</span> hazırla.</li>
      </ul>
    `;
    setWebViewBaslik("Nasıl Kullanılır?");
    setWebViewHtml(
      htmlSablonUret("Kullanım Rehberi", "Öğrenci Portalı", icerik)
    );
    setWebViewModalGorunur(true);
  };

  const acKullanimKosullari = () => {
    const icerik = `
      <div class="card">
        <p>Mikro AI platformuna hoş geldiniz. Bu belge, uygulamamızı kullanırken uyulması gereken kuralları ve veri güvenliği esaslarını içerir.</p>
      </div>

      <h2>🔒 Gizlilik ve Veri Güvenliği</h2>
      <p>Yüklediğiniz tüm fotoğraflar ve verileriniz uçtan uca şifreli sunucularda barındırılır. Verileriniz üçüncü taraflarla reklam veya pazarlama amacıyla paylaşılmaz.</p>

      <h2>⚡ Hizmet Limitleri</h2>
      <ul>
        <li>Standart kullanım günlük <span class="highlight">3 soru</span> ile sınırlıdır.</li>
        <li>Premium üyeler için sınır <span class="highlight">50 soru/gün</span> olarak belirlenmiştir.</li>
        <li>Bu limitler sunucu stabilitesini korumak adına uygulanmaktadır.</li>
      </ul>

      <h2>📋 Sorumluluk Reddini Bildiririz</h2>
      <p>Yapay zeka çözümleri yüksek doğruluk oranına sahip olsa da, bu bir eğitim destek aracıdır. Sınav başarılarınızdaki nihai sorumluluk kullanıcıya aittir.</p>

      <h2>💎 Abonelik Şartları</h2>
      <p>Abonelikler ve ödeme işlemleri doğrudan App Store veya Play Store üzerinden yönetilir. İptal ve iade süreçleri ilgili mağaza politikalarına tabidir.</p>
    `;
    setWebViewBaslik("Kullanım Koşulları");
    setWebViewHtml(htmlSablonUret("Yasal Şartlar", "Hukuki Metin", icerik));
    setWebViewModalGorunur(true);
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

  const seviyeIcinGerekenXP = 1000;
  const mevcutSeviyeXP = kullaniciPuan % seviyeIcinGerekenXP;
  const ilerlemeYuzdesi = (mevcutSeviyeXP / seviyeIcinGerekenXP) * 100;

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

  const getModalButonStil = (mod) => {
    const isSelected = temaModu === mod;

    if (mod === "light") {
      const bgColor = isSelected ? tema.anaButon : "transparent";
      const textColor = isSelected ? "#fff" : tema.metin;
      const borderColor = isSelected ? "transparent" : tema.kutuCerceve;
      return { bgColor, textColor, borderColor, isSelected };
    }

    const bgColor = isSelected ? tema.metin : "transparent";
    const textColor = isSelected ? tema.arkaplan : tema.metin;
    const borderColor = isSelected ? "transparent" : tema.kutuCerceve;
    return { bgColor, textColor, borderColor, isSelected };
  };

  return (
    <View style={[styles.container, { backgroundColor: tema.arkaplan }]}>
      {/* 🚀 DÜZELTME: Sadece sayfa odaktaysa StatusBar devreye girer. Rengini de Gerçek Karanlık olup olmamasına göre belirler. */}
      {isFocused && (
        <StatusBar
          barStyle={isGercektenKaranlik ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent={true}
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: tema.anaButon,
              paddingTop: insets.top + 20,
              paddingBottom: 35,
            },
          ]}
        >
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
              style={[
                styles.kameraIkonKutu,
                { backgroundColor: tema.anaButon },
              ]}
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

          <View style={styles.isimDuzenlemeKutu}>
            {isimDuzenleniyor ? (
              <View style={styles.isimInputKapsayici}>
                <TextInput
                  style={styles.isimInput}
                  value={adSoyad}
                  onChangeText={setAdSoyad}
                  autoFocus={true}
                  placeholder="İsminiz"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  onSubmitEditing={isimKaydet}
                  returnKeyType="done"
                  selectionColor="#fff"
                />
                <TouchableOpacity
                  onPress={isimKaydet}
                  style={styles.isimOnayButon}
                >
                  <Ionicons name="checkmark-circle" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 4,
                }}
                onPress={() => setIsimDuzenleniyor(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.userName}>
                  {adSoyad || user?.email?.split("@")[0]}
                </Text>
                <View style={{ marginLeft: 8 }}>
                  <Ionicons
                    name="pencil"
                    size={22}
                    color="rgba(255,255,255,0.9)"
                  />
                </View>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.userEmail}>{user?.email}</Text>

          {rol === "ogrenci" && (
            <View
              style={{
                alignItems: "center",
                width: "100%",
                paddingHorizontal: 40,
                marginTop: 15,
              }}
            >
              <View style={styles.seviyeVeXpKapsayici}>
                <Text style={styles.seviyeYazisi}>
                  Seviye {kullaniciSeviye}
                </Text>
                <View style={styles.xpKutusu}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.xpYazisi}>{kullaniciPuan} XP</Text>
                </View>
              </View>
              <View style={styles.xpBarArkaplan}>
                <View
                  style={[styles.xpBarDolu, { width: `${ilerlemeYuzdesi}%` }]}
                />
              </View>
              <Text style={styles.xpKalanYazi}>
                Sonraki seviyeye {seviyeIcinGerekenXP - mevcutSeviyeXP} XP kaldı
              </Text>
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
                style={{ marginBottom: 25 }}
              >
                {rozetler.map((rozet) => (
                  <View
                    key={rozet.id}
                    style={[
                      styles.rozetKutu,
                      {
                        backgroundColor: rozet.kazanildi
                          ? isGercektenKaranlik
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
                      style={[
                        styles.rozetAciklama,
                        { color: tema.ikincilMetin },
                      ]}
                    >
                      {rozet.aciklama}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          {rol === "ogrenci" && (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: tema.metin, marginTop: 5 },
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
                    {kalanSoru} / {maxKota}
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
                        width: `${(kalanSoru / maxKota) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setSinifModalGorunur(true)}
                style={[
                  styles.menuItem,
                  { backgroundColor: tema.kutuArkaplan },
                ]}
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
                style={[
                  styles.menuItem,
                  { backgroundColor: tema.kutuArkaplan },
                ]}
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
            style={[styles.sectionTitle, { color: tema.metin, marginTop: 25 }]}
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

          <View
            style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
          >
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
            style={[styles.sectionTitle, { color: tema.metin, marginTop: 25 }]}
          >
            Destek ve Bilgi
          </Text>

          <TouchableOpacity
            onPress={uygulamayiPaylas}
            style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Ionicons
              name="share-social-outline"
              size={22}
              color={tema.metin}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuBaslik, { color: tema.metin }]}>
              Uygulamayı Paylaş
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={bizeUlasin}
            style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Ionicons
              name="mail-outline"
              size={22}
              color={tema.metin}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuBaslik, { color: tema.metin }]}>
              Bize Ulaşın / Hata Bildir
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={acNasilKullanilir}
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
            onPress={acKullanimKosullari}
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

          <View style={{ alignItems: "center", marginTop: 15 }}>
            <Text style={{ color: tema.ikincilMetin, fontSize: 13 }}>
              Versiyon 1.0.2
            </Text>
          </View>

          <Text
            style={[styles.sectionTitle, { color: tema.metin, marginTop: 30 }]}
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
            onPress={() => setHesapSilModalGorunur(true)}
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
          <Pressable
            style={styles.modalArkaplan}
            onPress={() => setSinifModalGorunur(false)}
          >
            <Pressable
              style={[styles.modalKutu, { backgroundColor: tema.kutuArkaplan }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.modalBaslik, { color: tema.metin }]}>
                Sınıfını Güncelle
              </Text>
              <ScrollView
                style={{ maxHeight: 350 }}
                showsVerticalScrollIndicator={false}
              >
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
                <Text
                  style={{
                    color: tema.hataKirmizi,
                    fontWeight: "bold",
                    fontSize: 16,
                  }}
                >
                  Kapat
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={temaModalGorunur}
          animationType="slide"
          transparent={true}
        >
          <Pressable
            style={styles.bottomSheetArkaplan}
            onPress={() => setTemaModalGorunur(false)}
          >
            <Pressable
              style={[
                styles.bottomSheetKutu,
                {
                  backgroundColor: isGercektenKaranlik
                    ? "#1C1C1E"
                    : tema.kutuArkaplan,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text
                style={[
                  styles.modalBaslik,
                  {
                    color: tema.metin,
                    fontSize: 20,
                    marginBottom: 25,
                    marginTop: 5,
                  },
                ]}
              >
                Görünüm Tercihi
              </Text>

              <TouchableOpacity
                style={[
                  styles.temaKarti,
                  {
                    backgroundColor: getModalButonStil("light").bgColor,
                    borderColor: getModalButonStil("light").borderColor,
                  },
                ]}
                onPress={() => {
                  temaDegistir("light");
                  setTemaModalGorunur(false);
                }}
              >
                <Ionicons
                  name={temaModu === "light" ? "sunny" : "sunny-outline"}
                  size={22}
                  color={getModalButonStil("light").textColor}
                  style={{ marginRight: 15 }}
                />
                <Text
                  style={[
                    styles.temaKartiYazi,
                    {
                      color: getModalButonStil("light").textColor,
                      fontWeight: getModalButonStil("light").isSelected
                        ? "800"
                        : "500",
                    },
                  ]}
                >
                  Açık Mod
                </Text>
                {temaModu === "light" && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={getModalButonStil("light").textColor}
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.temaKarti,
                  {
                    backgroundColor: getModalButonStil("dark").bgColor,
                    borderColor: getModalButonStil("dark").borderColor,
                  },
                ]}
                onPress={() => {
                  temaDegistir("dark");
                  setTemaModalGorunur(false);
                }}
              >
                <Ionicons
                  name={temaModu === "dark" ? "moon" : "moon-outline"}
                  size={22}
                  color={getModalButonStil("dark").textColor}
                  style={{ marginRight: 15 }}
                />
                <Text
                  style={[
                    styles.temaKartiYazi,
                    {
                      color: getModalButonStil("dark").textColor,
                      fontWeight: getModalButonStil("dark").isSelected
                        ? "800"
                        : "500",
                    },
                  ]}
                >
                  Koyu Mod
                </Text>
                {temaModu === "dark" && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={getModalButonStil("dark").textColor}
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.temaKarti,
                  {
                    backgroundColor: getModalButonStil("system").bgColor,
                    borderColor: getModalButonStil("system").borderColor,
                  },
                ]}
                onPress={() => {
                  temaDegistir("system");
                  setTemaModalGorunur(false);
                }}
              >
                <Ionicons
                  name={
                    temaModu === "system"
                      ? "phone-portrait"
                      : "phone-portrait-outline"
                  }
                  size={22}
                  color={getModalButonStil("system").textColor}
                  style={{ marginRight: 15 }}
                />
                <Text
                  style={[
                    styles.temaKartiYazi,
                    {
                      color: getModalButonStil("system").textColor,
                      fontWeight: getModalButonStil("system").isSelected
                        ? "800"
                        : "500",
                    },
                  ]}
                >
                  Sistem Ayarı
                </Text>
                {temaModu === "system" && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={getModalButonStil("system").textColor}
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setTemaModalGorunur(false)}
                style={styles.modalKapatButon}
              >
                <Text
                  style={{
                    color: tema.ikincilMetin,
                    fontWeight: "bold",
                    fontSize: 16,
                  }}
                >
                  Vazgeç
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={webViewModalGorunur}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setWebViewModalGorunur(false)}
        >
          <View style={styles.webViewModalOverlay}>
            <View
              style={[
                styles.webViewContainer,
                { backgroundColor: tema.arkaplan },
              ]}
            >
              <View
                style={[
                  styles.webViewHeader,
                  { borderBottomColor: tema.kutuCerceve },
                ]}
              >
                <Text
                  style={[styles.webViewHeaderBaslik, { color: tema.metin }]}
                >
                  {webViewBaslik}
                </Text>
                <TouchableOpacity
                  onPress={() => setWebViewModalGorunur(false)}
                  style={styles.webViewKapatButon}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="close-circle"
                    size={32}
                    color={tema.ikincilMetin}
                  />
                </TouchableOpacity>
              </View>
              <WebView
                originWhitelist={["*"]}
                source={{ html: webViewHtml }}
                style={{ flex: 1, backgroundColor: tema.arkaplan }}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Modal>

        <Modal
          visible={hesapSilModalGorunur}
          animationType="slide"
          transparent={true}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalArkaplan}
          >
            <View
              style={[styles.modalKutu, { backgroundColor: tema.kutuArkaplan }]}
            >
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                <Ionicons name="warning" size={48} color={tema.hataKirmizi} />
              </View>

              <Text style={[styles.modalBaslik, { color: tema.metin }]}>
                Hesabı Kalıcı Olarak Sil
              </Text>

              <Text
                style={{
                  color: tema.ikincilMetin,
                  textAlign: "center",
                  marginBottom: 20,
                  lineHeight: 22,
                }}
              >
                Tüm çözülen sorularınız, hata defteriniz ve istatistikleriniz
                kalıcı olarak silinecektir. Bu işlem{" "}
                <Text style={{ fontWeight: "bold", color: tema.metin }}>
                  geri alınamaz.
                </Text>
              </Text>

              <Text
                style={{
                  color: tema.metin,
                  fontWeight: "600",
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                Onaylamak için aşağıya SİL yazın:
              </Text>

              <TextInput
                style={[
                  styles.silInput,
                  {
                    backgroundColor: tema.arkaplan,
                    color: tema.hataKirmizi,
                    borderColor:
                      silOnayMetni === "SİL"
                        ? tema.hataKirmizi
                        : tema.kutuCerceve,
                  },
                ]}
                placeholder="SİL"
                placeholderTextColor={tema.ikincilMetin}
                autoCapitalize="characters"
                value={silOnayMetni}
                onChangeText={setSilOnayMetni}
              />

              <View style={styles.modalButonSatir}>
                <TouchableOpacity
                  onPress={() => {
                    setHesapSilModalGorunur(false);
                    setSilOnayMetni("");
                  }}
                  style={styles.modalIptalButon}
                >
                  <Text
                    style={{
                      color: tema.ikincilMetin,
                      fontWeight: "bold",
                      fontSize: 16,
                    }}
                  >
                    Vazgeç
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={guvenliHesabiSil}
                  disabled={silOnayMetni !== "SİL" || hesapSiliniyor}
                  style={[
                    styles.modalOnayButon,
                    {
                      backgroundColor:
                        silOnayMetni === "SİL"
                          ? tema.hataKirmizi
                          : tema.kutuCerceve,
                    },
                  ]}
                >
                  {hesapSiliniyor ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text
                      style={{
                        color:
                          silOnayMetni === "SİL" ? "#fff" : tema.ikincilMetin,
                        fontWeight: "bold",
                        fontSize: 16,
                      }}
                    >
                      Hesabımı Sil
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
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

  isimDuzenlemeKutu: {
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  isimInputKapsayici: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  isimInput: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
    minWidth: 120,
    maxWidth: 200,
    textAlign: "center",
    padding: 0,
    margin: 0,
  },
  isimOnayButon: {
    marginLeft: 10,
  },

  userName: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  userEmail: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 15,
  },

  seviyeVeXpKapsayici: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
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

  xpBarArkaplan: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    marginTop: 15,
    overflow: "hidden",
  },
  xpBarDolu: {
    height: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 3,
  },
  xpKalanYazi: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "500",
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    letterSpacing: 0.3,
  },

  rozetKutu: {
    width: 105,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    marginRight: 12,
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
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  streakIkon: { fontSize: 32, marginRight: 15 },
  streakBaslik: { fontSize: 17, fontWeight: "bold" },
  streakAltYazi: { fontSize: 12, marginTop: 2 },

  kutu: { padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1 },
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
    borderRadius: 16,
    marginBottom: 12,
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
  modalKutu: { borderRadius: 24, padding: 25, width: "100%" },
  modalBaslik: {
    fontSize: 19,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  modalSecenek: { paddingVertical: 16, borderBottomWidth: 0.5 },
  modalSecenekYazi: { fontSize: 16, textAlign: "center" },
  modalKapatButon: { marginTop: 25, padding: 10, alignItems: "center" },

  silInput: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 15,
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 3,
    marginBottom: 10,
  },
  modalButonSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  modalIptalButon: { padding: 15, flex: 1, alignItems: "center" },
  modalOnayButon: {
    padding: 15,
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
  },

  bottomSheetArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheetKutu: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: Platform.OS === "ios" ? 45 : 30,
  },
  temaKarti: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  temaKartiYazi: {
    fontSize: 16,
  },

  webViewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  webViewContainer: {
    width: "100%",
    height: "90%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
  webViewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  webViewHeaderBaslik: {
    fontSize: 18,
    fontWeight: "bold",
  },
  webViewKapatButon: {
    padding: 2,
  },
});
