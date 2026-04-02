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
import { Ionicons } from "@expo/vector-icons"; // 🚀 Standart İkon Kütüphanesi Eklendi

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

  if (yukleniyor) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: tema.arkaplan, justifyContent: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={tema.anaButon} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: tema.arkaplan }]}>
      <Text style={[styles.baslik, { color: tema.metin }]}>
        Akıllı Hata Defterim
      </Text>

      {sorular.length === 0 ? (
        <View style={styles.bosMesajKutusu}>
          <Ionicons
            name="folder-open-outline"
            size={60}
            color={tema.ikincilMetin}
            style={styles.ikon}
          />
          <Text style={[styles.bosMesajYazisi, { color: tema.ikincilMetin }]}>
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
                style={[
                  styles.kart,
                  {
                    backgroundColor: tema.kutuArkaplan,
                    borderColor: tema.kutuCerceve,
                  },
                ]}
                onPress={() => soruDetayAc(item)}
              >
                {item.fotoLink ? (
                  <Image
                    source={{ uri: item.fotoLink }}
                    style={styles.kucukFoto}
                  />
                ) : (
                  <View
                    style={[
                      styles.kucukFoto,
                      { backgroundColor: tema.kutuCerceve },
                    ]}
                  />
                )}
                <View style={styles.kartBilgi}>
                  <Text
                    style={[styles.kartTarih, { color: tema.ikincilMetin }]}
                  >
                    {okunanTarih}
                  </Text>
                  <Text style={[styles.kartDurum, { color: tema.anaButon }]}>
                    Durum: {item.durum}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward-outline"
                  size={20}
                  color={tema.ikincilMetin}
                />
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
          <View style={styles.tamEkranArkaplan}>
            <TouchableOpacity
              style={styles.tamEkranKapatButon}
              onPress={() => setTamEkranModu(false)}
            >
              <Ionicons name="close-circle" size={36} color="#fff" />
            </TouchableOpacity>
            <Image
              source={{ uri: seciliSoru.fotoLink }}
              style={styles.tamEkranResim}
            />
          </View>
        ) : (
          <View style={styles.modalArkaplan}>
            <View
              style={[styles.modalKutu, { backgroundColor: tema.kutuArkaplan }]}
            >
              <View style={styles.modalUstKontroller}>
                <TouchableOpacity
                  onPress={silmeOnayiIste}
                  style={[
                    styles.modalSilButon,
                    { backgroundColor: tema.hataKirmizi },
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.modalSilButonYazi}>Sil</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setModalGorunur(false)}
                  style={styles.kapatButon}
                >
                  <Text
                    style={[
                      styles.modalKapatYazi,
                      { color: tema.ikincilMetin },
                    ]}
                  >
                    Kapat
                  </Text>
                  <Ionicons
                    name="close-outline"
                    size={24}
                    color={tema.ikincilMetin}
                  />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {seciliSoru?.fotoLink && (
                  <TouchableOpacity onPress={() => setTamEkranModu(true)}>
                    <Image
                      source={{ uri: seciliSoru.fotoLink }}
                      style={styles.modalBuyukFoto}
                    />
                  </TouchableOpacity>
                )}

                <Text
                  style={[
                    styles.kartDurum,
                    { color: tema.anaButon, fontSize: 18, marginBottom: 5 },
                  ]}
                >
                  Durum: {seciliSoru?.durum}
                </Text>
                <Text style={[styles.kartTarih, { color: tema.ikincilMetin }]}>
                  Sorma Tarihi:{" "}
                  {seciliSoru &&
                    new Date(seciliSoru.tarih).toLocaleString("tr-TR")}
                </Text>

                <Text
                  style={[styles.modalCevapBaslik, { color: tema.aiButon }]}
                >
                  Yapay Zeka Cevabı:
                </Text>
                <Text style={[styles.modalCevapMetin, { color: tema.metin }]}>
                  {seciliSoru?.cevap
                    ? seciliSoru.cevap
                    : "Yapay zeka henüz bu soruyu yanıtlamadı. Lütfen biraz bekleyip tekrar kontrol et."}
                </Text>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  baslik: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  bosMesajKutusu: { flex: 1, justifyContent: "center", alignItems: "center" },
  ikon: { marginBottom: 15, opacity: 0.8 },
  bosMesajYazisi: { fontSize: 16, textAlign: "center" },
  kart: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  kartBilgi: { flex: 1 },
  kartTarih: { fontSize: 12, marginBottom: 5 },
  kartDurum: { fontSize: 16, fontWeight: "bold" },
  kucukFoto: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  modalArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 20,
  },
  modalKutu: {
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
  kapatButon: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalKapatYazi: {
    fontWeight: "bold",
    fontSize: 16,
    marginRight: 2,
  },
  modalSilButon: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalSilButonYazi: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 5,
  },
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
    marginTop: 15,
    marginBottom: 5,
  },
  modalCevapMetin: { fontSize: 16, lineHeight: 24 },
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
    borderRadius: 20,
    zIndex: 10,
  },
});
