import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { YONETICI_RENGI } from "../utils/useYoneticiYetkisi";
import { aktiflikMetni, gunDizisi } from "../utils/kurumIstatistik";
import GunlukGrafik from "./GunlukGrafik";
import DersCubuklari from "./DersCubuklari";
import KonuListesi from "./KonuListesi";

const GRAFIK_GUNU = 14;

// Tek bir öğrencinin istatistik özeti (soru içeriği içermez; yalnızca sayılar).
export default function OgrenciDetay({
  satir,
  tema,
  simdi,
  onKapat,
  mudurMu,
  onSorulariAc,
}) {
  const kutuStili = [
    styles.kutu,
    { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
  ];

  const gunler = gunDizisi(satir.gunler, GRAFIK_GUNU, simdi);
  const okunanYuzde =
    satir.toplam > 0 ? Math.round((satir.okunan / satir.toplam) * 100) : 0;

  const kartlar = [
    { etiket: "Toplam soru", deger: satir.toplam },
    { etiket: "Bugün", deger: satir.bugun },
    { etiket: "Son 7 gün", deger: satir.son7 },
    { etiket: "Son 30 gün", deger: satir.son30 },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: tema.arkaplan }}>
      <View style={[styles.baslik, { borderBottomColor: tema.kutuCerceve }]}>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.isim, { color: tema.metin }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {satir.isim}
          </Text>
          <Text style={[styles.altYazi, { color: tema.ikincilMetin }]}>
            Son aktiflik: {aktiflikMetni(satir.sonAktiflikMs, simdi)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onKapat}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
        >
          <Ionicons name="close-circle" size={32} color={tema.ikincilMetin} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {mudurMu && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onSorulariAc}
            accessibilityRole="button"
            style={[styles.soruButonu, { backgroundColor: YONETICI_RENGI }]}
          >
            <Ionicons name="document-text-outline" size={22} color="#fff" />
            <Text style={styles.soruButonuYazi}>
              Gönderdiği Soruları Gör ({satir.toplam})
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        <View style={styles.kartSatiri}>
          {kartlar.map((kart) => (
            <View
              key={kart.etiket}
              style={[
                styles.kucukKart,
                {
                  backgroundColor: tema.kutuArkaplan,
                  borderColor: tema.kutuCerceve,
                },
              ]}
            >
              <Text style={[styles.kartSayi, { color: YONETICI_RENGI }]}>
                {kart.deger}
              </Text>
              <Text style={[styles.kartEtiket, { color: tema.ikincilMetin }]}>
                {kart.etiket}
              </Text>
            </View>
          ))}
        </View>

        <View style={kutuStili}>
          <View style={styles.kutuUstSatir}>
            <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
              Okunan Çözümler
            </Text>
            <Text style={[styles.kutuSayi, { color: YONETICI_RENGI }]}>
              {satir.okunan} / {satir.toplam}
            </Text>
          </View>
          <View
            style={[styles.barArkaplan, { backgroundColor: tema.kutuCerceve }]}
          >
            <View
              style={[
                styles.barDolu,
                { backgroundColor: YONETICI_RENGI, width: `${okunanYuzde}%` },
              ]}
            />
          </View>
          <Text style={[styles.altYazi, { color: tema.ikincilMetin }]}>
            Gönderilen soruların %{okunanYuzde}'i için çözüm açılmış.
          </Text>
        </View>

        <View style={kutuStili}>
          <Text
            style={[
              styles.kutuBaslik,
              styles.baslikAralik,
              { color: tema.metin },
            ]}
          >
            Son {GRAFIK_GUNU} Gün
          </Text>
          <GunlukGrafik gunler={gunler} tema={tema} />
        </View>

        <View style={kutuStili}>
          <Text
            style={[
              styles.kutuBaslik,
              styles.baslikAralik,
              { color: tema.metin },
            ]}
          >
            Ders Dağılımı
          </Text>
          <DersCubuklari
            dersler={satir.dersler}
            tema={tema}
            bosMetin="Henüz soru gönderilmedi."
          />
        </View>

        <View style={kutuStili}>
          <Text
            style={[
              styles.kutuBaslik,
              styles.baslikAralik,
              { color: tema.metin },
            ]}
          >
            En Çok Sorduğu Konular
          </Text>
          <KonuListesi
            konular={satir.konular}
            tema={tema}
            sinir={5}
            bosMetin="Konu bilgisi, öğrenci yeni soru sorduktan sonra burada görünür."
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  baslik: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  isim: { fontSize: 20, fontWeight: "900" },
  altYazi: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  soruButonu: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 16,
  },
  soruButonuYazi: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    marginLeft: 12,
  },
  kartSatiri: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  kucukKart: {
    width: "48%",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: "center",
  },
  kartSayi: { fontSize: 26, fontWeight: "900" },
  kartEtiket: { fontSize: 13, marginTop: 4 },
  kutu: { padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1 },
  kutuUstSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  kutuBaslik: { fontSize: 15, fontWeight: "bold" },
  baslikAralik: { marginBottom: 14 },
  kutuSayi: { fontSize: 16, fontWeight: "bold" },
  barArkaplan: { height: 8, borderRadius: 4, width: "100%", marginBottom: 8 },
  barDolu: { height: "100%", borderRadius: 4 },
});
