import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { oturumuKapat } from "../utils/oturum";
import { useTheme } from "../ThemeContext";
import SinifSecici from "./SinifSecici";
import RolSecici, { rolEtiketi } from "./RolSecici";
import { SINIF_SECENEKLERI, profilFormuDogrula, yeniProfilBelgesi } from "../utils/profilKurallari";

// "Profilini Tamamla" (28 Kasım 2026)
//  - mod "yeni": Google/Apple ile ilk giriş; profil yok. Ad soyad, sınıf (yalnızca öğrenci) ve rol (Öğrenci/Veli)
//    seçilir; profil OLUŞTURULUR. Rol bundan sonra değiştirilemez (firestore.rules).
//  - mod "tamamla": mevcut hesapta ad ya da sınıf eksik. Rol sabittir, gösterilmez; yalnızca eksik alanlar yazılır.
// Bu ekran tamamlanmadan uygulamaya girilemez (App.js). Yönetici rolü burada seçilemez (yalnızca sunucu verir).
export default function ProfilTamamla({ kullanici, mod, rolSabit, onerilenAd, mevcutSinif, onTamamlandi }) {
  const { tema } = useTheme();
  const [adSoyad, setAdSoyad] = useState(onerilenAd || "");
  const [sinif, setSinif] = useState(SINIF_SECENEKLERI.includes(mevcutSinif) ? mevcutSinif : null);
  // Yeni profilde hesap türü boş başlar: bilinçli seçilmeden devam edilemez
  const [rol, setRol] = useState(null);
  const [sinifSeciciGorunur, setSinifSeciciGorunur] = useState(false);
  const [rolSeciciGorunur, setRolSeciciGorunur] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const yeniMi = mod === "yeni";
  const gecerliRol = yeniMi ? rol : rolSabit;

  const kaydet = async () => {
    if (kaydediliyor || !kullanici) return;
    const sonuc = profilFormuDogrula({ adSoyad, sinif, rol, rolSabit: yeniMi ? undefined : rolSabit });
    if (sonuc.hata) {
      Alert.alert("Eksik Bilgi", sonuc.hata);
      return;
    }
    setKaydediliyor(true);
    try {
      const ref = doc(db, "kullanicilar", kullanici.uid);
      if (yeniMi) {
        // Birleştirmesiz yazım: belge yoksa oluşturur. Belge bu arada oluşmuşsa (ör. sunucu yönetici yaptıysa)
        // kurallar rol değişikliğini reddeder; rol hiçbir koşulda istemciden değiştirilemez.
        await setDoc(ref, yeniProfilBelgesi({ profil: sonuc.profil, eposta: kullanici.email }));
      } else {
        const guncelleme = { adSoyad: sonuc.profil.adSoyad };
        if (sonuc.profil.rol === "ogrenci") guncelleme.sinif = sonuc.profil.sinif;
        await updateDoc(ref, guncelleme);
      }
      onTamamlandi(sonuc.profil);
    } catch (e) {
      console.log("Profil kaydedilemedi:", e?.code);
      setKaydediliyor(false);
      Alert.alert("Kaydedilemedi", "Bilgilerin kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.");
    }
  };

  const baskaHesap = async () => {
    if (kaydediliyor) return;
    try {
      await oturumuKapat();
    } catch (e) {
      console.log("Çıkış yapılamadı:", e?.message);
    }
  };

  const kutu = [styles.kutu, { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.arkaplan }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.icerik} keyboardShouldPersistTaps="handled">
          <View style={[styles.ikon, { backgroundColor: tema.anaButon + "1A" }]}>
            <Ionicons name="person-circle-outline" size={56} color={tema.anaButon} />
          </View>
          <Text style={[styles.baslik, { color: tema.metin }]}>Profilini Tamamla</Text>
          <Text style={[styles.alt, { color: tema.ikincilMetin }]}>
            {yeniMi
              ? "Devam etmeden önce birkaç bilgiye ihtiyacımız var."
              : "Hesabında eksik bilgiler var. Bir kez tamamlaman yeterli."}
          </Text>

          <View style={kutu}>
            <Ionicons name="person-outline" size={22} color={tema.ikincilMetin} style={styles.kutuIkon} />
            <TextInput
              style={[styles.girdi, { color: tema.metin }]}
              placeholder="Ad Soyad"
              placeholderTextColor={tema.ikincilMetin}
              value={adSoyad}
              onChangeText={setAdSoyad}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              maxLength={40}
              editable={!kaydediliyor}
            />
          </View>

          {gecerliRol !== "veli" && (
            <TouchableOpacity
              style={kutu}
              onPress={() => setSinifSeciciGorunur(true)}
              disabled={kaydediliyor}
              accessibilityRole="button"
              accessibilityLabel={sinif ? `Sınıf: ${sinif}` : "Sınıfını seç"}
            >
              <Ionicons name="school-outline" size={22} color={tema.ikincilMetin} style={styles.kutuIkon} />
              <Text style={[styles.girdi, { color: sinif ? tema.metin : tema.ikincilMetin }]}>{sinif || "Sınıfın"}</Text>
              <Ionicons name="chevron-down" size={20} color={tema.ikincilMetin} />
            </TouchableOpacity>
          )}

          {yeniMi && (
            <TouchableOpacity
              style={kutu}
              onPress={() => setRolSeciciGorunur(true)}
              disabled={kaydediliyor}
              accessibilityRole="button"
              accessibilityLabel={rol ? `Hesap türü: ${rolEtiketi(rol)}. Değiştirmek için dokun.` : "Hesap türünü seç"}
            >
              <Ionicons
                name={rol === "ogrenci" ? "school-outline" : "people-outline"}
                size={22}
                color={tema.ikincilMetin}
                style={styles.kutuIkon}
              />
              <Text style={[styles.girdi, { color: rol ? tema.metin : tema.ikincilMetin }]}>
                {rol ? `Hesap türü: ${rolEtiketi(rol)}` : "Hesap türün"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={tema.ikincilMetin} />
            </TouchableOpacity>
          )}
          {yeniMi && (
            <Text style={[styles.not, { color: tema.ikincilMetin }]}>
              Hesap türü daha sonra değiştirilemez.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.buton, { backgroundColor: tema.anaButon }, kaydediliyor && { opacity: 0.7 }]}
            onPress={kaydet}
            disabled={kaydediliyor}
            accessibilityRole="button"
          >
            {kaydediliyor ? <ActivityIndicator color="#fff" /> : <Text style={styles.butonYazi}>Devam Et</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={baskaHesap} disabled={kaydediliyor} style={styles.cikis} accessibilityRole="button">
            <Text style={[styles.cikisYazi, { color: tema.ikincilMetin }]}>Başka bir hesapla giriş yap</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <RolSecici
        gorunur={rolSeciciGorunur}
        kapat={() => setRolSeciciGorunur(false)}
        seciliRol={rol}
        sec={setRol}
      />
      <SinifSecici
        gorunur={sinifSeciciGorunur}
        kapat={() => setSinifSeciciGorunur(false)}
        siniflar={SINIF_SECENEKLERI}
        seciliSinif={sinif}
        sec={(secilen) => {
          setSinif(secilen);
          return true;
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  icerik: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, paddingVertical: 40 },
  ikon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  baslik: { fontSize: 26, fontWeight: "900", textAlign: "center", marginBottom: 8 },
  alt: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  kutu: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 60,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  kutuIkon: { marginRight: 12 },
  girdi: { flex: 1, fontSize: 16 },
  not: { fontSize: 13, alignSelf: "flex-start", marginBottom: 16, marginLeft: 4 },
  buton: { width: "100%", height: 60, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 10 },
  butonYazi: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  cikis: { marginTop: 22, paddingVertical: 10 },
  cikisYazi: { fontSize: 15, fontWeight: "600" },
});
