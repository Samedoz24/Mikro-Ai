// Alttan açılan ortak pencere (bottom sheet): tutamaç, başlık, açıklama, güvenli alt boşluk.
// Hesabım ekranındaki seçim pencereleri bu kabuğu kullanır; böylece hepsi aynı görünür ve davranır.

import React from "react";
import { Modal, Pressable, View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../ThemeContext";
import { colors } from "../theme";

// kaydirmaRef verilirse içerik kaydırılabilir olur (klavyeli pencereler: odaklanan kutu görünür tutulur)
export default function AltPencere({ gorunur, kapat, baslik, aciklama, children, kapatilabilir = true, kaydirmaRef }) {
  const { tema } = useTheme();
  const insets = useSafeAreaInsets();
  const karanlik = tema.arkaplan === colors.dark.arkaplan;
  const kapatIstegi = () => {
    if (kapatilabilir) kapat();
  };

  return (
    <Modal visible={gorunur} animationType="slide" transparent onRequestClose={kapatIstegi} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable style={stiller.arkaplan} onPress={kapatIstegi} accessibilityLabel="Kapat">
        <Pressable
          style={[
            stiller.kutu,
            {
              backgroundColor: karanlik ? "#1C1C1E" : "#FFFFFF",
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
          onPress={() => {}}
          accessible={false}
        >
          <View style={[stiller.tutamac, { backgroundColor: tema.kutuCerceve }]} />
          {!!baslik && (
            <Text style={[stiller.baslik, { color: tema.metin }]} accessibilityRole="header">
              {baslik}
            </Text>
          )}
          {!!aciklama && <Text style={[stiller.aciklama, { color: tema.ikincilMetin }]}>{aciklama}</Text>}
          {kaydirmaRef ? (
            <ScrollView
              ref={kaydirmaRef}
              style={{ flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const stiller = StyleSheet.create({
  arkaplan: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  kutu: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "90%",
  },
  tutamac: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 16 },
  baslik: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  aciklama: { fontSize: 14, textAlign: "center", marginTop: 6, marginBottom: 20, lineHeight: 20 },
});
