import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { YONETICI_RENGI } from "../utils/useYoneticiYetkisi";
import { sorulariHazirla, tarihSaatMetni } from "../utils/kurumSorular";

const SAYFA_BOYUTU = 30;

// Bir öğrencinin gönderdiği soruların listesi. Yalnızca müdür bu ekrana ulaşır; güvenlik kuralları
// da soru belgelerini yalnızca öğrencinin kurumunun müdürüne açar.
export default function OgrenciSorulari({
  ogrenciId,
  isim,
  tema,
  onGeri,
  onSoruAc,
}) {
  const [sorular, setSorular] = useState(null); // null: yükleniyor
  const [hata, setHata] = useState(false);
  const [gosterilen, setGosterilen] = useState(SAYFA_BOYUTU);
  const canli = useRef(true);

  useEffect(() => {
    canli.current = true;
    return () => {
      canli.current = false;
    };
  }, []);

  const yukle = useCallback(async () => {
    setHata(false);
    setSorular(null);
    try {
      const snap = await getDocs(
        query(collection(db, "sorular"), where("kullaniciUid", "==", ogrenciId))
      );
      if (!canli.current) return;
      setSorular(
        sorulariHazirla(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      );
    } catch (e) {
      console.log("Öğrenci soruları okunamadı:", e?.code);
      if (canli.current) setHata(true);
    }
  }, [ogrenciId]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const baslik = (
    <View style={[styles.baslik, { borderBottomColor: tema.kutuCerceve }]}>
      <TouchableOpacity
        onPress={onGeri}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Geri"
        style={styles.geri}
      >
        <Ionicons name="chevron-back" size={26} color={YONETICI_RENGI} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.baslikYazi, { color: tema.metin }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {isim}
        </Text>
        <Text style={[styles.altYazi, { color: tema.ikincilMetin }]}>
          {sorular === null || hata ? "Sorular" : `${sorular.length} soru`}
        </Text>
      </View>
    </View>
  );

  const merkez = (icerik) => (
    <View style={{ flex: 1, backgroundColor: tema.arkaplan }}>
      {baslik}
      <View style={styles.ortala}>{icerik}</View>
    </View>
  );

  if (sorular === null && !hata) {
    return merkez(<ActivityIndicator size="large" color={YONETICI_RENGI} />);
  }

  if (hata) {
    return merkez(
      <>
        <Text style={[styles.bosYazi, { color: tema.ikincilMetin }]}>
          Sorular yüklenemedi. İnternet bağlantını kontrol edip tekrar dene.
        </Text>
        <TouchableOpacity
          style={[styles.buton, { backgroundColor: YONETICI_RENGI }]}
          onPress={yukle}
          activeOpacity={0.8}
        >
          <Text style={styles.butonYazi}>Tekrar Dene</Text>
        </TouchableOpacity>
      </>
    );
  }

  if (sorular.length === 0) {
    return merkez(
      <Text style={[styles.bosYazi, { color: tema.ikincilMetin }]}>
        Bu öğrenci henüz soru göndermedi.
      </Text>
    );
  }

  const gorunenler = sorular.slice(0, gosterilen);

  const renderSoru = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onSoruAc(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.dersAdi} sorusu, ${tarihSaatMetni(
        item.tarihMs
      )}`}
      style={[
        styles.satir,
        { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
      ]}
    >
      {item.fotoLink ? (
        <Image
          source={{ uri: item.fotoLink }}
          style={[styles.kucukFoto, { backgroundColor: tema.kutuCerceve }]}
        />
      ) : (
        <View
          style={[
            styles.kucukFoto,
            styles.fotoYok,
            { backgroundColor: tema.kutuCerceve },
          ]}
        >
          <Ionicons name="image-outline" size={22} color={tema.ikincilMetin} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.ders, { color: tema.metin }]} numberOfLines={1}>
          {item.dersAdi}
        </Text>
        <Text style={[styles.altYazi, { color: tema.ikincilMetin }]}>
          {tarihSaatMetni(item.tarihMs)}
        </Text>
      </View>
      <View
        style={[
          styles.durum,
          {
            backgroundColor: item.cozuldu
              ? YONETICI_RENGI + "22"
              : tema.kutuCerceve,
          },
        ]}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: item.cozuldu ? YONETICI_RENGI : tema.ikincilMetin,
          }}
        >
          {item.cozuldu ? "Çözüldü" : item.durum || "Bekliyor"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: tema.arkaplan }}>
      {baslik}
      <FlatList
        data={gorunenler}
        keyExtractor={(item) => item.id}
        renderItem={renderSoru}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          gosterilen < sorular.length ? (
            <TouchableOpacity
              style={[styles.dahaFazla, { borderColor: tema.kutuCerceve }]}
              onPress={() => setGosterilen((g) => g + SAYFA_BOYUTU)}
              activeOpacity={0.7}
            >
              <Text style={{ color: YONETICI_RENGI, fontWeight: "700" }}>
                Daha eski soruları göster ({sorular.length - gosterilen})
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />
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
  geri: { paddingHorizontal: 6 },
  baslikYazi: { fontSize: 18, fontWeight: "900" },
  altYazi: { fontSize: 12, marginTop: 2 },
  ortala: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  bosYazi: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  buton: {
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  butonYazi: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  satir: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  kucukFoto: { width: 56, height: 56, borderRadius: 10, marginRight: 12 },
  fotoYok: { alignItems: "center", justifyContent: "center" },
  ders: { fontSize: 15, fontWeight: "bold" },
  durum: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  dahaFazla: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
});
