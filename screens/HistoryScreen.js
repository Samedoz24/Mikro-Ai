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
  StatusBar,
  Platform,
  Pressable,
} from "react-native";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// 🚀 YENİ: Sayfa odağını anlamak ve StatusBar çakışmasını önlemek için eklendi
import { useIsFocused } from "@react-navigation/native";

import { auth, db, storage } from "../firebaseConfig";

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
import { ref, deleteObject } from "firebase/storage";
import { Ionicons } from "@expo/vector-icons";

import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";

import { useTheme } from "../ThemeContext";
import { colors } from "../theme";
import { usePremium } from "../PremiumContext";
import {
  cozumYukle,
  cozumOnbellekSil,
  cozumYollari,
} from "../utils/cozumYukleyici";
import { soruBlokHtml, belgeHtml } from "../utils/pdfIcerik";
import { DERSLER, dersBul } from "../utils/ders";

const ekranGenisligi = Dimensions.get("window").width;
const ekranYuksekligi = Dimensions.get("window").height;

// PDF için bir sorunun çözümü (önbellekten ya da sunucudan). Çözüm yoksa nedeni `mesaj` olarak döner.
const pdfCozumVerisi = async (soru, eposta) => {
  if (soru.durum !== "Çözüldü") {
    return {
      cozum: null,
      mesaj: "⏳ Bu soru henüz yapay zeka tarafından çözülmedi veya beklemede.",
    };
  }
  const { cozumDetayi, hata } = await cozumYukle(soru, eposta);
  if (!cozumDetayi) {
    return {
      cozum: null,
      mesaj: hata
        ? "⚠️ Çözüm şu an yüklenemedi."
        : "⚠️ Yapay zeka analiz dosyası sunucuda bulunamadı (Test veya silinmiş veri).",
    };
  }
  return { cozum: cozumDetayi, mesaj: "" };
};

const PRATIK_SEVIYELERI = {
  kolay: { ad: "Kolay", renk: "#4CAF50" },
  orta: { ad: "Orta", renk: "#FF9800" },
  zor: { ad: "Zor", renk: "#F44336" },
};

export default function HistoryScreen() {
  const { tema, temaModu } = useTheme();
  const insets = useSafeAreaInsets();
  const { premiumMu, premiumAc } = usePremium();

  // 🚀 EKLENDİ: Sayfa odakta mı kontrolü
  const isFocused = useIsFocused();
  const isGercektenKaranlik = tema.arkaplan === colors.dark.arkaplan;

  const [sorular, setSorular] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [indirmeBasladi, setIndirmeBasladi] = useState(false);

  const [seciliKategori, setSeciliKategori] = useState("Tümü");

  const temelKategoriler = DERSLER;
  const [dinamikKategoriler, setDinamikKategoriler] = useState([
    "Tümü",
    ...temelKategoriler,
  ]);

  const [seciliSoru, setSeciliSoru] = useState(null);
  const [modalGorunur, setModalGorunur] = useState(false);
  const [tamEkranModu, setTamEkranModu] = useState(false);
  const [cozumYukleniyor, setCozumYukleniyor] = useState(false);
  const [cozumHatasi, setCozumHatasi] = useState(false);

  const [pratikModalGorunur, setPratikModalGorunur] = useState(false);
  const [aktifPratikSoru, setAktifPratikSoru] = useState(null);
  const [seciliPratikSeviye, setSeciliPratikSeviye] = useState("");
  const [secilenSik, setSecilenSik] = useState(null);
  const [pratikCozumGorunur, setPratikCozumGorunur] = useState(false);
  const [dersSecimiAcik, setDersSecimiAcik] = useState(false);

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
      const enSonDers = dersBul(enSonSoru);

      if (enSonDers && enSonDers !== "Tümü" && enSonDers !== "Diğer") {
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
      : sorular.filter((soru) => dersBul(soru) === seciliKategori);

  const soruDetayAc = async (soru) => {
    setSeciliSoru(soru);
    setModalGorunur(true);
    setTamEkranModu(false);
    setCozumYukleniyor(true);
    setCozumHatasi(false);
    setPratikModalGorunur(false);
    setDersSecimiAcik(false);

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
      const sonuc = await cozumYukle(soru, auth.currentUser?.email);
      setSeciliSoru((prev) => ({
        ...prev,
        cozumDetayi: sonuc.cozumDetayi,
        cozumKartiLink: sonuc.cozumKartiLink,
      }));
      setCozumHatasi(!sonuc.cozumDetayi && !!sonuc.hata);
    } catch (error) {
      console.log("Veriler çekilirken genel hata oluştu:", error);
      setCozumHatasi(true);
    } finally {
      setCozumYukleniyor(false);
    }
  };

  const soruyuSil = async () => {
    if (!seciliSoru) return;
    try {
      const userEmail = auth.currentUser?.email;

      if (seciliSoru.fotoLink) {
        try {
          await deleteObject(ref(storage, seciliSoru.fotoLink));
        } catch (e) {}
      }

      // Çözüm JSON'u ve kartı: n8n'in yazdığı yol, UID yolu ve eski e-posta yolu
      const yollar = cozumYollari(seciliSoru, userEmail);
      for (const yol of [...yollar.json, ...yollar.resim]) {
        try {
          await deleteObject(ref(storage, yol));
        } catch (e) {
          if (e?.code !== "storage/object-not-found") {
            console.log("Çözüm dosyası silinemedi:", yol, e?.code);
          }
        }
      }

      await cozumOnbellekSil(seciliSoru, userEmail);
      await deleteDoc(doc(db, "sorular", seciliSoru.id));
      setModalGorunur(false);
    } catch (error) {
      Alert.alert("Hata", "Soru silinirken bir sorun oluştu.");
    }
  };

  // Kullanıcının seçtiği ders her zaman önceliklidir; otomatik tahmin ya da n8n bunu ezmez.
  const dersiKaydet = async (ders) => {
    setDersSecimiAcik(false);
    if (!seciliSoru || dersBul(seciliSoru) === ders) return;
    try {
      await updateDoc(doc(db, "sorular", seciliSoru.id), {
        ders,
        dersKaynak: "kullanici",
      });
      setSeciliSoru((onceki) => ({ ...onceki, ders }));
    } catch (hata) {
      console.log("Ders kaydedilemedi:", hata?.code);
      Alert.alert(
        "Kaydedilemedi",
        "Ders değiştirilemedi. İnternet bağlantını kontrol edip tekrar dene."
      );
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
    let gecici = null;
    try {
      setIndirmeBasladi(true);
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("İzin Gerekli", "Galeri erişim izni vermeniz gerekiyor.");
        return;
      }
      // Geçici dosya önbellek klasörüne iner ve iş bitince silinir (kalıcı alan şişmesin)
      gecici = FileSystem.cacheDirectory + `CozumKarti_${Date.now()}.png`;
      const sonuc = await FileSystem.downloadAsync(
        seciliSoru.cozumKartiLink,
        gecici
      );
      if (sonuc.status !== 200) {
        throw new Error(`İndirme başarısız (HTTP ${sonuc.status})`);
      }
      await MediaLibrary.saveToLibraryAsync(sonuc.uri);
      Alert.alert("Başarılı!", "Çözüm kartı galerinize kaydedildi. 🖼️");
    } catch (error) {
      console.log("İndirme Hatası Detayı:", error?.message);
      Alert.alert("Hata", "Fotoğraf indirilirken bir sorun oluştu.");
    } finally {
      if (gecici) {
        try {
          await FileSystem.deleteAsync(gecici, { idempotent: true });
        } catch (e) {}
      }
      setIndirmeBasladi(false);
    }
  };

  const pratikEkraniAc = (pratik) => {
    if (!pratik?.soru) {
      Alert.alert("Bilgi", "Bu pratik soru okunamadı.");
      return;
    }
    setSeciliPratikSeviye(PRATIK_SEVIYELERI[pratik.seviye]?.ad || "");
    setAktifPratikSoru(pratik);
    setSecilenSik(null);
    setPratikCozumGorunur(false);
    setPratikModalGorunur(true);
  };

  const pdfOlarakIndir = async () => {
    // PDF indirme premium'a özeldir (düğme de kilitli görünür; burası ikinci kontrol)
    if (!premiumMu) {
      premiumAc("pdf");
      return;
    }

    try {
      setIndirmeBasladi(true);

      const indirilecekSorular = filtrelenmisSorular;

      if (indirilecekSorular.length === 0) {
        Alert.alert("Bilgi", "Bu kategoride indirilecek soru bulunmuyor.");
        setIndirmeBasladi(false);
        return;
      }

      const userEmail = auth.currentUser?.email;

      // Çözümleri küçük gruplar hâlinde paralel getir (önbellekten gelenler ağa gitmez)
      const cozumler = new Array(indirilecekSorular.length).fill(null);
      const GRUP = 4;
      for (let bas = 0; bas < indirilecekSorular.length; bas += GRUP) {
        await Promise.all(
          indirilecekSorular.slice(bas, bas + GRUP).map(async (soru, j) => {
            cozumler[bas + j] = await pdfCozumVerisi(soru, userEmail);
          })
        );
      }

      const sorularHtml = indirilecekSorular
        .map((soru, i) =>
          soruBlokHtml({
            sira: i + 1,
            dersAdi: dersBul(soru),
            tarih: new Date(soru.tarih).toLocaleDateString("tr-TR"),
            fotoLink: soru.fotoLink,
            cozum: cozumler[i].cozum,
            mesaj: cozumler[i].mesaj,
          })
        )
        .join("\n");

      const htmlIcerik = belgeHtml({
        kategori: seciliKategori,
        toplam: indirilecekSorular.length,
        govde: sorularHtml,
      });

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
      <SafeAreaView
        style={[
          styles.safeArea,
          { backgroundColor: tema.arkaplan, justifyContent: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={tema.anaButon} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: tema.arkaplan }]}>
      {/* 🚀 DÜZELTME: Sadece sayfa odaktaysa StatusBar çalışır ve gerçek karanlık rengi alır */}
      {isFocused && (
        <StatusBar
          barStyle={isGercektenKaranlik ? "light-content" : "dark-content"}
          backgroundColor={tema.arkaplan}
        />
      )}

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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24 }}
            >
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
            <View style={styles.innerContainer}>
              <FlatList
                data={filtrelenmisSorular}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
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
                      <Text
                        style={[styles.kartDersAd, { color: tema.metin }]}
                      >
                        {dersBul(item)}
                      </Text>
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
            </View>
          )}
        </>
      )}

      {filtrelenmisSorular.length > 0 && (
        <TouchableOpacity
          style={[
            styles.fabButon,
            { backgroundColor: tema.anaButon, bottom: 20 },
          ]}
          onPress={pdfOlarakIndir}
          disabled={indirmeBasladi}
          accessibilityRole="button"
          accessibilityLabel={
            premiumMu ? "PDF olarak indir" : "PDF indirme, Premium'a özel"
          }
        >
          {indirmeBasladi ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons
                name={premiumMu ? "document-text" : "lock-closed"}
                size={24}
                color="#fff"
              />
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
              style={[
                styles.modalKutu,
                {
                  backgroundColor: tema.kutuArkaplan,
                  paddingBottom: insets.bottom + 20,
                },
              ]}
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
                    size={28}
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

                <View style={styles.dersSatiri}>
                  <Text style={[styles.dersEtiket, { color: tema.ikincilMetin }]}>
                    Ders
                  </Text>
                  <TouchableOpacity
                    onPress={() => setDersSecimiAcik(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Ders: ${dersBul(seciliSoru)}. Değiştirmek için dokun`}
                    style={[
                      styles.dersChip,
                      {
                        borderColor: tema.kutuCerceve,
                        backgroundColor: isGercektenKaranlik
                          ? "#1A1A1A"
                          : "#F9FAFB",
                      },
                    ]}
                  >
                    <Text style={[styles.dersChipYazi, { color: tema.metin }]}>
                      {dersBul(seciliSoru)}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={tema.ikincilMetin}
                    />
                  </TouchableOpacity>
                </View>

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

                    {(seciliSoru.cozumDetayi.subject ||
                      seciliSoru.cozumDetayi.topic) && (
                    <View
                      style={[
                        styles.bilgiEtiketi,
                        {
                          backgroundColor: isGercektenKaranlik
                            ? "#1A1A1A"
                            : "#F9FAFB",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: tema.metin,
                          fontWeight: "600",
                          fontSize: 15,
                        }}
                      >
                        📚{" "}
                        {[
                          seciliSoru.cozumDetayi.subject,
                          seciliSoru.cozumDetayi.topic,
                        ]
                          .filter(Boolean)
                          .join(" › ")}
                      </Text>
                    </View>
                    )}

                    {seciliSoru.cozumDetayi.question ? (
                      <View
                        style={[
                          styles.formulKutu,
                          {
                            backgroundColor: isGercektenKaranlik
                              ? "#1A1A1A"
                              : "#F9FAFB",
                            borderColor: tema.kutuCerceve,
                            borderStyle: "solid",
                          },
                        ]}
                      >
                        <Text
                          style={[styles.kucukBaslik, { color: tema.ikincilMetin }]}
                        >
                          📝 SORU
                        </Text>
                        <Text
                          style={[styles.adimIcerik, { color: tema.metin }]}
                        >
                          {seciliSoru.cozumDetayi.question}
                        </Text>
                      </View>
                    ) : null}

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
                            backgroundColor: isGercektenKaranlik
                              ? "#1E293B"
                              : "#EFF6FF",
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
                          backgroundColor: isGercektenKaranlik
                            ? "#064E3B"
                            : "#ECFDF5",
                          borderColor: "#10B981",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.kucukBaslik,
                          {
                            color: isGercektenKaranlik ? "#34D399" : "#059669",
                          },
                        ]}
                      >
                        KESİN SONUÇ
                      </Text>
                      <Text
                        style={[
                          styles.cevapMetni,
                          {
                            color: isGercektenKaranlik ? "#A7F3D0" : "#065F46",
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
                      <View style={{ marginBottom: 30 }}>
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

                    {(seciliSoru.cozumDetayi.pratikSorular || []).length > 0 && (
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
                          {seciliSoru.cozumDetayi.pratikSorular.map((pratik) => {
                            const seviye = PRATIK_SEVIYELERI[pratik.seviye];
                            return (
                              <TouchableOpacity
                                key={pratik.seviye}
                                style={[
                                  styles.seviyeButon,
                                  { borderColor: seviye.renk },
                                ]}
                                onPress={() => pratikEkraniAc(pratik)}
                                accessibilityRole="button"
                                accessibilityLabel={`${seviye.ad} seviye benzer soru`}
                              >
                                <Text
                                  style={{
                                    color: seviye.renk,
                                    fontWeight: "bold",
                                  }}
                                >
                                  {seviye.ad}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ padding: 40, alignItems: "center" }}>
                    <Text
                      style={{
                        color: tema.metin,
                        marginTop: 15,
                        textAlign: "center",
                        fontSize: 16,
                      }}
                    >
                      {cozumHatasi
                        ? "Çözüm şu an yüklenemedi. Lütfen bağlantını kontrol edip daha sonra tekrar dene."
                        : seciliSoru?.durum === "Çözüldü"
                        ? "Bu sorunun çözüm detayı şu an hazır değil. Birkaç dakika sonra tekrar dene."
                        : "Yapay zeka analiz dosyası bekleniyor..."}
                    </Text>
                    {(cozumHatasi || seciliSoru?.durum === "Çözüldü") && (
                      <TouchableOpacity
                        onPress={() => soruDetayAc(seciliSoru)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        style={{
                          marginTop: 18,
                          paddingVertical: 12,
                          paddingHorizontal: 28,
                          borderRadius: 100,
                          backgroundColor: tema.anaButon,
                        }}
                      >
                        <Text
                          style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}
                        >
                          Tekrar Dene
                        </Text>
                      </TouchableOpacity>
                    )}
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

              {dersSecimiAcik && (
                <View style={styles.dersSecimKatman}>
                  <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => setDersSecimiAcik(false)}
                    accessibilityLabel="Kapat"
                  />
                  <View
                    style={[
                      styles.dersSecimKutu,
                      {
                        backgroundColor: tema.arkaplan,
                        borderColor: tema.kutuCerceve,
                      },
                    ]}
                  >
                    <Text style={[styles.dersSecimBaslik, { color: tema.metin }]}>
                      Dersi Seç
                    </Text>
                    {DERSLER.map((ders) => {
                      const secili = dersBul(seciliSoru) === ders;
                      return (
                        <TouchableOpacity
                          key={ders}
                          onPress={() => dersiKaydet(ders)}
                          activeOpacity={0.7}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: secili }}
                          style={[
                            styles.dersSecimSatir,
                            { borderTopColor: tema.kutuCerceve },
                          ]}
                        >
                          <Text
                            style={{
                              color: secili ? tema.anaButon : tema.metin,
                              fontSize: 16,
                              fontWeight: secili ? "700" : "500",
                            }}
                          >
                            {ders}
                          </Text>
                          {secili && (
                            <Ionicons
                              name="checkmark"
                              size={20}
                              color={tema.anaButon}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
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
                    {
                      backgroundColor: tema.kutuArkaplan,
                      paddingBottom: insets.bottom + 20,
                    },
                  ]}
                >
                  <View style={styles.pratikUstKontroller}>
                    <Text style={[styles.pratikBaslik, { color: tema.metin }]}>
                      {seciliPratikSeviye} Seviye {aktifPratikSoru?.secenekler ? "Test" : "Soru"}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPratikModalGorunur(false)}
                    >
                      <Ionicons
                        name="close-circle"
                        size={32}
                        color={tema.ikincilMetin}
                      />
                    </TouchableOpacity>
                  </View>

                  {aktifPratikSoru && (
                    <ScrollView showsVerticalScrollIndicator={false}>
                      <Text
                        style={[styles.pratikSoruMetni, { color: tema.metin }]}
                      >
                        {aktifPratikSoru.soru}
                      </Text>

                      {aktifPratikSoru.secenekler &&
                        Object.entries(aktifPratikSoru.secenekler).map(
                          ([harf, secenek]) => {
                            let arkaplanRengi = tema.arkaplan;
                            let cerceveRengi = tema.kutuCerceve;
                            let yaziRengi = tema.metin;

                            if (secilenSik) {
                              if (harf === aktifPratikSoru.dogruSecenek) {
                                arkaplanRengi = isGercektenKaranlik
                                  ? "#064E3B"
                                  : "#ECFDF5";
                                cerceveRengi = "#10B981";
                                yaziRengi = isGercektenKaranlik
                                  ? "#A7F3D0"
                                  : "#065F46";
                              } else if (
                                secilenSik === harf &&
                                harf !== aktifPratikSoru.dogruSecenek
                              ) {
                                arkaplanRengi = isGercektenKaranlik
                                  ? "#7F1D1D"
                                  : "#FEF2F2";
                                cerceveRengi = "#EF4444";
                                yaziRengi = isGercektenKaranlik
                                  ? "#FECACA"
                                  : "#991B1B";
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
                                  harf === aktifPratikSoru.dogruSecenek && (
                                    <Ionicons
                                      name="checkmark-circle"
                                      size={24}
                                      color="#10B981"
                                    />
                                  )}
                                {secilenSik === harf &&
                                  harf !== aktifPratikSoru.dogruSecenek && (
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
                            borderRadius: 12,
                            backgroundColor:
                              secilenSik === aktifPratikSoru.dogruSecenek
                                ? "#10B98120"
                                : "#EF444420",
                          }}
                        >
                          <Text
                            style={{
                              textAlign: "center",
                              fontWeight: "bold",
                              fontSize: 16,
                              color:
                                secilenSik === aktifPratikSoru.dogruSecenek
                                  ? "#10B981"
                                  : "#EF4444",
                            }}
                          >
                            {secilenSik === aktifPratikSoru.dogruSecenek
                              ? "🎉 Tebrikler, Doğru Cevap!"
                              : "Kötü Şans, Yanlış Cevap."}
                          </Text>
                        </View>
                      )}
                      {!aktifPratikSoru.secenekler && !pratikCozumGorunur && (
                        <TouchableOpacity
                          onPress={() => setPratikCozumGorunur(true)}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          style={{
                            marginTop: 24,
                            height: 52,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: tema.anaButon,
                          }}
                        >
                          <Text
                            style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}
                          >
                            Çözümü Göster
                          </Text>
                        </TouchableOpacity>
                      )}

                      {!aktifPratikSoru.secenekler && pratikCozumGorunur && (
                        <View style={{ marginTop: 20 }}>
                          {(aktifPratikSoru.adimlar || []).map((adim, index) => (
                            <View
                              key={index}
                              style={[
                                styles.adimKutusu,
                                {
                                  backgroundColor: isGercektenKaranlik
                                    ? "#1E293B"
                                    : "#EFF6FF",
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

                          {aktifPratikSoru.cevap ? (
                            <View
                              style={[
                                styles.cevapKutusu,
                                {
                                  backgroundColor: isGercektenKaranlik
                                    ? "#064E3B"
                                    : "#ECFDF5",
                                  borderColor: "#10B981",
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.kucukBaslik,
                                  {
                                    color: isGercektenKaranlik
                                      ? "#34D399"
                                      : "#059669",
                                  },
                                ]}
                              >
                                CEVAP
                              </Text>
                              <Text
                                style={[
                                  styles.cevapMetni,
                                  {
                                    color: isGercektenKaranlik
                                      ? "#A7F3D0"
                                      : "#065F46",
                                  },
                                ]}
                              >
                                {aktifPratikSoru.cevap}
                              </Text>
                            </View>
                          ) : null}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },

  headerKapsayici: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 15,
  },
  anaBaslik: {
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  kategoriKapsayici: {
    marginBottom: 20,
  },
  kategoriButon: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
  },
  kategoriYazi: {
    fontSize: 15,
    fontWeight: "bold",
  },
  bosMesajKutusu: { flex: 1, justifyContent: "center", alignItems: "center" },
  ikon: { marginBottom: 15, opacity: 0.8 },
  bosMesajYazisi: { fontSize: 16, textAlign: "center" },
  kart: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  kartBilgi: { flex: 1 },
  kartDersAd: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  kartTarih: { fontSize: 13, marginBottom: 6 },
  kartDurum: { fontSize: 15, fontWeight: "bold" },
  kucukFoto: { width: 65, height: 65, borderRadius: 12, marginRight: 15 },
  fabButon: {
    position: "absolute",
    right: 24,
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
    fontSize: 11,
    fontWeight: "bold",
    marginTop: -2,
  },
  modalArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalKutu: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 24,
    maxHeight: "92%",
  },
  modalUstKontroller: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  kapatButon: { flexDirection: "row", alignItems: "center" },
  modalKapatYazi: { fontWeight: "bold", fontSize: 17, marginRight: 4 },
  modalSilButon: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalSilButonYazi: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 6,
  },
  modalBuyukFoto: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 20,
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
  aiEtiketYazi: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  cozumAnaBaslik: { fontSize: 26, fontWeight: "900", marginBottom: 20 },
  bilgiEtiketi: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: "center",
    borderColor: "#ccc",
  },
  dersSatiri: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  dersEtiket: { fontSize: 14, fontWeight: "600" },
  dersChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 100,
    paddingVertical: 8,
    paddingLeft: 16,
    paddingRight: 12,
  },
  dersChipYazi: { fontSize: 15, fontWeight: "700" },
  dersSecimKatman: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  dersSecimKutu: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  dersSecimBaslik: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 16,
  },
  dersSecimSatir: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  formulKutu: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 25,
  },
  formulMetin: {
    fontSize: 22,
    textAlign: "center",
    fontWeight: "bold",
    fontStyle: "italic",
    marginTop: 8,
  },
  kucukBaslik: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  aciklamaMetin: { fontSize: 16, fontStyle: "italic", lineHeight: 24 },
  adimlarKonteyner: { marginBottom: 25 },
  adimlarAnaBaslik: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  adimKutusu: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 18,
    marginBottom: 15,
  },
  adimBaslik: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  adimIcerik: { fontSize: 17, lineHeight: 26 },
  cevapKutusu: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    marginBottom: 25,
    alignItems: "center",
  },
  cevapMetni: { fontSize: 32, fontWeight: "900", marginTop: 5 },
  benzerSoruBolumu: {
    marginTop: 15,
    paddingTop: 25,
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
    paddingVertical: 14,
    marginHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  indirButonu: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: 16,
    marginTop: 15,
  },
  indirButonuYazi: { color: "#fff", fontSize: 17, fontWeight: "bold" },
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
    padding: 12,
    borderRadius: 25,
    zIndex: 10,
  },
  pratikModalArkaplan: {
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  pratikModalKutu: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 24,
    maxHeight: "80%",
    minHeight: "50%",
  },
  pratikUstKontroller: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150,150,150,0.2)",
    paddingBottom: 18,
  },
  pratikBaslik: {
    fontSize: 22,
    fontWeight: "bold",
  },
  pratikSoruMetni: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 28,
    marginBottom: 25,
  },
  sikKutusu: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
  },
  harfDairesi: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  harfYazisi: {
    fontWeight: "bold",
    fontSize: 17,
  },
  sikMetni: {
    fontSize: 17,
    flex: 1,
    fontWeight: "500",
    lineHeight: 24,
  },
});
