import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { YONETICI_RENGI } from "../utils/useYoneticiYetkisi";
import {
  kurumHataMesaji,
  ogretmenDavetEt,
  yoneticiKaldir,
} from "../utils/kurumIstemci";
import { ekipSirala } from "../utils/kurumEkip";
import { ogretmenDavetMetni } from "../utils/kurumRapor";

const UYARI_RENGI = "#D97706";
const ROL_ADLARI = { mudur: "Müdür", ogretmen: "Öğretmen" };

// Müdürün ekip yönetimi: öğretmen davet etme, davet/yetki kaldırma. Yetki kararları sunucudadır;
// bu kart yalnızca listeyi okur ve fonksiyonları çağırır.
export default function EkipKarti({ kurumId, kurumAdi, tema }) {
  const [kayitlar, setKayitlar] = useState(null); // null: yükleniyor
  const [hata, setHata] = useState(false);
  const [modalGorunur, setModalGorunur] = useState(false);
  const [eposta, setEposta] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);
  const [kaldirilan, setKaldirilan] = useState(null);
  const canli = useRef(true);

  const benimEposta = String(auth.currentUser?.email || "").toLowerCase();

  useEffect(() => {
    canli.current = true;
    return () => {
      canli.current = false;
    };
  }, []);

  useEffect(() => {
    if (!kurumId) return;
    setHata(false);
    return onSnapshot(
      collection(db, "kurumlar", kurumId, "yoneticiler"),
      (snap) => {
        setKayitlar(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setHata(false);
      },
      (e) => {
        console.log("Ekip listesi okunamadı:", e?.code);
        setHata(true);
      }
    );
  }, [kurumId]);

  const ekip = useMemo(() => ekipSirala(kayitlar || []), [kayitlar]);

  const modaliKapat = () => {
    if (calisiyor) return;
    setModalGorunur(false);
    setEposta("");
  };

  const davetGonder = async () => {
    const temiz = eposta.trim().toLowerCase();
    if (!temiz) {
      Alert.alert("E-posta Gerekli", "Öğretmenin e-posta adresini yaz.");
      return;
    }
    setCalisiyor(true);
    try {
      const sonuc = await ogretmenDavetEt(temiz);
      if (!canli.current) return;
      setCalisiyor(false);
      setModalGorunur(false);
      setEposta("");
      const mesaj = ogretmenDavetMetni(kurumAdi, sonuc.eposta);
      Alert.alert(
        sonuc.zatenVar ? "Zaten Ekipte" : "Davet Hazır",
        sonuc.zatenVar
          ? `${sonuc.eposta} zaten ekipte ya da davetli.`
          : `${sonuc.eposta} adresine öğretmen yetkisi tanımlandı. Öğretmen, Yönetici sekmesinden bu adresle giriş yapınca ekibe katılır. İstersen hazır davet mesajını paylaşabilirsin.`,
        [
          { text: "Tamam", style: "cancel" },
          {
            text: "Mesajı Paylaş",
            onPress: () =>
              Share.share({ message: mesaj }).catch((e) =>
                console.log("Davet mesajı paylaşılamadı:", e?.message)
              ),
          },
        ]
      );
    } catch (e) {
      console.log("Öğretmen daveti hatası:", e?.code, e?.message);
      if (!canli.current) return;
      setCalisiyor(false);
      Alert.alert("Davet Edilemedi", kurumHataMesaji(e));
    }
  };

  const kaldirmayiOnayla = (uye) => {
    const davetli = uye.durum === "davetli";
    Alert.alert(
      davetli ? "Daveti İptal Et" : "Öğretmeni Kaldır",
      davetli
        ? `${uye.eposta} adresine gönderilen davet iptal edilecek.`
        : `${uye.eposta} ekipten çıkarılacak ve yönetici yetkisi hemen kapanacak.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: davetli ? "İptal Et" : "Kaldır",
          style: "destructive",
          onPress: () => kaldir(uye.eposta),
        },
      ]
    );
  };

  const kaldir = async (adres) => {
    setKaldirilan(adres);
    try {
      await yoneticiKaldir(adres);
    } catch (e) {
      console.log("Kaldırma hatası:", e?.code, e?.message);
      if (canli.current) Alert.alert("Kaldırılamadı", kurumHataMesaji(e));
    } finally {
      if (canli.current) setKaldirilan(null);
    }
  };

  const kartStili = [
    styles.kutu,
    { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
  ];

  return (
    <>
      <View style={kartStili}>
        <View style={styles.baslikSatiri}>
          <Text style={[styles.baslik, { color: tema.metin }]}>Ekip</Text>
          <Text style={[styles.sayi, { color: YONETICI_RENGI }]}>
            {ekip.length} kişi
          </Text>
        </View>

        {kayitlar === null && !hata ? (
          <ActivityIndicator color={YONETICI_RENGI} style={{ margin: 16 }} />
        ) : hata && kayitlar === null ? (
          <Text style={[styles.kucukYazi, { color: tema.ikincilMetin }]}>
            Ekip listesi yüklenemedi. İnternet bağlantını kontrol et.
          </Text>
        ) : (
          ekip.map((uye, i) => {
            const ben = uye.eposta === benimEposta;
            const davetli = uye.durum === "davetli";
            const kaldirilabilir = uye.rol === "ogretmen" && !ben;
            return (
              <View
                key={uye.eposta}
                style={[
                  styles.satir,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: tema.kutuCerceve,
                  },
                ]}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text
                    style={[styles.eposta, { color: tema.metin }]}
                    numberOfLines={1}
                  >
                    {uye.eposta}
                    {ben ? " (sen)" : ""}
                  </Text>
                  <View style={styles.etiketSatiri}>
                    <Text style={[styles.rol, { color: tema.ikincilMetin }]}>
                      {ROL_ADLARI[uye.rol]}
                    </Text>
                    <View
                      style={[
                        styles.durum,
                        {
                          backgroundColor: davetli
                            ? UYARI_RENGI + "22"
                            : YONETICI_RENGI + "22",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: davetli ? UYARI_RENGI : YONETICI_RENGI,
                        }}
                      >
                        {davetli ? "Davetli" : "Aktif"}
                      </Text>
                    </View>
                  </View>
                </View>
                {kaldirilabilir &&
                  (kaldirilan === uye.eposta ? (
                    <ActivityIndicator color={tema.hataKirmizi} />
                  ) : (
                    <TouchableOpacity
                      onPress={() => kaldirmayiOnayla(uye)}
                      disabled={kaldirilan !== null}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        davetli
                          ? `${uye.eposta} davetini iptal et`
                          : `${uye.eposta} öğretmenini kaldır`
                      }
                    >
                      <Ionicons
                        name="trash-outline"
                        size={22}
                        color={tema.hataKirmizi}
                      />
                    </TouchableOpacity>
                  ))}
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={[styles.anaButon, { backgroundColor: YONETICI_RENGI }]}
          onPress={() => setModalGorunur(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons name="person-add-outline" size={18} color="#fff" />
          <Text style={styles.anaButonYazi}>Öğretmen Davet Et</Text>
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
                Öğretmen Davet Et
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
                value={eposta}
                onChangeText={setEposta}
                placeholder="ogretmen@ornek.com"
                placeholderTextColor={tema.ikincilMetin}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!calisiyor}
                returnKeyType="send"
                onSubmitEditing={davetGonder}
              />
              <Text style={[styles.bilgi, { color: tema.ikincilMetin }]}>
                Öğretmen, uygulamada Yönetici sekmesinden bu e-posta adresiyle
                giriş yapınca ekibe katılır. Google ile giriş önerilir. Öğretmen
                öğrencilerin yalnızca istatistiklerini görür, sorularını
                göremez.
              </Text>
              <TouchableOpacity
                style={[
                  styles.anaButon,
                  {
                    backgroundColor: YONETICI_RENGI,
                    opacity: eposta.trim() && !calisiyor ? 1 : 0.5,
                  },
                ]}
                onPress={davetGonder}
                disabled={calisiyor}
                activeOpacity={0.8}
              >
                {calisiyor ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.anaButonYazi}>Davet Et</Text>
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
    marginBottom: 8,
  },
  baslik: { fontSize: 15, fontWeight: "bold" },
  sayi: { fontSize: 14, fontWeight: "bold" },
  kucukYazi: { fontSize: 13, lineHeight: 19 },
  satir: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  eposta: { fontSize: 14, fontWeight: "600" },
  etiketSatiri: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  rol: { fontSize: 12, marginRight: 8 },
  durum: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  anaButon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  anaButonYazi: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    marginLeft: 6,
  },
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
    fontSize: 16,
    marginBottom: 14,
  },
  bilgi: { fontSize: 13, lineHeight: 20 },
  vazgec: { paddingVertical: 14, alignItems: "center" },
  vazgecYazi: { fontSize: 14 },
});
