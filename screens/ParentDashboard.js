import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { colors } from "../theme";
import { Ionicons } from "@expo/vector-icons";

// Firebase Araçları
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
} from "firebase/firestore";

export default function ParentDashboard() {
  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  // Veli Kontrol Stateleri
  const [veliModalGorunur, setVeliModalGorunur] = useState(false);
  const [ogrenciKoduInput, setOgrenciKoduInput] = useState("");
  const [bagliOgrenciler, setBagliOgrenciler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  // WhatsApp Raporlama Stateleri
  const [whatsappNo, setWhatsappNo] = useState("");
  const [raporAktif, setRaporAktif] = useState(false);

  // 📊 Gerçek İstatistik Stateleri
  const [sonSorular, setSonSorular] = useState([]);
  const [toplamSoruSayisi, setToplamSoruSayisi] = useState(0);
  const [cozulmeOrani, setCozulmeOrani] = useState(0);
  const [sorularYukleniyor, setSorularYukleniyor] = useState(false);

  // 1. ADIM: Velinin Kendi Verilerini Getir
  useEffect(() => {
    const veliVerileriniGetir = async () => {
      if (!auth.currentUser) return;

      const veliRef = doc(db, "kullanicilar", auth.currentUser.uid);
      const veliSnap = await getDoc(veliRef);

      if (veliSnap.exists()) {
        const data = veliSnap.data();
        if (data.bagliOgrenciler) setBagliOgrenciler(data.bagliOgrenciler);
        if (data.whatsappNo) setWhatsappNo(data.whatsappNo);
        if (data.raporAktif !== undefined) setRaporAktif(data.raporAktif);
      }
    };
    veliVerileriniGetir();
  }, []);

  // 2. ADIM: Bağlı Öğrencilerin Gerçek Sorularını Çek
  useEffect(() => {
    const ogrenciSorulariniCek = async () => {
      // Eğer velinin bağlı öğrencisi yoksa istatistik aramaya gerek yok
      if (bagliOgrenciler.length === 0) {
        setSonSorular([]);
        setToplamSoruSayisi(0);
        setCozulmeOrani(0);
        return;
      }

      setSorularYukleniyor(true);
      try {
        let tumSorular = [];
        let cozulmusSayisi = 0;

        // Velinin listesindeki her bir öğrenci için döngü başlat
        for (const ogr of bagliOgrenciler) {
          // Öğrencinin "eposta" adresini bulmak için kendi dosyasına bakıyoruz
          const ogrRef = doc(db, "kullanicilar", ogr.id);
          const ogrSnap = await getDoc(ogrRef);

          if (ogrSnap.exists() && ogrSnap.data().eposta) {
            const ogrEposta = ogrSnap.data().eposta;

            // Öğrencinin e-postası ile "sorular" veritabanında arama yapıyoruz
            const q = query(
              collection(db, "sorular"),
              where("kullaniciEposta", "==", ogrEposta)
            );
            const qSnap = await getDocs(q);

            qSnap.forEach((docSnap) => {
              const soruData = docSnap.data();
              // Çekilen her soruyu "tumSorular" listesine atıyoruz
              tumSorular.push({
                id: docSnap.id,
                ogrenciIsim: ogr.isim,
                ...soruData,
              });

              // Eğer soru yapay zeka tarafından çözülmüşse sayacı 1 artırıyoruz
              if (soruData.durum === "Çözüldü") {
                cozulmusSayisi++;
              }
            });
          }
        }

        // Bütün öğrencilerin sorularını tarihe göre sırala (En yeni en üstte)
        tumSorular.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

        // Stateleri Güncelle
        setSonSorular(tumSorular);
        setToplamSoruSayisi(tumSorular.length);

        // Çözülme oranını hesapla: (Çözülen Soru / Toplam Soru) * 100
        if (tumSorular.length > 0) {
          const oran = Math.round((cozulmusSayisi / tumSorular.length) * 100);
          setCozulmeOrani(oran);
        } else {
          setCozulmeOrani(0);
        }
      } catch (error) {
        console.log("Soru çekme hatası:", error);
      }
      setSorularYukleniyor(false);
    };

    ogrenciSorulariniCek();
  }, [bagliOgrenciler]); // bagliOgrenciler listesi değiştiğinde bu kodu tekrar çalıştır

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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tema.arkaplan }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.baslik, { color: tema.metin }]}>Veli Paneli</Text>
        <Text style={{ color: tema.ikincilMetin }}>
          Öğrencinizin gelişimini buradan takip edin.
        </Text>
      </View>

      <View
        style={[
          styles.kutu,
          { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
        ]}
      >
        <View style={styles.kutuUstBaslik}>
          <Text
            style={[styles.kutuBaslik, { color: tema.metin, marginBottom: 0 }]}
          >
            Bağlı Öğrenciler
          </Text>
          <TouchableOpacity onPress={() => setVeliModalGorunur(true)}>
            <Ionicons name="add-circle" size={28} color={tema.anaButon} />
          </TouchableOpacity>
        </View>

        {bagliOgrenciler.length > 0 ? (
          bagliOgrenciler.map((ogr, index) => (
            <View
              key={index}
              style={[
                styles.ogrenciKart,
                { marginBottom: index === bagliOgrenciler.length - 1 ? 0 : 15 },
              ]}
            >
              <Ionicons
                name="person-circle-outline"
                size={40}
                color={tema.anaButon}
              />
              <Text style={[styles.ogrenciIsim, { color: tema.metin }]}>
                {ogr.isim}
              </Text>
            </View>
          ))
        ) : (
          <Text
            style={{
              color: tema.ikincilMetin,
              textAlign: "center",
              marginVertical: 10,
            }}
          >
            Henüz bir öğrenci bağlamadınız. Eklemek için sağ üstteki + ikonuna
            dokunun.
          </Text>
        )}
      </View>

      <View
        style={[
          styles.kutu,
          { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
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

      <Text style={[styles.altBaslik, { color: tema.metin }]}>
        Haftalık Özet
      </Text>
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
            {bagliOgrenciler.length > 0 ? toplamSoruSayisi : "-"}
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
          <Text style={[styles.kartSayi, { color: tema.aiButon || "#10B981" }]}>
            {bagliOgrenciler.length > 0 ? `%${cozulmeOrani}` : "-"}
          </Text>
          <Text style={[styles.kartYazi, { color: tema.ikincilMetin }]}>
            Çözülme Oranı
          </Text>
        </View>
      </View>

      <Text style={[styles.altBaslik, { color: tema.metin }]}>
        Son Çözülenler
      </Text>
      {bagliOgrenciler.length > 0 ? (
        sorularYukleniyor ? (
          <ActivityIndicator
            size="large"
            color={tema.anaButon}
            style={{ marginTop: 20, marginBottom: 20 }}
          />
        ) : sonSorular.length > 0 ? (
          // Ekranda çok fazla yer kaplamaması için sadece en yeni 5 soruyu listeliyoruz (slice(0,5))
          sonSorular.slice(0, 5).map((item, index) => {
            const okunanTarih = new Date(item.tarih).toLocaleDateString(
              "tr-TR"
            );
            const cozulduMu = item.durum === "Çözüldü";

            return (
              <View
                key={index}
                style={[
                  styles.listeElemani,
                  {
                    backgroundColor: tema.kutuArkaplan,
                    borderColor: tema.kutuCerceve,
                  },
                ]}
              >
                <View>
                  <Text style={[styles.listeBaslik, { color: tema.metin }]}>
                    Soru - {item.ogrenciIsim}
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
                    }}
                  >
                    {item.durum}
                  </Text>
                </View>
              </View>
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
            Öğrencileriniz henüz soru göndermedi.
          </Text>
        )
      ) : (
        <Text
          style={{
            color: tema.ikincilMetin,
            textAlign: "center",
            marginTop: 10,
            marginBottom: 30,
          }}
        >
          Öğrenci bağladığınızda veriler burada görünecektir.
        </Text>
      )}

      <View style={{ height: 40 }} />

      <Modal visible={veliModalGorunur} animationType="fade" transparent={true}>
        <View style={styles.modalArkaplan}>
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
    </ScrollView>
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
  ogrenciKart: { flexDirection: "row", alignItems: "center" },
  ogrenciIsim: { fontSize: 18, fontWeight: "bold", marginLeft: 10 },
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
  modalArkaplan: {
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
});
