import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeContext";
import { colors } from "../theme";
import { htmlSablonUret, KULLANIM_KOSULLARI_ICERIK, YONETICI_KOSULLARI_ICERIK } from "../utils/yasalMetinler";
import { kosullarBasligi } from "../utils/onayMetni";

// Kullanım Koşulları penceresi: giriş/kayıt ekranı ve onay ekranı (YasOnayScreen) ortak kullanır.
// İçerik uygulamaya gömülü metindir (dış bir sayfa yüklenmez; WebView yalnızca bu HTML'i gösterir).
export default function KosullarPenceresi({ gorunur, kapat, rol }) {
  const { tema } = useTheme();
  const insets = useSafeAreaInsets();
  const isKaranlik = tema.arkaplan === colors.dark.arkaplan;
  const yoneticiMi = rol === "yonetici";

  return (
    <Modal
      visible={gorunur}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={kapat}
      onDismiss={kapat}
    >
      {/* Modal, güvenli alan bağlamının dışında çizildiği için boşluklar elle verilir */}
      <View
        style={{
          flex: 1,
          // WebView'ın içindeki şablonla aynı renk; alt boşlukta renk farkı oluşmaz
          backgroundColor: isKaranlik ? "#121212" : "#FFFFFF",
          paddingTop: Platform.OS === "android" ? insets.top : 0,
          paddingBottom: insets.bottom,
        }}
      >
        <View style={[styles.baslik, { borderBottomColor: tema.kutuCerceve, backgroundColor: tema.arkaplan }]}>
          <Text style={[styles.baslikYazi, { color: tema.metin }]} accessibilityRole="header">
            {kosullarBasligi(rol)}
          </Text>
          <TouchableOpacity
            onPress={kapat}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            style={styles.kapat}
          >
            <Ionicons name="close-circle" size={32} color={tema.ikincilMetin} />
          </TouchableOpacity>
        </View>
        <WebView
          originWhitelist={["*"]}
          source={{
            html: htmlSablonUret(
              isKaranlik,
              "Yasal Şartlar",
              "Hukuki Metin",
              yoneticiMi ? YONETICI_KOSULLARI_ICERIK : KULLANIM_KOSULLARI_ICERIK
            ),
          }}
          // Yalnızca gömülü metin gösterilir: metindeki olası bir bağlantı pencere içinde başka sayfaya gidemez
          onShouldStartLoadWithRequest={(istek) => istek.url === "about:blank" || istek.url.startsWith("data:")}
          javaScriptEnabled={false}
          style={{ flex: 1, backgroundColor: isKaranlik ? "#121212" : "#FFFFFF" }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  baslik: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  baslikYazi: { fontSize: 18, fontWeight: "700" },
  kapat: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
