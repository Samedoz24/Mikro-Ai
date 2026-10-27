import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { doc, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

import { auth, db } from "../firebaseConfig";
import { useTheme } from "../ThemeContext";
import { colors } from "../theme";
import {
  htmlSablonUret,
  KULLANIM_KOSULLARI_ICERIK,
  YAS_ONAYI_SURUMU,
  ASGARI_YAS,
} from "../utils/yasalMetinler";

// Girişten hemen sonra, kullanıcı henüz yaş/koşul onayı vermemişse gösterilir.
// Tüm giriş yöntemleri (e-posta, Google, ileride Apple) ve mevcut hesaplar aynı yoldan geçer.
export default function YasOnayScreen({ kullanici, rol, onOnaylandi }) {
  const { tema } = useTheme();
  const insets = useSafeAreaInsets();
  const isKaranlik = tema.arkaplan === colors.dark.arkaplan;
  const veliMi = rol === "veli";
  const anaRenk = veliMi ? "#4F46E5" : tema.anaButon;

  const [onaylandi, setOnaylandi] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [kosullarGorunur, setKosullarGorunur] = useState(false);

  const maddeler = veliMi
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
          metin: `Mikro AI'yı kullanmak için ${ASGARI_YAS} yaşını doldurmuş olmalısın.`,
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

  const onayMetni = veliMi
    ? "18 yaşını doldurduğumu ve "
    : `${ASGARI_YAS} yaşını doldurduğumu, 18 yaşından küçükse velimin bilgisi dahilinde kullandığımı ve `;

  const onayla = async () => {
    if (!onaylandi || kaydediliyor || !kullanici) return;
    setKaydediliyor(true);
    try {
      await setDoc(
        doc(db, "kullanicilar", kullanici.uid),
        {
          yasOnayi: {
            onaylandi: true,
            surum: YAS_ONAYI_SURUMU,
            tarih: new Date().toISOString(),
            rol: rol || "ogrenci",
          },
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
      await signOut(auth);
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
          Mikro AI'yı güvenle kullanabilmen için aşağıdaki bilgileri
          okuyup onaylaman gerekiyor.
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
              Kullanım Koşulları
            </Text>
            'nı okuyup kabul ettiğimi onaylıyorum.
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

      <Modal
        visible={kosullarGorunur}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setKosullarGorunur(false)}
        onDismiss={() => setKosullarGorunur(false)}
      >
        {/* Modal, güvenli alan bağlamının dışında çizildiği için boşluklar elle verilir */}
        <View
          style={{
            flex: 1,
            // WebView'ın içindeki şablonla aynı renk; alt boşlukta renk farkı oluşmaz
            backgroundColor: isKaranlik ? "#121212" : "#FFFFFF",
            paddingTop: Platform.OS === "android" ? insets.top : 0,
            paddingBottom: insets.bottom,
          }}
        >
          <View
            style={[
              styles.modalBaslik,
              {
                borderBottomColor: tema.kutuCerceve,
                backgroundColor: tema.arkaplan,
              },
            ]}
          >
            <Text
              style={[styles.modalBaslikYazi, { color: tema.metin }]}
              accessibilityRole="header"
            >
              Kullanım Koşulları
            </Text>
            <TouchableOpacity
              onPress={() => setKosullarGorunur(false)}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              style={styles.modalKapatButon}
            >
              <Ionicons
                name="close-circle"
                size={32}
                color={tema.ikincilMetin}
              />
            </TouchableOpacity>
          </View>
          <WebView
            originWhitelist={["*"]}
            source={{
              html: htmlSablonUret(
                isKaranlik,
                "Yasal Şartlar",
                "Hukuki Metin",
                KULLANIM_KOSULLARI_ICERIK
              ),
            }}
            style={{
              flex: 1,
              backgroundColor: isKaranlik ? "#121212" : "#FFFFFF",
            }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
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
  modalBaslik: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalBaslikYazi: { fontSize: 18, fontWeight: "700" },
  modalKapatButon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
