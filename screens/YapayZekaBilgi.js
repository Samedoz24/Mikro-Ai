import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Bilgilendirme maddeleri (yalnızca metin; ağ ya da veri kullanmaz)
export const BILGI_BASLIK = "Yapay Zekâ Çözümleri Hakkında";
// Öğrenci (soruyu gönderen) için: çözümün doğası, kullanım önerisi ve doğruluğu artıran adımlar
export const OGRENCI_MADDELERI = [
  {
    ikon: "sparkles-outline",
    metin:
      "Çözümler yapay zekâ tarafından otomatik olarak hazırlanır. Yapay zekâ çoğu zaman doğru sonuç verse de hata yapabilir.",
  },
  {
    ikon: "school-outline",
    metin:
      "Çözümü bir öğrenme yardımcısı olarak kullan; tek ve kesin kaynak olarak kabul etme. Emin olmadığın durumlarda öğretmenine danış.",
  },
  {
    ikon: "checkmark-circle-outline",
    metin:
      "Sorunun cevabını biliyorsan işaretlemen, çözümün kontrol edilmesine yardımcı olur.",
  },
  {
    ikon: "camera-outline",
    metin:
      "Fotoğrafın net olması ve sorunun şıklarıyla birlikte tamamen görünmesi doğruluğu artırır.",
  },
];

// Veli ve dershane yöneticisi (çözümü inceleyen) için
export const INCELEYEN_MADDELERI = [
  {
    ikon: "sparkles-outline",
    metin:
      "Bu çözüm yapay zekâ tarafından otomatik olarak hazırlanmıştır. Yapay zekâ çoğu zaman doğru sonuç verse de hata yapabilir.",
  },
  {
    ikon: "school-outline",
    metin:
      "Çözümler öğrencinin öğrenmesine destek olmak içindir; kesin ve tek doğru kaynak olarak kabul edilmemelidir.",
  },
  {
    ikon: "people-outline",
    metin:
      "Emin olunamayan durumlarda sorunun bir öğretmenle birlikte değerlendirilmesini öneririz.",
  },
];

// Eski adla uyumluluk
export const BILGI_MADDELERI = OGRENCI_MADDELERI;

// Küçük ⓘ düğmesi ve bilgilendirme penceresi. Hiçbir veri okumaz ya da göndermez.
// kitle: "ogrenci" (varsayılan) ya da "inceleyen" (veli, müdür)
export default function YapayZekaBilgi({ tema, style, kitle = "ogrenci" }) {
  const [acik, setAcik] = useState(false);
  const maddeler =
    kitle === "inceleyen" ? INCELEYEN_MADDELERI : OGRENCI_MADDELERI;
  return (
    <>
      <TouchableOpacity
        onPress={() => setAcik(true)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Yapay zekâ çözümleri hakkında bilgi"
        style={style}
      >
        <Ionicons
          name="information-circle-outline"
          size={26}
          color={tema.ikincilMetin}
        />
      </TouchableOpacity>

      <Modal
        visible={acik}
        transparent
        animationType="fade"
        onRequestClose={() => setAcik(false)}
      >
        <View style={styles.arka}>
          <View style={[styles.kutu, { backgroundColor: tema.kutuArkaplan }]}>
            <View style={styles.baslikSatiri}>
              <Ionicons
                name="information-circle"
                size={26}
                color={tema.anaButon}
              />
              <Text
                style={[styles.baslik, { color: tema.metin }]}
                accessibilityRole="header"
              >
                {BILGI_BASLIK}
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 420 }} bounces={false}>
              {maddeler.map((m) => (
                <View key={m.ikon} style={styles.madde}>
                  <Ionicons
                    name={m.ikon}
                    size={20}
                    color={tema.anaButon}
                    style={styles.maddeIkon}
                  />
                  <Text style={[styles.maddeMetin, { color: tema.metin }]}>
                    {m.metin}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setAcik(false)}
              style={[styles.dugme, { backgroundColor: tema.anaButon }]}
              accessibilityRole="button"
              accessibilityLabel="Anladım, pencereyi kapat"
            >
              <Text style={styles.dugmeYazi}>Anladım</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  arka: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  kutu: { borderRadius: 20, padding: 22 },
  baslikSatiri: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  baslik: { fontSize: 18, fontWeight: "bold", marginLeft: 8, flex: 1 },
  madde: { flexDirection: "row", marginBottom: 12 },
  maddeIkon: { marginTop: 1, marginRight: 10 },
  maddeMetin: { flex: 1, fontSize: 14, lineHeight: 20 },
  dugme: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  dugmeYazi: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});
