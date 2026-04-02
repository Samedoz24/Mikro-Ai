import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  useColorScheme,
  Alert,
} from "react-native";
import { auth } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { colors } from "../theme";

export default function ProfileScreen() {
  const user = auth.currentUser;
  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  const cikisYap = () => {
    Alert.alert(
      "Çıkış",
      "Hesabınızdan çıkış yapmak istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        { text: "Evet", onPress: () => signOut(auth) },
      ]
    );
  };

  // İstatistik Kartı Bileşeni
  const StatCard = ({ label, value, icon }) => (
    <View style={[styles.statCard, { backgroundColor: tema.kutuArkaplan }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color: tema.metin }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: tema.ikincilMetin }]}>
        {label}
      </Text>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: tema.arkaplan }]}>
      {/* Üst Profil Alanı */}
      <View style={[styles.header, { backgroundColor: tema.anaButon }]}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.email?.split("@")[0]}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {/* İçerik Alanı */}
      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: tema.metin }]}>
          İstatistikler
        </Text>

        <View style={styles.statsGrid}>
          <StatCard label="Sorulan Soru" value="12" icon="📝" />
          <StatCard label="Çözülen Soru" value="8" icon="✅" />
          <StatCard label="Başarı Oranı" value="%75" icon="📈" />
        </View>

        <Text style={[styles.sectionTitle, { color: tema.metin }]}>
          Hesap Ayarları
        </Text>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
        >
          <Text style={styles.menuIcon}>🔔</Text>
          <Text style={[styles.menuText, { color: tema.metin }]}>
            Bildirim Ayarları
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
        >
          <Text style={styles.menuIcon}>🔒</Text>
          <Text style={[styles.menuText, { color: tema.metin }]}>
            Şifre Değiştir
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={cikisYap}
          style={[styles.logoutButton, { borderColor: tema.hataKirmizi }]}
        >
          <Text style={[styles.logoutText, { color: tema.hataKirmizi }]}>
            Oturumu Kapat
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingVertical: 40,
    alignItems: "center",
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  avatarText: { fontSize: 35, color: "#fff", fontWeight: "bold" },
  userName: { fontSize: 22, color: "#fff", fontWeight: "bold" },
  userEmail: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    marginTop: 10,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  statCard: {
    width: "30%",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  statIcon: { fontSize: 24, marginBottom: 5 },
  statValue: { fontSize: 18, fontWeight: "bold" },
  statLabel: { fontSize: 10, textAlign: "center" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  menuIcon: { fontSize: 20, marginRight: 15 },
  menuText: { fontSize: 16, fontWeight: "500" },
  logoutButton: {
    marginTop: 30,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 40,
  },
  logoutText: { fontSize: 16, fontWeight: "bold" },
});
