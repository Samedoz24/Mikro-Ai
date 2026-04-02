import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, useColorScheme } from "react-native";
import { auth } from "./firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🧭 Navigasyon Paketleri
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

// 🎨 Renkler
import { colors } from "./theme";

// 📄 Sayfalarımız
import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import HistoryScreen from "./screens/HistoryScreen";
import ParentDashboard from "./screens/ParentDashboard";

const Tab = createBottomTabNavigator();

export default function App() {
  const [kullanici, setKullanici] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kullaniciRolu, setKullaniciRolu] = useState("ogrenci");

  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  useEffect(() => {
    const abonelik = onAuthStateChanged(auth, async (aktifKullanici) => {
      if (aktifKullanici) {
        try {
          const kayitliRol = await AsyncStorage.getItem("kullaniciRolu");
          if (kayitliRol) {
            setKullaniciRolu(kayitliRol);
          }
        } catch (e) {
          console.log("Hafızadan rol okuma hatası:", e);
        }
        setKullanici(aktifKullanici);
      } else {
        setKullanici(null);
      }
      setYukleniyor(false);
    });
    return () => abonelik();
  }, []);

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

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
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
        }}
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
              options={{ title: "Geçmiş Sorular" }}
            />
            <Tab.Screen
              name="Profil"
              component={ProfileScreen}
              options={{ title: "Hesabım" }}
            />
          </>
        ) : (
          <>
            {/* Veli için iki sekme: Yönetim Paneli ve Profil */}
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
