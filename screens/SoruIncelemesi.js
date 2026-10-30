import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";
import { cozumYukle } from "../utils/cozumYukleyici";
import { YONETICI_RENGI } from "../utils/useYoneticiYetkisi";
import { tarihSaatMetni } from "../utils/kurumSorular";

// Tek bir sorunun fotoğrafı ve yapay zekâ çözümü (müdür için salt okunur).
// Çözüm dosyaları cihaza kaydedilmez: başkasının verisi yönetici telefonunda kalıcı olarak durmasın.
export default function SoruIncelemesi({ soru, tema, onGeri }) {
  const karanlik = tema.arkaplan === colors.dark.arkaplan;
  const [yukleniyor, setYukleniyor] = useState(true);
  const [cozum, setCozum] = useState(null);
  const [kartLinki, setKartLinki] = useState(null);
  const [hata, setHata] = useState(false);
  const [tamEkran, setTamEkran] = useState(false);
  const canli = useRef(true);

  useEffect(() => {
    canli.current = true;
    return () => {
      canli.current = false;
    };
  }, []);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(false);
    try {
      const sonuc = await cozumYukle(soru, soru.kullaniciEposta, {
        onbellek: false,
      });
      if (!canli.current) return;
      setCozum(sonuc.cozumDetayi || null);
      setKartLinki(sonuc.cozumKartiLink || null);
      setHata(!sonuc.cozumDetayi && !!sonuc.hata);
    } catch (e) {
      console.log("Çözüm yüklenemedi:", e?.code || e?.message);
      if (canli.current) setHata(true);
    } finally {
      if (canli.current) setYukleniyor(false);
    }
  }, [soru]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const acikKutu = karanlik ? "#1A1A1A" : "#F9FAFB";
  const adimKutusu = karanlik ? "#1E293B" : "#EFF6FF";
  const adimlar = Array.isArray(cozum?.cardSteps) ? cozum.cardSteps : [];
  const sonuc = String(
    cozum?.cardAnswer ||
      cozum?.correct_answer ||
      cozum?.solution ||
      "Sonuç bulunamadı"
  );

  if (tamEkran && soru.fotoLink) {
    return (
      <View style={styles.tamEkran}>
        <TouchableOpacity
          style={styles.tamEkranKapat}
          onPress={() => setTamEkran(false)}
          accessibilityRole="button"
          accessibilityLabel="Fotoğrafı kapat"
        >
          <Ionicons name="close-circle" size={36} color="#fff" />
        </TouchableOpacity>
        <Image
          source={{ uri: soru.fotoLink }}
          style={styles.tamEkranResim}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tema.arkaplan }}>
      <View style={[styles.baslik, { borderBottomColor: tema.kutuCerceve }]}>
        <TouchableOpacity
          onPress={onGeri}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Geri"
          style={{ paddingHorizontal: 6 }}
        >
          <Ionicons name="chevron-back" size={26} color={YONETICI_RENGI} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.baslikYazi, { color: tema.metin }]}
            accessibilityRole="header"
          >
            Soru İncelemesi
          </Text>
          <Text style={[styles.altYazi, { color: tema.ikincilMetin }]}>
            {soru.dersAdi} · {tarihSaatMetni(soru.tarihMs)}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        {soru.fotoLink ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setTamEkran(true)}
            accessibilityRole="button"
            accessibilityLabel="Fotoğrafı tam ekran aç"
          >
            <Image
              source={{ uri: soru.fotoLink }}
              style={[styles.foto, { backgroundColor: tema.kutuCerceve }]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ) : null}

        {yukleniyor ? (
          <View style={styles.ortala}>
            <ActivityIndicator size="large" color={YONETICI_RENGI} />
            <Text style={[styles.durumYazi, { color: tema.ikincilMetin }]}>
              Çözüm yükleniyor...
            </Text>
          </View>
        ) : cozum ? (
          <View>
            <View
              style={[
                styles.etiket,
                { backgroundColor: YONETICI_RENGI + "22" },
              ]}
            >
              <Text
                style={{
                  color: YONETICI_RENGI,
                  fontWeight: "800",
                  fontSize: 12,
                }}
              >
                AI Çözüm
              </Text>
            </View>
            <Text style={[styles.cozumBaslik, { color: tema.metin }]}>
              {cozum.cardTitle || "Soru Çözümü"}
            </Text>

            {(cozum.subject || cozum.topic) && (
              <View style={[styles.kutu, { backgroundColor: acikKutu }]}>
                <Text
                  style={{ color: tema.metin, fontWeight: "600", fontSize: 15 }}
                >
                  📚 {[cozum.subject, cozum.topic].filter(Boolean).join(" › ")}
                </Text>
              </View>
            )}

            {cozum.question ? (
              <View
                style={[
                  styles.kutu,
                  {
                    backgroundColor: acikKutu,
                    borderLeftWidth: 4,
                    borderLeftColor: tema.ikincilMetin,
                  },
                ]}
              >
                <Text
                  style={[styles.kucukBaslik, { color: tema.ikincilMetin }]}
                >
                  📝 SORU
                </Text>
                <Text style={[styles.icerik, { color: tema.metin }]}>
                  {cozum.question}
                </Text>
              </View>
            ) : null}

            {adimlar.map((adim, index) => (
              <View
                key={index}
                style={[
                  styles.kutu,
                  {
                    backgroundColor: adimKutusu,
                    borderLeftWidth: 4,
                    borderLeftColor: YONETICI_RENGI,
                  },
                ]}
              >
                <Text style={[styles.kucukBaslik, { color: YONETICI_RENGI }]}>
                  ADIM {index + 1}
                </Text>
                <Text style={[styles.icerik, { color: tema.metin }]}>
                  {adim}
                </Text>
              </View>
            ))}

            <View
              style={[
                styles.kutu,
                {
                  backgroundColor: karanlik ? "#064E3B" : "#ECFDF5",
                  borderWidth: 1,
                  borderColor: "#10B981",
                },
              ]}
            >
              <Text
                style={[
                  styles.kucukBaslik,
                  { color: karanlik ? "#34D399" : "#059669" },
                ]}
              >
                KESİN SONUÇ
              </Text>
              <Text
                style={[
                  styles.icerik,
                  {
                    color: karanlik ? "#A7F3D0" : "#065F46",
                    fontWeight: "700",
                  },
                ]}
              >
                {sonuc}
              </Text>
            </View>

            {kartLinki ? (
              <View style={{ marginTop: 6 }}>
                <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                  🖼️ Çözüm Görseli
                </Text>
                <Image
                  source={{ uri: kartLinki }}
                  style={[styles.foto, { backgroundColor: tema.kutuCerceve }]}
                  resizeMode="contain"
                />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.ortala}>
            <Text style={[styles.durumYazi, { color: tema.metin }]}>
              {hata
                ? "Çözüm şu an yüklenemedi. Bağlantıyı kontrol edip tekrar dene."
                : soru.cozuldu
                  ? "Bu sorunun çözüm detayı şu an hazır değil. Birkaç dakika sonra tekrar dene."
                  : "Bu soru için yapay zekâ çözümü henüz hazırlanmadı."}
            </Text>
            {(hata || soru.cozuldu) && (
              <TouchableOpacity
                style={[styles.buton, { backgroundColor: YONETICI_RENGI }]}
                onPress={yukle}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.butonYazi}>Tekrar Dene</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  baslik: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  baslikYazi: { fontSize: 18, fontWeight: "900" },
  altYazi: { fontSize: 12, marginTop: 2 },
  foto: { width: "100%", height: 240, borderRadius: 14, marginBottom: 18 },
  ortala: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 10 },
  durumYazi: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 14,
  },
  etiket: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  cozumBaslik: { fontSize: 24, fontWeight: "900", marginBottom: 16 },
  kutu: { padding: 16, borderRadius: 12, marginBottom: 12 },
  kucukBaslik: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  icerik: { fontSize: 15, lineHeight: 23 },
  kutuBaslik: { fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  buton: {
    marginTop: 18,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 100,
  },
  butonYazi: { color: "#fff", fontWeight: "700", fontSize: 15 },
  tamEkran: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
  tamEkranKapat: { position: "absolute", top: 20, right: 20, zIndex: 2 },
  tamEkranResim: { width: "100%", height: "100%" },
});
