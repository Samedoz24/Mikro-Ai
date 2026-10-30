import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { YONETICI_RENGI } from "../utils/useYoneticiYetkisi";

// En çok sorulan konular. konular: [{ ders, konu, adet }], çoktan aza sıralı; ilk `sinir` tanesi gösterilir.
export default function KonuListesi({ konular, tema, sinir = 8, bosMetin }) {
  if (konular.length === 0) {
    return (
      <Text style={[styles.bos, { color: tema.ikincilMetin }]}>{bosMetin}</Text>
    );
  }

  return konular.slice(0, sinir).map((k, i) => (
    <View
      key={`${k.ders}|${k.konu}`}
      style={[
        styles.satir,
        i > 0 && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: tema.kutuCerceve,
        },
      ]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.konu, { color: tema.metin }]} numberOfLines={2}>
          {k.konu}
        </Text>
        <Text style={[styles.ders, { color: tema.ikincilMetin }]}>
          {k.ders}
        </Text>
      </View>
      <Text style={[styles.adet, { color: YONETICI_RENGI }]}>{k.adet}</Text>
    </View>
  ));
}

const styles = StyleSheet.create({
  bos: { fontSize: 13, lineHeight: 19 },
  satir: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  konu: { fontSize: 14, fontWeight: "600" },
  ders: { fontSize: 12, marginTop: 2 },
  adet: { fontSize: 18, fontWeight: "900" },
});
