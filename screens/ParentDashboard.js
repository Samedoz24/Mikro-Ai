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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Firebase Araçları
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

const ekranGenisligi = Dimensions.get("window").width;
const ekranYuksekligi = Dimensions.get("window").height;

export default function ParentDashboard() {
  const { tema, temaModu } = useTheme();

  // Veli Kontrol Stateleri
  const [veliModalGorunur, setVeliModalGorunur] = useState(false);
  const [ogrenciKoduInput, setOgrenciKoduInput] = useState("");
  const [bagliOgrenciler, setBagliOgrenciler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  const [aktifOgrenci, setAktifOgrenci] = useState(null);

  // 🎯 YENİ: Öğrenci fotoğraflarını hafızada tutacak state
  const [ogrenciFotolar, setOgrenciFotolar] = useState({});

  // WhatsApp Raporlama Stateleri
  const [whatsappNo, setWhatsappNo] = useState("");
  const [raporAktif, setRaporAktif] = useState(false);

  // 📊 İstatistik Stateleri
  const [sonSorular, setSonSorular] = useState([]);
  const [toplamSoruSayisi, setToplamSoruSayisi] = useState(0);
  const [cozulmeOrani, setCozulmeOrani] = useState(0);
  const [sorularYukleniyor, setSorularYukleniyor] = useState(false);
  const [dersIstatistikleri, setDersIstatistikleri] = useState([]);

  // Soru Detayı Gösterme Stateleri
  const [seciliSoru, setSeciliSoru] = useState(null);
  const [detayModalGorunur, setDetayModalGorunur] = useState(false);
  const [tamEkranModu, setTamEkranModu] = useState(false);
  const [cozumYukleniyor, setCozumYukleniyor] = useState(false);

  // 1. ADIM: Velinin Verilerini Getir
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

  // 2. ADIM: Aktif Öğrencinin Sorularını ve TÜM Öğrencilerin Fotoğraflarını Çek
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

        // Döngü: Hem fotoğrafları alıyoruz hem de aktif öğrenciyse sorularını çekiyoruz
        for (const ogr of bagliOgrenciler) {
          const ogrRef = doc(db, "kullanicilar", ogr.id);
          const ogrSnap = await getDoc(ogrRef);

          if (ogrSnap.exists() && ogrSnap.data().eposta) {
            const data = ogrSnap.data();

            // 🎯 YENİ: Profil fotoğrafını hafızaya kaydet
            if (data.profilFoto) {
              geciciFotolar[ogr.id] = data.profilFoto;
            }

            // Eğer bu öğrenci "Aktif" olarak seçtiğimiz öğrenciyse sorularını çek
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

        // State'leri Güncelle
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
      `${ogrenci.isim} isimli öğrencinin bağlantısını kesmek istediğinize emin misiniz?`,
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
    <View style={{ flex: 1, backgroundColor: tema.arkaplan }}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.baslik, { color: tema.metin }]}>
            Veli Paneli
          </Text>
          <Text style={{ color: tema.ikincilMetin }}>
            Öğrencinizin gelişimini buradan takip edin.
          </Text>
        </View>

        {/* BAĞLI ÖĞRENCİLER LİSTESİ */}
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
              <Ionicons name="add-circle" size={28} color={tema.anaButon} />
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
                    {/* 🎯 YENİ: Varsa Fotoğrafı, Yoksa İkonu Göster */}
                    {ogrenciFotolar[ogr.id] ? (
                      <Image
                        source={{ uri: ogrenciFotolar[ogr.id] }}
                        style={[
                          styles.ogrenciKucukFoto,
                          { borderColor: seciliMi ? "#fff" : tema.kutuCerceve },
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
                      style={{ marginLeft: 10 }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
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
            style={[styles.kutuBaslik, { color: tema.metin, marginBottom: 15 }]}
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
            {/* 🎯 YENİ: Başlıkta da fotoğraf gösterimi */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 10,
                marginBottom: 15,
              }}
            >
              {ogrenciFotolar[aktifOgrenci.id] && (
                <Image
                  source={{ uri: ogrenciFotolar[aktifOgrenci.id] }}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
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
                    { color: tema.metin, marginBottom: 15 },
                  ]}
                >
                  Derslere Göre Soru Dağılımı
                </Text>

                {dersIstatistikleri.map((istatistik, index) => (
                  <View key={index} style={{ marginBottom: 12 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 5,
                      }}
                    >
                      <Text
                        style={{
                          color: tema.metin,
                          fontSize: 13,
                          fontWeight: "500",
                        }}
                      >
                        {istatistik.ders}
                      </Text>
                      <Text
                        style={{
                          color: tema.anaButon,
                          fontSize: 13,
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
              style={[styles.altBaslik, { color: tema.metin, marginTop: 10 }]}
            >
              {aktifOgrenci.isim}'in Son Çözdükleri
            </Text>

            {sorularYukleniyor ? (
              <ActivityIndicator
                size="large"
                color={tema.anaButon}
                style={{ marginTop: 20, marginBottom: 20 }}
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
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      {item.fotoLink && (
                        <Image
                          source={{ uri: item.fotoLink }}
                          style={{
                            width: 45,
                            height: 45,
                            borderRadius: 8,
                            marginRight: 12,
                          }}
                        />
                      )}
                      <View>
                        <Text
                          style={[styles.listeBaslik, { color: tema.metin }]}
                        >
                          {dersAdi}
                        </Text>
                        <Text
                          style={{
                            color: tema.ikincilMetin,
                            fontSize: 12,
                            marginTop: 4,
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
                          fontSize: 12,
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
                  marginTop: 10,
                  marginBottom: 30,
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
              marginTop: 10,
              marginBottom: 30,
            }}
          >
            Yukarıdan bir öğrenci seçin.
          </Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Çözüm İnceleme Modalı */}
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
                { backgroundColor: tema.kutuArkaplan },
              ]}
            >
              <View style={styles.modalUstKontroller}>
                <Text
                  style={{
                    fontSize: 18,
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
                            "Sonuç bulunamadı"
                        )}
                      </Text>
                    </View>

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
                  </View>
                ) : (
                  <View style={{ padding: 40, alignItems: "center" }}>
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
                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      {/* Veli Bağlantı Modalı */}
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
                  marginBottom: 15,
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
                <Text style={{ color: tema.ikincilMetin, fontWeight: "bold" }}>
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
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>
                    Bağla
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 20, marginTop: 10 },
  baslik: { fontSize: 24, fontWeight: "bold", marginBottom: 5 },
  kutu: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  kutuBaslik: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  kutuUstBaslik: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },

  // Öğrenci Seçici (Tab) Stilleri
  ogrenciSeciciKutu: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  ogrenciSeciciYazi: { fontSize: 14, fontWeight: "bold", marginLeft: 8 },
  ogrenciKucukFoto: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
  },

  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  switchSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
  },
  switchYazi: { fontSize: 16, fontWeight: "500" },
  altBaslik: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  istatistikKutusu: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  kart: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginHorizontal: 5,
  },
  kartSayi: { fontSize: 24, fontWeight: "bold", marginBottom: 5 },
  kartYazi: { fontSize: 12, fontWeight: "500", textAlign: "center" },

  barArkaplan: {
    height: 6,
    borderRadius: 3,
    width: "100%",
    overflow: "hidden",
  },
  barDolu: { height: "100%", borderRadius: 3 },

  listeElemani: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  listeBaslik: { fontSize: 16, fontWeight: "600" },
  durumKutusu: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },

  modalOgrenciArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalKutu: { borderRadius: 15, padding: 20 },
  modalBaslik: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 2,
  },
  modalButonSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  modalIptalButon: { padding: 15, flex: 1, alignItems: "center" },
  modalOnayButon: {
    padding: 15,
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
  },

  // Soru Detay Modalı Stilleri
  modalArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modalDetayKutu: {
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
  kucukBaslik: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    textTransform: "uppercase",
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
    padding: 10,
    borderRadius: 20,
    zIndex: 10,
  },
});
