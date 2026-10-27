import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { auth, db } from "./firebaseConfig";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider, useTheme } from "./ThemeContext";

import {
  sendQuestionSolvedNotification,
  registerForPushNotificationsAsync,
  setupSmartNotifications,
} from "./utils/notificationManager";

import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import HistoryScreen from "./screens/HistoryScreen";
import ParentDashboard from "./screens/ParentDashboard";
import OnboardingScreen from "./screens/OnboardingScreen";
import YasOnayScreen from "./screens/YasOnayScreen";
import { YAS_ONAYI_SURUMU } from "./utils/yasalMetinler";
import { PremiumProvider } from "./PremiumContext";

const Tab = createBottomTabNavigator();

function MainApp() {
  const [kullanici, setKullanici] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kullaniciRolu, setKullaniciRolu] = useState("ogrenci");
  const [gosterOnboarding, setGosterOnboarding] = useState(false);
  const [onayGerekli, setOnayGerekli] = useState(false);
  const [okunmamisSayisi, setOkunmamisSayisi] = useState(0);
  const [premiumMu, setPremiumMu] = useState(false);

  const { tema } = useTheme();

  useEffect(() => {
    const abonelik = onAuthStateChanged(auth, async (aktifKullanici) => {
      if (aktifKullanici) {
        try {
          const userDocRef = doc(db, "kullanicilar", aktifKullanici.uid);
          const userDoc = await getDoc(userDocRef);
          const hedefRol = await AsyncStorage.getItem("hedefRol");

          if (userDoc.exists()) {
            const gercekRol = userDoc.data().rol || "ogrenci";

            if (hedefRol && gercekRol !== hedefRol) {
              await signOut(auth);
              Alert.alert(
                "Hatalı Giriş ❌",
                `Bu e-posta adresi bir ${
                  gercekRol === "ogrenci" ? "Öğrenci" : "Veli"
                } hesabına ait. Lütfen doğru sekmeyi seçin.`
              );
              await AsyncStorage.removeItem("hedefRol");
              setKullanici(null);
              setYukleniyor(false);
              return;
            }

            const yasOnayi = userDoc.data().yasOnayi;
            setOnayGerekli(
              !(
                yasOnayi?.onaylandi === true &&
                (yasOnayi?.surum ?? 0) >= YAS_ONAYI_SURUMU
              )
            );

            setKullaniciRolu(gercekRol);
            setPremiumMu(userDoc.data().premiumMu === true);
            await AsyncStorage.setItem("kullaniciRolu", gercekRol);
            setGosterOnboarding(false);
          } else {
            const yeniRol = hedefRol || "ogrenci";
            await setDoc(
              userDocRef,
              {
                eposta: aktifKullanici.email,
                rol: yeniRol,
                kayitTarihi: new Date().toISOString(),
              },
              { merge: true }
            );

            setOnayGerekli(true);
            setKullaniciRolu(yeniRol);
            setPremiumMu(false);
            await AsyncStorage.setItem("kullaniciRolu", yeniRol);
            setGosterOnboarding(true);
          }

          await AsyncStorage.removeItem("hedefRol");
        } catch (e) {
          console.log("Kapı bekçisi hatası:", e);
        }

        setKullanici(aktifKullanici);
      } else {
        setKullanici(null);
      }
      setYukleniyor(false);
    });

    return () => abonelik();
  }, []);

  // Premium durumu canlı izlenir: satın alma sonrası sunucu güncelleyince arayüz yenilenir
  useEffect(() => {
    if (!kullanici || onayGerekli) return;

    const abonelik = onSnapshot(
      doc(db, "kullanicilar", kullanici.uid),
      (snap) => setPremiumMu(snap.data()?.premiumMu === true),
      (hata) => console.log("Premium dinleme hatası:", hata?.code)
    );

    return () => abonelik();
  }, [kullanici, onayGerekli]);

  useEffect(() => {
    const bildirimleriKur = async () => {
      // Onay verilmeden bildirim izni istenmez
      if (!kullanici || onayGerekli) return;

      try {
        const bildirimAyar = await AsyncStorage.getItem("bildirimAktif");
        const aktif = bildirimAyar !== null ? JSON.parse(bildirimAyar) : true;

        if (aktif) {
          const izin = await registerForPushNotificationsAsync();
          if (izin) {
            await setupSmartNotifications(kullaniciRolu);
          }
        }
      } catch (error) {
        console.log("Bildirim kurulum hatası:", error);
      }
    };

    bildirimleriKur();
  }, [kullanici, kullaniciRolu, onayGerekli]);

  useEffect(() => {
    if (!kullanici || kullaniciRolu !== "ogrenci") return;

    const q = query(
      collection(db, "sorular"),
      where("kullaniciEposta", "==", kullanici.email)
    );

    const abonelik = onSnapshot(q, (snapshot) => {
      let okunmamisAdet = 0;
      snapshot.forEach((doc) => {
        const veri = doc.data();
        if (veri.durum === "Çözüldü" && veri.okunduMu !== true) {
          okunmamisAdet++;
        }
      });
      setOkunmamisSayisi(okunmamisAdet);

      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const veri = change.doc.data();
          if (veri.durum === "Çözüldü" && veri.okunduMu !== true) {
            const dersAdi = veri.subject || veri.ders || "";
            sendQuestionSolvedNotification(dersAdi);
          }
        }
      });
    });

    return () => abonelik();
  }, [kullanici, kullaniciRolu]);

  if (yukleniyor) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: tema.arkaplan,
        }}
      >
        <ActivityIndicator size="large" color={tema.anaButon} />
      </View>
    );
  }

  if (!kullanici) {
    return <LoginScreen setKullaniciRolu={setKullaniciRolu} />;
  }

  if (onayGerekli) {
    return (
      <YasOnayScreen
        kullanici={kullanici}
        rol={kullaniciRolu}
        onOnaylandi={() => setOnayGerekli(false)}
      />
    );
  }

  if (gosterOnboarding) {
    return <OnboardingScreen onTamamla={() => setGosterOnboarding(false)} />;
  }

  // 🚀 DÜZELTME: NavigationContainer buradan silindi, en dıştaki (ölümsüz) App bileşenine taşındı.
  return (
    <PremiumProvider premiumMu={premiumMu} rol={kullaniciRolu}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === "Ana Sayfa") {
              iconName = focused ? "camera" : "camera-outline";
            } else if (route.name === "Hata Defteri") {
              iconName = focused ? "book" : "book-outline";
            } else if (route.name === "Profil") {
              iconName = focused ? "person" : "person-outline";
            } else if (route.name === "Veli Paneli") {
              iconName = focused
                ? "shield-checkmark"
                : "shield-checkmark-outline";
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          headerShown: false,
          tabBarActiveTintColor: tema.anaButon,
          tabBarInactiveTintColor: tema.ikincilMetin,
          tabBarStyle: {
            backgroundColor: tema.kutuArkaplan,
            borderTopColor: tema.kutuCerceve,
          },
        })}
      >
        {kullaniciRolu === "ogrenci" ? (
          <>
            <Tab.Screen
              name="Ana Sayfa"
              component={HomeScreen}
              options={{ title: "Kamera" }}
            />
            <Tab.Screen
              name="Hata Defteri"
              component={HistoryScreen}
              options={{
                title: "Geçmiş Sorular",
                tabBarBadge: okunmamisSayisi > 0 ? okunmamisSayisi : null,
                tabBarBadgeStyle: {
                  backgroundColor: "#EF4444",
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: "bold",
                },
              }}
            />
            <Tab.Screen
              name="Profil"
              component={ProfileScreen}
              options={{ title: "Hesabım" }}
            />
          </>
        ) : (
          <>
            <Tab.Screen
              name="Veli Paneli"
              component={ParentDashboard}
              options={{ title: "Yönetim Paneli" }}
            />
            <Tab.Screen
              name="Profil"
              component={ProfileScreen}
              options={{ title: "Hesabım" }}
            />
          </>
        )}
      </Tab.Navigator>
    </PremiumProvider>
  );
}

// 🚀 MİMARİ DÜZELTME: NavigationContainer artık uygulamanın en tepesinde ve hiçbir zaman silinmeyecek.
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NavigationContainer>
          <MainApp />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
