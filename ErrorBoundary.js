import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeContext";

// Arayüz çizilirken beklenmedik bir hata olursa uygulama kapanmak yerine bu ekranı gösterir.
// (Olay işleyicilerdeki ve asenkron hatalar ilgili yerlerde try/catch ile ele alınır;
// hata yakalayıcılar yalnızca çizim sırasındaki hataları yakalar.)
function HataEkrani({ hata, onYenidenDene }) {
  const { tema } = useTheme();

  return (
    <View style={[styles.kapsayici, { backgroundColor: tema.arkaplan }]}>
      <View style={[styles.ikonCember, { backgroundColor: tema.kutuArkaplan }]}>
        <Ionicons name="alert-circle-outline" size={48} color={tema.hataKirmizi} />
      </View>

      <Text style={[styles.baslik, { color: tema.metin }]} accessibilityRole="header">
        Bir Şeyler Ters Gitti
      </Text>
      <Text style={[styles.mesaj, { color: tema.ikincilMetin }]}>
        Beklenmedik bir sorun oluştu. Yeniden denemek genellikle çözer. Sorun
        sürerse uygulamayı kapatıp tekrar aç.
      </Text>

      {__DEV__ && hata?.message ? (
        <Text style={[styles.gelistirici, { color: tema.ikincilMetin }]} numberOfLines={6}>
          {String(hata.message)}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={onYenidenDene}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={[styles.buton, { backgroundColor: tema.anaButon }]}
      >
        <Text style={styles.butonYazi}>Yeniden Dene</Text>
      </TouchableOpacity>
    </View>
  );
}

export default class ErrorBoundary extends React.Component {
  state = { hata: null };

  static getDerivedStateFromError(hata) {
    return { hata };
  }

  componentDidCatch(hata) {
    console.log("Beklenmeyen arayüz hatası:", hata?.message);
  }

  yenidenDene = () => this.setState({ hata: null });

  render() {
    if (this.state.hata) {
      return (
        <HataEkrani hata={this.state.hata} onYenidenDene={this.yenidenDene} />
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  kapsayici: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  ikonCember: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  baslik: { fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 10 },
  mesaj: { fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 28 },
  gelistirici: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "Courier",
  },
  buton: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  butonYazi: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
