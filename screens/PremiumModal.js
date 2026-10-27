import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../ThemeContext";
import { colors } from "../theme";
import {
  planlariGetir,
  satinAl,
  satinAlimlariGeriYukle,
  tasarrufYuzdesi,
  PLAN_ADLARI,
  SATIN_ALMA_IPTAL,
  SATIN_ALMA_HAZIR_DEGIL,
} from "../utils/premiumPlanlari";
import {
  KULLANIM_KOSULLARI_URL,
  GIZLILIK_POLITIKASI_URL,
} from "../utils/yasalMetinler";

const METINLER = {
  kota: {
    baslik: "Premium'a Geç",
    alt: "Bugünkü ücretsiz hakların bitti. Premium ile günde 50 soru sorabilirsin.",
  },
  pdf: {
    baslik: "PDF İndirme Premium'a Özel",
    alt: "Hata defterini PDF olarak indirmek için Premium'a geç.",
  },
  profil: {
    baslik: "Premium'a Geç",
    alt: "Günde 50 soru sor ve hata defterini PDF olarak indir.",
  },
};

const AVANTAJLAR = [
  "Günde 50 soru çözümü (ücretsiz: 3)",
  "Hata defterini PDF olarak indirme",
];

export default function PremiumModal({ gorunur, neden, onKapat }) {
  const { tema } = useTheme();
  const insets = useSafeAreaInsets();
  const isKaranlik = tema.arkaplan === colors.dark.arkaplan;

  const [planlar, setPlanlar] = useState([]);
  const [onizleme, setOnizleme] = useState(false);
  const [satinAlinabilir, setSatinAlinabilir] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [seciliPlan, setSeciliPlan] = useState(null);
  const [islemde, setIslemde] = useState(false);

  useEffect(() => {
    if (!gorunur) return;
    let iptal = false;
    setYukleniyor(true);

    planlariGetir()
      .then((sonuc) => {
        if (iptal) return;
        setPlanlar(sonuc.planlar);
        setOnizleme(sonuc.onizleme);
        setSatinAlinabilir(sonuc.satinAlinabilir);
        setSeciliPlan(
          sonuc.planlar.some((p) => p.id === "yillik")
            ? "yillik"
            : sonuc.planlar[0]?.id ?? null
        );
      })
      .catch((hata) => {
        console.log("Planlar alınamadı:", hata?.code, hata?.message);
        if (!iptal) setPlanlar([]);
      })
      .finally(() => {
        if (!iptal) setYukleniyor(false);
      });

    return () => {
      iptal = true;
    };
  }, [gorunur]);

  const metin = METINLER[neden] || METINLER.profil;
  const altan = tema.ikincilMetin;
  const altin = tema.premiumAltin;

  // Koyu modda uygulamanın siyah/kömür temasıyla uyumlu, tek altın vurgulu palet
  const p = isKaranlik
    ? {
        kutu: "#121212",
        ustCizgi: "#262626",
        kart: "#1A1A1A",
        kartCerceve: "#2C2C2C",
        kartSecili: "rgba(245, 197, 24, 0.08)",
        butonPasif: "#262626",
        butonPasifYazi: "#7A7A7A",
        ikonZemin: "rgba(245, 197, 24, 0.12)",
        ikonCerceve: "rgba(245, 197, 24, 0.35)",
      }
    : {
        kutu: "#FFFFFF",
        ustCizgi: "transparent",
        kart: "#F8F8F8",
        kartCerceve: tema.kutuCerceve,
        kartSecili: "rgba(245, 197, 24, 0.14)",
        butonPasif: tema.kutuCerceve,
        butonPasifYazi: tema.ikincilMetin,
        ikonZemin: "rgba(245, 197, 24, 0.16)",
        ikonCerceve: "rgba(245, 197, 24, 0.45)",
      };

  const satinAlmayiBaslat = async () => {
    if (!seciliPlan || islemde || !satinAlinabilir) return;
    setIslemde(true);
    try {
      await satinAl(seciliPlan);
      onKapat();
      Alert.alert(
        "Teşekkürler!",
        "Premium üyeliğin etkinleştiriliyor. Birkaç saniye içinde aktif olacak."
      );
    } catch (hata) {
      if (hata?.code !== SATIN_ALMA_IPTAL) {
        console.log("Satın alma hatası:", hata?.code, hata?.message);
        Alert.alert(
          "Satın Alma Tamamlanamadı",
          "İşlem tamamlanamadı. Ücret alındıysa Satın Alımları Geri Yükle'yi dene ya da daha sonra tekrar dene."
        );
      }
    } finally {
      setIslemde(false);
    }
  };

  const geriYukle = async () => {
    if (islemde) return;
    setIslemde(true);
    try {
      await satinAlimlariGeriYukle();
      Alert.alert(
        "Satın Alımlar Kontrol Edildi",
        "Aktif bir aboneliğin varsa Premium birkaç saniye içinde etkinleşir."
      );
    } catch (hata) {
      Alert.alert(
        "Geri Yüklenemedi",
        hata?.code === SATIN_ALMA_HAZIR_DEGIL
          ? "Satın alma altyapısı henüz etkin değil."
          : "Satın alımlar geri yüklenemedi. Lütfen daha sonra tekrar dene."
      );
    } finally {
      setIslemde(false);
    }
  };

  const baglantiAc = (url) => {
    Linking.openURL(url).catch(() =>
      Alert.alert("Hata", "Bağlantı açılamadı.")
    );
  };

  return (
    <Modal
      visible={gorunur}
      transparent
      animationType="slide"
      onRequestClose={onKapat}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onKapat}
          accessibilityLabel="Kapat"
        />

        <View
          style={[
            styles.kutu,
            {
              backgroundColor: p.kutu,
              borderColor: p.ustCizgi,
              paddingBottom: 24 + insets.bottom,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onKapat}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            style={styles.kapatButon}
          >
            <Ionicons name="close" size={28} color={altan} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.icerik}
          >
            <View
              style={[
                styles.ikonCember,
                { backgroundColor: p.ikonZemin, borderColor: p.ikonCerceve },
              ]}
            >
              <Ionicons name="star" size={38} color={altin} />
            </View>

            <Text
              style={[styles.baslik, { color: tema.metin }]}
              accessibilityRole="header"
            >
              {metin.baslik}
            </Text>
            <Text style={[styles.altYazi, { color: altan }]}>{metin.alt}</Text>

            <View style={styles.avantajKutusu}>
              {AVANTAJLAR.map((avantaj) => (
                <View key={avantaj} style={styles.avantajSatiri}>
                  <Ionicons name="checkmark-circle" size={22} color={altin} />
                  <Text style={[styles.avantajYazi, { color: tema.metin }]}>
                    {avantaj}
                  </Text>
                </View>
              ))}
            </View>

            {yukleniyor ? (
              <ActivityIndicator
                color={tema.anaButon}
                style={{ marginVertical: 30 }}
              />
            ) : planlar.length === 0 ? (
              <Text style={[styles.bilgi, { color: altan }]}>
                Abonelik seçenekleri şu an yüklenemedi. Lütfen daha sonra tekrar
                dene.
              </Text>
            ) : (
              <View style={styles.planSatiri}>
                {planlar.map((plan) => {
                  const secili = plan.id === seciliPlan;
                  const tasarruf = tasarrufYuzdesi(planlar, plan.id);
                  return (
                    <Pressable
                      key={plan.id}
                      onPress={() => setSeciliPlan(plan.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: secili }}
                      style={[
                        styles.planKutu,
                        {
                          borderColor: secili ? altin : p.kartCerceve,
                          backgroundColor: secili ? p.kartSecili : p.kart,
                        },
                      ]}
                    >
                      {tasarruf > 0 && (
                        <View
                          style={[
                            styles.tasarrufEtiketi,
                            { backgroundColor: altin },
                          ]}
                        >
                          <Text style={styles.tasarrufYazi}>
                            %{tasarruf} tasarruf
                          </Text>
                        </View>
                      )}
                      <Text style={[styles.planAdi, { color: altan }]}>
                        {PLAN_ADLARI[plan.id]}
                      </Text>
                      <Text style={[styles.planFiyat, { color: tema.metin }]}>
                        {plan.fiyatYazi}
                      </Text>
                      {plan.aylikFiyatYazi ? (
                        <Text style={[styles.planAylik, { color: altan }]}>
                          aylık ≈ {plan.aylikFiyatYazi}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {onizleme && (
              <Text style={[styles.onizlemeNotu, { color: altan }]}>
                Önizleme fiyatları (yalnızca geliştirme sürümü)
              </Text>
            )}

            <TouchableOpacity
              onPress={satinAlmayiBaslat}
              disabled={!satinAlinabilir || !seciliPlan || islemde}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{
                disabled: !satinAlinabilir || !seciliPlan || islemde,
              }}
              style={[
                styles.satinAlButon,
                { backgroundColor: altin },
                !satinAlinabilir && {
                  backgroundColor: p.butonPasif,
                  shadowOpacity: 0,
                  elevation: 0,
                },
              ]}
            >
              {islemde ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text
                  style={[
                    styles.satinAlYazi,
                    !satinAlinabilir && { color: p.butonPasifYazi },
                  ]}
                >
                  {satinAlinabilir ? "Premium'a Geç" : "Yakında"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={geriYukle}
              disabled={islemde}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={styles.geriYukleButon}
            >
              <Text style={[styles.geriYukleYazi, { color: tema.anaButon }]}>
                Satın Alımları Geri Yükle
              </Text>
            </TouchableOpacity>

            <Text style={[styles.yasalMetin, { color: altan }]}>
              Abonelik, seçtiğin sürenin sonunda otomatik olarak yenilenir.
              İstediğin zaman App Store / Google Play hesap ayarlarından iptal
              edebilirsin. Ödeme, satın alma onayında hesabından tahsil edilir.
            </Text>

            {(KULLANIM_KOSULLARI_URL || GIZLILIK_POLITIKASI_URL) && (
              <View style={styles.baglantiSatiri}>
                {KULLANIM_KOSULLARI_URL ? (
                  <Text
                    onPress={() => baglantiAc(KULLANIM_KOSULLARI_URL)}
                    style={[styles.baglanti, { color: tema.anaButon }]}
                    accessibilityRole="link"
                  >
                    Kullanım Koşulları
                  </Text>
                ) : null}
                {GIZLILIK_POLITIKASI_URL ? (
                  <Text
                    onPress={() => baglantiAc(GIZLILIK_POLITIKASI_URL)}
                    style={[styles.baglanti, { color: tema.anaButon }]}
                    accessibilityRole="link"
                  >
                    Gizlilik Politikası
                  </Text>
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  kutu: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    paddingTop: 24,
    paddingHorizontal: 24,
    maxHeight: "92%",
  },
  kapatButon: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  icerik: { alignItems: "center", paddingTop: 8 },
  ikonCember: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  baslik: {
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  altYazi: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 22,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  avantajKutusu: { width: "100%", marginBottom: 24 },
  avantajSatiri: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avantajYazi: { fontSize: 15, fontWeight: "500", marginLeft: 10, flex: 1 },
  bilgi: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginVertical: 24,
  },
  planSatiri: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 14,
    paddingTop: 10,
  },
  planKutu: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: "center",
    marginHorizontal: 4,
  },
  tasarrufEtiketi: {
    position: "absolute",
    top: -11,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tasarrufYazi: { color: "#111111", fontSize: 10, fontWeight: "800" },
  planAdi: { fontSize: 14, fontWeight: "600", marginBottom: 8, marginTop: 4 },
  planFiyat: { fontSize: 18, fontWeight: "900" },
  planAylik: { fontSize: 11, marginTop: 4 },
  onizlemeNotu: { fontSize: 11, marginBottom: 10, fontStyle: "italic" },
  satinAlButon: {
    width: "100%",
    height: 56,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    shadowColor: "#F5C518",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  satinAlYazi: {
    color: "#111111",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  geriYukleButon: { paddingVertical: 14 },
  geriYukleYazi: { fontSize: 15, fontWeight: "600" },
  yasalMetin: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 6,
  },
  baglantiSatiri: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 18,
    marginTop: 10,
  },
  baglanti: { fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },
});
