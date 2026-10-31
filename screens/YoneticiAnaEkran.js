import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useTheme } from "../ThemeContext";
import useYoneticiYetkisi, {
  YONETICI_RENGI,
  ROL_ETIKETLERI,
} from "../utils/useYoneticiYetkisi";
import useKurumOzetleri from "../utils/useKurumOzetleri";
import EkipKarti from "./EkipKarti";
import GruplarKarti from "./GruplarKarti";
import { kodYenile, kurumHataMesaji } from "../utils/kurumIstemci";
import {
  kurumGenelBakis,
  milisaniye,
  ogrenciSatiri,
} from "../utils/kurumIstatistik";
import {
  bosKoltuk,
  haftalikOzetMetni,
  lisansDurumu,
  ogrenciDavetMetni,
  turkceTarih,
} from "../utils/kurumRapor";

const UYARI_RENGI = "#D97706";

// Müdür ve öğretmenin dershane ekranı: lisans, kontenjan, öğrenci kayıt kodu ve paylaşımlar.
// Yetki, sunucunun kimlik belirtecine yazdığı kurumId ve kurumRol bilgilerinden gelir;
// yetki alınmamış ya da geri alınmışsa bilgi ekranı gösterilir.
export default function YoneticiAnaEkran() {
  const { tema } = useTheme();
  const insets = useSafeAreaInsets();
  const { yetki, yenile: yetkiyiOku } = useYoneticiYetkisi();
  const { ozetler } = useKurumOzetleri(yetki?.kurumId);
  const [kurum, setKurum] = useState(null);

  useEffect(() => {
    if (!yetki) {
      setKurum(null);
      return;
    }
    return onSnapshot(
      doc(db, "kurumlar", yetki.kurumId),
      (snap) => setKurum(snap.exists() ? snap.data() : null),
      (hata) => {
        console.log("Kurum bilgisi okunamadı:", hata?.code);
        setKurum(null);
      }
    );
  }, [yetki]);

  const kutuStili = [
    styles.kutu,
    { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
  ];

  const [kodYenileniyor, setKodYenileniyor] = useState(false);
  const canli = useRef(true);
  useEffect(() => {
    canli.current = true;
    return () => {
      canli.current = false;
    };
  }, []);

  const kodYenilemeyiOnayla = () => {
    Alert.alert(
      "Kodu Yenile",
      "Yeni bir kayıt kodu oluşturulacak. Eski kod hemen geçersiz olur ve artık kimse onunla katılamaz.\n\nDershaneye zaten bağlı olan öğrenciler etkilenmez. Daha önce paylaştığın katılım mesajlarını yeni kodla yeniden göndermen gerekir.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Yenile", style: "destructive", onPress: kodYenileCalistir },
      ]
    );
  };

  const kodYenileCalistir = async () => {
    setKodYenileniyor(true);
    try {
      const sonuc = await kodYenile();
      if (canli.current) {
        Alert.alert(
          "Yeni Kod Hazır",
          `Yeni öğrenci kayıt kodu: ${sonuc.kurumKodu}`
        );
      }
    } catch (hata) {
      console.log("Kod yenileme hatası:", hata?.code, hata?.message);
      if (canli.current) Alert.alert("Yenilenemedi", kurumHataMesaji(hata));
    } finally {
      if (canli.current) setKodYenileniyor(false);
    }
  };

  const paylas = async (mesaj) => {
    try {
      await Share.share({ message: mesaj });
    } catch (hata) {
      console.log("Paylaşılamadı:", hata?.message);
      Alert.alert("Paylaşılamadı", "Paylaşma penceresi açılamadı.");
    }
  };

  if (yetki === undefined) {
    return (
      <View style={[styles.ortala, { backgroundColor: tema.arkaplan }]}>
        <ActivityIndicator size="large" color={YONETICI_RENGI} />
      </View>
    );
  }

  const yenileButonu = (
    <TouchableOpacity
      style={[styles.buton, { backgroundColor: YONETICI_RENGI }]}
      onPress={yetkiyiOku}
      activeOpacity={0.8}
    >
      <Text style={styles.butonYazi}>Yeniden Kontrol Et</Text>
    </TouchableOpacity>
  );

  if (!yetki) {
    return (
      <View
        style={[
          styles.ortala,
          { backgroundColor: tema.arkaplan, paddingTop: insets.top },
        ]}
      >
        <Text style={styles.buyukIkon}>🏫</Text>
        <Text style={[styles.baslik, { color: tema.metin }]}>
          Yönetici Yetkin Bulunmuyor
        </Text>
        <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
          Dershanenin kullanım süresi dolmuş ya da yetkin kaldırılmış olabilir.
          Lütfen dershane yetkilisiyle iletişime geç.
        </Text>
        {yenileButonu}
      </View>
    );
  }

  const mudurMu = yetki.kurumRol === "mudur";
  const koltuk = kurum?.koltuk || 0;
  const uyeSayisi = kurum?.uyeSayisi || 0;
  const doluluk = koltuk > 0 ? Math.min(100, (uyeSayisi / koltuk) * 100) : 0;
  const simdi = Date.now();
  const lisans = lisansDurumu(kurum?.lisansBitis, kurum?.durum, simdi);
  const lisansRengi =
    lisans.seviye === "iyi"
      ? YONETICI_RENGI
      : lisans.seviye === "yaklasiyor"
        ? UYARI_RENGI
        : lisans.seviye === "bilinmiyor"
          ? tema.ikincilMetin
          : tema.hataKirmizi;
  const bitisMs = milisaniye(kurum?.lisansBitis);

  const haftalikOzetiPaylas = () => {
    const satirlar = (ozetler || []).map((o) => ogrenciSatiri(o.id, o, simdi));
    paylas(
      haftalikOzetMetni(kurum?.ad, kurumGenelBakis(satirlar, simdi), simdi)
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: tema.arkaplan }}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: 40,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.ustSatir}>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.baslik, { color: tema.metin, textAlign: "left" }]}
          >
            {kurum?.ad || "Dershane"}
          </Text>
          <Text style={[styles.rolYazi, { color: YONETICI_RENGI }]}>
            {ROL_ETIKETLERI[yetki.kurumRol] || "Yönetici"}
          </Text>
        </View>
        <Text style={styles.buyukIkon}>🏫</Text>
      </View>

      {!kurum ? (
        <View style={kutuStili}>
          <Text style={[styles.aciklama, { color: tema.ikincilMetin }]}>
            Dershane bilgileri yüklenemedi. İnternet bağlantını kontrol edip
            tekrar dene.
          </Text>
          {yenileButonu}
        </View>
      ) : (
        <>
          {lisans.seviye === "bitti" && (
            <View
              style={[
                kutuStili,
                { borderColor: tema.hataKirmizi, borderWidth: 2 },
              ]}
            >
              <Text style={[styles.kutuBaslik, { color: tema.hataKirmizi }]}>
                Kullanım süresi sona erdi
              </Text>
              <Text style={[styles.kucukYazi, { color: tema.ikincilMetin }]}>
                Öğrencilerin dershane bağlantısı ve premium hakları sona erdi.
                Yeniden başlamak için Mikro AI ekibiyle iletişime geç.
              </Text>
            </View>
          )}

          <View style={kutuStili}>
            <View style={styles.kutuUstSatir}>
              <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                Lisans
              </Text>
              <Text style={[styles.sayi, { color: lisansRengi }]}>
                {lisans.metin}
              </Text>
            </View>
            <Text style={[styles.kucukYazi, { color: tema.ikincilMetin }]}>
              Bitiş tarihi: {bitisMs !== null ? turkceTarih(bitisMs) : "-"}
            </Text>
            {(lisans.seviye === "yaklasiyor" || lisans.seviye === "kritik") && (
              <Text
                style={[
                  styles.kucukYazi,
                  { color: lisansRengi, marginTop: 8, fontWeight: "600" },
                ]}
              >
                Lisans süresi yaklaşıyor. Kesinti olmaması için yenilemek üzere
                Mikro AI ekibiyle iletişime geç.
              </Text>
            )}
          </View>

          <View style={kutuStili}>
            <View style={styles.kutuUstSatir}>
              <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                Öğrenci Kontenjanı
              </Text>
              <Text style={[styles.sayi, { color: YONETICI_RENGI }]}>
                {uyeSayisi} / {koltuk}
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
                  { backgroundColor: YONETICI_RENGI, width: `${doluluk}%` },
                ]}
              />
            </View>
            <Text style={[styles.kucukYazi, { color: tema.ikincilMetin }]}>
              {bosKoltuk(koltuk, uyeSayisi) > 0
                ? `${bosKoltuk(koltuk, uyeSayisi)} boş koltuk var.`
                : "Boş koltuk kalmadı. Yeni öğrenci eklemek için ek koltuk gerekir."}
            </Text>
          </View>

          {mudurMu && kurum.kurumKodu && (
            <View style={kutuStili}>
              <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                Öğrenci Kayıt Kodu
              </Text>
              <Text style={[styles.kod, { color: tema.metin }]}>
                {kurum.kurumKodu}
              </Text>
              <Text style={[styles.kucukYazi, { color: tema.ikincilMetin }]}>
                Öğrenciler Profil sayfasındaki "Dershane Kodu Gir" bölümüne bu
                kodu girerek dershaneye bağlanır. Aşağıdaki düğme, adımların
                yazılı olduğu hazır bir mesajı paylaşır.
              </Text>
              <TouchableOpacity
                style={[styles.buton, { backgroundColor: YONETICI_RENGI }]}
                onPress={() =>
                  paylas(ogrenciDavetMetni(kurum.ad, kurum.kurumKodu))
                }
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Text style={styles.butonYazi}>Katılım Mesajını Paylaş</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ikincilButon, { borderColor: tema.kutuCerceve }]}
                onPress={kodYenilemeyiOnayla}
                disabled={kodYenileniyor}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                {kodYenileniyor ? (
                  <ActivityIndicator color={YONETICI_RENGI} />
                ) : (
                  <Text style={[styles.ikincilYazi, { color: tema.metin }]}>
                    Kodu Yenile
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {mudurMu && (
            <EkipKarti
              kurumId={yetki.kurumId}
              kurumAdi={kurum.ad}
              tema={tema}
            />
          )}

          {mudurMu && <GruplarKarti kurumId={yetki.kurumId} tema={tema} />}

          <View style={kutuStili}>
            <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
              Haftalık Özet
            </Text>
            <Text
              style={[
                styles.kucukYazi,
                { color: tema.ikincilMetin, marginTop: 6 },
              ]}
            >
              Bu haftanın sayılarını (aktif öğrenci, sorulan soru, en çok
              sorulan konular) hazır bir mesaj olarak paylaş. Öğrenci adı
              içermez.
            </Text>
            <TouchableOpacity
              style={[
                styles.buton,
                {
                  backgroundColor: YONETICI_RENGI,
                  opacity: ozetler === null ? 0.5 : 1,
                },
              ]}
              onPress={haftalikOzetiPaylas}
              disabled={ozetler === null}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.butonYazi}>Özeti Paylaş</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ortala: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  buyukIkon: { fontSize: 38 },
  ustSatir: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  baslik: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },
  rolYazi: { fontSize: 15, fontWeight: "bold" },
  aciklama: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 20,
  },
  kutu: { padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1 },
  kutuUstSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  kutuBaslik: { fontSize: 15, fontWeight: "bold" },
  sayi: { fontSize: 17, fontWeight: "bold" },
  barArkaplan: { height: 8, borderRadius: 4, width: "100%", marginBottom: 12 },
  barDolu: { height: "100%", borderRadius: 4 },
  kod: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
    marginVertical: 14,
  },
  kucukYazi: { fontSize: 13, lineHeight: 19 },
  buton: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  butonYazi: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  ikincilButon: {
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  ikincilYazi: { fontSize: 14, fontWeight: "600" },
});
