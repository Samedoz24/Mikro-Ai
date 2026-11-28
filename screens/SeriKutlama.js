import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import { useTheme } from "../ThemeContext";
import { seriKutlamasiniDinle, KUTLAMA_GECIKMESI_MS } from "../utils/seriKutlama";
import { seriKutlamaMetni } from "../utils/seri";

const ekranGenisligi = Dimensions.get("window").width;

// Uygulamanın kökünde durur: soru gönderildikten 10 saniye sonra hangi ekranda olunursa olunsun seri kutlamasını
// gösterir. Kullanıcı değişirse (çıkış/başka hesap) bekleyen kutlama iptal edilir; başka hesabın serisi gösterilmez.
export default function SeriKutlama({ kullaniciUid }) {
  const { tema } = useTheme();
  const [gun, setGun] = useState(null);
  const zamanlayici = useRef(null);

  useEffect(() => {
    const temizle = () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
      zamanlayici.current = null;
    };
    setGun(null);
    if (!kullaniciUid) return temizle;
    const birak = seriKutlamasiniDinle((yeniGun) => {
      temizle();
      zamanlayici.current = setTimeout(() => {
        zamanlayici.current = null;
        setGun(yeniGun);
      }, KUTLAMA_GECIKMESI_MS);
    });
    return () => {
      birak();
      temizle();
    };
  }, [kullaniciUid]);

  if (!gun) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setGun(null)}>
      <View style={styles.katman}>
        <ConfettiCannon
          count={200}
          origin={{ x: ekranGenisligi / 2, y: -20 }}
          autoStart
          fadeOut
          fallSpeed={2500}
        />
        <View style={[styles.kutu, { backgroundColor: tema.kutuArkaplan }]}>
          <View style={styles.ikonCember}>
            <Ionicons name="flame" size={50} color="#FF9800" />
          </View>
          <Text style={[styles.baslik, { color: tema.metin }]}>{gun} GÜNLÜK SERİ!</Text>
          <Text style={[styles.mesaj, { color: tema.ikincilMetin }]}>{seriKutlamaMetni(gun)}</Text>
          <TouchableOpacity
            onPress={() => setGun(null)}
            accessibilityRole="button"
            style={[styles.buton, { backgroundColor: tema.anaButon }]}
          >
            <Text style={styles.butonYazi}>Devam Et</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  katman: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  kutu: { padding: 35, borderRadius: 30, alignItems: "center", width: "100%", elevation: 15 },
  ikonCember: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255, 152, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  baslik: { fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 12, letterSpacing: 0.5 },
  mesaj: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 30, paddingHorizontal: 10 },
  buton: { paddingVertical: 16, paddingHorizontal: 40, borderRadius: 100, width: "100%", alignItems: "center", elevation: 3 },
  butonYazi: { color: "#fff", fontSize: 17, fontWeight: "bold" },
});
