import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  useColorScheme,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Dimensions,
  Alert,
} from "react-native";
import { colors } from "../theme";
import { auth, db } from "../firebaseConfig";
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";

const ekranGenisligi = Dimensions.get("window").width;
const ekranYuksekligi = Dimensions.get("window").height;

export default function HistoryScreen() {
  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  const [sorular, setSorular] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  const [seciliSoru, setSeciliSoru] = useState(null);
  const [modalGorunur, setModalGorunur] = useState(false);
  const [tamEkranModu, setTamEkranModu] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "sorular"),
      where("kullaniciEposta", "==", auth.currentUser?.email)
    );

    const abonelik = onSnapshot(q, (snapshot) => {
      const geciciDizi = [];
      snapshot.forEach((doc) => {
        geciciDizi.push({ id: doc.id, ...doc.data() });
      });

      geciciDizi.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

      setSorular(geciciDizi);
      setYukleniyor(false);
    });

    return () => abonelik();
  }, []);

  const soruDetayAc = (soru) => {
    setSeciliSoru(soru);
    setTamEkranModu(false);
    setModalGorunur(true);
  };

  const soruyuSil = async () => {
    if (!seciliSoru) return;
    try {
      await deleteDoc(doc(db, "sorular", seciliSoru.id));
      setModalGorunur(false);
      setTamEkranModu(false);
    } catch (error) {
      Alert.alert("Hata", "Soru silinirken bir sorun oluştu.");
    }
  };

  const silmeOnayiIste = () => {
    Alert.alert(
      "Soruyu Sil",
      "Bu soruyu hata defterinden kalıcı olarak silmek istediğine emin misin?",
      [
        { text: "İptal", style: "cancel" },
        { text: "Evet, Sil", onPress: soruyuSil, style: "destructive" },
      ]
    );
  };

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
      flexDirection: "row",
      alignItems: "center",
    },
    kartBilgi: { flex: 1 },
    kartTarih: { fontSize: 12, color: tema.ikincilMetin, marginBottom: 5 },
    kartDurum: { fontSize: 16, fontWeight: "bold", color: tema.anaButon },
    kucukFoto: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 15,
      backgroundColor: tema.kutuCerceve,
    },
    modalArkaplan: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.8)",
      justifyContent: "center",
      padding: 20,
    },
    modalKutu: {
      backgroundColor: tema.kutuArkaplan,
      borderRadius: 15,
      padding: 20,
      maxHeight: "90%",
    },
    modalUstKontroller: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
    },
    modalKapatYazi: {
      color: tema.ikincilMetin,
      fontWeight: "bold",
      fontSize: 16,
    },
    modalSilButon: {
      backgroundColor: tema.hataKirmizi,
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 8,
    },
    modalSilButonYazi: { color: "#fff", fontWeight: "bold", fontSize: 16 },
    modalBuyukFoto: {
      width: "100%",
      height: 250,
      borderRadius: 10,
      marginBottom: 15,
      resizeMode: "contain",
      backgroundColor: "#000",
    },
    modalCevapBaslik: {
      fontSize: 18,
      fontWeight: "bold",
      color: tema.aiButon,
      marginTop: 15,
      marginBottom: 5,
    },
    modalCevapMetin: { fontSize: 16, color: tema.metin, lineHeight: 24 },
    tamEkranArkaplan: {
      flex: 1,
      backgroundColor: "#000",
      justifyContent: "center",
      alignItems: "center",
    },
    tamEkranResim: {
      width: ekranGenisligi,
      height: ekranYuksekligi,
      resizeMode: "contain",
    },
    tamEkranKapatButon: {
      position: "absolute",
      top: 50,
      right: 20,
      backgroundColor: "rgba(255,255,255,0.2)",
      padding: 10,
      borderRadius: 10,
      zIndex: 10,
    },
    tamEkranKapatYazi: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  };

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
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const okunanTarih = new Date(item.tarih).toLocaleString("tr-TR");
            return (
              <TouchableOpacity
                style={dinamikStil.kart}
                onPress={() => soruDetayAc(item)}
              >
                {item.fotoLink ? (
                  <Image
                    source={{ uri: item.fotoLink }}
                    style={dinamikStil.kucukFoto}
                  />
                ) : (
                  <View style={dinamikStil.kucukFoto} />
                )}
                <View style={dinamikStil.kartBilgi}>
                  <Text style={dinamikStil.kartTarih}>{okunanTarih}</Text>
                  <Text style={dinamikStil.kartDurum}>Durum: {item.durum}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal
        visible={modalGorunur}
        animationType="fade"
        transparent={true}
        onRequestClose={() =>
          tamEkranModu ? setTamEkranModu(false) : setModalGorunur(false)
        }
      >
        {tamEkranModu ? (
          <View style={dinamikStil.tamEkranArkaplan}>
            <TouchableOpacity
              style={dinamikStil.tamEkranKapatButon}
              onPress={() => setTamEkranModu(false)}
            >
              <Text style={dinamikStil.tamEkranKapatYazi}>Geri Dön ✖</Text>
            </TouchableOpacity>
            <Image
              source={{ uri: seciliSoru.fotoLink }}
              style={dinamikStil.tamEkranResim}
            />
          </View>
        ) : (
          <View style={dinamikStil.modalArkaplan}>
            <View style={dinamikStil.modalKutu}>
              <View style={dinamikStil.modalUstKontroller}>
                <TouchableOpacity
                  onPress={silmeOnayiIste}
                  style={dinamikStil.modalSilButon}
                >
                  <Text style={dinamikStil.modalSilButonYazi}>🗑 Sil</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setModalGorunur(false)}>
                  <Text style={dinamikStil.modalKapatYazi}>Kapat ✖</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {seciliSoru?.fotoLink && (
                  <TouchableOpacity onPress={() => setTamEkranModu(true)}>
                    <Image
                      source={{ uri: seciliSoru.fotoLink }}
                      style={dinamikStil.modalBuyukFoto}
                    />
                  </TouchableOpacity>
                )}

                <Text
                  style={[
                    dinamikStil.kartDurum,
                    { fontSize: 18, marginBottom: 5 },
                  ]}
                >
                  Durum: {seciliSoru?.durum}
                </Text>
                <Text style={dinamikStil.kartTarih}>
                  Sorma Tarihi:{" "}
                  {seciliSoru &&
                    new Date(seciliSoru.tarih).toLocaleString("tr-TR")}
                </Text>

                <Text style={dinamikStil.modalCevapBaslik}>
                  Yapay Zeka Cevabı:
                </Text>
                <Text style={dinamikStil.modalCevapMetin}>
                  {seciliSoru?.cevap
                    ? seciliSoru.cevap
                    : "Yapay zeka henüz bu soruyu yanıtlamadı. Lütfen biraz bekleyip tekrar kontrol et. ⏳"}
                </Text>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}
