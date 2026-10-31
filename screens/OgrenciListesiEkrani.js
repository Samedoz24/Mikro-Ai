import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
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
import {
  DURUM_FILTRELERI,
  SIRALAMALAR,
  aktiflikMetni,
  dersSecenekleri,
  durumSayilari,
  ogrenciFiltrele,
  ogrenciSatiri,
  ogrenciSirala,
} from "../utils/kurumIstatistik";
import OgrenciPenceresi from "./OgrenciPenceresi";

// Müdür ve öğretmenin öğrenci listesi. Yalnızca sunucunun hazırladığı istatistik özetlerini okur;
// soru içerikleri bu ekranda yoktur.
export default function OgrenciListesiEkrani() {
  const { tema } = useTheme();
  const insets = useSafeAreaInsets();
  const { yetki, yenile } = useYoneticiYetkisi();
  const { ozetler, hata } = useKurumOzetleri(yetki?.kurumId);
  const kurum = useKurum(yetki?.kurumId);

  const [olcut, setOlcut] = useState("aktiflik");
  const [durum, setDurum] = useState("hepsi");
  const [ders, setDers] = useState(null);
  const [aranan, setAranan] = useState("");
  const [seciliId, setSeciliId] = useState(null);
  // "Bugün" ve "dün" gibi ifadeler özet her değiştiğinde yeniden hesaplanır
  const [simdi, setSimdi] = useState(Date.now());
  useEffect(() => {
    setSimdi(Date.now());
  }, [ozetler]);

  const satirlar = useMemo(
    () => (ozetler || []).map((o) => ogrenciSatiri(o.id, o, simdi)),
    [ozetler, simdi]
  );
  const dersler = useMemo(() => dersSecenekleri(satirlar), [satirlar]);
  // Seçili ders artık hiçbir öğrencide yoksa (öğrenci ayrıldı vb.) süzgeç kendiliğinden kalkar
  const gecerliDers = dersler.some((d) => d.ders === ders) ? ders : null;
  const sayilar = useMemo(
    () => durumSayilari(satirlar, gecerliDers),
    [satirlar, gecerliDers]
  );
  const liste = useMemo(
    () =>
      ogrenciSirala(
        ogrenciFiltrele(satirlar, { durum, ders: gecerliDers }),
        olcut,
        aranan
      ),
    [satirlar, durum, gecerliDers, olcut, aranan]
  );
  // Seçili öğrenci özet güncellenince canlı kalır; öğrenci ayrılırsa pencere kapanır
  const secili = satirlar.find((s) => s.id === seciliId) || null;
  const mudurMu = yetki?.kurumRol === "mudur";

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
          Öğrenciler Yüklenemedi
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

  const baslik = (
    <View>
      <Text style={[styles.baslik, { color: tema.metin }]}>Öğrenciler</Text>
      <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
        {liste.length === satirlar.length
          ? `${satirlar.length} öğrenci`
          : `${liste.length} / ${satirlar.length} öğrenci`}
      </Text>

      <View
        style={[
          styles.aramaKutusu,
          { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
        ]}
      >
        <Ionicons name="search" size={18} color={tema.ikincilMetin} />
        <TextInput
          style={[styles.aramaGirdisi, { color: tema.metin }]}
          value={aranan}
          onChangeText={setAranan}
          placeholder="Öğrenci ara"
          placeholderTextColor={tema.ikincilMetin}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <Text style={[styles.grupEtiket, { color: tema.ikincilMetin }]}>
        Durum (son 7 gün)
      </Text>
      <View style={styles.sirala}>
        {DURUM_FILTRELERI.map((f) => {
          const secilen = f.id === durum;
          return (
            <TouchableOpacity
              key={f.id}
              onPress={() => setDurum(f.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: secilen }}
              style={[
                styles.siraSecenek,
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
                {f.etiket} ({sayilar[f.id]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {dersler.length > 1 && (
        <>
          <Text style={[styles.grupEtiket, { color: tema.ikincilMetin }]}>
            Ders
          </Text>
          <View style={styles.sirala}>
            {[{ ders: null, etiket: "Tüm dersler" }, ...dersler].map((d) => {
              const secilen = d.ders === gecerliDers;
              return (
                <TouchableOpacity
                  key={d.ders ?? "hepsi"}
                  onPress={() => setDers(d.ders)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: secilen }}
                  style={[
                    styles.siraSecenek,
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
                    {d.etiket ?? d.ders}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <Text style={[styles.grupEtiket, { color: tema.ikincilMetin }]}>
        Sıralama
      </Text>
      <View style={styles.sirala}>
        {SIRALAMALAR.map((s) => {
          const secilen = s.id === olcut;
          return (
            <TouchableOpacity
              key={s.id}
              onPress={() => setOlcut(s.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: secilen }}
              style={[
                styles.siraSecenek,
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
                {s.etiket}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const bos = (
    <View style={styles.listeBos}>
      <Text style={[styles.bosYazi, { color: tema.ikincilMetin }]}>
        {satirlar.length === 0
          ? "Henüz dershaneye bağlı öğrenci yok. Öğrenciler dershane kodunu Profil sayfasından girince burada görünür."
          : "Seçtiğin süzgeçlere ve aramana uyan öğrenci bulunamadı."}
      </Text>
    </View>
  );

  const renderSatir = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => setSeciliId(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`${item.isim}, ayrıntıları aç`}
      style={[
        styles.satir,
        { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: YONETICI_RENGI + "22" }]}>
        <Text style={[styles.avatarHarf, { color: YONETICI_RENGI }]}>
          {item.isim.trim().charAt(0).toLocaleUpperCase("tr-TR")}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.satirIsim, { color: tema.metin }]}
          numberOfLines={1}
        >
          {item.isim}
        </Text>
        <Text
          style={[styles.satirAlt, { color: tema.ikincilMetin }]}
          numberOfLines={1}
        >
          {aktiflikMetni(item.sonAktiflikMs, simdi)}
          {item.enCokDers ? ` · ${item.enCokDers}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={[
            styles.satirSayi,
            { color: item.aktif ? YONETICI_RENGI : tema.ikincilMetin },
          ]}
        >
          {item.son7}
        </Text>
        <Text style={[styles.satirAlt, { color: tema.ikincilMetin }]}>
          bu hafta · {item.toplam} toplam
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: tema.arkaplan }}>
      <FlatList
        data={liste}
        keyExtractor={(item) => item.id}
        renderItem={renderSatir}
        ListHeaderComponent={baslik}
        ListEmptyComponent={bos}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: 40,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      />

      <OgrenciPenceresi
        satir={secili}
        tema={tema}
        simdi={simdi}
        mudurMu={mudurMu}
        kurumAdi={kurum?.ad}
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
  aciklama: { fontSize: 13, marginTop: 2, marginBottom: 16 },
  aramaKutusu: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  aramaGirdisi: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 15,
  },
  grupEtiket: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  sirala: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  siraSecenek: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  satir: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarHarf: { fontSize: 18, fontWeight: "900" },
  satirIsim: { fontSize: 15, fontWeight: "bold" },
  satirAlt: { fontSize: 12, marginTop: 2 },
  satirSayi: { fontSize: 20, fontWeight: "900" },
  listeBos: { paddingVertical: 30, paddingHorizontal: 10 },
  bosBaslik: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  bosYazi: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  buton: {
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  butonYazi: { color: "#fff", fontSize: 15, fontWeight: "bold" },
});
