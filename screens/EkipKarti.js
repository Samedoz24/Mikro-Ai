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
  ogretmenKapsamAta,
  yoneticiKaldir,
} from "../utils/kurumIstemci";
import { ekipSirala } from "../utils/kurumEkip";
import useGruplar from "../utils/useGruplar";
import { kapsamMetni } from "../utils/kurumKapsam";
import { ogretmenDavetMetni } from "../utils/kurumRapor";

const UYARI_RENGI = "#D97706";
const ROL_ADLARI = { mudur: "Müdür", ogretmen: "Öğretmen" };
const EN_FAZLA_OGRETMEN_GRUBU = 10;

// Müdürün ekip yönetimi: öğretmen davet etme, davet/yetki kaldırma. Yetki kararları sunucudadır;
// bu kart yalnızca listeyi okur ve fonksiyonları çağırır.
export default function EkipKarti({ kurumId, kurumAdi, tema }) {
  const [kayitlar, setKayitlar] = useState(null); // null: yükleniyor
  const [hata, setHata] = useState(false);
  const [modalGorunur, setModalGorunur] = useState(false);
  const [eposta, setEposta] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);
  const [kaldirilan, setKaldirilan] = useState(null);
  const gruplar = useGruplar(kurumId);
  const grupListesi = gruplar || [];
  // Öğretmenin kapsamını düzenleme penceresi: { eposta, kapsam: "tum" | "gruplar", secili: [grup kimlikleri] }
  const [kapsamPenceresi, setKapsamPenceresi] = useState(null);
  const [kapsamKaydediliyor, setKapsamKaydediliyor] = useState(false);
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

  const kapsamPenceresiniAc = (uye) =>
    setKapsamPenceresi({
      eposta: uye.eposta,
      kapsam: uye.kapsam === "gruplar" ? "gruplar" : "tum",
      // Silinmiş gruplar seçimden düşer
      secili: (Array.isArray(uye.gruplar) ? uye.gruplar : []).filter((id) =>
        grupListesi.some((g) => g.id === id)
      ),
    });

  const kapsamPenceresiniKapat = () => {
    if (kapsamKaydediliyor) return;
    setKapsamPenceresi(null);
  };

  const grupIsaretle = (id) => {
    if (!kapsamPenceresi) return;
    const isaretli = kapsamPenceresi.secili.includes(id);
    if (!isaretli && kapsamPenceresi.secili.length >= EN_FAZLA_OGRETMEN_GRUBU) {
      Alert.alert(
        "Sınıra Ulaşıldı",
        `Bir öğretmene en fazla ${EN_FAZLA_OGRETMEN_GRUBU} grup atanabilir.`
      );
      return;
    }
    setKapsamPenceresi({
      ...kapsamPenceresi,
      secili: isaretli
        ? kapsamPenceresi.secili.filter((g) => g !== id)
        : [...kapsamPenceresi.secili, id],
    });
  };

  const kapsamKaydet = async () => {
    const { eposta: hedef, kapsam, secili } = kapsamPenceresi;
    setKapsamKaydediliyor(true);
    try {
      await ogretmenKapsamAta(
        hedef,
        kapsam,
        kapsam === "gruplar" ? secili : []
      );
      if (!canli.current) return;
      setKapsamKaydediliyor(false);
      setKapsamPenceresi(null);
    } catch (e) {
      console.log("Kapsam kaydetme hatası:", e?.code, e?.message);
      if (!canli.current) return;
      setKapsamKaydediliyor(false);
      Alert.alert("Kaydedilemedi", kurumHataMesaji(e));
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
                  {uye.rol === "ogretmen" && (
                    <Text
                      style={[styles.kapsam, { color: tema.ikincilMetin }]}
                      numberOfLines={2}
                    >
                      Kapsam:{" "}
                      {kapsamMetni(
                        uye.kapsam === "gruplar" ? "gruplar" : "tum",
                        uye.gruplar,
                        grupListesi
                      )}
                    </Text>
                  )}
                </View>
                {uye.rol === "ogretmen" && (
                  <TouchableOpacity
                    onPress={() => kapsamPenceresiniAc(uye)}
                    disabled={kaldirilan !== null}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${uye.eposta} kapsamını düzenle`}
                    style={{ paddingHorizontal: 10 }}
                  >
                    <Ionicons
                      name="options-outline"
                      size={22}
                      color={tema.ikincilMetin}
                    />
                  </TouchableOpacity>
                )}
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

      <Modal
        visible={kapsamPenceresi !== null}
        transparent
        animationType="fade"
        onRequestClose={kapsamPenceresiniKapat}
      >
        <View style={styles.modalArkaplan}>
          <View
            style={[styles.modalKutu, { backgroundColor: tema.kutuArkaplan }]}
          >
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalBaslik, { color: tema.metin }]}>
                Öğretmenin Kapsamı
              </Text>
              <Text
                style={[
                  styles.bilgi,
                  { color: tema.ikincilMetin, marginBottom: 14 },
                ]}
                numberOfLines={1}
              >
                {kapsamPenceresi?.eposta}
              </Text>

              {[
                { id: "tum", etiket: "Tüm öğrenciler" },
                { id: "gruplar", etiket: "Yalnızca seçili gruplar" },
              ].map((secenek) => {
                const secili = kapsamPenceresi?.kapsam === secenek.id;
                return (
                  <TouchableOpacity
                    key={secenek.id}
                    onPress={() =>
                      setKapsamPenceresi((o) =>
                        o ? { ...o, kapsam: secenek.id } : o
                      )
                    }
                    disabled={kapsamKaydediliyor}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: secili }}
                    style={styles.secenek}
                  >
                    <Ionicons
                      name={secili ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={secili ? YONETICI_RENGI : tema.ikincilMetin}
                    />
                    <Text style={[styles.secenekYazi, { color: tema.metin }]}>
                      {secenek.etiket}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {kapsamPenceresi?.kapsam === "gruplar" && (
                <View style={{ marginTop: 6 }}>
                  {grupListesi.length === 0 ? (
                    <Text style={[styles.bilgi, { color: tema.ikincilMetin }]}>
                      Henüz grup yok. Önce Gruplar bölümünden grup oluştur.
                    </Text>
                  ) : (
                    grupListesi.map((g) => {
                      const isaretli = kapsamPenceresi.secili.includes(g.id);
                      return (
                        <TouchableOpacity
                          key={g.id}
                          onPress={() => grupIsaretle(g.id)}
                          disabled={kapsamKaydediliyor}
                          activeOpacity={0.7}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isaretli }}
                          style={[styles.secenek, styles.grupSecenegi]}
                        >
                          <Ionicons
                            name={isaretli ? "checkbox" : "square-outline"}
                            size={22}
                            color={
                              isaretli ? YONETICI_RENGI : tema.ikincilMetin
                            }
                          />
                          <Text
                            style={[styles.secenekYazi, { color: tema.metin }]}
                          >
                            {g.ad}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                  {kapsamPenceresi.secili.length === 0 && (
                    <Text
                      style={[
                        styles.bilgi,
                        { color: tema.hataKirmizi, marginTop: 8 },
                      ]}
                    >
                      Hiç grup seçmezsen bu öğretmen hiçbir öğrenciyi göremez.
                    </Text>
                  )}
                </View>
              )}

              <Text
                style={[
                  styles.bilgi,
                  { color: tema.ikincilMetin, marginTop: 14 },
                ]}
              >
                Kapsam, öğretmenin göreceği öğrenci istatistiklerini belirler.
                Öğretmen hiçbir zaman öğrencilerin sorularını göremez.
                Değişiklik, öğretmen uygulamayı bir sonraki açtığında geçerli
                olur.
              </Text>

              <TouchableOpacity
                style={[
                  styles.anaButon,
                  {
                    backgroundColor: YONETICI_RENGI,
                    opacity: kapsamKaydediliyor ? 0.6 : 1,
                  },
                ]}
                onPress={kapsamKaydet}
                disabled={kapsamKaydediliyor}
                activeOpacity={0.8}
              >
                {kapsamKaydediliyor ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.anaButonYazi}>Kaydet</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.vazgec}
                onPress={kapsamPenceresiniKapat}
                disabled={kapsamKaydediliyor}
                activeOpacity={0.7}
              >
                <Text style={[styles.vazgecYazi, { color: tema.ikincilMetin }]}>
                  Vazgeç
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
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
  kapsam: { fontSize: 12, marginTop: 4 },
  secenek: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  secenekYazi: { fontSize: 15, marginLeft: 10, flex: 1 },
  grupSecenegi: { paddingLeft: 30 },
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
