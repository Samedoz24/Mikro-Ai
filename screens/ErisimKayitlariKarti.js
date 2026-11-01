import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { YONETICI_RENGI } from "../utils/useYoneticiYetkisi";
import useKurumOzetleri from "../utils/useKurumOzetleri";
import { milisaniye } from "../utils/kurumIstatistik";
import { tarihSaatMetni } from "../utils/kurumSorular";

const SON_KAYIT = 15;
const TUR_METNI = {
  "soru-listesi": "soru listesine baktı",
  "soru-detay": "bir soruyu inceledi",
  rapor: "rapor hazırladı",
};

// KVKK erişim kayıtları (yalnızca müdür): kim, hangi öğrencinin verisine, ne zaman eriştiği.
// Kayıtlar sunucuda yazılır, 12 ay saklanır ve silinemez. Soru içeriği kayıtta tutulmaz.
export default function ErisimKayitlariKarti({ kurumId, tema }) {
  const [kayitlar, setKayitlar] = useState(null);
  const [hata, setHata] = useState(false);
  const { ozetler } = useKurumOzetleri(kurumId);

  useEffect(() => {
    if (!kurumId) return undefined;
    return onSnapshot(
      query(
        collection(db, "kurumlar", kurumId, "erisimKayitlari"),
        orderBy("zaman", "desc"),
        limit(SON_KAYIT)
      ),
      (snap) => {
        setKayitlar(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setHata(false);
      },
      (e) => {
        console.log("Erişim kayıtları okunamadı:", e?.code);
        setHata(true);
      }
    );
  }, [kurumId]);

  const isimler = useMemo(
    () => new Map((ozetler || []).map((o) => [o.id, o.isim])),
    [ozetler]
  );

  return (
    <View
      style={[
        styles.kutu,
        { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
      ]}
    >
      <View style={styles.baslikSatiri}>
        <Text style={[styles.baslik, { color: tema.metin }]}>
          Erişim Kayıtları
        </Text>
        <Text style={styles.ikon}>🔎</Text>
      </View>
      <Text style={[styles.kucukYazi, { color: tema.ikincilMetin }]}>
        Öğrenci verilerine kimin ne zaman eriştiği kaydedilir. Kayıtlar 12 ay
        saklanır; öğrenciler dershane yönetiminin son erişim tarihini görür.
      </Text>

      {kayitlar === null && !hata ? (
        <ActivityIndicator color={YONETICI_RENGI} style={{ margin: 16 }} />
      ) : kayitlar === null ? (
        <Text
          style={[
            styles.kucukYazi,
            { color: tema.ikincilMetin, marginTop: 10 },
          ]}
        >
          Kayıtlar yüklenemedi. İnternet bağlantını kontrol et.
        </Text>
      ) : kayitlar.length === 0 ? (
        <Text
          style={[
            styles.kucukYazi,
            { color: tema.ikincilMetin, marginTop: 10 },
          ]}
        >
          Henüz kayıtlı bir erişim yok.
        </Text>
      ) : (
        kayitlar.map((k, i) => (
          <View
            key={k.id}
            style={[
              styles.satir,
              i > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: tema.kutuCerceve,
              },
            ]}
          >
            <Text style={[styles.ana, { color: tema.metin }]}>
              {isimler.get(k.ogrenciUid) || "Öğrenci"} —{" "}
              {TUR_METNI[k.tur] || "erişildi"}
            </Text>
            <Text style={[styles.alt, { color: tema.ikincilMetin }]}>
              {k.yoneticiEposta || "Yönetici"} ·{" "}
              {tarihSaatMetni(milisaniye(k.zaman))}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kutu: { padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1 },
  baslikSatiri: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  baslik: { fontSize: 15, fontWeight: "bold" },
  ikon: { fontSize: 20 },
  kucukYazi: { fontSize: 13, lineHeight: 19 },
  satir: { paddingVertical: 10 },
  ana: { fontSize: 14, fontWeight: "600" },
  alt: { fontSize: 12, marginTop: 2 },
});
