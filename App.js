import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, Text, useColorScheme } from "react-native";
import { auth } from "./firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

// 🧭 Navigasyon Paketleri
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

// 🎨 KENDİ RENK SİSTEMİMİZİ İÇERİ AKTARIYORUZ
import { colors } from "./theme";

// 📄 Sayfalarımız
import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import HistoryScreen from "./screens/HistoryScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  const [kullanici, setKullanici] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  // 🌓 Temayı Algılama
  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  useEffect(() => {
    const abonelik = onAuthStateChanged(auth, (aktifKullanici) => {
      setKullanici(aktifKullanici);
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
    return <LoginScreen />;
  }

  // 🚀 NAVİGASYONA KENDİ RENKLERİMİZİ GİYDİRİYORUZ
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          // Seçili menü ikonunun rengi (Örn: Güven Mavisi)
          tabBarActiveTintColor: tema.anaButon,
          // Seçili olmayanların rengi
          tabBarInactiveTintColor: tema.ikincilMetin,

          // Alt Menünün Arka Plan Rengi
          tabBarStyle: {
            backgroundColor: tema.kutuArkaplan,
            borderTopColor: tema.kutuCerceve,
          },

          // Üst Başlığın (Header) Rengi
          headerStyle: {
            backgroundColor: tema.kutuArkaplan,
            borderBottomColor: tema.kutuCerceve,
            borderBottomWidth: 1,
          },
          // Üst Başlıktaki Yazıların Rengi
          headerTintColor: tema.metin,
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      >
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
      </Tab.Navigator>
    </NavigationContainer>
  );
}
