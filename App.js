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

import { ThemeProvider, useTheme } from "./ThemeContext";
import { sendQuestionSolvedNotification } from "./utils/notificationManager";

// 📄 Sayfalarımız
import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import HistoryScreen from "./screens/HistoryScreen";
import ParentDashboard from "./screens/ParentDashboard";
import OnboardingScreen from "./screens/OnboardingScreen";

const Tab = createBottomTabNavigator();

function MainApp() {
  const [kullanici, setKullanici] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kullaniciRolu, setKullaniciRolu] = useState("ogrenci");
  const [gosterOnboarding, setGosterOnboarding] = useState(false);
  const [okunmamisSayisi, setOkunmamisSayisi] = useState(0);

  const { tema } = useTheme();

  // 🚪 Akıllı Kapı Bekçisi (Gatekeeper)
  useEffect(() => {
    const abonelik = onAuthStateChanged(auth, async (aktifKullanici) => {
      if (aktifKullanici) {
        // 🚀 DÜZELTME: Buradaki "setYukleniyor(true);" komutu SİLİNDİ.
        // Artık Firebase verileri çekerken kullanıcıyı kaba bir şekilde boş sayfaya atmayacak!

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

            setKullaniciRolu(gercekRol);
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

            setKullaniciRolu(yeniRol);
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
      // Sadece uygulamanın ilk açılışındaki siyah ekranı kaldırmak için false yapıyoruz
      setYukleniyor(false);
    });

    return () => abonelik();
  }, []);

  // 🤖 Arka Planda Soru Çözümü ve Bildirim Bekçisi
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

  if (gosterOnboarding) {
    return <OnboardingScreen onTamamla={() => setGosterOnboarding(false)} />;
  }

  return (
    <NavigationContainer>
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
          headerTitleAlign: "center",
          tabBarActiveTintColor: tema.anaButon,
          tabBarInactiveTintColor: tema.ikincilMetin,
          tabBarStyle: {
            backgroundColor: tema.kutuArkaplan,
            borderTopColor: tema.kutuCerceve,
          },
          headerStyle: {
            backgroundColor: tema.kutuArkaplan,
            borderBottomColor: tema.kutuCerceve,
            borderBottomWidth: 1,
          },
          headerTintColor: tema.metin,
          headerTitleStyle: { fontWeight: "bold" },
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
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
