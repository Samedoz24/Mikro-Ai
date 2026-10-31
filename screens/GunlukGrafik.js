import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { YONETICI_RENGI } from "../utils/useYoneticiYetkisi";

const YUKSEKLIK = 90;

// Günlük soru sayısı sütun grafiği. gunler: [{ anahtar: "YYYY-MM-DD", adet }], eskiden yeniye.
export default function GunlukGrafik({ gunler, tema }) {
  const enYuksek = Math.max(1, ...gunler.map((g) => g.adet));
  // 30 gün gibi çok sütunlu görünümde sayılar ve gün etiketleri sığmaz: seyrekleştirilir
  const yogun = gunler.length > 16;

  return (
    <View style={styles.grafik}>
      {gunler.map((gun, i) => (
        <View key={gun.anahtar} style={styles.sutun}>
          <Text style={[styles.sayi, { color: tema.ikincilMetin }]}>
            {!yogun && gun.adet > 0 ? gun.adet : ""}
          </Text>
          <View
            style={[
              styles.cubuk,
              {
                height: Math.max(
                  gun.adet > 0 ? 6 : 3,
                  (gun.adet / enYuksek) * YUKSEKLIK
                ),
                backgroundColor:
                  gun.adet > 0 ? YONETICI_RENGI : tema.kutuCerceve,
              },
            ]}
          />
          <Text
            numberOfLines={1}
            style={[styles.gun, { color: tema.ikincilMetin }]}
          >
            {!yogun || (gunler.length - 1 - i) % 5 === 0
              ? Number(gun.anahtar.slice(8))
              : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grafik: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: YUKSEKLIK + 40,
  },
  sutun: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  sayi: {
    fontSize: 10,
    marginBottom: 2,
    height: 14,
    width: 28,
    textAlign: "center",
  },
  cubuk: { width: "60%", borderRadius: 3, minWidth: 2 },
  // Etiket dar sütundan geniştir; ortalanıp iki yana taşar, alt satıra kırılmaz
  gun: { fontSize: 10, marginTop: 4, width: 28, textAlign: "center" },
});
