import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  useColorScheme,
  ActivityIndicator,
} from "react-native";
import { colors } from "../theme";
// Firebase araçlarını içeri aktarıyoruz
import { auth, db } from "../firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";

export default function HistoryScreen() {
  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  const [sorular, setSorular] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  // Ekran açıldığında veritabanını dinlemeye başla
  useEffect(() => {
    // Sadece anlık giriş yapan kullanıcının sorularını getiren sorgu
    const q = query(
      collection(db, "sorular"),
      where("kullaniciEposta", "==", auth.currentUser?.email)
    );

    // onSnapshot: Veritabanında her değişiklik olduğunda listeyi otomatik günceller
    const abonelik = onSnapshot(q, (snapshot) => {
      const geciciDizi = [];
      snapshot.forEach((doc) => {
        // Veritabanındaki her bir satırı alıp listemize ekliyoruz
        geciciDizi.push({ id: doc.id, ...doc.data() });
      });

      // Soruları en yeniden en eskiye doğru sıralıyoruz
      geciciDizi.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

      setSorular(geciciDizi);
      setYukleniyor(false); // Veriler geldi, yükleme ikonunu kapat
    });

    // Sayfa kapandığında dinlemeyi durdur (bellek tasarrufu için)
    return () => abonelik();
  }, []);

  const dinamikStil = {
    container: { flex: 1, padding: 20, backgroundColor: tema.arkaplan },
    baslik: {
      fontSize: 24,
      fontWeight: "bold",
      marginBottom: 20,
      color: tema.metin,
      textAlign: "center",
    },
    bosMesajKutusu: { flex: 1, justifyContent: "center", alignItems: "center" },
    bosMesajYazisi: {
      fontSize: 16,
      color: tema.ikincilMetin,
      textAlign: "center",
      marginTop: 10,
    },
    kart: {
      backgroundColor: tema.kutuArkaplan,
      padding: 15,
      borderRadius: 10,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: tema.kutuCerceve,
    },
    kartTarih: { fontSize: 12, color: tema.ikincilMetin, marginBottom: 5 },
    kartDurum: { fontSize: 16, fontWeight: "bold", color: tema.anaButon },
  };

  // Veriler veritabanından gelene kadar dönen ikon göster
  if (yukleniyor) {
    return (
      <View style={[dinamikStil.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={tema.anaButon} />
      </View>
    );
  }

  return (
    <View style={dinamikStil.container}>
      <Text style={dinamikStil.baslik}>Akıllı Hata Defterim 📚</Text>

      {sorular.length === 0 ? (
        <View style={dinamikStil.bosMesajKutusu}>
          <Text style={{ fontSize: 50 }}>📭</Text>
          <Text style={dinamikStil.bosMesajYazisi}>
            Henüz hiç soru sormadın.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorular}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            // Bilgisayar tarihini okunabilir bir saate çeviriyoruz
            const okunanTarih = new Date(item.tarih).toLocaleString("tr-TR");

            return (
              <View style={dinamikStil.kart}>
                <Text style={dinamikStil.kartTarih}>{okunanTarih}</Text>
                <Text style={dinamikStil.kartDurum}>Durum: {item.durum}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
