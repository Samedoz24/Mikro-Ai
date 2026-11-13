// Yeni rozet kutlaması: ekranın üstünden kayarak gelen kart.
// Sistem uyarısı (Alert) yerine kullanılır: iOS'ta bir pencere kapanırken açılan uyarı görünmeden
// kaybolabiliyordu (ör. sınıf seçme penceresi kapanırken kazanılan rozet). Kart pencerelerden bağımsızdır.
// Sırayla gösterilir: aynı anda birden fazla rozet kazanılırsa tek kartta listelenir.

import React, { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../ThemeContext";
import { colors } from "../theme";

const GORUNME_SURESI_MS = 4000;

export default function RozetKutlama({ rozetler, bitti }) {
  const { tema } = useTheme();
  const insets = useSafeAreaInsets();
  const karanlik = tema.arkaplan === colors.dark.arkaplan;
  const konum = useRef(new Animated.Value(-200)).current;
  const zamanlayici = useRef(null);
  const gorunur = Array.isArray(rozetler) && rozetler.length > 0;

  const kapat = () => {
    clearTimeout(zamanlayici.current);
    Animated.timing(konum, { toValue: -200, duration: 220, useNativeDriver: true }).start(() => bitti());
  };

  useEffect(() => {
    if (!gorunur) return undefined;
    konum.setValue(-200);
    Animated.spring(konum, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }).start();
    zamanlayici.current = setTimeout(kapat, GORUNME_SURESI_MS);
    return () => clearTimeout(zamanlayici.current);
    // Yalnızca yeni bir rozet grubu geldiğinde çalışır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rozetler]);

  if (!gorunur) return null;

  const baslik = rozetler.length > 1 ? "Yeni rozetler kazandın!" : "Yeni rozet kazandın!";

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[stiller.kap, { top: insets.top + 8, transform: [{ translateY: konum }] }]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={kapat}
        accessibilityRole="alert"
        accessibilityLabel={`${baslik} ${rozetler.map((r) => r.baslik).join(", ")}`}
        accessibilityHint="Kapatmak için dokun"
        style={[
          stiller.kart,
          {
            backgroundColor: karanlik ? "#1C1C1E" : "#FFFFFF",
            borderColor: tema.premiumAltin,
          },
        ]}
      >
        <Text style={stiller.kupa}>🏆</Text>
        <View style={{ flex: 1 }}>
          <Text style={[stiller.baslik, { color: tema.metin }]}>{baslik}</Text>
          {rozetler.map((r) => (
            <Text key={r.id} style={[stiller.satir, { color: tema.ikincilMetin }]} numberOfLines={1}>
              {r.ikon} <Text style={{ color: tema.metin, fontWeight: "700" }}>{r.baslik}</Text> · {r.aciklama}
            </Text>
          ))}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const stiller = StyleSheet.create({
  kap: { position: "absolute", left: 16, right: 16, zIndex: 1000, elevation: 10 },
  kart: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    // Android gölgesi (shadow* özellikleri yalnızca iOS'ta çalışır)
    elevation: 8,
  },
  kupa: { fontSize: 30, marginRight: 12 },
  baslik: { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  satir: { fontSize: 13, lineHeight: 19 },
});
