import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { YONETICI_RENGI } from "../utils/useYoneticiYetkisi";
import {
  kurumAskiyaAl,
  kurumHataMesaji,
  kurumKapat,
  kurumListele,
  kurumOlustur,
  kurumYenidenAc,
  platformYetkisi,
} from "../utils/kurumIstemci";
import {
  adEslesiyor,
  durumEtiketi,
  eylemler,
  formuDenetle,
  mudurMesaji,
  tarihiGoster,
  yeniIstekKimligi,
  yilSonrasi,
} from "../utils/platformDogrulama";
import { milisaniye } from "../utils/kurumIstatistik";

// Yetki sorgusu oturum başına kullanıcı başına bir kez yapılır (yetkisiz kullanıcılar için ağ yükü olmasın)
const yetkiOnbellegi = new Map();

const tarihMetni = (ms) =>
  ms
    ? tarihiGoster(new Date(ms + 3 * 60 * 60 * 1000).toISOString().slice(0, 10))
    : "-";

// Platform yöneticisine özel "Dershane Ekle" aracı. Yetkisi olmayan kullanıcıda hiçbir şey çizmez.
// Yetki ve tüm doğrulama sunucudadır; bu ekran yalnızca formu toplar ve sonucu gösterir.
export default function PlatformKarti({ uid, tema }) {
  const [yetkili, setYetkili] = useState(yetkiOnbellegi.get(uid) === true);
  const [liste, setListe] = useState(null);
  const [listeHatasi, setListeHatasi] = useState(false);
  const [formAcik, setFormAcik] = useState(false);
  const [listeAcik, setListeAcik] = useState(false);
  const [ad, setAd] = useState("");
  const [koltuk, setKoltuk] = useState("");
  const [tarih, setTarih] = useState(yilSonrasi(1));
  const [eposta, setEposta] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);
  const [sonuc, setSonuc] = useState(null);
  // Askıya alma / yeniden açma / kapatma: işlemdeki kurum, kapatma onay ekranı
  const [islemde, setIslemde] = useState(null);
  const [kapatilacak, setKapatilacak] = useState(null);
  const [kapatAd, setKapatAd] = useState("");
  const istekKimligi = useRef(null);
  const canli = useRef(true);

  useEffect(() => {
    canli.current = true;
    return () => {
      canli.current = false;
    };
  }, []);

  useEffect(() => {
    if (!uid || yetkiOnbellegi.has(uid)) return;
    platformYetkisi()
      .then((sonuc) => {
        yetkiOnbellegi.set(uid, sonuc);
        if (canli.current) setYetkili(sonuc);
      })
      .catch((e) => console.log("Platform yetkisi alınamadı:", e?.code));
  }, [uid]);

  const listeyiYukle = useCallback(async () => {
    setListeHatasi(false);
    try {
      const { kurumlar } = await kurumListele();
      if (canli.current) setListe(Array.isArray(kurumlar) ? kurumlar : []);
    } catch (e) {
      console.log("Dershane listesi alınamadı:", e?.code);
      if (canli.current) setListeHatasi(true);
    }
  }, []);

  useEffect(() => {
    if (yetkili) listeyiYukle();
  }, [yetkili, listeyiYukle]);

  if (!yetkili) return null;

  // Form alanı değişirse önceki denemenin kimliği geçersiz olur; aynı içerikle yeniden denemede kimlik korunur
  const alanDegistir = (ayarla) => (deger) => {
    istekKimligi.current = null;
    ayarla(deger);
  };

  const formuKapat = () => {
    if (calisiyor) return;
    setFormAcik(false);
    setSonuc(null);
  };

  const formuAc = () => {
    istekKimligi.current = null;
    setAd("");
    setKoltuk("");
    setTarih(yilSonrasi(1));
    setEposta("");
    setSonuc(null);
    setFormAcik(true);
  };

  const olustur = async () => {
    const denetim = formuDenetle({ ad, koltuk, tarih, eposta });
    if (denetim.hata) {
      Alert.alert("Eksik ya da hatalı bilgi", denetim.hata);
      return;
    }
    const v = denetim.veri;
    Alert.alert(
      "Dershane oluşturulsun mu?",
      `Ad: ${v.ad}\nKoltuk: ${v.koltuk}\nLisans bitişi: ${tarihiGoster(v.lisansBitis)}\nMüdür: ${v.mudurEposta}`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Oluştur", onPress: () => gonder(v) },
      ]
    );
  };

  const gonder = async (v) => {
    if (calisiyor) return;
    if (!istekKimligi.current) istekKimligi.current = yeniIstekKimligi();
    setCalisiyor(true);
    try {
      const yanit = await kurumOlustur({
        istekKimligi: istekKimligi.current,
        ...v,
      });
      if (!canli.current) return;
      setSonuc(yanit);
      istekKimligi.current = null;
      listeyiYukle();
    } catch (e) {
      console.log("Dershane oluşturulamadı:", e?.code, e?.message);
      if (canli.current) Alert.alert("Oluşturulamadı", kurumHataMesaji(e));
    } finally {
      if (canli.current) setCalisiyor(false);
    }
  };

  // Yaşam döngüsü işlemleri: her biri sunucuda yeniden doğrulanır; burada yalnızca onay alınır ve sonuç gösterilir
  const islemYap = async (k, istek, basariMesaji) => {
    if (islemde) return;
    setIslemde(k.id);
    try {
      await istek();
      if (canli.current) Alert.alert("Tamam", basariMesaji);
    } catch (e) {
      console.log("Dershane işlemi başarısız:", e?.code, e?.message);
      if (canli.current) Alert.alert("İşlem yapılamadı", kurumHataMesaji(e));
    } finally {
      if (canli.current) setIslemde(null);
      listeyiYukle();
    }
  };

  const askiyaAlOnayla = (k) =>
    Alert.alert(
      "Dershane askıya alınsın mı?",
      `${k.ad}\n\n• Müdür ve öğretmenler yönetici özelliklerini kullanamaz\n• Yeni öğrenci katılamaz\n• Mevcut ${k.uyeSayisi} öğrenci bağlı kalır\n• İstediğin zaman yeniden açabilirsin`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Askıya Al",
          style: "destructive",
          onPress: () =>
            islemYap(k, () => kurumAskiyaAl(k.id), "Dershane askıya alındı."),
        },
      ]
    );

  const yenidenAcOnayla = (k) =>
    Alert.alert(
      "Dershane yeniden açılsın mı?",
      `${k.ad}\n\nMüdür ve öğretmenler bir sonraki girişlerinde yetkilerini geri alır.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Yeniden Aç",
          onPress: () =>
            islemYap(k, () => kurumYenidenAc(k.id), "Dershane yeniden açıldı."),
        },
      ]
    );

  const kapatPenceresiniAc = (k) => {
    setKapatAd("");
    setKapatilacak(k);
  };

  const kapatmayiOnayla = async () => {
    if (!kapatilacak || islemde) return;
    if (!adEslesiyor(kapatAd, kapatilacak.ad)) return;
    const k = kapatilacak;
    setIslemde(k.id);
    try {
      await kurumKapat(k.id, kapatAd);
      if (canli.current) {
        setKapatilacak(null);
        Alert.alert(
          "Dershane kapatıldı",
          `${k.ad} kapatıldı. Öğrencilerin bağlantısı kaldırıldı.`
        );
      }
    } catch (e) {
      console.log("Dershane kapatılamadı:", e?.code, e?.message);
      if (canli.current) {
        // Zaman aşımı: sunucu işlemi arka planda sürdürebilir
        const mesaj =
          e?.code === "functions/deadline-exceeded"
            ? "İşlem uzun sürdü ve arka planda devam ediyor olabilir. Birkaç dakika sonra listeyi yenile."
            : kurumHataMesaji(e);
        Alert.alert("Kapatma tamamlanamadı", mesaj);
      }
    } finally {
      if (canli.current) setIslemde(null);
      listeyiYukle();
    }
  };

  const mesajiPaylas = async () => {
    try {
      await Share.share({ message: mudurMesaji(sonuc) });
    } catch (e) {
      console.log("Paylaşılamadı:", e?.message);
    }
  };

  const kutu = [
    styles.kutu,
    { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
  ];
  const girdi = [
    styles.girdi,
    {
      color: tema.metin,
      borderColor: tema.kutuCerceve,
      backgroundColor: tema.arkaplan,
    },
  ];

  return (
    <>
      <View style={kutu}>
        <View style={styles.baslikSatiri}>
          <Text style={[styles.baslik, { color: tema.metin }]}>
            Platform Yönetimi
          </Text>
          <Text style={styles.ikon}>🛠️</Text>
        </View>
        <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
          Yeni dershane ekle ve mevcut dershaneleri gör. Bu kart yalnızca
          platform yöneticisine görünür.
        </Text>
        <TouchableOpacity
          style={[styles.anaButon, { backgroundColor: YONETICI_RENGI }]}
          onPress={formuAc}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Dershane ekle"
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.anaButonYazi}>Dershane Ekle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ikinciSatir}
          onPress={() => {
            setListeAcik(true);
            listeyiYukle();
          }}
          accessibilityRole="button"
        >
          <Text style={[styles.ikinciYazi, { color: YONETICI_RENGI }]}>
            Dershaneleri gör{liste ? ` (${liste.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={formAcik}
        animationType="slide"
        transparent
        onRequestClose={formuKapat}
      >
        <KeyboardAvoidingView
          style={styles.arka}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.pencere, { backgroundColor: tema.arkaplan }]}>
            <View style={styles.pencereBaslik}>
              <Text style={[styles.pencereBaslikYazi, { color: tema.metin }]}>
                {sonuc ? "Dershane Oluşturuldu" : "Yeni Dershane"}
              </Text>
              <TouchableOpacity
                onPress={formuKapat}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
              >
                <Ionicons name="close" size={26} color={tema.ikincilMetin} />
              </TouchableOpacity>
            </View>

            {sonuc ? (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                  Dershane
                </Text>
                <Text style={[styles.deger, { color: tema.metin }]}>
                  {sonuc.ad}
                </Text>
                <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                  Öğrenci kayıt kodu
                </Text>
                <Text
                  selectable
                  style={[styles.kod, { color: YONETICI_RENGI }]}
                >
                  {sonuc.kurumKodu}
                </Text>
                <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                  Müdür
                </Text>
                <Text style={[styles.deger, { color: tema.metin }]}>
                  {sonuc.mudurEposta}
                </Text>
                <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                  Koltuk · Lisans bitişi
                </Text>
                <Text style={[styles.deger, { color: tema.metin }]}>
                  {sonuc.koltuk} · {tarihMetni(sonuc.lisansBitis)}
                </Text>
                {sonuc.zatenVar && (
                  <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
                    Bu dershane daha önce oluşturulmuştu; yeni bir kayıt
                    açılmadı.
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.anaButon, { backgroundColor: YONETICI_RENGI }]}
                  onPress={mesajiPaylas}
                  accessibilityRole="button"
                >
                  <Ionicons name="share-outline" size={20} color="#fff" />
                  <Text style={styles.anaButonYazi}>Müdüre mesajı paylaş</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                  Dershane adı
                </Text>
                <TextInput
                  style={girdi}
                  value={ad}
                  onChangeText={alanDegistir(setAd)}
                  maxLength={80}
                  placeholder="Örn. Uğur Dershanesi"
                  placeholderTextColor={tema.ikincilMetin}
                  editable={!calisiyor}
                />
                <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                  Koltuk sayısı
                </Text>
                <TextInput
                  style={girdi}
                  value={koltuk}
                  onChangeText={alanDegistir((t) =>
                    setKoltuk(t.replace(/[^0-9]/g, ""))
                  )}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="Örn. 50"
                  placeholderTextColor={tema.ikincilMetin}
                  editable={!calisiyor}
                />
                <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                  Lisans bitiş tarihi (GG.AA.YYYY)
                </Text>
                <TextInput
                  style={girdi}
                  value={tarih}
                  onChangeText={alanDegistir(setTarih)}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  placeholder="31.08.2027"
                  placeholderTextColor={tema.ikincilMetin}
                  editable={!calisiyor}
                />
                <View style={styles.hizliSatir}>
                  {[1, 2].map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[styles.hizli, { borderColor: tema.kutuCerceve }]}
                      onPress={() => alanDegistir(setTarih)(yilSonrasi(y))}
                      disabled={calisiyor}
                      accessibilityRole="button"
                    >
                      <Text
                        style={{ color: YONETICI_RENGI, fontWeight: "600" }}
                      >
                        +{y} yıl
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                  Müdürün e-posta adresi
                </Text>
                <TextInput
                  style={girdi}
                  value={eposta}
                  onChangeText={alanDegistir(setEposta)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  maxLength={254}
                  placeholder="mudur@ornek.com"
                  placeholderTextColor={tema.ikincilMetin}
                  editable={!calisiyor}
                />
                <TouchableOpacity
                  style={[
                    styles.anaButon,
                    {
                      backgroundColor: YONETICI_RENGI,
                      opacity: calisiyor ? 0.6 : 1,
                    },
                  ]}
                  onPress={olustur}
                  disabled={calisiyor}
                  accessibilityRole="button"
                >
                  {calisiyor ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.anaButonYazi}>Dershaneyi Oluştur</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={listeAcik}
        animationType="slide"
        transparent
        onRequestClose={() => setListeAcik(false)}
      >
        <View style={styles.arka}>
          <View style={[styles.pencere, { backgroundColor: tema.arkaplan }]}>
            <View style={styles.pencereBaslik}>
              <Text style={[styles.pencereBaslikYazi, { color: tema.metin }]}>
                Dershaneler
              </Text>
              <TouchableOpacity
                onPress={() => setListeAcik(false)}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
              >
                <Ionicons name="close" size={26} color={tema.ikincilMetin} />
              </TouchableOpacity>
            </View>
            {kapatilacak ? (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={[styles.uyari, { color: "#DC2626" }]}>
                  Bu işlem geri alınamaz
                </Text>
                <Text style={[styles.aciklama, { color: tema.metin }]}>
                  {kapatilacak.ad} kapatılacak:{"\n\n"}• {kapatilacak.uyeSayisi}{" "}
                  öğrencinin dershane bağlantısı kaldırılır ve koltuklar boşalır
                  {"\n"}• Dershanenin verdiği premium hakları sona erer
                  {"\n"}• Müdür ve öğretmenlerin yetkisi kaldırılır
                  {"\n"}• Duyurular ve istatistik kopyaları silinir
                  {"\n"}• Kayıt kodu çalışmaz
                  {"\n\n"}Öğrencilerin hesapları, soruları ve geçmişleri
                  silinmez. Öğrencilere otomatik bildirim gitmez.
                </Text>
                <Text style={[styles.etiket, { color: tema.ikincilMetin }]}>
                  Onaylamak için dershane adını aynen yaz
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
                  value={kapatAd}
                  onChangeText={setKapatAd}
                  placeholder={kapatilacak.ad}
                  placeholderTextColor={tema.ikincilMetin}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={100}
                  editable={!islemde}
                />
                <TouchableOpacity
                  style={[
                    styles.anaButon,
                    {
                      backgroundColor: "#DC2626",
                      opacity:
                        adEslesiyor(kapatAd, kapatilacak.ad) && !islemde
                          ? 1
                          : 0.4,
                    },
                  ]}
                  onPress={kapatmayiOnayla}
                  disabled={!adEslesiyor(kapatAd, kapatilacak.ad) || !!islemde}
                  accessibilityRole="button"
                >
                  {islemde ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.anaButonYazi}>Dershaneyi Kapat</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ikinciSatir}
                  onPress={() => !islemde && setKapatilacak(null)}
                  disabled={!!islemde}
                  accessibilityRole="button"
                >
                  <Text style={[styles.ikinciYazi, { color: YONETICI_RENGI }]}>
                    Vazgeç
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView>
                {liste === null && !listeHatasi ? (
                  <ActivityIndicator
                    color={YONETICI_RENGI}
                    style={{ margin: 20 }}
                  />
                ) : listeHatasi && liste === null ? (
                  <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
                    Liste yüklenemedi. İnternet bağlantını kontrol et.
                  </Text>
                ) : liste.length === 0 ? (
                  <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
                    Henüz dershane yok.
                  </Text>
                ) : (
                  liste.map((k) => {
                    const e = eylemler(k.durum);
                    const mesgul = islemde === k.id;
                    return (
                      <View
                        key={k.id}
                        style={[
                          styles.satir,
                          { borderColor: tema.kutuCerceve },
                        ]}
                      >
                        <View style={styles.adSatiri}>
                          <Text
                            style={[
                              styles.deger,
                              { color: tema.metin, flex: 1 },
                            ]}
                          >
                            {k.ad}
                          </Text>
                          <Text
                            style={[
                              styles.etiketKutu,
                              {
                                color:
                                  k.durum === "aktif" ? "#059669" : "#D97706",
                              },
                            ]}
                          >
                            {durumEtiketi(k.durum)}
                          </Text>
                        </View>
                        <Text
                          style={[styles.alt, { color: tema.ikincilMetin }]}
                        >
                          {k.uyeSayisi}/{k.koltuk} öğrenci · bitiş{" "}
                          {tarihMetni(k.lisansBitis)}
                        </Text>
                        <Text
                          selectable
                          style={[styles.alt, { color: YONETICI_RENGI }]}
                        >
                          Kod: {k.kurumKodu}
                        </Text>
                        {(e.askiyaAl || e.yenidenAc || e.kapat) && (
                          <View style={styles.eylemSatiri}>
                            {mesgul ? (
                              <ActivityIndicator color={YONETICI_RENGI} />
                            ) : (
                              <>
                                {e.askiyaAl && (
                                  <TouchableOpacity
                                    style={[
                                      styles.eylem,
                                      { borderColor: tema.kutuCerceve },
                                    ]}
                                    onPress={() => askiyaAlOnayla(k)}
                                    disabled={!!islemde}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${k.ad} dershanesini askıya al`}
                                  >
                                    <Text style={styles.eylemYazi}>
                                      Askıya Al
                                    </Text>
                                  </TouchableOpacity>
                                )}
                                {e.yenidenAc && (
                                  <TouchableOpacity
                                    style={[
                                      styles.eylem,
                                      { borderColor: tema.kutuCerceve },
                                    ]}
                                    onPress={() => yenidenAcOnayla(k)}
                                    disabled={!!islemde}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${k.ad} dershanesini yeniden aç`}
                                  >
                                    <Text
                                      style={[
                                        styles.eylemYazi,
                                        { color: "#059669" },
                                      ]}
                                    >
                                      Yeniden Aç
                                    </Text>
                                  </TouchableOpacity>
                                )}
                                {e.kapat && (
                                  <TouchableOpacity
                                    style={[
                                      styles.eylem,
                                      { borderColor: "#DC2626" },
                                    ]}
                                    onPress={() => kapatPenceresiniAc(k)}
                                    disabled={!!islemde}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${k.ad} dershanesini kapat`}
                                  >
                                    <Text
                                      style={[
                                        styles.eylemYazi,
                                        { color: "#DC2626" },
                                      ]}
                                    >
                                      Kapat
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
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
  ikon: { fontSize: 20 },
  aciklama: { fontSize: 13, lineHeight: 19, marginVertical: 8 },
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
  ikinciSatir: { alignItems: "center", paddingTop: 12 },
  ikinciYazi: { fontSize: 14, fontWeight: "600" },
  arka: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  pencere: {
    maxHeight: "90%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  pencereBaslik: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pencereBaslikYazi: { fontSize: 18, fontWeight: "bold" },
  etiket: { fontSize: 12, marginTop: 14, marginBottom: 6, fontWeight: "600" },
  girdi: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  hizliSatir: { flexDirection: "row", marginTop: 8 },
  hizli: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  deger: { fontSize: 16, fontWeight: "600" },
  kod: {
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: 3,
    marginVertical: 4,
  },
  satir: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  alt: { fontSize: 12, marginTop: 3 },
  adSatiri: { flexDirection: "row", alignItems: "center" },
  etiketKutu: { fontSize: 12, fontWeight: "700", marginLeft: 8 },
  eylemSatiri: { flexDirection: "row", marginTop: 10, minHeight: 36 },
  eylem: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  eylemYazi: { fontSize: 13, fontWeight: "700", color: "#D97706" },
  uyari: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
});
