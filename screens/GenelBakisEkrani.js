import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeContext";
import useYoneticiYetkisi, {
  YONETICI_RENGI,
} from "../utils/useYoneticiYetkisi";
import useKurumOzetleri from "../utils/useKurumOzetleri";
import useKurum from "../utils/useKurum";
import useGruplar from "../utils/useGruplar";
import { kapsamMetni } from "../utils/kurumKapsam";
import { kurumGenelBakis, ogrenciSatiri } from "../utils/kurumIstatistik";
import GunlukGrafik from "./GunlukGrafik";
import DersCubuklari from "./DersCubuklari";
import KonuListesi from "./KonuListesi";
import OgrenciPenceresi from "./OgrenciPenceresi";

const ARALIKLAR = [7, 14, 30];
const DIKKAT_SINIRI = 6;
const EN_AKTIF_SINIRI = 5;

const dikkatMetni = (d) => {
  if (d.hicBaslamadi) {
    return d.pasifGun !== null && d.pasifGun > 0
      ? `Henüz hiç soru sormadı · ${d.pasifGun} gündür dershanede`
      : "Henüz hiç soru sormadı";
  }
  return d.pasifGun !== null
    ? `${d.pasifGun} gündür soru sormadı`
    : "Uzun süredir aktif değil";
};

// Müdür ve öğretmenin dershane geneli özeti: soru grafiği, dikkat gerektiren öğrenciler,
// en aktif öğrenciler, en çok sorulan konular ve ders dağılımı. Yalnızca özet verisini kullanır.
export default function GenelBakisEkrani() {
  const { tema } = useTheme();
  const insets = useSafeAreaInsets();
  const { yetki, yenile } = useYoneticiYetkisi();
  const { ozetler, hata } = useKurumOzetleri(
    yetki?.kurumId,
    yetki?.kapsam,
    yetki?.gruplar
  );
  const kurum = useKurum(yetki?.kurumId);
  const gruplar = useGruplar(yetki?.kurumId);

  const [seciliId, setSeciliId] = useState(null);
  // Seçilen zaman aralığı (gün): grafik, aktif öğrenci, en aktif ve dikkat gerektirenler buna göre hesaplanır
  const [gun, setGun] = useState(7);
  const [simdi, setSimdi] = useState(Date.now());
  useEffect(() => {
    setSimdi(Date.now());
  }, [ozetler]);

  const satirlar = useMemo(
    () => (ozetler || []).map((o) => ogrenciSatiri(o.id, o, simdi)),
    [ozetler, simdi]
  );
  const bakis = useMemo(
    () => kurumGenelBakis(satirlar, simdi, gun, gun),
    [satirlar, simdi, gun]
  );
  const secili = satirlar.find((s) => s.id === seciliId) || null;
  const mudurMu = yetki?.kurumRol === "mudur";
  // Kapsamı seçili gruplarla sınırlı öğretmen: hangi grupları gördüğü ekranda yazar
  const kapsamliOgretmen = !mudurMu && yetki?.kapsam === "gruplar";
  const kapsamBos = kapsamliOgretmen && (yetki.gruplar || []).length === 0;

  const kutuStili = [
    styles.kutu,
    { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
  ];

  const ortala = (icerik) => (
    <View
      style={[
        styles.ortala,
        { backgroundColor: tema.arkaplan, paddingTop: insets.top },
      ]}
    >
      {icerik}
    </View>
  );

  if (yetki === undefined) {
    return ortala(<ActivityIndicator size="large" color={YONETICI_RENGI} />);
  }

  if (!yetki) {
    return ortala(
      <>
        <Text style={[styles.bosBaslik, { color: tema.metin }]}>
          Yönetici Yetkin Bulunmuyor
        </Text>
        <Text style={[styles.bosYazi, { color: tema.ikincilMetin }]}>
          Dershane sekmesinden yetkini yeniden kontrol edebilirsin.
        </Text>
      </>
    );
  }

  if (hata && ozetler === null) {
    return ortala(
      <>
        <Text style={[styles.bosBaslik, { color: tema.metin }]}>
          Genel Bakış Yüklenemedi
        </Text>
        <Text style={[styles.bosYazi, { color: tema.ikincilMetin }]}>
          İnternet bağlantını kontrol edip tekrar dene.
        </Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: YONETICI_RENGI }]}
          onPress={yenile}
          activeOpacity={0.8}
        >
          <Text style={styles.butonYazi}>Tekrar Dene</Text>
        </TouchableOpacity>
      </>
    );
  }

  if (ozetler === null) {
    return ortala(<ActivityIndicator size="large" color={YONETICI_RENGI} />);
  }

  const { toplamlar, donem } = bakis;
  const ozetKartlari = [
    { etiket: "Öğrenci", deger: toplamlar.ogrenci },
    { etiket: "Bugün soru", deger: toplamlar.bugun },
    { etiket: `${gun} gün soru`, deger: donem.soru },
    { etiket: "Aktif öğrenci", deger: donem.aktifOgrenci },
  ];

  const ogrenciSatiriGoster = (ogrenci, sag, alt) => (
    <TouchableOpacity
      key={ogrenci.id}
      activeOpacity={0.75}
      onPress={() => setSeciliId(ogrenci.id)}
      accessibilityRole="button"
      accessibilityLabel={`${ogrenci.isim}, ayrıntıları aç`}
      style={[styles.ogrenciSatiri, { borderTopColor: tema.kutuCerceve }]}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text
          style={[styles.ogrenciIsim, { color: tema.metin }]}
          numberOfLines={1}
        >
          {ogrenci.isim}
        </Text>
        {alt ? (
          <Text style={[styles.ogrenciAlt, { color: tema.ikincilMetin }]}>
            {alt}
          </Text>
        ) : null}
      </View>
      {sag}
      <Ionicons name="chevron-forward" size={18} color={tema.ikincilMetin} />
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: tema.arkaplan }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: 40,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.baslik, { color: tema.metin }]}>Genel Bakış</Text>
        {kapsamliOgretmen && (
          <Text style={[styles.kapsamYazi, { color: YONETICI_RENGI }]}>
            Kapsamın: {kapsamMetni(yetki.kapsam, yetki.gruplar, gruplar)}
          </Text>
        )}
        <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
          Aktif öğrenci: seçilen aralıkta en az bir soru soran öğrenci.
        </Text>

        <View style={styles.aralikSatiri}>
          {ARALIKLAR.map((n) => {
            const secilen = n === gun;
            return (
              <TouchableOpacity
                key={n}
                onPress={() => setGun(n)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: secilen }}
                style={[
                  styles.aralik,
                  {
                    backgroundColor: secilen ? YONETICI_RENGI : "transparent",
                    borderColor: secilen ? YONETICI_RENGI : tema.kutuCerceve,
                  },
                ]}
              >
                <Text
                  style={{
                    color: secilen ? "#fff" : tema.ikincilMetin,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  Son {n} gün
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.ozetSatiri}>
          {ozetKartlari.map((kart) => (
            <View
              key={kart.etiket}
              style={[
                styles.ozetKart,
                {
                  backgroundColor: tema.kutuArkaplan,
                  borderColor: tema.kutuCerceve,
                },
              ]}
            >
              <Text style={[styles.ozetSayi, { color: YONETICI_RENGI }]}>
                {kart.deger}
              </Text>
              <Text style={[styles.ozetEtiket, { color: tema.ikincilMetin }]}>
                {kart.etiket}
              </Text>
            </View>
          ))}
        </View>

        {satirlar.length === 0 ? (
          <View style={kutuStili}>
            <Text style={[styles.bosYazi, { color: tema.ikincilMetin }]}>
              {kapsamBos
                ? "Sana henüz bir grup atanmadı. Müdürün seni bir gruba atayınca o gruptaki öğrencilerin istatistikleri burada görünür."
                : kapsamliOgretmen
                  ? "Gruplarında henüz öğrenci yok. Öğrenciler gruplarına atandığında istatistikleri burada görünür."
                  : "Henüz dershaneye bağlı öğrenci yok. Öğrenciler dershane kodunu Profil sayfasından girince istatistikler burada görünür."}
            </Text>
          </View>
        ) : (
          <>
            <View style={kutuStili}>
              <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                Son {gun} Gün
              </Text>
              <Text style={[styles.kutuAlt, { color: tema.ikincilMetin }]}>
                Tüm öğrencilerin sorduğu soru sayısı
              </Text>
              <GunlukGrafik gunler={bakis.gunler} tema={tema} />
            </View>

            <View style={kutuStili}>
              <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                Dikkat Gerektirenler
              </Text>
              <Text style={[styles.kutuAlt, { color: tema.ikincilMetin }]}>
                Son {gun} günde hiç soru sormayan öğrenciler
              </Text>
              {bakis.dikkat.length === 0 ? (
                <Text
                  style={[
                    styles.bosYazi,
                    styles.solaYasla,
                    { color: tema.ikincilMetin },
                  ]}
                >
                  Harika! Tüm öğrenciler son {gun} günde soru sordu.
                </Text>
              ) : (
                <>
                  {bakis.dikkat
                    .slice(0, DIKKAT_SINIRI)
                    .map((d) => ogrenciSatiriGoster(d, null, dikkatMetni(d)))}
                  {bakis.dikkat.length > DIKKAT_SINIRI && (
                    <Text
                      style={[
                        styles.ogrenciAlt,
                        { color: tema.ikincilMetin, marginTop: 10 },
                      ]}
                    >
                      +{bakis.dikkat.length - DIKKAT_SINIRI} öğrenci daha
                      (Öğrenciler sekmesinden "Son aktiflik" sıralamasına bak)
                    </Text>
                  )}
                </>
              )}
            </View>

            <View style={kutuStili}>
              <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                Bu Hafta En Aktif
              </Text>
              <Text style={[styles.kutuAlt, { color: tema.ikincilMetin }]}>
                Son {gun} günde en çok soru soranlar
              </Text>
              {bakis.enAktif.length === 0 ? (
                <Text
                  style={[
                    styles.bosYazi,
                    styles.solaYasla,
                    { color: tema.ikincilMetin },
                  ]}
                >
                  Bu hafta henüz soru soran öğrenci yok.
                </Text>
              ) : (
                bakis.enAktif
                  .slice(0, EN_AKTIF_SINIRI)
                  .map((s, i) =>
                    ogrenciSatiriGoster(
                      s,
                      <Text style={[styles.sag, { color: YONETICI_RENGI }]}>
                        {s.donemSoru}
                      </Text>,
                      `${i + 1}. sıra`
                    )
                  )
              )}
            </View>

            <View style={kutuStili}>
              <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                En Çok Sorulan Konular
              </Text>
              <Text style={[styles.kutuAlt, { color: tema.ikincilMetin }]}>
                Öğrencilerin en çok takıldığı konular (tüm zamanlar)
              </Text>
              <KonuListesi
                konular={bakis.konular}
                tema={tema}
                sinir={8}
                bosMetin="Konu bilgisi, öğrenciler yeni soru sorduktan sonra burada görünür."
              />
            </View>

            <View style={kutuStili}>
              <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                Ders Dağılımı
              </Text>
              <Text style={[styles.kutuAlt, { color: tema.ikincilMetin }]}>
                Tüm zamanlar
              </Text>
              <DersCubuklari
                dersler={bakis.dersler.slice(0, 6)}
                tema={tema}
                bosMetin="Henüz soru gönderilmedi."
              />
            </View>
          </>
        )}
      </ScrollView>

      <OgrenciPenceresi
        satir={secili}
        tema={tema}
        simdi={simdi}
        mudurMu={mudurMu}
        kurumAdi={kurum?.ad}
        gruplar={gruplar}
        onKapat={() => setSeciliId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ortala: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  baslik: { fontSize: 26, fontWeight: "900" },
  aciklama: { fontSize: 12, marginTop: 4, marginBottom: 12 },
  kapsamYazi: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  aralikSatiri: { flexDirection: "row", marginBottom: 14 },
  aralik: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  ozetSatiri: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  ozetKart: {
    width: "23.5%",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  ozetSayi: { fontSize: 20, fontWeight: "900" },
  ozetEtiket: { fontSize: 10, marginTop: 3, textAlign: "center" },
  kutu: { padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1 },
  kutuBaslik: { fontSize: 15, fontWeight: "bold" },
  kutuAlt: { fontSize: 12, marginTop: 2, marginBottom: 14 },
  ogrenciSatiri: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ogrenciIsim: { fontSize: 15, fontWeight: "600" },
  ogrenciAlt: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  sag: { fontSize: 18, fontWeight: "900", marginRight: 8 },
  bosBaslik: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  bosYazi: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  solaYasla: { textAlign: "left" },
  buton: {
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  butonYazi: { color: "#fff", fontSize: 15, fontWeight: "bold" },
});
