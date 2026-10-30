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

const GRAFIK_GUNU = 14;
const GRAFIK_YUKSEKLIK = 90;

// Tek bir öğrencinin istatistik özeti (soru içeriği içermez; yalnızca sayılar).
export default function OgrenciDetay({ satir, tema, simdi, onKapat }) {
  const kutuStili = [
    styles.kutu,
    { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
  ];

  const gunler = gunDizisi(satir.gunler, GRAFIK_GUNU, simdi);
  const enYuksek = Math.max(1, ...gunler.map((g) => g.adet));
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
            style={[styles.kutuBaslik, { color: tema.metin, marginBottom: 14 }]}
          >
            Son {GRAFIK_GUNU} Gün
          </Text>
          <View style={styles.grafik}>
            {gunler.map((gun) => (
              <View key={gun.anahtar} style={styles.grafikSutun}>
                <Text style={[styles.grafikSayi, { color: tema.ikincilMetin }]}>
                  {gun.adet > 0 ? gun.adet : ""}
                </Text>
                <View
                  style={[
                    styles.grafikCubuk,
                    {
                      height: Math.max(
                        gun.adet > 0 ? 6 : 3,
                        (gun.adet / enYuksek) * GRAFIK_YUKSEKLIK
                      ),
                      backgroundColor:
                        gun.adet > 0 ? YONETICI_RENGI : tema.kutuCerceve,
                    },
                  ]}
                />
                <Text style={[styles.grafikGun, { color: tema.ikincilMetin }]}>
                  {Number(gun.anahtar.slice(8))}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={kutuStili}>
          <Text
            style={[styles.kutuBaslik, { color: tema.metin, marginBottom: 14 }]}
          >
            Ders Dağılımı
          </Text>
          {satir.dersler.length === 0 ? (
            <Text style={[styles.altYazi, { color: tema.ikincilMetin }]}>
              Henüz soru gönderilmedi.
            </Text>
          ) : (
            satir.dersler.map((ders) => (
              <View key={ders.ders} style={{ marginBottom: 12 }}>
                <View style={styles.kutuUstSatir}>
                  <Text style={[styles.dersAdi, { color: tema.metin }]}>
                    {ders.ders}
                  </Text>
                  <Text style={[styles.dersSayi, { color: tema.ikincilMetin }]}>
                    {ders.adet} soru · %{ders.yuzde}
                  </Text>
                </View>
                <View
                  style={[
                    styles.barArkaplan,
                    { backgroundColor: tema.kutuCerceve, height: 6 },
                  ]}
                >
                  <View
                    style={[
                      styles.barDolu,
                      {
                        backgroundColor: YONETICI_RENGI,
                        width: `${ders.yuzde}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
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
  kutuSayi: { fontSize: 16, fontWeight: "bold" },
  barArkaplan: { height: 8, borderRadius: 4, width: "100%", marginBottom: 8 },
  barDolu: { height: "100%", borderRadius: 4 },
  grafik: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: GRAFIK_YUKSEKLIK + 40,
  },
  grafikSutun: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  grafikSayi: { fontSize: 10, marginBottom: 2, height: 14 },
  grafikCubuk: { width: "60%", borderRadius: 3 },
  grafikGun: { fontSize: 10, marginTop: 4 },
  dersAdi: { fontSize: 14, fontWeight: "500" },
  dersSayi: { fontSize: 13 },
});
