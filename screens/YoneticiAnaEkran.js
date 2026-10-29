import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { useTheme } from "../ThemeContext";

const ROL_ETIKETLERI = { mudur: "Müdür", ogretmen: "Öğretmen" };
const YONETICI_RENGI = "#0F766E";

const tarihMetni = (deger) => {
  const tarih = deger?.toDate ? deger.toDate() : deger ? new Date(deger) : null;
  return tarih && !Number.isNaN(tarih.getTime())
    ? tarih.toLocaleDateString("tr-TR")
    : "-";
};

// Müdür ve öğretmenin ana ekranı. Yetki, sunucunun kimlik belirtecine yazdığı kurumId ve
// kurumRol bilgilerinden gelir; yetki alınmamış ya da geri alınmışsa bilgi ekranı gösterilir.
export default function YoneticiAnaEkran() {
  const { tema } = useTheme();
  const insets = useSafeAreaInsets();
  const odakta = useIsFocused();

  const [yetki, setYetki] = useState(undefined); // undefined: yükleniyor, null: yetki yok
  const [kurum, setKurum] = useState(null);

  // Belirteç her açılışta sunucudan yenilenir: geri alınan yetki en geç bu ekranda fark edilir
  const yetkiyiOku = useCallback(async () => {
    try {
      const kullanici = auth.currentUser;
      if (!kullanici) return;
      const sonuc = await kullanici.getIdTokenResult(true);
      const { kurumId, kurumRol } = sonuc.claims;
      setYetki(kurumId && kurumRol ? { kurumId, kurumRol } : null);
    } catch (hata) {
      console.log("Yönetici yetkisi okunamadı:", hata?.code);
      setYetki((onceki) => (onceki === undefined ? null : onceki));
    }
  }, []);

  useEffect(() => {
    if (odakta) yetkiyiOku();
  }, [odakta, yetkiyiOku]);

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

  const kodPaylas = async () => {
    try {
      await Share.share({
        message: `Mikro AI dershane kodun: ${kurum.kurumKodu}\nUygulamada Profil > Dershane Kodu Gir bölümünden kodu girerek bağlanabilirsin.`,
      });
    } catch (hata) {
      console.log("Kod paylaşılamadı:", hata?.message);
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

  return (
    <ScrollView
      style={{ backgroundColor: tema.arkaplan }}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: 40,
        paddingHorizontal: 20,
      }}
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
          {kurum.durum !== "aktif" && (
            <View style={[kutuStili, { borderColor: tema.hataKirmizi }]}>
              <Text style={[styles.kutuBaslik, { color: tema.hataKirmizi }]}>
                Kullanım süresi sona erdi
              </Text>
            </View>
          )}

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
              Lisans bitiş tarihi: {tarihMetni(kurum.lisansBitis)}
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
                Öğrencilerin Profil sayfasındaki "Dershane Kodu Gir" bölümüne bu
                kodu girmesi yeterli.
              </Text>
              <TouchableOpacity
                style={[styles.buton, { backgroundColor: YONETICI_RENGI }]}
                onPress={kodPaylas}
                activeOpacity={0.8}
              >
                <Text style={styles.butonYazi}>Kodu Paylaş</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={kutuStili}>
            <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
              Öğrenci İstatistikleri
            </Text>
            <Text style={[styles.kucukYazi, { color: tema.ikincilMetin }]}>
              Öğrenci listesi ve istatistikler bir sonraki sürümde burada
              olacak.
            </Text>
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
});
