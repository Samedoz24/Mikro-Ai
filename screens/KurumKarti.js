import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import {
  kurumaKatil,
  kurumdanAyril,
  kurumHataMesaji,
} from "../utils/kurumIstemci";

// Öğrencinin dershane (kurum) kartı: kurum koduyla katılma ve kurumdan ayrılma.
// Üyelik bilgisi sunucu tarafından yazılır; bu ekran yalnızca okur ve fonksiyonları çağırır.
export default function KurumKarti({ uid, tema }) {
  const [kurumId, setKurumId] = useState(null);
  const [kurumAdi, setKurumAdi] = useState(null);
  const [modalGorunur, setModalGorunur] = useState(false);
  const [kod, setKod] = useState("");
  const [onayli, setOnayli] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Kullanıcı belgesindeki kurumId canlı izlenir; katılma/ayrılma sonrası kart kendiliğinden güncellenir
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "kullanicilar", uid),
      (snap) => setKurumId(snap.data()?.kurumId || null),
      () => setKurumId(null)
    );
  }, [uid]);

  // Kurum adı, öğrencinin kendi üyelik kaydından okunur (kurum belgesini yalnızca yöneticiler okuyabilir)
  useEffect(() => {
    if (!uid || !kurumId) {
      setKurumAdi(null);
      return;
    }
    return onSnapshot(
      doc(db, "kurumlar", kurumId, "uyeler", uid),
      (snap) => setKurumAdi(snap.data()?.kurumAdi || null),
      () => setKurumAdi(null)
    );
  }, [uid, kurumId]);

  const modaliKapat = () => {
    if (calisiyor) return;
    setModalGorunur(false);
    setKod("");
    setOnayli(false);
  };

  const katil = async () => {
    const temizKod = kod.trim();
    if (!temizKod) {
      Alert.alert("Kod Gerekli", "Lütfen dershanenin verdiği kodu gir.");
      return;
    }
    if (!onayli) {
      Alert.alert(
        "Onay Gerekli",
        "Devam etmek için bilgilendirmeyi onaylamalısın."
      );
      return;
    }
    setCalisiyor(true);
    try {
      const sonuc = await kurumaKatil(temizKod);
      if (!mounted.current) return;
      setCalisiyor(false);
      setModalGorunur(false);
      setKod("");
      setOnayli(false);
      Alert.alert(
        "Hoş geldin! 🏫",
        `${sonuc.kurumAdi || "Dershane"} ile bağlandın. Premium haklarından yararlanabilirsin.`
      );
    } catch (hata) {
      console.log("Kuruma katılma hatası:", hata?.code, hata?.message);
      if (!mounted.current) return;
      setCalisiyor(false);
      Alert.alert("Katılınamadı", kurumHataMesaji(hata));
    }
  };

  const ayrilmayiOnayla = () => {
    Alert.alert(
      "Dershaneden Ayrıl",
      "Ayrılırsan dershane artık soru ve istatistiklerini göremez, dershanenin verdiği premium hakların da sona erer. Devam etmek istiyor musun?",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Ayrıl", style: "destructive", onPress: ayril },
      ]
    );
  };

  const ayril = async () => {
    setCalisiyor(true);
    try {
      await kurumdanAyril();
      if (mounted.current) setCalisiyor(false);
    } catch (hata) {
      console.log("Kurumdan ayrılma hatası:", hata?.code, hata?.message);
      if (!mounted.current) return;
      setCalisiyor(false);
      Alert.alert("Ayrılınamadı", kurumHataMesaji(hata));
    }
  };

  const kartStili = [
    styles.kutu,
    { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
  ];

  if (kurumId) {
    return (
      <View style={kartStili}>
        <View style={styles.baslikSatiri}>
          <Text style={[styles.baslik, { color: tema.metin }]}>Dershanem</Text>
          <Text style={styles.ikon}>🏫</Text>
        </View>
        <Text style={[styles.kurumAdi, { color: tema.anaButon }]}>
          {kurumAdi || "Bağlı dershane"}
        </Text>
        <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
          Dershane müdürün sorularını ve çözümlerini, öğretmenlerin ise soru
          sayın ve ders dağılımın gibi istatistiklerini görebilir. İstediğin
          zaman ayrılabilirsin.
        </Text>
        <TouchableOpacity
          style={[styles.ikincilButon, { borderColor: tema.hataKirmizi }]}
          onPress={ayrilmayiOnayla}
          disabled={calisiyor}
          activeOpacity={0.7}
        >
          {calisiyor ? (
            <ActivityIndicator color={tema.hataKirmizi} />
          ) : (
            <Text
              style={[styles.ikincilButonYazi, { color: tema.hataKirmizi }]}
            >
              Dershaneden Ayrıl
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <View style={kartStili}>
        <View style={styles.baslikSatiri}>
          <Text style={[styles.baslik, { color: tema.metin }]}>Dershane</Text>
          <Text style={styles.ikon}>🏫</Text>
        </View>
        <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
          Dershanen sana bir kod verdiyse buradan girerek bağlanabilirsin.
        </Text>
        <TouchableOpacity
          style={[styles.anaButon, { backgroundColor: tema.anaButon }]}
          onPress={() => setModalGorunur(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.anaButonYazi}>Dershane Kodu Gir</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalGorunur}
        transparent
        animationType="fade"
        onRequestClose={modaliKapat}
      >
        <KeyboardAvoidingView
          style={styles.modalArkaplan}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[styles.modalKutu, { backgroundColor: tema.kutuArkaplan }]}
          >
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              <Text style={[styles.modalBaslik, { color: tema.metin }]}>
                Dershaneye Bağlan
              </Text>
              <TextInput
                style={[
                  styles.girdi,
                  {
                    color: tema.metin,
                    borderColor: tema.kutuCerceve,
                    backgroundColor: tema.arkaplan,
                  },
                ]}
                value={kod}
                onChangeText={(metin) => setKod(metin.toUpperCase())}
                placeholder="Dershane kodu"
                placeholderTextColor={tema.ikincilMetin}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={14}
                editable={!calisiyor}
              />

              <Text
                style={[styles.bilgilendirme, { color: tema.ikincilMetin }]}
              >
                Dershaneye bağlanırsan:{"\n"}• Dershane müdürü gönderdiğin
                soruları ve çözümleri görebilir.{"\n"}• Öğretmenler soru sayın,
                ders dağılımın gibi istatistikleri görebilir.{"\n"}• Dershanenin
                sağladığı premium haklarından yararlanırsın.{"\n"}• İstediğin
                zaman Profil ekranından ayrılabilirsin; ayrılınca erişim
                kapanır.{"\n"}• 18 yaşından küçüksen velinin bilgisi dahilinde
                katılmalısın.
              </Text>

              <TouchableOpacity
                style={styles.onaySatiri}
                onPress={() => setOnayli((onceki) => !onceki)}
                disabled={calisiyor}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={onayli ? "checkbox" : "square-outline"}
                  size={24}
                  color={onayli ? tema.anaButon : tema.ikincilMetin}
                />
                <Text style={[styles.onayYazi, { color: tema.metin }]}>
                  Yukarıdaki bilgilendirmeyi okudum ve onaylıyorum.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.anaButon,
                  {
                    backgroundColor: tema.anaButon,
                    opacity: onayli && kod.trim() && !calisiyor ? 1 : 0.5,
                  },
                ]}
                onPress={katil}
                disabled={calisiyor}
                activeOpacity={0.8}
              >
                {calisiyor ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.anaButonYazi}>Bağlan</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.vazgec}
                onPress={modaliKapat}
                disabled={calisiyor}
                activeOpacity={0.7}
              >
                <Text style={[styles.vazgecYazi, { color: tema.ikincilMetin }]}>
                  Vazgeç
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  kutu: { padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1 },
  baslikSatiri: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  baslik: { fontSize: 15, fontWeight: "bold" },
  ikon: { fontSize: 20 },
  kurumAdi: { fontSize: 18, fontWeight: "bold", marginBottom: 8 },
  aciklama: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  anaButon: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  anaButonYazi: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  ikincilButon: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  ikincilButonYazi: { fontSize: 14, fontWeight: "bold" },
  modalArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 25,
  },
  modalKutu: { borderRadius: 24, padding: 25, width: "100%", maxHeight: "90%" },
  modalBaslik: { fontSize: 19, fontWeight: "bold", marginBottom: 16 },
  girdi: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 16,
  },
  bilgilendirme: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  onaySatiri: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  onayYazi: { flex: 1, fontSize: 14, marginLeft: 10, lineHeight: 19 },
  vazgec: { paddingVertical: 14, alignItems: "center" },
  vazgecYazi: { fontSize: 14 },
});
