import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Dimensions,
  Alert,
} from "react-native";
import { auth, db, storage } from "../firebaseConfig";
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
// Storage'dan dosya çekmek ve silmek için gerekli fonksiyonlar
import { ref, deleteObject, getDownloadURL } from "firebase/storage";
import { Ionicons } from "@expo/vector-icons";

// İndirme İşlemleri Paketleri
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";

// Tema Sistemimiz
import { useTheme } from "../ThemeContext";

const ekranGenisligi = Dimensions.get("window").width;
const ekranYuksekligi = Dimensions.get("window").height;

export default function HistoryScreen() {
  const { tema, temaModu } = useTheme();

  const [sorular, setSorular] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [indirmeBasladi, setIndirmeBasladi] = useState(false);

  const [seciliSoru, setSeciliSoru] = useState(null);
  const [modalGorunur, setModalGorunur] = useState(false);
  const [tamEkranModu, setTamEkranModu] = useState(false);
  const [cozumYukleniyor, setCozumYukleniyor] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "sorular"),
      where("kullaniciEposta", "==", auth.currentUser?.email || "")
    );

    const abonelik = onSnapshot(
      q,
      (snapshot) => {
        const geciciDizi = [];
        snapshot.forEach((doc) => {
          geciciDizi.push({ id: doc.id, ...doc.data() });
        });

        geciciDizi.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

        setSorular(geciciDizi);
        setYukleniyor(false);
      },
      (error) => {
        console.log("Firestore okuma hatası:", error);
        setYukleniyor(false);
      }
    );

    return () => abonelik();
  }, []);

  // Storage'dan JSON Çözüm Verisini ve Resmini Çeken Fonksiyon
  const soruDetayAc = async (soru) => {
    setSeciliSoru(soru);
    setModalGorunur(true);
    setTamEkranModu(false);
    setCozumYukleniyor(true);

    try {
      const userEmail = auth.currentUser?.email;
      let timestamp = soru.id;

      // Linkin içindeki 13 haneli sayıyı (timestamp) kesin olarak bulur
      if (soru.fotoLink) {
        const match = soru.fotoLink.match(/(\d{13})/);
        if (match && match[1]) {
          timestamp = match[1];
        } else {
          // Eğer 13 haneli değilse eski usul noktadan öncekini almayı dene
          const matchYedek = soru.fotoLink.match(/(\d+)\.(jpg|jpeg|png)/i);
          if (matchYedek && matchYedek[1]) {
            timestamp = matchYedek[1];
          }
        }
      }

      console.log("Kullanılan Timestamp:", timestamp);
      console.log("Kullanılan E-Posta:", userEmail);

      // 1. JSON Verisini Çekme (Düzeltilmiş Yol)
      let jsonVerisi = null;
      try {
        const jsonYolu = `cozumDetayi/${userEmail}/${timestamp}.json`;
        console.log("Aranan JSON Yolu:", jsonYolu);

        const jsonRef = ref(storage, jsonYolu);
        const jsonUrl = await getDownloadURL(jsonRef);

        const response = await fetch(jsonUrl);
        jsonVerisi = await response.json();
      } catch (jsonHata) {
        console.log("JSON bulunamadı. Hata detayı:", jsonHata.message);
      }

      // 2. Çözüm Kartı (Resim) Çekme (Düzeltilmiş Yol)
      let resimVerisi = null;
      try {
        const resimYolu = `solution-cards/${userEmail}/${timestamp}.png`;
        console.log("Aranan Resim Yolu:", resimYolu);

        const resimRef = ref(storage, resimYolu);
        resimVerisi = await getDownloadURL(resimRef);
      } catch (resimHata) {
        console.log("Çözüm resmi bulunamadı. Hata detayı:", resimHata.message);
      }

      // İndirilen verileri seçili soruya ekle
      setSeciliSoru((prev) => ({
        ...prev,
        cozumDetayi: jsonVerisi,
        cozumKartiLink: resimVerisi,
      }));
    } catch (error) {
      console.log("Veriler çekilirken genel hata oluştu:", error);
    } finally {
      setCozumYukleniyor(false);
    }
  };

  const soruyuSil = async () => {
    if (!seciliSoru) return;
    try {
      let timestamp = seciliSoru.id;
      if (seciliSoru.fotoLink) {
        const match = seciliSoru.fotoLink.match(/(\d{13})/);
        if (match && match[1]) {
          timestamp = match[1];
        } else {
          const matchYedek = seciliSoru.fotoLink.match(
            /(\d+)\.(jpg|jpeg|png)/i
          );
          if (matchYedek && matchYedek[1]) {
            timestamp = matchYedek[1];
          }
        }
      }

      const userEmail = auth.currentUser?.email;

      // Orijinal sorunun fotoğrafını sil
      if (seciliSoru.fotoLink) {
        try {
          await deleteObject(ref(storage, seciliSoru.fotoLink));
        } catch (e) {
          console.log("Orijinal fotoğraf silinemedi.");
        }
      }

      // Storage'daki JSON çözüm dosyasını sil
      try {
        const jsonYolu = `cozumDetayi/${userEmail}/${timestamp}.json`;
        await deleteObject(ref(storage, jsonYolu));
      } catch (e) {
        console.log("JSON dosyası silinemedi.");
      }

      // Storage'daki Çözüm Kartını (Resim) sil
      try {
        const resimYolu = `solution-cards/${userEmail}/${timestamp}.png`;
        await deleteObject(ref(storage, resimYolu));
      } catch (e) {
        console.log("Çözüm resmi silinemedi.");
      }

      // Firestore belgesini sil
      await deleteDoc(doc(db, "sorular", seciliSoru.id));

      setModalGorunur(false);
    } catch (error) {
      Alert.alert("Hata", "Soru silinirken bir sorun oluştu.");
    }
  };

  const silmeOnayiIste = () => {
    Alert.alert(
      "Soruyu Sil",
      "Bu soruyu ve tüm verilerini kalıcı olarak silmek istediğine emin misin?",
      [
        { text: "İptal", style: "cancel" },
        { text: "Evet, Sil", onPress: soruyuSil, style: "destructive" },
      ]
    );
  };
  const cozumKartiniIndir = async () => {
    if (!seciliSoru?.cozumKartiLink) {
      Alert.alert("Hata", "İndirilecek bir çözüm kartı bulunamadı.");
      return;
    }
    try {
      setIndirmeBasladi(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("İzin Gerekli", "Galeri erişim izni vermeniz gerekiyor.");
        setIndirmeBasladi(false);
        return;
      }
      const dosyaAdi = `CozumKarti_${Date.now()}.png`;
      const dosyaYolu = FileSystem.documentDirectory + dosyaAdi;
      const { uri } = await FileSystem.downloadAsync(
        seciliSoru.cozumKartiLink,
        dosyaYolu
      );
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Başarılı!", "Çözüm kartı galerinize kaydedildi. 🖼️");
    } catch (error) {
      // Hatayı terminalde detaylı görmek için log ekledik
      console.log("İndirme Hatası Detayı:", error);
      Alert.alert("Hata", "Fotoğraf indirilirken bir sorun oluştu.");
    } finally {
      setIndirmeBasladi(false);
    }
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
          renderItem={({ item }) => (
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
              <Image source={{ uri: item.fotoLink }} style={styles.kucukFoto} />
              <View style={styles.kartBilgi}>
                <Text style={[styles.kartTarih, { color: tema.ikincilMetin }]}>
                  {new Date(item.tarih).toLocaleString("tr-TR")}
                </Text>
                <Text
                  style={[
                    styles.kartDurum,
                    {
                      color:
                        item.durum === "Çözüldü" ? "#4CAF50" : tema.anaButon,
                    },
                  ]}
                >
                  {item.durum === "Çözüldü" ? "✅ Çözüldü" : "⏳ " + item.durum}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward-outline"
                size={20}
                color={tema.ikincilMetin}
              />
            </TouchableOpacity>
          )}
        />
      )}

      <Modal
        visible={modalGorunur}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalGorunur(false)}
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
              source={{ uri: seciliSoru?.fotoLink }}
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

                {cozumYukleniyor ? (
                  <View style={{ padding: 40, alignItems: "center" }}>
                    <ActivityIndicator size="large" color={tema.anaButon} />
                    <Text style={{ color: tema.metin, marginTop: 15 }}>
                      Çözüm dosyası çekiliyor...
                    </Text>
                  </View>
                ) : seciliSoru?.cozumDetayi ? (
                  <View style={styles.jsonArayuzKonteyner}>
                    <View style={styles.aiEtiketKutusu}>
                      <Text style={styles.aiEtiketYazi}>AI Çözüm</Text>
                    </View>
                    <Text
                      style={[styles.cozumAnaBaslik, { color: tema.metin }]}
                    >
                      {seciliSoru.cozumDetayi.cardTitle || "Soru Çözümü"}
                    </Text>

                    <View
                      style={[
                        styles.bilgiEtiketi,
                        {
                          backgroundColor:
                            temaModu === "dark" ? "#1A1A1A" : "#F9FAFB",
                        },
                      ]}
                    >
                      <Text style={{ color: tema.metin, fontWeight: "600" }}>
                        📚 {seciliSoru.cozumDetayi.subject} ›{" "}
                        {seciliSoru.cozumDetayi.topic}
                      </Text>
                    </View>

                    {(seciliSoru.cozumDetayi.cardExpression ||
                      seciliSoru.cozumDetayi.expression) && (
                      <View
                        style={[
                          styles.formulKutu,
                          {
                            backgroundColor: tema.anaButon + "15",
                            borderColor: tema.anaButon,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.kucukBaslik, { color: tema.anaButon }]}
                        >
                          📐 Kullanılan Formül
                        </Text>
                        <Text
                          style={[styles.formulMetin, { color: tema.metin }]}
                        >
                          {seciliSoru.cozumDetayi.cardExpression ||
                            seciliSoru.cozumDetayi.expression}
                        </Text>
                      </View>
                    )}

                    {(
                      seciliSoru.cozumDetayi.cardSteps ||
                      seciliSoru.cozumDetayi.steps
                    )?.map((adim, index) => (
                      <View
                        key={index}
                        style={[
                          styles.adimKutusu,
                          {
                            backgroundColor:
                              temaModu === "dark" ? "#1E293B" : "#EFF6FF",
                            borderLeftColor: tema.anaButon,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.adimBaslik, { color: tema.anaButon }]}
                        >
                          ADIM {index + 1}
                        </Text>
                        <Text
                          style={[styles.adimIcerik, { color: tema.metin }]}
                        >
                          {adim}
                        </Text>
                      </View>
                    ))}

                    <View
                      style={[
                        styles.cevapKutusu,
                        {
                          backgroundColor:
                            temaModu === "dark" ? "#064E3B" : "#ECFDF5",
                          borderColor: "#10B981",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.kucukBaslik,
                          {
                            color: temaModu === "dark" ? "#34D399" : "#059669",
                          },
                        ]}
                      >
                        KESİN SONUÇ
                      </Text>
                      <Text
                        style={[
                          styles.cevapMetni,
                          {
                            color: temaModu === "dark" ? "#A7F3D0" : "#065F46",
                          },
                        ]}
                      >
                        {String(
                          seciliSoru.cozumDetayi.cardAnswer ||
                            seciliSoru.cozumDetayi.correct_answer ||
                            seciliSoru.cozumDetayi.solution ||
                            seciliSoru.cozumDetayi.answer ||
                            seciliSoru.cozumDetayi.sonuc ||
                            seciliSoru.cozumDetayi.result ||
                            "Sonuç bulunamadı"
                        )}
                      </Text>
                    </View>

                    {seciliSoru.cozumDetayi.explanation && (
                      <View style={{ marginBottom: 25 }}>
                        <Text
                          style={[
                            styles.kucukBaslik,
                            { color: tema.ikincilMetin },
                          ]}
                        >
                          💡 Bilgi Notu
                        </Text>
                        <Text
                          style={[styles.aciklamaMetin, { color: tema.metin }]}
                        >
                          {seciliSoru.cozumDetayi.explanation}
                        </Text>
                      </View>
                    )}

                    {seciliSoru.cozumKartiLink && (
                      <View style={{ marginBottom: 25 }}>
                        <Text
                          style={[
                            styles.adimlarAnaBaslik,
                            { color: tema.metin },
                          ]}
                        >
                          🖼️ Çözüm Görseli
                        </Text>
                        <Image
                          source={{ uri: seciliSoru.cozumKartiLink }}
                          style={[
                            styles.modalBuyukFoto,
                            { resizeMode: "contain" },
                          ]}
                        />
                      </View>
                    )}

                    <View style={styles.benzerSoruBolumu}>
                      <Text
                        style={[styles.adimlarAnaBaslik, { color: tema.metin }]}
                      >
                        🎯 Pratik Yap
                      </Text>
                      {seciliSoru.cozumDetayi.easy_question && (
                        <View
                          style={[
                            styles.egzersizKutu,
                            {
                              backgroundColor:
                                temaModu === "dark" ? "#1A1A1A" : "#F9FAFB",
                            },
                          ]}
                        >
                          <Text
                            style={{ fontWeight: "bold", color: "#4CAF50" }}
                          >
                            Kolay Seviye:
                          </Text>
                          <Text style={{ color: tema.metin }}>
                            {seciliSoru.cozumDetayi.easy_question}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={{ padding: 40, alignItems: "center" }}>
                    <ActivityIndicator size="large" color={tema.anaButon} />
                    <Text
                      style={{
                        color: tema.metin,
                        marginTop: 15,
                        textAlign: "center",
                      }}
                    >
                      Yapay zeka analiz dosyası bekleniyor...
                    </Text>
                  </View>
                )}

                {seciliSoru?.cozumKartiLink && (
                  <TouchableOpacity
                    onPress={cozumKartiniIndir}
                    disabled={indirmeBasladi}
                    style={[
                      styles.indirButonu,
                      {
                        backgroundColor: indirmeBasladi
                          ? tema.ikincilMetin
                          : tema.anaButon,
                      },
                    ]}
                  >
                    {indirmeBasladi ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons
                          name="download-outline"
                          size={22}
                          color="#fff"
                          style={{ marginRight: 8 }}
                        />
                        <Text style={styles.indirButonuYazi}>
                          Çözüm Kartını İndir
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                <View style={{ height: 40 }} />
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
    marginTop: 20,
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
  kucukFoto: { width: 60, height: 60, borderRadius: 8, marginRight: 15 },
  modalArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalKutu: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    maxHeight: "95%",
  },
  modalUstKontroller: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  kapatButon: { flexDirection: "row", alignItems: "center" },
  modalKapatYazi: { fontWeight: "bold", fontSize: 16, marginRight: 2 },
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
    height: 200,
    borderRadius: 15,
    marginBottom: 15,
    resizeMode: "cover",
  },
  jsonArayuzKonteyner: { marginTop: 10 },
  aiEtiketKutusu: {
    backgroundColor: "#1E293B",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 15,
  },
  aiEtiketYazi: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  cozumAnaBaslik: { fontSize: 26, fontWeight: "900", marginBottom: 20 },
  bilgiEtiketi: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: "center",
    borderColor: "#ccc",
  },
  formulKutu: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 20,
  },
  formulMetin: {
    fontSize: 20,
    textAlign: "center",
    fontWeight: "bold",
    fontStyle: "italic",
    marginTop: 5,
  },
  kucukBaslik: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  aciklamaMetin: { fontSize: 15, fontStyle: "italic", lineHeight: 22 },
  adimlarKonteyner: { marginBottom: 25 },
  adimlarAnaBaslik: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  adimKutusu: {
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  adimBaslik: { fontSize: 13, fontWeight: "bold", marginBottom: 6 },
  adimIcerik: { fontSize: 16, lineHeight: 24 },
  cevapKutusu: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
  },
  cevapMetni: { fontSize: 28, fontWeight: "900" },
  benzerSoruBolumu: {
    marginTop: 10,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(150,150,150,0.2)",
  },
  egzersizKutu: {
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    borderColor: "#ccc",
  },
  indirButonu: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 15,
    marginTop: 10,
  },
  indirButonuYazi: { color: "#fff", fontSize: 16, fontWeight: "bold" },
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
