import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native"; // useColorScheme sildik, artık kendi temamızı kullanacağız
import { auth } from "./firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 🧭 Navigasyon Paketleri
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

// 🎨 İkon Kütüphanesi Eklendi
import { Ionicons } from "@expo/vector-icons";

// 🌗 TEMA YÖNETİCİSİ (Yeni Eklenen Kısım)
import { ThemeProvider, useTheme } from "./ThemeContext";

// 📄 Sayfalarımız
import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import HistoryScreen from "./screens/HistoryScreen";
import ParentDashboard from "./screens/ParentDashboard";

const Tab = createBottomTabNavigator();

// 🧠 Ana Uygulama Gövdesi (Temayı okuyabilmesi için ayırdık)
function MainApp() {
  const [kullanici, setKullanici] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kullaniciRolu, setKullaniciRolu] = useState("ogrenci");

  // 🚀 ÇÖZÜM: Artık telefonun değil, uygulamanın kendi global temasını dinliyoruz
  const { tema } = useTheme();

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
          backgroundColor: tema.arkaplan, // Temadan otomatik gelir
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

// 🚀 EN ÜST KATMAN: Uygulamayı Tema Dağıtıcısı ile sarmalıyoruz
export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
