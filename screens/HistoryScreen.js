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

// 📄 PDF ve Paylaşım Kütüphaneleri
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { ref, deleteObject, getDownloadURL } from "firebase/storage";
import { Ionicons } from "@expo/vector-icons";

import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";

import { useTheme } from "../ThemeContext";

const ekranGenisligi = Dimensions.get("window").width;
const ekranYuksekligi = Dimensions.get("window").height;

export default function HistoryScreen() {
  const { tema, temaModu } = useTheme();

  const [sorular, setSorular] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [indirmeBasladi, setIndirmeBasladi] = useState(false);

  const [seciliKategori, setSeciliKategori] = useState("Tümü");

  const temelKategoriler = [
    "Matematik",
    "Fizik",
    "Kimya",
    "Biyoloji",
    "Türkçe",
    "Tarih",
    "Coğrafya",
    "Diğer",
  ];
  const [dinamikKategoriler, setDinamikKategoriler] = useState([
    "Tümü",
    ...temelKategoriler,
  ]);

  const [seciliSoru, setSeciliSoru] = useState(null);
  const [modalGorunur, setModalGorunur] = useState(false);
  const [tamEkranModu, setTamEkranModu] = useState(false);
  const [cozumYukleniyor, setCozumYukleniyor] = useState(false);

  const [pratikModalGorunur, setPratikModalGorunur] = useState(false);
  const [aktifPratikSoru, setAktifPratikSoru] = useState(null);
  const [seciliPratikSeviye, setSeciliPratikSeviye] = useState("");
  const [secilenSik, setSecilenSik] = useState(null);

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

  useEffect(() => {
    if (sorular.length > 0) {
      const enSonSoru = sorular[0];
      const enSonDers = enSonSoru.subject || enSonSoru.ders;

      if (enSonDers && enSonDers !== "Tümü") {
        const yeniSiralama = ["Tümü", enSonDers];

        temelKategoriler.forEach((kategori) => {
          if (kategori !== enSonDers && !yeniSiralama.includes(kategori)) {
            yeniSiralama.push(kategori);
          }
        });
        setDinamikKategoriler(yeniSiralama);
      } else {
        setDinamikKategoriler(["Tümü", ...temelKategoriler]);
      }
    } else {
      setDinamikKategoriler(["Tümü", ...temelKategoriler]);
    }
  }, [sorular]);

  const filtrelenmisSorular =
    seciliKategori === "Tümü"
      ? sorular
      : sorular.filter(
          (soru) =>
            soru.ders === seciliKategori || soru.subject === seciliKategori
        );

  const soruDetayAc = async (soru) => {
    setSeciliSoru(soru);
    setModalGorunur(true);
    setTamEkranModu(false);
    setCozumYukleniyor(true);
    setPratikModalGorunur(false);

    if (soru.durum === "Çözüldü" && soru.okunduMu !== true) {
      try {
        await updateDoc(doc(db, "sorular", soru.id), {
          okunduMu: true,
        });
      } catch (error) {
        console.log("Okundu damgası vurulurken hata oluştu:", error);
      }
    }

    try {
      const userEmail = auth.currentUser?.email;
      let timestamp = soru.id;

      if (soru.fotoLink) {
        const match = soru.fotoLink.match(/(\d{13})/);
        if (match && match[1]) {
          timestamp = match[1];
        } else {
          const matchYedek = soru.fotoLink.match(/(\d+)\.(jpg|jpeg|png)/i);
          if (matchYedek && matchYedek[1]) {
            timestamp = matchYedek[1];
          }
        }
      }

      let jsonVerisi = null;
      try {
        const jsonYolu = `cozumDetayi/${userEmail}/${timestamp}.json`;
        const jsonRef = ref(storage, jsonYolu);
        const jsonUrl = await getDownloadURL(jsonRef);
        const response = await fetch(jsonUrl);
        jsonVerisi = await response.json();
      } catch (jsonHata) {
        console.log("JSON bulunamadı.");
      }

      let resimVerisi = null;
      try {
        const resimYolu = `solution-cards/${userEmail}/${timestamp}.png`;
        const resimRef = ref(storage, resimYolu);
        resimVerisi = await getDownloadURL(resimRef);
      } catch (resimHata) {
        console.log("Çözüm resmi bulunamadı.");
      }

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

      if (seciliSoru.fotoLink) {
        try {
          await deleteObject(ref(storage, seciliSoru.fotoLink));
        } catch (e) {}
      }

      try {
        const jsonYolu = `cozumDetayi/${userEmail}/${timestamp}.json`;
        await deleteObject(ref(storage, jsonYolu));
      } catch (e) {}

      try {
        const resimYolu = `solution-cards/${userEmail}/${timestamp}.png`;
        await deleteObject(ref(storage, resimYolu));
      } catch (e) {}

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
      console.log("İndirme Hatası Detayı:", error);
      Alert.alert("Hata", "Fotoğraf indirilirken bir sorun oluştu.");
    } finally {
      setIndirmeBasladi(false);
    }
  };

  const pratikEkraniAc = (seviyeAdi, soruData) => {
    if (!soruData) return;
    if (typeof soruData === "string" || !soruData.options) {
      Alert.alert(
        "Bilgi",
        "Bu sorunun pratik testi eski formatta oluşturulmuş. Lütfen yeni çözdürdüğünüz sorularda deneyin."
      );
      return;
    }

    setSeciliPratikSeviye(seviyeAdi);
    setAktifPratikSoru(soruData);
    setSecilenSik(null);
    setPratikModalGorunur(true);
  };

  const pdfOlarakIndir = async () => {
    try {
      setIndirmeBasladi(true);

      const indirilecekSorular = filtrelenmisSorular;

      if (indirilecekSorular.length === 0) {
        Alert.alert("Bilgi", "Bu kategoride indirilecek soru bulunmuyor.");
        setIndirmeBasladi(false);
        return;
      }

      const userEmail = auth.currentUser?.email;
      let sorularHtml = "";

      for (let i = 0; i < indirilecekSorular.length; i++) {
        const soru = indirilecekSorular[i];
        const dersAdi = soru.subject || soru.ders || "Ders Belirtilmemiş";
        const tarih = new Date(soru.tarih).toLocaleDateString("tr-TR");
        const durum = soru.durum || "Bilinmiyor";

        let cozumMetni = "";

        if (durum !== "Çözüldü") {
          cozumMetni =
            "⏳ Bu soru henüz yapay zeka tarafından çözülmedi veya beklemede.";
        } else {
          let timestamp = soru.id;
          if (soru.fotoLink) {
            const match = soru.fotoLink.match(/(\d{13})/);
            if (match && match[1]) {
              timestamp = match[1];
            } else {
              const matchYedek = soru.fotoLink.match(/(\d+)\.(jpg|jpeg|png)/i);
              if (matchYedek && matchYedek[1]) timestamp = matchYedek[1];
            }
          }

          try {
            const jsonYolu = `cozumDetayi/${userEmail}/${timestamp}.json`;
            const jsonUrl = await getDownloadURL(ref(storage, jsonYolu));
            const response = await fetch(jsonUrl);
            const jsonVerisi = await response.json();

            cozumMetni =
              jsonVerisi.cardAnswer ||
              jsonVerisi.correct_answer ||
              jsonVerisi.solution ||
              jsonVerisi.answer ||
              jsonVerisi.sonuc ||
              jsonVerisi.result ||
              jsonVerisi.explanation ||
              "Çözüm dosyası bulundu fakat sonuç formatı farklı (Eski format).";
          } catch (e) {
            cozumMetni =
              "⚠️ Yapay zeka analiz dosyası sunucuda bulunamadı (Test veya silinmiş veri).";
          }
        }

        const resimHtml = soru.fotoLink
          ? `<img src="${soru.fotoLink}" style="max-width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px; margin-bottom: 15px; border: 1px solid #ddd;" />`
          : `<div style="padding: 20px; background: #eee; text-align: center; border-radius: 8px; margin-bottom: 15px; color: #888;">Fotoğraf Yok</div>`;

        sorularHtml += `
        <div class="soru-kutusu">
          <div class="soru-baslik">
            <span>Soru ${i + 1} - ${dersAdi}</span>
            <span>${tarih}</span>
          </div>
          ${resimHtml}
          <div class="cozum-kutusu">
            <strong>Yapay Zeka Çözümü:</strong><br/>
            <p style="margin-top:8px; line-height:1.6; font-size:15px;">${cozumMetni}</p>
          </div>
        </div>
      `;
      }

      const htmlIcerik = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hata Defterim</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
          h1 { text-align: center; color: #2C3E50; border-bottom: 2px solid #3498DB; padding-bottom: 10px; font-size: 28px; margin-bottom: 5px; }
          .kategori-bilgi { text-align: center; font-size: 14px; color: #7F8C8D; margin-bottom: 35px; }
          .soru-kutusu { border: 1px solid #BDC3C7; border-radius: 8px; padding: 20px; margin-bottom: 25px; page-break-inside: avoid; }
          .soru-baslik { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; color: #2980B9; border-bottom: 1px solid #ECF0F1; padding-bottom: 10px; margin-bottom: 15px; }
          .cozum-kutusu { background-color: #F4F6F7; border-left: 4px solid #1ABC9C; padding: 15px; border-radius: 4px; font-size: 15px; }
          .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #95A5A6; border-top: 1px solid #ECF0F1; padding-top: 15px; }
        </style>
      </head>
      <body>
        <h1>Akıllı Hata Defterim</h1>
        <div class="kategori-bilgi">Seçilen Kategori: <strong>${seciliKategori}</strong> | Toplam Soru: <strong>${indirilecekSorular.length}</strong></div>
        ${sorularHtml}
        <div class="footer">Bu belge Akıllı Hata Defterim uygulaması tarafından otomatik oluşturulmuştur.</div>
      </body>
      </html>
    `;

      const { uri } = await Print.printToFileAsync({
        html: htmlIcerik,
        base64: false,
      });

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Hata Defterimi Paylaş",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Bilgi", "Cihazınızda paylaşım özelliği desteklenmiyor.");
      }
    } catch (error) {
      console.log("PDF Oluşturma Hatası:", error);
      Alert.alert("Hata", "PDF oluşturulurken bir sorun yaşandı.");
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
      <View style={styles.headerKapsayici}>
        <Text style={[styles.anaBaslik, { color: tema.metin }]}>
          Hata Defterim
        </Text>
      </View>

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
        <>
          <View style={styles.kategoriKapsayici}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {dinamikKategoriler.map((kategori, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.kategoriButon,
                    {
                      backgroundColor:
                        seciliKategori === kategori
                          ? tema.anaButon
                          : tema.kutuArkaplan,
                      borderColor:
                        seciliKategori === kategori
                          ? tema.anaButon
                          : tema.kutuCerceve,
                    },
                  ]}
                  onPress={() => setSeciliKategori(kategori)}
                >
                  <Text
                    style={[
                      styles.kategoriYazi,
                      {
                        color:
                          seciliKategori === kategori ? "#fff" : tema.metin,
                      },
                    ]}
                  >
                    {kategori}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {filtrelenmisSorular.length === 0 ? (
            <View style={styles.bosMesajKutusu}>
              <Text
                style={[styles.bosMesajYazisi, { color: tema.ikincilMetin }]}
              >
                Bu kategoriye ait soru bulunmuyor.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtrelenmisSorular}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 80 }}
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
                  <Image
                    source={{ uri: item.fotoLink }}
                    style={styles.kucukFoto}
                  />
                  <View style={styles.kartBilgi}>
                    {/* 🎯 GÜNCELLENEN KISIM: Ders Adı En Üste ve Kalın Puntuya Alındı */}
                    {(item.subject || item.ders) && (
                      <Text style={[styles.kartDersAd, { color: tema.metin }]}>
                        {item.subject || item.ders}
                      </Text>
                    )}
                    {/* Tarih sadeleştirildi ve ders adının altına alındı */}
                    <Text
                      style={[styles.kartTarih, { color: tema.ikincilMetin }]}
                    >
                      {new Date(item.tarih).toLocaleString("tr-TR")}
                    </Text>
                    <Text
                      style={[
                        styles.kartDurum,
                        {
                          color:
                            item.durum === "Çözüldü"
                              ? "#4CAF50"
                              : tema.anaButon,
                        },
                      ]}
                    >
                      {item.durum === "Çözüldü"
                        ? "✅ Çözüldü"
                        : "⏳ " + item.durum}
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
        </>
      )}

      {filtrelenmisSorular.length > 0 && (
        <TouchableOpacity
          style={[styles.fabButon, { backgroundColor: tema.anaButon }]}
          onPress={pdfOlarakIndir}
          disabled={indirmeBasladi}
        >
          {indirmeBasladi ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text" size={24} color="#fff" />
              <Text style={styles.fabYazi}>PDF</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* ANA SORU DETAY MODALI */}
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

                    {(seciliSoru.cozumDetayi.easy_question ||
                      seciliSoru.cozumDetayi.medium_question ||
                      seciliSoru.cozumDetayi.hard_question) && (
                      <View style={styles.benzerSoruBolumu}>
                        <Text
                          style={[
                            styles.adimlarAnaBaslik,
                            { color: tema.metin },
                          ]}
                        >
                          🎯 Pratik Yap
                        </Text>

                        <View style={styles.seviyeButonKonteyner}>
                          {seciliSoru.cozumDetayi.easy_question && (
                            <TouchableOpacity
                              style={[
                                styles.seviyeButon,
                                { borderColor: "#4CAF50" },
                              ]}
                              onPress={() =>
                                pratikEkraniAc(
                                  "Kolay",
                                  seciliSoru.cozumDetayi.easy_question
                                )
                              }
                            >
                              <Text
                                style={{ color: "#4CAF50", fontWeight: "bold" }}
                              >
                                Kolay
                              </Text>
                            </TouchableOpacity>
                          )}

                          {seciliSoru.cozumDetayi.medium_question && (
                            <TouchableOpacity
                              style={[
                                styles.seviyeButon,
                                { borderColor: "#FF9800" },
                              ]}
                              onPress={() =>
                                pratikEkraniAc(
                                  "Orta",
                                  seciliSoru.cozumDetayi.medium_question
                                )
                              }
                            >
                              <Text
                                style={{ color: "#FF9800", fontWeight: "bold" }}
                              >
                                Orta
                              </Text>
                            </TouchableOpacity>
                          )}

                          {seciliSoru.cozumDetayi.hard_question && (
                            <TouchableOpacity
                              style={[
                                styles.seviyeButon,
                                { borderColor: "#F44336" },
                              ]}
                              onPress={() =>
                                pratikEkraniAc(
                                  "Zor",
                                  seciliSoru.cozumDetayi.hard_question
                                )
                              }
                            >
                              <Text
                                style={{ color: "#F44336", fontWeight: "bold" }}
                              >
                                Zor
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}
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

            {pratikModalGorunur && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.pratikModalArkaplan,
                  { zIndex: 999 },
                ]}
              >
                <View
                  style={[
                    styles.pratikModalKutu,
                    { backgroundColor: tema.kutuArkaplan },
                  ]}
                >
                  <View style={styles.pratikUstKontroller}>
                    <Text style={[styles.pratikBaslik, { color: tema.metin }]}>
                      {seciliPratikSeviye} Seviye Test
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPratikModalGorunur(false)}
                    >
                      <Ionicons
                        name="close-circle"
                        size={28}
                        color={tema.ikincilMetin}
                      />
                    </TouchableOpacity>
                  </View>

                  {aktifPratikSoru && (
                    <ScrollView showsVerticalScrollIndicator={false}>
                      <Text
                        style={[styles.pratikSoruMetni, { color: tema.metin }]}
                      >
                        {aktifPratikSoru.question}
                      </Text>

                      {aktifPratikSoru.options &&
                        Object.entries(aktifPratikSoru.options).map(
                          ([harf, secenek]) => {
                            let arkaplanRengi = tema.arkaplan;
                            let cerceveRengi = tema.kutuCerceve;
                            let yaziRengi = tema.metin;

                            if (secilenSik) {
                              if (harf === aktifPratikSoru.correct_option) {
                                arkaplanRengi =
                                  temaModu === "dark" ? "#064E3B" : "#ECFDF5";
                                cerceveRengi = "#10B981";
                                yaziRengi =
                                  temaModu === "dark" ? "#A7F3D0" : "#065F46";
                              } else if (
                                secilenSik === harf &&
                                harf !== aktifPratikSoru.correct_option
                              ) {
                                arkaplanRengi =
                                  temaModu === "dark" ? "#7F1D1D" : "#FEF2F2";
                                cerceveRengi = "#EF4444";
                                yaziRengi =
                                  temaModu === "dark" ? "#FECACA" : "#991B1B";
                              } else {
                                arkaplanRengi = tema.kutuArkaplan;
                                cerceveRengi = "transparent";
                                yaziRengi = tema.ikincilMetin;
                              }
                            }

                            return (
                              <TouchableOpacity
                                key={harf}
                                disabled={secilenSik !== null}
                                onPress={() => setSecilenSik(harf)}
                                style={[
                                  styles.sikKutusu,
                                  {
                                    backgroundColor: arkaplanRengi,
                                    borderColor: cerceveRengi,
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.harfDairesi,
                                    {
                                      backgroundColor:
                                        cerceveRengi === "transparent"
                                          ? tema.kutuCerceve
                                          : cerceveRengi,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.harfYazisi,
                                      {
                                        color:
                                          cerceveRengi === "transparent"
                                            ? tema.metin
                                            : "#fff",
                                      },
                                    ]}
                                  >
                                    {harf}
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.sikMetni,
                                    { color: yaziRengi },
                                  ]}
                                >
                                  {secenek}
                                </Text>

                                {secilenSik &&
                                  harf === aktifPratikSoru.correct_option && (
                                    <Ionicons
                                      name="checkmark-circle"
                                      size={24}
                                      color="#10B981"
                                    />
                                  )}
                                {secilenSik === harf &&
                                  harf !== aktifPratikSoru.correct_option && (
                                    <Ionicons
                                      name="close-circle"
                                      size={24}
                                      color="#EF4444"
                                    />
                                  )}
                              </TouchableOpacity>
                            );
                          }
                        )}

                      {secilenSik && (
                        <View
                          style={{
                            marginTop: 20,
                            padding: 15,
                            borderRadius: 10,
                            backgroundColor:
                              secilenSik === aktifPratikSoru.correct_option
                                ? "#10B98120"
                                : "#EF444420",
                          }}
                        >
                          <Text
                            style={{
                              textAlign: "center",
                              fontWeight: "bold",
                              color:
                                secilenSik === aktifPratikSoru.correct_option
                                  ? "#10B981"
                                  : "#EF4444",
                            }}
                          >
                            {secilenSik === aktifPratikSoru.correct_option
                              ? "🎉 Tebrikler, Doğru Cevap!"
                              : "Kötü Şans, Yanlış Cevap."}
                          </Text>
                        </View>
                      )}
                      <View style={{ height: 30 }} />
                    </ScrollView>
                  )}
                </View>
              </View>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  headerKapsayici: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 20,
  },
  anaBaslik: {
    fontSize: 24,
    fontWeight: "bold",
  },
  kategoriKapsayici: {
    marginBottom: 15,
  },
  kategoriButon: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
  },
  kategoriYazi: {
    fontSize: 14,
    fontWeight: "bold",
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
  // 🎯 YENİ EKLENEN STİL: Ders Adı
  kartDersAd: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 3,
  },
  kartTarih: { fontSize: 12, marginBottom: 5 },
  kartDurum: { fontSize: 16, fontWeight: "bold" },
  kucukFoto: { width: 60, height: 60, borderRadius: 8, marginRight: 15 },
  fabButon: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 65,
    height: 65,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  fabYazi: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    marginTop: -2,
  },
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
  seviyeButonKonteyner: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  seviyeButon: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
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
  pratikModalArkaplan: {
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  pratikModalKutu: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    maxHeight: "75%",
    minHeight: "45%",
  },
  pratikUstKontroller: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.2)",
    paddingBottom: 15,
  },
  pratikBaslik: {
    fontSize: 20,
    fontWeight: "bold",
  },
  pratikSoruMetni: {
    fontSize: 17,
    fontWeight: "600",
    lineHeight: 26,
    marginBottom: 25,
  },
  sikKutusu: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  harfDairesi: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  harfYazisi: {
    fontWeight: "bold",
    fontSize: 16,
  },
  sikMetni: {
    fontSize: 16,
    flex: 1,
    fontWeight: "500",
  },
});
