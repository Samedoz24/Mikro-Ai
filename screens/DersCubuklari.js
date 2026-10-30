import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { YONETICI_RENGI } from "../utils/useYoneticiYetkisi";

// Ders dağılımı çubukları. dersler: [{ ders, adet, yuzde }], çoktan aza sıralı.
export default function DersCubuklari({ dersler, tema, bosMetin }) {
  if (dersler.length === 0) {
    return (
      <Text style={[styles.bos, { color: tema.ikincilMetin }]}>{bosMetin}</Text>
    );
  }

  return dersler.map((ders) => (
    <View key={ders.ders} style={{ marginBottom: 12 }}>
      <View style={styles.ustSatir}>
        <Text style={[styles.ad, { color: tema.metin }]}>{ders.ders}</Text>
        <Text style={[styles.sayi, { color: tema.ikincilMetin }]}>
          {ders.adet} soru · %{ders.yuzde}
        </Text>
      </View>
      <View style={[styles.arkaplan, { backgroundColor: tema.kutuCerceve }]}>
        <View
          style={[
            styles.dolu,
            { backgroundColor: YONETICI_RENGI, width: `${ders.yuzde}%` },
          ]}
        />
      </View>
    </View>
  ));
}

const styles = StyleSheet.create({
  bos: { fontSize: 13, lineHeight: 19 },
  ustSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  ad: { fontSize: 14, fontWeight: "500" },
  sayi: { fontSize: 13 },
  arkaplan: { height: 6, borderRadius: 4, width: "100%" },
  dolu: { height: "100%", borderRadius: 4 },
});
