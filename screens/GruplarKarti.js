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
import useGruplar from "../utils/useGruplar";
import useKurumOzetleri from "../utils/useKurumOzetleri";
import { GRUPSUZ, grupSayilari, ogrenciSatiri } from "../utils/kurumIstatistik";
import {
  grupAdiDegistir,
  grupOlustur,
  grupSil,
  kurumHataMesaji,
} from "../utils/kurumIstemci";

const AD_SINIRI = 30;

// Müdürün grup (sınıf/şube) yönetimi: oluşturma, yeniden adlandırma, silme.
// Gruplar öğrencileri ve öğretmenlerin kapsamını düzenler; yetki kararları sunucudadır.
export default function GruplarKarti({ kurumId, tema }) {
  const gruplar = useGruplar(kurumId);
  const { ozetler } = useKurumOzetleri(kurumId);
  const [duzenle, setDuzenle] = useState(null); // { grup } yeniden adlandırma, {} yeni grup
  const [ad, setAd] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);
  const [silinen, setSilinen] = useState(null);
  const canli = useRef(true);

  useEffect(() => {
    canli.current = true;
    return () => {
      canli.current = false;
    };
  }, []);

  const sayilar = useMemo(() => {
    const satirlar = (ozetler || []).map((o) => ogrenciSatiri(o.id, o));
    return grupSayilari(satirlar, gruplar || []);
  }, [ozetler, gruplar]);

  const modaliAc = (grup) => {
    setAd(grup ? grup.ad : "");
    setDuzenle({ grup: grup || null });
  };

  const modaliKapat = () => {
    if (calisiyor) return;
    setDuzenle(null);
    setAd("");
  };

  const kaydet = async () => {
    const temiz = ad.trim();
    if (!temiz) {
      Alert.alert("Ad Gerekli", "Grup için bir ad yaz (örneğin 12-A).");
      return;
    }
    setCalisiyor(true);
    try {
      if (duzenle.grup) await grupAdiDegistir(duzenle.grup.id, temiz);
      else await grupOlustur(temiz);
      if (!canli.current) return;
      setCalisiyor(false);
      setDuzenle(null);
      setAd("");
    } catch (e) {
      console.log("Grup kaydetme hatası:", e?.code, e?.message);
      if (!canli.current) return;
      setCalisiyor(false);
      Alert.alert("Kaydedilemedi", kurumHataMesaji(e));
    }
  };

  const silmeyiOnayla = (grup) => {
    const n = sayilar[grup.id] || 0;
    Alert.alert(
      "Grubu Sil",
      `"${grup.ad}" grubu silinecek.\n\n• ${
        n > 0 ? `${n} öğrenci` : "Öğrenciler"
      } gruptan çıkar ama dershanede kalır\n• Bu gruba atanmış öğretmenlerin bu gruptaki erişimi kalkar\n\nBu işlem geri alınamaz.`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: () => sil(grup) },
      ]
    );
  };

  const sil = async (grup) => {
    setSilinen(grup.id);
    try {
      await grupSil(grup.id);
    } catch (e) {
      console.log("Grup silme hatası:", e?.code, e?.message);
      if (canli.current) Alert.alert("Silinemedi", kurumHataMesaji(e));
    } finally {
      if (canli.current) setSilinen(null);
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
          <Text style={[styles.baslik, { color: tema.metin }]}>Gruplar</Text>
          <Text style={[styles.sayi, { color: YONETICI_RENGI }]}>
            {(gruplar || []).length} grup
          </Text>
        </View>

        {gruplar === null ? (
          <ActivityIndicator color={YONETICI_RENGI} style={{ margin: 16 }} />
        ) : gruplar.length === 0 ? (
          <Text style={[styles.kucukYazi, { color: tema.ikincilMetin }]}>
            Henüz grup yok. Öğrencilerini sınıf ya da şubelere ayırarak
            öğretmenlerin yalnızca kendi öğrencilerinin istatistiklerini
            görmesini sağlayabilirsin.
          </Text>
        ) : (
          gruplar.map((grup, i) => (
            <View
              key={grup.id}
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
                  style={[styles.grupAdi, { color: tema.metin }]}
                  numberOfLines={1}
                >
                  {grup.ad}
                </Text>
                <Text style={[styles.alt, { color: tema.ikincilMetin }]}>
                  {sayilar[grup.id] || 0} öğrenci
                </Text>
              </View>
              {silinen === grup.id ? (
                <ActivityIndicator color={tema.hataKirmizi} />
              ) : (
                <View style={styles.islemler}>
                  <TouchableOpacity
                    onPress={() => modaliAc(grup)}
                    disabled={silinen !== null}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${grup.ad} grubunu yeniden adlandır`}
                    style={styles.islem}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={20}
                      color={tema.ikincilMetin}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => silmeyiOnayla(grup)}
                    disabled={silinen !== null}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${grup.ad} grubunu sil`}
                    style={styles.islem}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={22}
                      color={tema.hataKirmizi}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}

        {gruplar !== null && gruplar.length > 0 && (
          <Text
            style={[styles.alt, { color: tema.ikincilMetin, marginTop: 10 }]}
          >
            Grupsuz öğrenci: {sayilar[GRUPSUZ] || 0}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.anaButon, { backgroundColor: YONETICI_RENGI }]}
          onPress={() => modaliAc(null)}
          disabled={gruplar === null}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.anaButonYazi}>Grup Ekle</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={duzenle !== null}
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
                {duzenle?.grup ? "Grubu Yeniden Adlandır" : "Yeni Grup"}
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
                value={ad}
                onChangeText={setAd}
                placeholder="Örn. 12-A, Hafta sonu kursu"
                placeholderTextColor={tema.ikincilMetin}
                maxLength={AD_SINIRI}
                autoFocus
                autoCorrect={false}
                editable={!calisiyor}
                returnKeyType="done"
                onSubmitEditing={kaydet}
              />
              <Text style={[styles.sayac, { color: tema.ikincilMetin }]}>
                {ad.length}/{AD_SINIRI}
              </Text>
              <TouchableOpacity
                style={[
                  styles.anaButon,
                  {
                    backgroundColor: YONETICI_RENGI,
                    opacity: ad.trim() && !calisiyor ? 1 : 0.5,
                  },
                ]}
                onPress={kaydet}
                disabled={calisiyor}
                activeOpacity={0.8}
              >
                {calisiyor ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.anaButonYazi}>Kaydet</Text>
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
  grupAdi: { fontSize: 15, fontWeight: "600" },
  alt: { fontSize: 12, marginTop: 2 },
  islemler: { flexDirection: "row", alignItems: "center" },
  islem: { paddingHorizontal: 8 },
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
  },
  sayac: { fontSize: 12, textAlign: "right", marginTop: 6 },
  vazgec: { paddingVertical: 14, alignItems: "center" },
  vazgecYazi: { fontSize: 14 },
});
