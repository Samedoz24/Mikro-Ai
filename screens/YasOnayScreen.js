import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { doc, setDoc } from "firebase/firestore";

import { auth, db } from "../firebaseConfig";
import { oturumuKapat } from "../utils/oturum";
import { useTheme } from "../ThemeContext";
import { colors } from "../theme";
import { ASGARI_YAS } from "../utils/yasalMetinler";
import { onayOnMetni, kosullarBasligi, ONAY_SON_METNI, onayKaydi } from "../utils/onayMetni";
import KosullarPenceresi from "./KosullarPenceresi";

// Girişten hemen sonra, kullanıcı henüz yaş/koşul onayı vermemişse gösterilir.
// Tüm giriş yöntemleri (e-posta, Google, ileride Apple) ve mevcut hesaplar aynı yoldan geçer.
export default function YasOnayScreen({ kullanici, rol, onOnaylandi }) {
  const { tema } = useTheme();
  const isKaranlik = tema.arkaplan === colors.dark.arkaplan;
  const veliMi = rol === "veli";
  // Dershane müdürü ya da öğretmeni: kendi metni ve belgesi vardır
  const yoneticiMi = rol === "yonetici";
  const anaRenk = yoneticiMi ? "#0F766E" : veliMi ? "#4F46E5" : tema.anaButon;

  const [onaylandi, setOnaylandi] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kosullarGorunur, setKosullarGorunur] = useState(false);

  const yoneticiMaddeleri = [
    {
      ikon: "business-outline",
      metin:
        "Bu hesabı, bağlı olduğun dershanenin yetkilisi (müdür ya da rehber öğretmen) olarak kullanıyorsun.",
    },
    {
      ikon: "eye-outline",
      metin:
        "Müdür öğrencilerin sorularını ve çözümlerini, rehber öğretmen yalnızca istatistiklerini görür. Yalnızca dershaneye kendi isteğiyle bağlanan öğrencilerin verileri görünür.",
    },
    {
      ikon: "lock-closed-outline",
      metin:
        "Öğrenci verilerini yalnızca dershanenin eğitim faaliyetleri için kullanmalı, üçüncü kişilerle paylaşmamalısın.",
    },
    {
      ikon: "trash-outline",
      metin: "Hesabını istediğin zaman Hesabım sayfasından silebilirsin.",
    },
  ];

  const maddeler = yoneticiMi
    ? yoneticiMaddeleri
    : veliMi
    ? [
        {
          ikon: "person-outline",
          metin: "Veli hesabı için 18 yaşını doldurmuş olmalısın.",
        },
        {
          ikon: "sparkles-outline",
          metin:
            "Öğrencinin gönderdiği soru fotoğrafları çözüm üretmek için yapay zeka ile işlenir.",
        },
        {
          ikon: "trash-outline",
          metin: "Hesabını istediğin zaman Hesabım sayfasından silebilirsin.",
        },
      ]
    : [
        {
          ikon: "person-outline",
          metin: `Sormix'i kullanmak için ${ASGARI_YAS} yaşını doldurmuş olmalısın.`,
        },
        {
          ikon: "people-outline",
          metin:
            "18 yaşından küçüksen, uygulamayı velinin bilgisi dahilinde kullanmalısın.",
        },
        {
          ikon: "sparkles-outline",
          metin:
            "Gönderdiğin soru fotoğrafları çözüm üretmek için yapay zeka ile işlenir.",
        },
        {
          ikon: "trash-outline",
          metin: "Hesabını istediğin zaman Hesabım sayfasından silebilirsin.",
        },
      ];

  // Kayıt formuyla aynı role özel cümle ve aynı kayıt biçimi (utils/onayMetni.js)
  const onayMetni = onayOnMetni(rol || "ogrenci");

  const onayla = async () => {
    if (!onaylandi || kaydediliyor || !kullanici) return;
    setKaydediliyor(true);
    try {
      await setDoc(
        doc(db, "kullanicilar", kullanici.uid),
        {
          yasOnayi: onayKaydi({ rol: rol || "ogrenci" }),
        },
        { merge: true }
      );
      onOnaylandi();
    } catch (error) {
      console.log("Yaş onayı kaydedilemedi:", error?.code, error?.message);
      setKaydediliyor(false);
      Alert.alert(
        "Onay Kaydedilemedi",
        "İnternet bağlantını kontrol edip tekrar dene."
      );
    }
  };

  const cikisYap = async () => {
    try {
      await oturumuKapat();
    } catch (error) {
      console.log("Çıkış hatası:", error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: tema.arkaplan }]}>
      <StatusBar
        barStyle={isKaranlik ? "light-content" : "dark-content"}
        backgroundColor={tema.arkaplan}
      />

      <ScrollView
        contentContainerStyle={styles.icerik}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.ikonDaire, { backgroundColor: anaRenk + "1F" }]}>
          <Ionicons name="shield-checkmark" size={40} color={anaRenk} />
        </View>

        <Text style={[styles.baslik, { color: tema.metin }]}>
          Devam Etmeden Önce
        </Text>
        <Text style={[styles.altBaslik, { color: tema.ikincilMetin }]}>
          {yoneticiMi
            ? "Dershane yönetici hesabını kullanmadan önce aşağıdaki bilgileri okuyup onaylaman gerekiyor."
            : "Sormix'i güvenle kullanabilmen için aşağıdaki bilgileri okuyup onaylaman gerekiyor."}
        </Text>

        <View
          style={[
            styles.kart,
            { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
          ]}
        >
          {maddeler.map((madde, index) => (
            <View
              key={madde.ikon}
              style={[
                styles.madde,
                index < maddeler.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: tema.kutuCerceve,
                },
              ]}
            >
              <Ionicons name={madde.ikon} size={22} color={anaRenk} />
              <Text style={[styles.maddeMetin, { color: tema.metin }]}>
                {madde.metin}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setOnaylandi((o) => !o)}
          disabled={kaydediliyor}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: onaylandi }}
          style={[
            styles.onayKutusu,
            {
              borderColor: onaylandi ? anaRenk : tema.kutuCerceve,
              backgroundColor: onaylandi ? anaRenk + "12" : "transparent",
            },
          ]}
        >
          <Ionicons
            name={onaylandi ? "checkbox" : "square-outline"}
            size={26}
            color={onaylandi ? anaRenk : tema.ikincilMetin}
          />
          <Text style={[styles.onayMetni, { color: tema.metin }]}>
            {onayMetni}
            <Text
              onPress={() => setKosullarGorunur(true)}
              style={{
                color: anaRenk,
                fontWeight: "700",
                textDecorationLine: "underline",
              }}
              accessibilityRole="link"
            >
              {kosullarBasligi(rol)}
            </Text>
            {ONAY_SON_METNI}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onayla}
          disabled={!onaylandi || kaydediliyor}
          accessibilityRole="button"
          accessibilityState={{ disabled: !onaylandi || kaydediliyor }}
          style={[
            styles.anaButon,
            { backgroundColor: onaylandi ? anaRenk : tema.kutuCerceve },
          ]}
        >
          {kaydediliyor ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={[
                styles.anaButonYazi,
                { color: onaylandi ? "#FFFFFF" : tema.ikincilMetin },
              ]}
            >
              Onayla ve Devam Et
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={cikisYap}
          disabled={kaydediliyor}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={styles.cikisButon}
        >
          <Text style={[styles.cikisYazi, { color: tema.ikincilMetin }]}>
            Onaylamıyorum, Çıkış Yap
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <KosullarPenceresi gorunur={kosullarGorunur} kapat={() => setKosullarGorunur(false)} rol={rol} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  icerik: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  ikonDaire: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  baslik: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  altBaslik: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 24,
  },
  kart: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  madde: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
  },
  maddeMetin: { flex: 1, fontSize: 15, lineHeight: 21 },
  onayKutusu: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 20,
  },
  onayMetni: { flex: 1, fontSize: 14, lineHeight: 21 },
  anaButon: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  anaButonYazi: { fontSize: 17, fontWeight: "700" },
  cikisButon: { alignItems: "center", paddingVertical: 18 },
  cikisYazi: { fontSize: 15, fontWeight: "600" },
});
