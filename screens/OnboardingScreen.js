import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { useTheme } from "../ThemeContext";

const { width, height } = Dimensions.get("window");

const kameraAnim = require("../assets/animations/kamera.json");
const robotAnim = require("../assets/animations/robot.json");
const kitapAnim = require("../assets/animations/kitap.json");
const veliAnim = require("../assets/animations/veli.json");

const SLIDES = [
  {
    id: "1",
    baslik: "Sorunu Çek, Gönder",
    aciklama:
      "Çözemediğin sorunun fotoğrafını çekip sisteme yüklemen yeterli. Gerisini Mikro Özel Hocan halleder.",
    animasyon: kameraAnim,
  },
  {
    id: "2",
    baslik: "Yapay Zeka İle Analiz",
    aciklama:
      "Sadece doğru cevabı değil, adım adım çözüm mantığını ve kullanılan formülleri anında öğren.",
    animasyon: robotAnim,
  },
  {
    id: "3",
    baslik: "Hata Defterin Hazır",
    aciklama:
      "Tüm soruların derslere göre otomatik arşivlenir. Sınavdan önce dönüp tekrar etmen için seni bekler.",
    animasyon: kitapAnim,
  },
  {
    id: "4",
    baslik: "Veli Takip Sistemi",
    aciklama:
      "Gelişim istatistiklerini ve çözdüğün soruları velinle paylaşarak başarı yolculuğunu kanıtla.",
    animasyon: veliAnim,
  },
];

export default function OnboardingScreen({ onTamamla }) {
  const { tema } = useTheme();
  const [mevcutSayfa, setMevcutSayfa] = useState(0);
  const flatListRef = useRef(null);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0]) {
      setMevcutSayfa(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const IleriGit = () => {
    if (mevcutSayfa < SLIDES.length - 1) {
      flatListRef.current.scrollToIndex({ index: mevcutSayfa + 1 });
    } else {
      onTamamla();
    }
  };

  const RenderSlide = ({ item }) => {
    return (
      <View style={[styles.slideKutu, { backgroundColor: tema.arkaplan }]}>
        <View style={styles.animasyonKonteyner}>
          <LottieView
            source={item.animasyon}
            autoPlay
            loop
            style={styles.animasyon}
          />
        </View>
        <View style={styles.metinKonteyner}>
          <Text style={[styles.baslik, { color: tema.metin }]}>
            {item.baslik}
          </Text>
          <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
            {item.aciklama}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: tema.arkaplan }]}
    >
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={RenderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
      />

      <View style={styles.altKisim}>
        <View style={styles.noktaKonteyner}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.nokta,
                {
                  backgroundColor:
                    mevcutSayfa === index ? tema.anaButon : tema.kutuCerceve,
                  width: mevcutSayfa === index ? 20 : 10,
                },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.buton, { backgroundColor: tema.anaButon }]}
          onPress={IleriGit}
        >
          <Text style={styles.butonYazi}>
            {mevcutSayfa === SLIDES.length - 1 ? "Hemen Başla" : "İleri"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slideKutu: {
    width: width,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  animasyonKonteyner: {
    flex: 0.6,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  animasyon: {
    width: width * 0.8,
    height: width * 0.8,
  },
  metinKonteyner: {
    flex: 0.4,
    paddingHorizontal: 30,
    alignItems: "center",
  },
  baslik: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  aciklama: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  altKisim: {
    height: height * 0.2,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  noktaKonteyner: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  nokta: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  buton: {
    height: 55,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  butonYazi: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});
