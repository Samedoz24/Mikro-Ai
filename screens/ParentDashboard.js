import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  TouchableOpacity,
} from "react-native";
import { colors } from "../theme";

export default function ParentDashboard() {
  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  return (
    <ScrollView style={[styles.container, { backgroundColor: tema.arkaplan }]}>
      {/* Üst Bilgi Alanı */}
      <View style={styles.header}>
        <Text style={[styles.baslik, { color: tema.metin }]}>
          Öğrenci Gelişim Raporu
        </Text>
        <Text style={{ color: tema.ikincilMetin }}>
          Bu hafta harika bir ilerleme var! 🚀
        </Text>
      </View>

      {/* İstatistik Kartları */}
      <View style={styles.istatistikKutusu}>
        <View
          style={[
            styles.kart,
            {
              backgroundColor: tema.kutuArkaplan,
              borderColor: tema.kutuCerceve,
            },
          ]}
        >
          <Text style={[styles.kartSayi, { color: tema.anaButon }]}>103</Text>
          <Text style={[styles.kartYazi, { color: tema.ikincilMetin }]}>
            Bu Hafta Çözülen
          </Text>
        </View>
        <View
          style={[
            styles.kart,
            {
              backgroundColor: tema.kutuArkaplan,
              borderColor: tema.kutuCerceve,
            },
          ]}
        >
          <Text style={[styles.kartSayi, { color: tema.aiButon }]}>%85</Text>
          <Text style={[styles.kartYazi, { color: tema.ikincilMetin }]}>
            Başarı Oranı
          </Text>
        </View>
      </View>

      {/* Son Etkinlikler */}
      <Text style={[styles.altBaslik, { color: tema.metin }]}>
        Son Çözülenler
      </Text>
      {[1, 2].map((item, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.listeElemani,
            {
              backgroundColor: tema.kutuArkaplan,
              borderColor: tema.kutuCerceve,
            },
          ]}
        >
          <View>
            <Text style={[styles.listeBaslik, { color: tema.metin }]}>
              Matematik - Türev
            </Text>
            <Text
              style={{ color: tema.ikincilMetin, fontSize: 12, marginTop: 4 }}
            >
              Bugün
            </Text>
          </View>
          <View
            style={[
              styles.durumKutusu,
              { backgroundColor: tema.aiButon + "20" },
            ]}
          >
            <Text style={{ color: tema.aiButon, fontWeight: "bold" }}>
              Doğru Çözüldü
            </Text>
          </View>
        </TouchableOpacity>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 20, marginTop: 10 },
  baslik: { fontSize: 24, fontWeight: "bold", marginBottom: 5 },
  istatistikKutusu: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  kart: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginHorizontal: 5,
  },
  kartSayi: { fontSize: 24, fontWeight: "bold", marginBottom: 5 },
  kartYazi: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  altBaslik: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  listeElemani: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  listeBaslik: { fontSize: 16, fontWeight: "600" },
  durumKutusu: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
});
