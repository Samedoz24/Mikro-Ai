import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useColorScheme,
  Alert,
  Modal,
  TextInput,
  Switch,
} from "react-native";

// Firebase Kütüphaneleri
import { auth, db } from "../firebaseConfig";
import { signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../theme";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileScreen() {
  const user = auth.currentUser;
  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  const [rol, setRol] = useState("ogrenci");
  const [sinifModalGorunur, setSinifModalGorunur] = useState(false);
  const [seciliSinif, setSeciliSinif] = useState("Sınıf Seçilmedi");

  const [adSoyad, setAdSoyad] = useState("");
  const [bildirimAktif, setBildirimAktif] = useState(true);

  const [kalanSoru, setKalanSoru] = useState(3);
  const [seriGunu, setSeriGunu] = useState(0);
  const [baglantiKodu, setBaglantiKodu] = useState("Yükleniyor...");

  const rastgeleKodUret = () => {
    const karakterler = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let kod = "";
    for (let i = 0; i < 6; i++) {
      kod += karakterler.charAt(Math.floor(Math.random() * karakterler.length));
    }
    return kod;
  };

  useEffect(() => {
    const verileriGetir = async () => {
      if (!user) return;

      // 1. Rolü, Sınıfı ve İsmi Hafızadan Hızlıca Al (Bekletmemek için)
      const kayitliRol = await AsyncStorage.getItem("kullaniciRolu");
      const gecerliRol = kayitliRol || "ogrenci";
      setRol(gecerliRol);

      const kayitliSinif = await AsyncStorage.getItem("seciliSinif");
      if (kayitliSinif) setSeciliSinif(kayitliSinif);

      const kayitliAdSoyad = await AsyncStorage.getItem("adSoyad");
      if (kayitliAdSoyad) setAdSoyad(kayitliAdSoyad);

      // 2. Firebase Veritabanından Kullanıcıyı Bul (Asıl Güvenilir Kaynak)
      const kullaniciRef = doc(db, "kullanicilar", user.uid);
      const kullaniciSnap = await getDoc(kullaniciRef);

      if (kullaniciSnap.exists()) {
        const data = kullaniciSnap.data();

        // Firebase'den gelen GÜNCEL verileri ekrana bas
        if (data.sinif) setSeciliSinif(data.sinif);
        if (data.baglantiKodu) setBaglantiKodu(data.baglantiKodu);
        if (data.adSoyad) setAdSoyad(data.adSoyad);

        // Bu güncel verileri, sonraki açılışlar için telefonun hafızasına da kaydet
        if (data.adSoyad) await AsyncStorage.setItem("adSoyad", data.adSoyad);
        if (data.sinif) await AsyncStorage.setItem("seciliSinif", data.sinif);
      } else {
        const yeniKod = rastgeleKodUret();
        setBaglantiKodu(yeniKod);

        await setDoc(kullaniciRef, {
          eposta: user.email,
          rol: gecerliRol,
          baglantiKodu: yeniKod,
          kayitTarihi: new Date().toISOString(),
        });
      }
    };

    verileriGetir();
  }, [user]);

  const cikisYap = () => {
    Alert.alert(
      "Çıkış",
      "Hesabınızdan çıkış yapmak istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Evet",
          onPress: async () => {
            try {
              // Çıkış yaparken önceki hesaba ait tüm geçici hafızayı temizle
              await AsyncStorage.removeItem("adSoyad");
              await AsyncStorage.removeItem("seciliSinif");
              await AsyncStorage.removeItem("kullaniciRolu");

              // Firebase'den çıkış yap
              await signOut(auth);
            } catch (error) {
              console.log("Çıkış hatası:", error);
            }
          },
        },
      ]
    );
  };

  const hesabiSil = () => {
    Alert.alert("Hesabı Sil", "Tüm verileriniz kalıcı olarak silinecektir.", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: () => console.log("Silme talebi"),
      },
    ]);
  };

  const siniflar = [
    "1. Sınıf",
    "2. Sınıf",
    "3. Sınıf",
    "4. Sınıf",
    "5. Sınıf",
    "6. Sınıf",
    "7. Sınıf",
    "8. Sınıf",
    "9. Sınıf",
    "10. Sınıf",
    "11. Sınıf",
    "12. Sınıf",
    "Mezun",
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tema.arkaplan }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { backgroundColor: tema.anaButon }]}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>
          {adSoyad || user?.email?.split("@")[0]}
        </Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: tema.metin }]}>
          Kişisel Bilgiler
        </Text>
        <View
          style={[
            styles.kutu,
            {
              backgroundColor: tema.kutuArkaplan,
              borderColor: tema.kutuCerceve,
            },
          ]}
        >
          <TextInput
            style={{ color: tema.metin, fontSize: 16 }}
            placeholder="Ad Soyad Giriniz"
            placeholderTextColor={tema.ikincilMetin}
            value={adSoyad}
            onChangeText={setAdSoyad}
            autoCorrect={false}
            spellCheck={false}
            onEndEditing={async () => {
              if (adSoyad !== "") {
                await AsyncStorage.setItem("adSoyad", adSoyad);
                if (user) {
                  const kullaniciRef = doc(db, "kullanicilar", user.uid);
                  await updateDoc(kullaniciRef, { adSoyad: adSoyad });
                }
              }
            }}
          />
        </View>

        {rol === "ogrenci" && (
          <>
            <Text
              style={[
                styles.sectionTitle,
                { color: tema.metin, marginTop: 20 },
              ]}
            >
              Gelişim Durumum
            </Text>

            <View
              style={[
                styles.streakKutu,
                {
                  backgroundColor: tema.kutuArkaplan,
                  borderColor: tema.anaButon,
                },
              ]}
            >
              <Text style={styles.streakIkon}>🔥</Text>
              <View>
                <Text style={[styles.streakBaslik, { color: tema.metin }]}>
                  {seriGunu} Günlük Seri
                </Text>
                <Text
                  style={[styles.streakAltYazi, { color: tema.ikincilMetin }]}
                >
                  Her gün soru çözerek serini koru!
                </Text>
              </View>
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
                <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                  Günlük Soru Kotası
                </Text>
                <Text style={[styles.kotaSayi, { color: tema.anaButon }]}>
                  {kalanSoru} / 3
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
                      width: `${(kalanSoru / 3) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setSinifModalGorunur(true)}
              style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
            >
              <Ionicons
                name="school-outline"
                size={22}
                color={tema.anaButon}
                style={styles.menuIcon}
              />
              <View style={styles.menuMetinAlan}>
                <Text style={[styles.menuBaslik, { color: tema.metin }]}>
                  Sınıf Bilgim
                </Text>
                <Text style={[styles.menuAlt, { color: tema.ikincilMetin }]}>
                  {seciliSinif}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={tema.ikincilMetin}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Veli Bağlantı Kodu",
                  `Bu kodu veline vererek seni takip etmesini sağlayabilirsin:\n\n${baglantiKodu}`
                )
              }
              style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
            >
              <Ionicons
                name="link-outline"
                size={22}
                color={tema.anaButon}
                style={styles.menuIcon}
              />
              <View style={styles.menuMetinAlan}>
                <Text style={[styles.menuBaslik, { color: tema.metin }]}>
                  Veli Bağlantı Kodum
                </Text>
                <Text style={[styles.menuAlt, { color: tema.ikincilMetin }]}>
                  {baglantiKodu}
                </Text>
              </View>
              <Ionicons
                name="copy-outline"
                size={18}
                color={tema.ikincilMetin}
              />
            </TouchableOpacity>
          </>
        )}

        <Text
          style={[styles.sectionTitle, { color: tema.metin, marginTop: 20 }]}
        >
          Tercihler
        </Text>
        <View style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={tema.anaButon}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuBaslik, { color: tema.metin, flex: 1 }]}>
            Bildirimleri Al
          </Text>
          <Switch
            value={bildirimAktif}
            onValueChange={setBildirimAktif}
            trackColor={{ false: tema.kutuCerceve, true: tema.anaButon }}
          />
        </View>

        <Text
          style={[styles.sectionTitle, { color: tema.metin, marginTop: 20 }]}
        >
          Destek ve Bilgi
        </Text>
        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
        >
          <Ionicons
            name="help-circle-outline"
            size={22}
            color={tema.metin}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuBaslik, { color: tema.metin }]}>
            Nasıl Kullanılır?
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={tema.metin}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuBaslik, { color: tema.metin }]}>
            Kullanım Koşulları
          </Text>
        </TouchableOpacity>
        <View style={{ alignItems: "center", marginTop: 10 }}>
          <Text style={{ color: tema.ikincilMetin, fontSize: 12 }}>
            Versiyon 1.0.2
          </Text>
        </View>

        <Text
          style={[styles.sectionTitle, { color: tema.metin, marginTop: 25 }]}
        >
          Hesap Ayarları
        </Text>
        <TouchableOpacity
          onPress={cikisYap}
          style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
        >
          <Ionicons
            name="log-out-outline"
            size={22}
            color={tema.metin}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuBaslik, { color: tema.metin }]}>
            Oturumu Kapat
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={hesabiSil}
          style={[
            styles.menuItem,
            {
              backgroundColor: tema.kutuArkaplan,
              borderColor: tema.hataKirmizi,
              borderWidth: 1,
            },
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={22}
            color={tema.hataKirmizi}
            style={styles.menuIcon}
          />
          <Text style={[styles.menuBaslik, { color: tema.hataKirmizi }]}>
            Hesabımı Sil
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={sinifModalGorunur}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalArkaplan}>
          <View
            style={[styles.modalKutu, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Text style={[styles.modalBaslik, { color: tema.metin }]}>
              Sınıfını Güncelle
            </Text>
            <ScrollView style={{ maxHeight: 350 }}>
              {siniflar.map((sinif, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalSecenek,
                    { borderBottomColor: tema.kutuCerceve },
                  ]}
                  onPress={async () => {
                    setSeciliSinif(sinif);
                    setSinifModalGorunur(false);

                    await AsyncStorage.setItem("seciliSinif", sinif);

                    if (user) {
                      const kullaniciRef = doc(db, "kullanicilar", user.uid);
                      await updateDoc(kullaniciRef, { sinif: sinif });
                    }
                  }}
                >
                  <Text
                    style={[styles.modalSecenekYazi, { color: tema.metin }]}
                  >
                    {sinif}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setSinifModalGorunur(false)}
              style={styles.modalKapatButon}
            >
              <Text style={{ color: tema.hataKirmizi, fontWeight: "bold" }}>
                Kapat
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingVertical: 45,
    alignItems: "center",
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  avatarContainer: {
    width: 85,
    height: 85,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  avatarText: { fontSize: 38, color: "#fff", fontWeight: "bold" },
  userName: { fontSize: 22, color: "#fff", fontWeight: "bold" },
  userEmail: { fontSize: 14, color: "rgba(255,255,255,0.85)" },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  streakKutu: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1.5,
  },
  streakIkon: { fontSize: 32, marginRight: 15 },
  streakBaslik: { fontSize: 17, fontWeight: "bold" },
  streakAltYazi: { fontSize: 12, marginTop: 2 },
  kutu: { padding: 18, borderRadius: 15, marginBottom: 15, borderWidth: 1 },
  kutuUstBaslik: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  kutuBaslik: { fontSize: 15, fontWeight: "bold" },
  kotaSayi: { fontSize: 16, fontWeight: "bold" },
  barArkaplan: {
    height: 8,
    borderRadius: 4,
    width: "100%",
    overflow: "hidden",
  },
  barDolu: { height: "100%", borderRadius: 4 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  menuIcon: { marginRight: 15 },
  menuMetinAlan: { flex: 1 },
  menuBaslik: { fontSize: 15, fontWeight: "600" },
  menuAlt: { fontSize: 12, marginTop: 3 },
  modalArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 25,
  },
  modalKutu: { borderRadius: 20, padding: 20 },
  modalBaslik: {
    fontSize: 19,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  modalSecenek: { paddingVertical: 16, borderBottomWidth: 0.5 },
  modalSecenekYazi: { fontSize: 16, textAlign: "center" },
  modalKapatButon: { marginTop: 20, padding: 10, alignItems: "center" },
});
