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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { YONETICI_RENGI } from "../utils/useYoneticiYetkisi";
import useDuyurular from "../utils/useDuyurular";
import useGruplar from "../utils/useGruplar";
import useKurumOzetleri from "../utils/useKurumOzetleri";
import { grupSayilari, ogrenciSatiri } from "../utils/kurumIstatistik";
import {
  BASLIK_SINIRI,
  HEDEF_HEPSI,
  METIN_SINIRI,
  aliciSayisi,
  duyuruDenetle,
  duyuruZamanMetni,
  duyurulariHazirla,
  hedefAdi,
} from "../utils/kurumDuyuru";
import {
  duyuruGonder,
  duyuruSil,
  kurumHataMesaji,
} from "../utils/kurumIstemci";

const ILK_GORUNEN = 5;

// Müdürün duyuru kartı: öğrencilere (hepsine ya da bir gruba) uygulama içi duyuru gönderir,
// gönderilenleri listeler ve siler. Yetki ve doğrulama sunucudadır.
export default function DuyurularKarti({ kurumId, uyeSayisi, tema }) {
  const { duyurular, hata } = useDuyurular(kurumId);
  const gruplar = useGruplar(kurumId);
  const { ozetler } = useKurumOzetleri(kurumId);
  const grupListesi = gruplar || [];

  const [pencere, setPencere] = useState(false);
  const [hedef, setHedef] = useState(HEDEF_HEPSI);
  const [baslik, setBaslik] = useState("");
  const [metin, setMetin] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [silinen, setSilinen] = useState(null);
  const [hepsiGorunur, setHepsiGorunur] = useState(false);
  const canli = useRef(true);

  useEffect(() => {
    canli.current = true;
    return () => {
      canli.current = false;
    };
  }, []);

  const liste = useMemo(
    () => duyurulariHazirla(duyurular, grupListesi),
    [duyurular, grupListesi]
  );
  const sayilar = useMemo(
    () =>
      grupSayilari(
        (ozetler || []).map((o) => ogrenciSatiri(o.id, o)),
        grupListesi
      ),
    [ozetler, grupListesi]
  );
  const gorunen = hepsiGorunur ? liste : liste.slice(0, ILK_GORUNEN);
  // Seçili grup silindiyse hedef "tüm öğrenciler"e döner
  const gecerliHedef =
    hedef === HEDEF_HEPSI || grupListesi.some((g) => g.id === hedef)
      ? hedef
      : HEDEF_HEPSI;

  const pencereyiAc = () => {
    setHedef(HEDEF_HEPSI);
    setBaslik("");
    setMetin("");
    setPencere(true);
  };

  const pencereyiKapat = () => {
    if (gonderiliyor) return;
    setPencere(false);
  };

  const gondermeyiOnayla = () => {
    const uyari = duyuruDenetle(baslik, metin);
    if (uyari) {
      Alert.alert("Eksik Bilgi", uyari);
      return;
    }
    const n = aliciSayisi(gecerliHedef, uyeSayisi, sayilar);
    const ad = hedefAdi(gecerliHedef, grupListesi);
    Alert.alert(
      "Duyuru Gönderilsin mi?",
      n > 0
        ? `"${ad}" hedefindeki ${n} öğrenci bu duyuruyu görecek. Gönderdikten sonra silebilirsin, ama öğrenciler o ana kadar görmüş olabilir.`
        : `"${ad}" hedefinde henüz öğrenci yok, şimdilik kimse görmeyecek. Yine de gönderilsin mi?`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Gönder", onPress: gonder },
      ]
    );
  };

  const gonder = async () => {
    setGonderiliyor(true);
    try {
      await duyuruGonder(
        baslik.trim(),
        metin,
        gecerliHedef === HEDEF_HEPSI ? null : gecerliHedef
      );
      if (!canli.current) return;
      setGonderiliyor(false);
      setPencere(false);
      Alert.alert(
        "Duyuru Gönderildi",
        "Öğrenciler uygulamayı açtığında göreceklerdir."
      );
    } catch (e) {
      console.log("Duyuru gönderme hatası:", e?.code, e?.message);
      if (!canli.current) return;
      setGonderiliyor(false);
      Alert.alert("Gönderilemedi", kurumHataMesaji(e));
    }
  };

  const silmeyiOnayla = (duyuru) => {
    Alert.alert(
      "Duyuruyu Sil",
      `"${duyuru.baslik}" duyurusu öğrencilerin ekranından da kaldırılacak.`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: () => sil(duyuru) },
      ]
    );
  };

  const sil = async (duyuru) => {
    setSilinen(duyuru.id);
    try {
      await duyuruSil(duyuru.id);
    } catch (e) {
      console.log("Duyuru silme hatası:", e?.code, e?.message);
      if (canli.current) Alert.alert("Silinemedi", kurumHataMesaji(e));
    } finally {
      if (canli.current) setSilinen(null);
    }
  };

  const kartStili = [
    styles.kutu,
    { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
  ];
  const secimStili = (secili) => [
    styles.hedef,
    {
      backgroundColor: secili ? YONETICI_RENGI : "transparent",
      borderColor: secili ? YONETICI_RENGI : tema.kutuCerceve,
    },
  ];

  return (
    <>
      <View style={kartStili}>
        <View style={styles.baslikSatiri}>
          <Text style={[styles.baslik, { color: tema.metin }]}>Duyurular</Text>
          <Text style={[styles.sayi, { color: YONETICI_RENGI }]}>
            {liste.length} duyuru
          </Text>
        </View>

        {duyurular === null && !hata ? (
          <ActivityIndicator color={YONETICI_RENGI} style={{ margin: 16 }} />
        ) : duyurular === null && hata ? (
          <Text style={[styles.kucukYazi, { color: tema.ikincilMetin }]}>
            Duyurular yüklenemedi. İnternet bağlantını kontrol et.
          </Text>
        ) : liste.length === 0 ? (
          <Text style={[styles.kucukYazi, { color: tema.ikincilMetin }]}>
            Henüz duyuru göndermedin. Öğrencilerine ya da bir gruba kısa
            mesajlar gönderebilirsin; öğrenciler uygulamayı açtığında görür.
          </Text>
        ) : (
          gorunen.map((d, i) => (
            <View
              key={d.id}
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
                  style={[styles.duyuruBaslik, { color: tema.metin }]}
                  numberOfLines={1}
                >
                  {d.baslik}
                </Text>
                <Text
                  style={[styles.alt, { color: YONETICI_RENGI }]}
                  numberOfLines={1}
                >
                  {d.hedefAdi}
                  <Text style={{ color: tema.ikincilMetin }}>
                    {" · "}
                    {duyuruZamanMetni(d.zamanMs)}
                  </Text>
                </Text>
                <Text
                  style={[styles.onizleme, { color: tema.ikincilMetin }]}
                  numberOfLines={2}
                >
                  {d.metin}
                </Text>
              </View>
              {silinen === d.id ? (
                <ActivityIndicator color={tema.hataKirmizi} />
              ) : (
                <TouchableOpacity
                  onPress={() => silmeyiOnayla(d)}
                  disabled={silinen !== null}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.baslik} duyurusunu sil`}
                >
                  <Ionicons
                    name="trash-outline"
                    size={22}
                    color={tema.hataKirmizi}
                  />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        {liste.length > ILK_GORUNEN && (
          <TouchableOpacity
            onPress={() => setHepsiGorunur((g) => !g)}
            style={styles.dahaFazla}
            accessibilityRole="button"
          >
            <Text
              style={{ color: YONETICI_RENGI, fontWeight: "700", fontSize: 13 }}
            >
              {hepsiGorunur
                ? "Daha az göster"
                : `Tümünü göster (${liste.length})`}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.anaButon, { backgroundColor: YONETICI_RENGI }]}
          onPress={pencereyiAc}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons name="megaphone-outline" size={20} color="#fff" />
          <Text style={styles.anaButonYazi}>Yeni Duyuru</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={pencere}
        transparent
        animationType="fade"
        onRequestClose={pencereyiKapat}
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
                Yeni Duyuru
              </Text>

              <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                Kime?
              </Text>
              <View style={styles.hedefler}>
                {[
                  { id: HEDEF_HEPSI, ad: "Tüm öğrenciler" },
                  ...grupListesi,
                ].map((g) => {
                  const secili = g.id === gecerliHedef;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      onPress={() => setHedef(g.id)}
                      disabled={gonderiliyor}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected: secili }}
                      style={secimStili(secili)}
                    >
                      <Text
                        style={{
                          color: secili ? "#fff" : tema.ikincilMetin,
                          fontSize: 13,
                          fontWeight: "600",
                        }}
                      >
                        {g.ad}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                Başlık
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
                value={baslik}
                onChangeText={setBaslik}
                placeholder="Örn. Yarın deneme sınavı var"
                placeholderTextColor={tema.ikincilMetin}
                maxLength={BASLIK_SINIRI}
                editable={!gonderiliyor}
                returnKeyType="next"
              />
              <Text style={[styles.sayac, { color: tema.ikincilMetin }]}>
                {baslik.length}/{BASLIK_SINIRI}
              </Text>

              <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                Mesaj
              </Text>
              <TextInput
                style={[
                  styles.girdi,
                  styles.cokSatir,
                  {
                    color: tema.metin,
                    borderColor: tema.kutuCerceve,
                    backgroundColor: tema.arkaplan,
                  },
                ]}
                value={metin}
                onChangeText={setMetin}
                placeholder="Duyuru metni"
                placeholderTextColor={tema.ikincilMetin}
                maxLength={METIN_SINIRI}
                multiline
                textAlignVertical="top"
                editable={!gonderiliyor}
              />
              <Text style={[styles.sayac, { color: tema.ikincilMetin }]}>
                {metin.length}/{METIN_SINIRI}
              </Text>

              <TouchableOpacity
                style={[
                  styles.anaButon,
                  {
                    backgroundColor: YONETICI_RENGI,
                    opacity:
                      baslik.trim() && metin.trim() && !gonderiliyor ? 1 : 0.5,
                  },
                ]}
                onPress={gondermeyiOnayla}
                disabled={gonderiliyor}
                activeOpacity={0.8}
              >
                {gonderiliyor ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.anaButonYazi}>Gönder</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.vazgec}
                onPress={pencereyiKapat}
                disabled={gonderiliyor}
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
  duyuruBaslik: { fontSize: 15, fontWeight: "600" },
  alt: { fontSize: 12, marginTop: 2, fontWeight: "600" },
  onizleme: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  dahaFazla: { alignItems: "center", paddingTop: 8, paddingBottom: 2 },
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
  modalKutu: { borderRadius: 24, padding: 25, width: "100%", maxHeight: "92%" },
  modalBaslik: { fontSize: 19, fontWeight: "bold", marginBottom: 14 },
  etiket: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  hedefler: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  hedef: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  girdi: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  cokSatir: { minHeight: 110 },
  sayac: { fontSize: 12, textAlign: "right", marginTop: 4, marginBottom: 6 },
  vazgec: { paddingVertical: 14, alignItems: "center" },
  vazgecYazi: { fontSize: 14 },
});
