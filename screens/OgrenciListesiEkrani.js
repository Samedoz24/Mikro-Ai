import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useTheme } from "../ThemeContext";
import useYoneticiYetkisi, {
  YONETICI_RENGI,
} from "../utils/useYoneticiYetkisi";
import {
  SIRALAMALAR,
  aktiflikMetni,
  kurumToplamlari,
  ogrenciSatiri,
  ogrenciSirala,
} from "../utils/kurumIstatistik";
import OgrenciDetay from "./OgrenciDetay";

// Müdür ve öğretmenin öğrenci listesi. Yalnızca sunucunun hazırladığı istatistik özetlerini okur;
// soru içerikleri bu ekranda yoktur.
export default function OgrenciListesiEkrani() {
  const { tema } = useTheme();
  const insets = useSafeAreaInsets();
  const { yetki, yenile } = useYoneticiYetkisi();

  const [ozetler, setOzetler] = useState(null); // null: yükleniyor
  const [hata, setHata] = useState(false);
  const [olcut, setOlcut] = useState("aktiflik");
  const [aranan, setAranan] = useState("");
  const [seciliId, setSeciliId] = useState(null);
  // "Bugün" ve "dün" gibi ifadeler özet her değiştiğinde yeniden hesaplanır
  const [simdi, setSimdi] = useState(Date.now());

  useEffect(() => {
    if (!yetki) {
      setOzetler(null);
      return;
    }
    setHata(false);
    return onSnapshot(
      collection(db, "kurumlar", yetki.kurumId, "ozet"),
      (snap) => {
        setOzetler(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setSimdi(Date.now());
        setHata(false);
      },
      (e) => {
        console.log("Öğrenci özetleri okunamadı:", e?.code);
        setHata(true);
      }
    );
  }, [yetki]);

  const satirlar = useMemo(
    () => (ozetler || []).map((o) => ogrenciSatiri(o.id, o, simdi)),
    [ozetler, simdi]
  );
  const toplamlar = useMemo(() => kurumToplamlari(satirlar), [satirlar]);
  const liste = useMemo(
    () => ogrenciSirala(satirlar, olcut, aranan),
    [satirlar, olcut, aranan]
  );
  // Seçili öğrenci özet güncellenince canlı kalır; öğrenci ayrılırsa pencere kapanır
  const secili = satirlar.find((s) => s.id === seciliId) || null;

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

  const ozetKartlari = [
    { etiket: "Öğrenci", deger: toplamlar.ogrenci },
    { etiket: "Bugün soru", deger: toplamlar.bugun },
    { etiket: "7 gün soru", deger: toplamlar.son7 },
    { etiket: "Aktif öğrenci", deger: toplamlar.aktifOgrenci },
  ];

  const baslik = (
    <View>
      <Text style={[styles.baslik, { color: tema.metin }]}>Öğrenciler</Text>
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
      <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
        Aktif öğrenci: son 7 günde en az bir soru soran öğrenci sayısı.
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

      <View style={styles.sirala}>
        {SIRALAMALAR.map((s) => {
          const secili = s.id === olcut;
          return (
            <TouchableOpacity
              key={s.id}
              onPress={() => setOlcut(s.id)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: secili }}
              style={[
                styles.siraSecenek,
                {
                  backgroundColor: secili ? YONETICI_RENGI : "transparent",
                  borderColor: secili ? YONETICI_RENGI : tema.kutuCerceve,
                },
              ]}
            >
              <Text
                style={{
                  color: secili ? "#fff" : tema.ikincilMetin,
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
          : "Aramana uyan öğrenci bulunamadı."}
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

      <Modal
        visible={!!secili}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSeciliId(null)}
        onDismiss={() => setSeciliId(null)}
      >
        <View
          style={{
            flex: 1,
            paddingTop: Platform.OS === "android" ? insets.top : 0,
            backgroundColor: tema.arkaplan,
          }}
        >
          {secili && (
            <OgrenciDetay
              satir={secili}
              tema={tema}
              simdi={simdi}
              onKapat={() => setSeciliId(null)}
            />
          )}
        </View>
      </Modal>
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
  baslik: { fontSize: 26, fontWeight: "900", marginBottom: 16 },
  ozetSatiri: { flexDirection: "row", justifyContent: "space-between" },
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
  aciklama: { fontSize: 12, marginTop: 8, marginBottom: 16 },
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
  sirala: { flexDirection: "row", flexWrap: "wrap", marginBottom: 14 },
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
