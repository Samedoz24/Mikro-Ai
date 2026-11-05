// Görünüm (tema) seçici: Hesabım > Tercihler > Görünüm Modu.
// Seçim anında uygulanır; pencere açık kalır, kullanıcı sonucu görüp "Tamam" ile kapatır.

import React from "react";
import {
  Modal,
  Pressable,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeContext";
import { colors } from "../theme";

const SECENEKLER = [
  { mod: "light", baslik: "Açık", ikon: "sunny-outline" },
  { mod: "dark", baslik: "Koyu", ikon: "moon-outline" },
  { mod: "system", baslik: "Sistem", ikon: "phone-portrait-outline" },
];

// Bir renk paletinin küçük telefon ekranı önizlemesi
const MiniEkran = ({ palet }) => (
  <View style={[stiller.miniEkran, { backgroundColor: palet.arkaplan }]}>
    <View style={[stiller.miniBaslik, { backgroundColor: palet.metin }]} />
    <View style={[stiller.miniKart, { backgroundColor: palet.kutuArkaplan, borderColor: palet.kutuCerceve }]}>
      <View style={[stiller.miniSatir, { backgroundColor: palet.ikincilMetin, width: "70%" }]} />
      <View style={[stiller.miniSatir, { backgroundColor: palet.ikincilMetin, width: "45%" }]} />
    </View>
    <View style={[stiller.miniButon, { backgroundColor: palet.anaButon }]} />
  </View>
);

const Onizleme = ({ mod }) => {
  if (mod === "system") {
    // Yarısı açık, yarısı koyu
    return (
      <View style={stiller.onizlemeCerceve}>
        <View style={stiller.yarimSol}>
          <View style={stiller.tamGenislik}>
            <MiniEkran palet={colors.light} />
          </View>
        </View>
        <View style={stiller.yarimSag}>
          <View style={[stiller.tamGenislik, { marginLeft: "-100%" }]}>
            <MiniEkran palet={colors.dark} />
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={stiller.onizlemeCerceve}>
      <MiniEkran palet={mod === "dark" ? colors.dark : colors.light} />
    </View>
  );
};

export default function GorunumSecici({ gorunur, kapat }) {
  const { tema, temaModu, temaDegistir } = useTheme();
  const sistemTemasi = useColorScheme();
  const insets = useSafeAreaInsets();
  const karanlik = tema.arkaplan === colors.dark.arkaplan;

  const sistemAciklamasi =
    temaModu === "system"
      ? `Telefonunun ayarını izler (şu an: ${sistemTemasi === "dark" ? "Koyu" : "Açık"}).`
      : "Sistem seçilirse uygulama telefonunun ayarını izler.";

  return (
    <Modal
      visible={gorunur}
      animationType="slide"
      transparent
      onRequestClose={kapat}
      statusBarTranslucent
    >
      <Pressable style={stiller.arkaplan} onPress={kapat} accessibilityLabel="Kapat">
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

          <Text style={[stiller.baslik, { color: tema.metin }]} accessibilityRole="header">
            Görünüm
          </Text>
          <Text style={[stiller.altBaslik, { color: tema.ikincilMetin }]}>
            Uygulamanın nasıl görüneceğini seç.
          </Text>

          <View style={stiller.secenekSirasi} accessibilityRole="radiogroup">
            {SECENEKLER.map(({ mod, baslik, ikon }) => {
              const secili = temaModu === mod;
              return (
                <TouchableOpacity
                  key={mod}
                  style={stiller.secenek}
                  activeOpacity={0.8}
                  onPress={() => temaDegistir(mod)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: secili, checked: secili }}
                  accessibilityLabel={`${baslik} görünüm`}
                >
                  <View
                    style={[
                      stiller.onizlemeKap,
                      {
                        borderColor: secili ? tema.anaButon : tema.kutuCerceve,
                        borderWidth: secili ? 2.5 : 1.5,
                      },
                    ]}
                  >
                    <Onizleme mod={mod} />
                  </View>

                  <View style={stiller.etiketSatiri}>
                    <Ionicons
                      name={ikon}
                      size={15}
                      color={secili ? tema.anaButon : tema.ikincilMetin}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        stiller.etiket,
                        { color: secili ? tema.metin : tema.ikincilMetin, fontWeight: secili ? "700" : "500" },
                      ]}
                    >
                      {baslik}
                    </Text>
                  </View>

                  <View
                    style={[
                      stiller.radyo,
                      { borderColor: secili ? tema.anaButon : tema.kutuCerceve },
                    ]}
                  >
                    {secili && (
                      <View style={[stiller.radyoIc, { backgroundColor: tema.anaButon }]} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[stiller.bilgiKutu, { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve }]}>
            <Ionicons name="information-circle-outline" size={18} color={tema.ikincilMetin} />
            <Text style={[stiller.bilgiYazi, { color: tema.ikincilMetin }]}>{sistemAciklamasi}</Text>
          </View>

          <TouchableOpacity
            style={[stiller.tamamButon, { backgroundColor: tema.anaButon }]}
            onPress={kapat}
            accessibilityRole="button"
          >
            <Text style={stiller.tamamYazi}>Tamam</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const stiller = StyleSheet.create({
  arkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  kutu: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  tutamac: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: 16,
  },
  baslik: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  altBaslik: { fontSize: 14, textAlign: "center", marginTop: 6, marginBottom: 22 },
  secenekSirasi: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  secenek: { flex: 1, alignItems: "center" },
  onizlemeKap: {
    width: "100%",
    aspectRatio: 0.62,
    borderRadius: 16,
    padding: 4,
  },
  onizlemeCerceve: {
    flex: 1,
    borderRadius: 11,
    overflow: "hidden",
    flexDirection: "row",
  },
  yarimSol: { flex: 1, overflow: "hidden" },
  yarimSag: { flex: 1, overflow: "hidden" },
  tamGenislik: { width: "200%", height: "100%" },
  miniEkran: { flex: 1, padding: 8 },
  miniBaslik: { height: 6, width: "50%", borderRadius: 3, marginTop: 6, marginBottom: 10, opacity: 0.85 },
  miniKart: { borderWidth: 1, borderRadius: 6, padding: 6, marginBottom: 8 },
  miniSatir: { height: 4, borderRadius: 2, marginBottom: 4, opacity: 0.7 },
  miniButon: { height: 12, borderRadius: 6, marginTop: "auto", marginBottom: 4 },
  etiketSatiri: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  etiket: { fontSize: 14 },
  radyo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  radyoIc: { width: 10, height: 10, borderRadius: 5 },
  bilgiKutu: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 20,
    gap: 8,
  },
  bilgiYazi: { flex: 1, fontSize: 13, lineHeight: 18 },
  tamamButon: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  tamamYazi: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
