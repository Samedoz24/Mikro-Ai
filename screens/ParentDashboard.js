import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
// 🚀 YENİ: Sayfa odağını anlamak için eklendi
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { auth, db, storage } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";

import { useTheme } from "../ThemeContext";
// 🚀 YENİ: Gerçek karanlık mod kontrolü için
import { colors } from "../theme";

const ekranGenisligi = Dimensions.get("window").width;
const ekranYuksekligi = Dimensions.get("window").height;

export default function ParentDashboard() {
  const { tema, temaModu } = useTheme();
  const insets = useSafeAreaInsets();

  // 🚀 YENİ: Sayfa odakta mı ve gerçekten karanlık mı kontrolleri
  const isFocused = useIsFocused();
  const isGercektenKaranlik = tema.arkaplan === colors.dark.arkaplan;

  const [veliModalGorunur, setVeliModalGorunur] = useState(false);
  const [ogrenciKoduInput, setOgrenciKoduInput] = useState("");
  const [bagliOgrenciler, setBagliOgrenciler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  const [aktifOgrenci, setAktifOgrenci] = useState(null);
  const [ogrenciFotolar, setOgrenciFotolar] = useState({});

  const [whatsappNo, setWhatsappNo] = useState("");
  const [raporAktif, setRaporAktif] = useState(false);

  const [sonSorular, setSonSorular] = useState([]);
  const [toplamSoruSayisi, setToplamSoruSayisi] = useState(0);
  const [cozulmeOrani, setCozulmeOrani] = useState(0);
  const [sorularYukleniyor, setSorularYukleniyor] = useState(false);
  const [dersIstatistikleri, setDersIstatistikleri] = useState([]);

  const [seciliSoru, setSeciliSoru] = useState(null);
  const [detayModalGorunur, setDetayModalGorunur] = useState(false);
  const [tamEkranModu, setTamEkranModu] = useState(false);
  const [cozumYukleniyor, setCozumYukleniyor] = useState(false);

  useEffect(() => {
    const veliVerileriniGetir = async () => {
      if (!auth.currentUser) return;

      const veliRef = doc(db, "kullanicilar", auth.currentUser.uid);
      const veliSnap = await getDoc(veliRef);

      if (veliSnap.exists()) {
        const data = veliSnap.data();
        if (data.bagliOgrenciler) {
          setBagliOgrenciler(data.bagliOgrenciler);
          if (data.bagliOgrenciler.length > 0) {
            setAktifOgrenci(data.bagliOgrenciler[0]);
          }
        }
        if (data.whatsappNo) setWhatsappNo(data.whatsappNo);
        if (data.raporAktif !== undefined) setRaporAktif(data.raporAktif);
      }
    };
    veliVerileriniGetir();
  }, []);

  useEffect(() => {
    const verileriCek = async () => {
      if (bagliOgrenciler.length === 0) {
        setSonSorular([]);
        setToplamSoruSayisi(0);
        setCozulmeOrani(0);
        setDersIstatistikleri([]);
        setOgrenciFotolar({});
        return;
      }

      setSorularYukleniyor(true);
      try {
        let geciciFotolar = { ...ogrenciFotolar };
        let tumSorular = [];
        let toplamSoruSayaci = 0;
        let cozulmusSayaci = 0;
        let dersSayaclari = {};

        for (const ogr of bagliOgrenciler) {
          const ogrRef = doc(db, "kullanicilar", ogr.id);
          const ogrSnap = await getDoc(ogrRef);

          if (ogrSnap.exists() && ogrSnap.data().eposta) {
            const data = ogrSnap.data();

            if (data.profilFoto) {
              geciciFotolar[ogr.id] = data.profilFoto;
            }

            if (aktifOgrenci && ogr.id === aktifOgrenci.id) {
              const q = query(
                collection(db, "sorular"),
                where("kullaniciEposta", "==", data.eposta)
              );
              const qSnap = await getDocs(q);

              qSnap.forEach((docSnap) => {
                const soruData = docSnap.data();

                tumSorular.push({
                  id: docSnap.id,
                  ogrenciIsim: aktifOgrenci.isim,
                  ...soruData,
                });

                toplamSoruSayaci++;
                if (soruData.durum === "Çözüldü") {
                  cozulmusSayaci++;
                }

                const dersAdi = soruData.subject || soruData.ders || "Diğer";
                dersSayaclari[dersAdi] = (dersSayaclari[dersAdi] || 0) + 1;
              });
            }
          }
        }

        setOgrenciFotolar(geciciFotolar);

        tumSorular.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
        setSonSorular(tumSorular.slice(0, 10));
        setToplamSoruSayisi(toplamSoruSayaci);

        if (toplamSoruSayaci > 0) {
          const oran = Math.round((cozulmusSayaci / toplamSoruSayaci) * 100);
          setCozulmeOrani(oran);

          const istatistikDizisi = Object.keys(dersSayaclari).map((ders) => ({
            ders: ders,
            sayi: dersSayaclari[ders],
            yuzde: Math.round((dersSayaclari[ders] / toplamSoruSayaci) * 100),
          }));
          istatistikDizisi.sort((a, b) => b.sayi - a.sayi);
          setDersIstatistikleri(istatistikDizisi);
        } else {
          setCozulmeOrani(0);
          setDersIstatistikleri([]);
        }
      } catch (error) {
        console.log("Veri çekme hatası:", error);
      }
      setSorularYukleniyor(false);
    };

    verileriCek();
  }, [aktifOgrenci, bagliOgrenciler]);

  const ogrenciyiBulVeBagla = async () => {
    if (ogrenciKoduInput.length !== 6) {
      Alert.alert("Hata", "Lütfen 6 haneli bağlantı kodunu eksiksiz girin.");
      return;
    }

    setYukleniyor(true);
    try {
      const q = query(
        collection(db, "kullanicilar"),
        where("baglantiKodu", "==", ogrenciKoduInput)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert(
          "Bulunamadı",
          "Bu koda sahip bir öğrenci bulunamadı. Lütfen kodu kontrol edin."
        );
      } else {
        let ogrenciIsim = "";
        let ogrenciId = "";

        querySnapshot.forEach((docSnap) => {
          ogrenciId = docSnap.id;
          ogrenciIsim =
            docSnap.data().adSoyad || docSnap.data().eposta.split("@")[0];
        });

        const zatenVar = bagliOgrenciler.some((ogr) => ogr.id === ogrenciId);
        if (zatenVar) {
          Alert.alert("Zaten Ekli", "Bu öğrenci listenizde bulunuyor.");
          setYukleniyor(false);
          return;
        }

        const yeniOgrenci = { id: ogrenciId, isim: ogrenciIsim };
        const veliRef = doc(db, "kullanicilar", auth.currentUser.uid);

        await setDoc(
          veliRef,
          {
            bagliOgrenciler: arrayUnion(yeniOgrenci),
            rol: "veli",
          },
          { merge: true }
        );

        setBagliOgrenciler((eskiListe) => [...eskiListe, yeniOgrenci]);
        if (!aktifOgrenci) setAktifOgrenci(yeniOgrenci);

        setVeliModalGorunur(false);
        setOgrenciKoduInput("");
        Alert.alert(
          "Başarılı!",
          `${ogrenciIsim} isimli öğrenci hesabınıza bağlandı.`
        );
      }
    } catch (error) {
      Alert.alert("Bağlantı Hatası", "Bir sorun oluştu: " + error.message);
    }
    setYukleniyor(false);
  };

  const ogrenciyiKaldir = (ogrenci) => {
    Alert.alert(
      "Öğrenciyi Kaldır",
      `${ogrenci.isim} isimli öğrencinin bağlantısını kesmek istediğinize emin misin?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Bağlantıyı Kes",
          style: "destructive",
          onPress: async () => {
            try {
              const veliRef = doc(db, "kullanicilar", auth.currentUser.uid);
              await setDoc(
                veliRef,
                { bagliOgrenciler: arrayRemove(ogrenci) },
                { merge: true }
              );

              const yeniListe = bagliOgrenciler.filter(
                (ogr) => ogr.id !== ogrenci.id
              );
              setBagliOgrenciler(yeniListe);

              if (aktifOgrenci?.id === ogrenci.id) {
                setAktifOgrenci(yeniListe.length > 0 ? yeniListe[0] : null);
              }
            } catch (error) {
              Alert.alert("Hata", "Öğrenci kaldırılamadı.");
            }
          },
        },
      ]
    );
  };

  const whatsappNumarasiKaydet = async (yeniNumara) => {
    setWhatsappNo(yeniNumara);
    if (auth.currentUser) {
      const veliRef = doc(db, "kullanicilar", auth.currentUser.uid);
      await setDoc(veliRef, { whatsappNo: yeniNumara }, { merge: true });
    }
  };

  const raporTercihiKaydet = async (deger) => {
    setRaporAktif(deger);
    if (auth.currentUser) {
      const veliRef = doc(db, "kullanicilar", auth.currentUser.uid);
      await setDoc(veliRef, { raporAktif: deger }, { merge: true });
    }
  };

  const soruDetayAc = async (soru) => {
    setSeciliSoru(soru);
    setDetayModalGorunur(true);
    setTamEkranModu(false);
    setCozumYukleniyor(true);

    try {
      const ogrenciEposta = soru.kullaniciEposta;
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

      let jsonVerisi = null;
      try {
        const jsonYolu = `cozumDetayi/${ogrenciEposta}/${timestamp}.json`;
        const jsonRef = ref(storage, jsonYolu);
        const jsonUrl = await getDownloadURL(jsonRef);
        const response = await fetch(jsonUrl);
        jsonVerisi = await response.json();
      } catch (e) {
        console.log("JSON bulunamadı.");
      }

      let resimVerisi = null;
      try {
        const resimYolu = `solution-cards/${ogrenciEposta}/${timestamp}.png`;
        const resimRef = ref(storage, resimYolu);
        resimVerisi = await getDownloadURL(resimRef);
      } catch (e) {
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: tema.arkaplan }]}>
      {/* 🚀 DÜZELTME: Sadece bu sayfadaysak StatusBar çalışır ve çakışma yapmaz */}
      {isFocused && (
        <StatusBar
          barStyle={isGercektenKaranlik ? "light-content" : "dark-content"}
          backgroundColor={tema.arkaplan}
        />
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.innerContainer}>
          <View style={styles.header}>
            <Text style={[styles.baslik, { color: tema.metin }]}>
              Veli Paneli
            </Text>
            <Text
              style={{ color: tema.ikincilMetin, fontSize: 15, lineHeight: 22 }}
            >
              Öğrencinizin gelişimini buradan takip edin.
            </Text>
          </View>

          <View
            style={[
              styles.kutu,
              {
                backgroundColor: tema.kutuArkaplan,
                borderColor: tema.kutuCerceve,
              },
            ]}
          >
            <View style={styles.kutuUstBaslik}>
              <Text
                style={[
                  styles.kutuBaslik,
                  { color: tema.metin, marginBottom: 0 },
                ]}
              >
                Bağlı Öğrenciler
              </Text>
              <TouchableOpacity onPress={() => setVeliModalGorunur(true)}>
                <Ionicons name="add-circle" size={32} color={tema.anaButon} />
              </TouchableOpacity>
            </View>

            {bagliOgrenciler.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 5 }}
              >
                {bagliOgrenciler.map((ogr, index) => {
                  const seciliMi = aktifOgrenci?.id === ogr.id;
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setAktifOgrenci(ogr)}
                      style={[
                        styles.ogrenciSeciciKutu,
                        {
                          backgroundColor: seciliMi
                            ? tema.anaButon
                            : tema.arkaplan,
                          borderColor: seciliMi
                            ? tema.anaButon
                            : tema.kutuCerceve,
                        },
                      ]}
                    >
                      {ogrenciFotolar[ogr.id] ? (
                        <Image
                          source={{ uri: ogrenciFotolar[ogr.id] }}
                          style={[
                            styles.ogrenciKucukFoto,
                            {
                              borderColor: seciliMi ? "#fff" : tema.kutuCerceve,
                            },
                          ]}
                        />
                      ) : (
                        <Ionicons
                          name="person-circle-outline"
                          size={28}
                          color={seciliMi ? "#fff" : tema.ikincilMetin}
                        />
                      )}

                      <Text
                        style={[
                          styles.ogrenciSeciciYazi,
                          { color: seciliMi ? "#fff" : tema.metin },
                        ]}
                      >
                        {ogr.isim}
                      </Text>
                      <TouchableOpacity
                        onPress={() => ogrenciyiKaldir(ogr)}
                        style={{ marginLeft: 12 }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={22}
                          color={
                            seciliMi ? "#FFEBEB" : tema.hataKirmizi || "#EF4444"
                          }
                        />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <Text
                style={{
                  color: tema.ikincilMetin,
                  textAlign: "center",
                  marginVertical: 10,
                  lineHeight: 22,
                }}
              >
                Henüz bir öğrenci bağlamadınız. Sağ üstten ekleyebilirsiniz.
              </Text>
            )}
          </View>

          <View
            style={[
              styles.kutu,
              {
                backgroundColor: tema.kutuArkaplan,
                borderColor: tema.kutuCerceve,
              },
            ]}
          >
            <Text
              style={[
                styles.kutuBaslik,
                { color: tema.metin, marginBottom: 15 },
              ]}
            >
              WhatsApp Raporlama (Cuma Günleri)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: tema.arkaplan,
                  color: tema.metin,
                  borderColor: tema.kutuCerceve,
                },
              ]}
              placeholder="Örn: 5xxxxxxxxx"
              placeholderTextColor={tema.ikincilMetin}
              keyboardType="phone-pad"
              value={whatsappNo}
              onChangeText={setWhatsappNo}
              onEndEditing={() => whatsappNumarasiKaydet(whatsappNo)}
            />
            <View style={styles.switchSatir}>
              <Text style={[styles.switchYazi, { color: tema.metin }]}>
                Haftalık Rapor İstiyorum
              </Text>
              <Switch
                value={raporAktif}
                onValueChange={raporTercihiKaydet}
                trackColor={{ false: tema.kutuCerceve, true: tema.anaButon }}
                thumbColor={"#fff"}
              />
            </View>
          </View>

          {aktifOgrenci ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 15,
                  marginBottom: 15,
                }}
              >
                {ogrenciFotolar[aktifOgrenci.id] && (
                  <Image
                    source={{ uri: ogrenciFotolar[aktifOgrenci.id] }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      marginRight: 12,
                      borderWidth: 1,
                      borderColor: tema.kutuCerceve,
                    }}
                  />
                )}
                <Text
                  style={[
                    styles.altBaslik,
                    { color: tema.metin, marginBottom: 0 },
                  ]}
                >
                  {aktifOgrenci.isim}'in İstatistikleri
                </Text>
              </View>

              <View style={styles.istatistikKutusu}>
                <View
                  style={[
                    styles.kart,
                    {
                      backgroundColor: tema.kutuArkaplan,
                      borderColor: tema.kutuCerceve,
                    },
                  ]}
                >
                  <Text style={[styles.kartSayi, { color: tema.anaButon }]}>
                    {toplamSoruSayisi}
                  </Text>
                  <Text style={[styles.kartYazi, { color: tema.ikincilMetin }]}>
                    Çözülen Soru
                  </Text>
                </View>
                <View
                  style={[
                    styles.kart,
                    {
                      backgroundColor: tema.kutuArkaplan,
                      borderColor: tema.kutuCerceve,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.kartSayi,
                      { color: tema.aiButon || "#10B981" },
                    ]}
                  >
                    {`%${cozulmeOrani}`}
                  </Text>
                  <Text style={[styles.kartYazi, { color: tema.ikincilMetin }]}>
                    Çözülme Oranı
                  </Text>
                </View>
              </View>

              {dersIstatistikleri.length > 0 && (
                <View
                  style={[
                    styles.kutu,
                    {
                      backgroundColor: tema.kutuArkaplan,
                      borderColor: tema.kutuCerceve,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.kutuBaslik,
                      { color: tema.metin, marginBottom: 20 },
                    ]}
                  >
                    Derslere Göre Soru Dağılımı
                  </Text>

                  {dersIstatistikleri.map((istatistik, index) => (
                    <View key={index} style={{ marginBottom: 15 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: tema.metin,
                            fontSize: 14,
                            fontWeight: "600",
                          }}
                        >
                          {istatistik.ders}
                        </Text>
                        <Text
                          style={{
                            color: tema.anaButon,
                            fontSize: 14,
                            fontWeight: "bold",
                          }}
                        >
                          % {istatistik.yuzde} ({istatistik.sayi} Soru)
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.barArkaplan,
                          { backgroundColor: tema.kutuCerceve },
                        ]}
                      >
                        <View
                          style={[
                            styles.barDolu,
                            {
                              backgroundColor: tema.anaButon,
                              width: `${istatistik.yuzde}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <Text
                style={[styles.altBaslik, { color: tema.metin, marginTop: 15 }]}
              >
                {aktifOgrenci.isim}'in Son Çözdükleri
              </Text>

              {sorularYukleniyor ? (
                <ActivityIndicator
                  size="large"
                  color={tema.anaButon}
                  style={{ marginTop: 30, marginBottom: 30 }}
                />
              ) : sonSorular.length > 0 ? (
                sonSorular.map((item, index) => {
                  const okunanTarih = new Date(item.tarih).toLocaleDateString(
                    "tr-TR"
                  );
                  const cozulduMu = item.durum === "Çözüldü";
                  const dersAdi = item.subject || item.ders || "Soru";

                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => soruDetayAc(item)}
                      style={[
                        styles.listeElemani,
                        {
                          backgroundColor: tema.kutuArkaplan,
                          borderColor: tema.kutuCerceve,
                        },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flex: 1,
                        }}
                      >
                        {item.fotoLink && (
                          <Image
                            source={{ uri: item.fotoLink }}
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: 10,
                              marginRight: 15,
                            }}
                          />
                        )}
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text
                            style={[styles.listeBaslik, { color: tema.metin }]}
                            numberOfLines={1}
                          >
                            {dersAdi}
                          </Text>
                          <Text
                            style={{
                              color: tema.ikincilMetin,
                              fontSize: 13,
                              marginTop: 5,
                            }}
                          >
                            {okunanTarih}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.durumKutusu,
                          {
                            backgroundColor: cozulduMu
                              ? (tema.aiButon || "#10B981") + "20"
                              : tema.kutuCerceve,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: cozulduMu
                              ? tema.aiButon || "#10B981"
                              : tema.ikincilMetin,
                            fontWeight: "bold",
                            fontSize: 13,
                          }}
                        >
                          {item.durum}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text
                  style={{
                    color: tema.ikincilMetin,
                    textAlign: "center",
                    marginTop: 20,
                    marginBottom: 40,
                    lineHeight: 22,
                  }}
                >
                  Bu öğrenci henüz soru göndermedi.
                </Text>
              )}
            </>
          ) : (
            <Text
              style={{
                color: tema.ikincilMetin,
                textAlign: "center",
                marginTop: 20,
                marginBottom: 40,
                lineHeight: 22,
              }}
            >
              Yukarıdan bir öğrenci seçin.
            </Text>
          )}

          <View style={{ height: 60 }} />
        </View>
      </ScrollView>

      <Modal
        visible={detayModalGorunur}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetayModalGorunur(false)}
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
                styles.modalDetayKutu,
                {
                  backgroundColor: tema.kutuArkaplan,
                  paddingBottom: insets.bottom + 20,
                },
              ]}
            >
              <View style={styles.modalUstKontroller}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: tema.metin,
                  }}
                >
                  Soru İncelemesi
                </Text>
                <TouchableOpacity
                  onPress={() => setDetayModalGorunur(false)}
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

                {cozumYukleniyor ? (
                  <View style={{ padding: 50, alignItems: "center" }}>
                    <ActivityIndicator size="large" color={tema.anaButon} />
                    <Text
                      style={{ color: tema.metin, marginTop: 20, fontSize: 16 }}
                    >
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
                        📚 {seciliSoru.cozumDetayi.subject} ›{" "}
                        {seciliSoru.cozumDetayi.topic}
                      </Text>
                    </View>

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
                            "Sonuç bulunamadı"
                        )}
                      </Text>
                    </View>

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
                  </View>
                ) : (
                  <View style={{ padding: 50, alignItems: "center" }}>
                    <Text
                      style={{
                        color: tema.metin,
                        marginTop: 15,
                        textAlign: "center",
                        fontSize: 16,
                        lineHeight: 24,
                      }}
                    >
                      Yapay zeka analiz dosyası bekleniyor...
                    </Text>
                  </View>
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      <Modal visible={veliModalGorunur} animationType="fade" transparent={true}>
        <View style={styles.modalOgrenciArkaplan}>
          <View
            style={[styles.modalKutu, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Text style={[styles.modalBaslik, { color: tema.metin }]}>
              Öğrenci Kodu
            </Text>
            <Text
              style={[
                {
                  color: tema.ikincilMetin,
                  textAlign: "center",
                  marginBottom: 20,
                  fontSize: 15,
                  lineHeight: 22,
                },
              ]}
            >
              Öğrencinin profilinde yazan 6 haneli bağlantı kodunu girin.
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: tema.arkaplan,
                  color: tema.metin,
                  borderColor: tema.kutuCerceve,
                },
              ]}
              placeholder="XXXXXX"
              placeholderTextColor={tema.ikincilMetin}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              value={ogrenciKoduInput}
              onChangeText={setOgrenciKoduInput}
            />
            <View style={styles.modalButonSatir}>
              <TouchableOpacity
                onPress={() => setVeliModalGorunur(false)}
                style={styles.modalIptalButon}
              >
                <Text
                  style={{
                    color: tema.ikincilMetin,
                    fontWeight: "bold",
                    fontSize: 16,
                  }}
                >
                  İptal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={ogrenciyiBulVeBagla}
                disabled={yukleniyor}
                style={[
                  styles.modalOnayButon,
                  {
                    backgroundColor: yukleniyor
                      ? tema.ikincilMetin
                      : tema.anaButon,
                  },
                ]}
              >
                {yukleniyor ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}
                  >
                    Bağla
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    paddingTop: 10,
  },
  header: { marginBottom: 25, marginTop: 10 },
  baslik: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  kutu: { padding: 24, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
  kutuBaslik: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  kutuUstBaslik: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  ogrenciSeciciKutu: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    marginRight: 12,
  },
  ogrenciSeciciYazi: { fontSize: 15, fontWeight: "bold", marginLeft: 10 },
  ogrenciKucukFoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  input: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 17 },
  switchSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  switchYazi: { fontSize: 16, fontWeight: "600" },
  altBaslik: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  istatistikKutusu: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  kart: {
    flex: 1,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    marginHorizontal: 6,
  },
  kartSayi: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  kartYazi: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  barArkaplan: {
    height: 8,
    borderRadius: 4,
    width: "100%",
    overflow: "hidden",
  },
  barDolu: { height: "100%", borderRadius: 4 },
  listeElemani: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  listeBaslik: { fontSize: 17, fontWeight: "700" },
  durumKutusu: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  modalOgrenciArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalKutu: { borderRadius: 24, padding: 25 },
  modalBaslik: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    fontSize: 24,
    textAlign: "center",
    letterSpacing: 4,
    fontWeight: "bold",
  },
  modalButonSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalIptalButon: { padding: 16, flex: 1, alignItems: "center" },
  modalOnayButon: {
    padding: 16,
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
  },
  modalArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalDetayKutu: {
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
  modalBuyukFoto: {
    width: "100%",
    height: 240,
    borderRadius: 20,
    marginBottom: 20,
    resizeMode: "cover",
  },
  jsonArayuzKonteyner: { marginTop: 10 },
  aiEtiketKutusu: {
    backgroundColor: "#1E293B",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 15,
  },
  aiEtiketYazi: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  cozumAnaBaslik: { fontSize: 28, fontWeight: "900", marginBottom: 20 },
  bilgiEtiketi: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 25,
    alignItems: "center",
    borderColor: "#ccc",
  },
  adimlarKonteyner: { marginBottom: 25 },
  adimlarAnaBaslik: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  adimKutusu: {
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 20,
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
    borderRadius: 20,
    padding: 25,
    marginBottom: 30,
    alignItems: "center",
  },
  cevapMetni: { fontSize: 32, fontWeight: "900", marginTop: 5 },
  kucukBaslik: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
});
