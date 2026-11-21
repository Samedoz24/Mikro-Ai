// Profil fotoğrafını tam ekran gösterir; altta Değiştir / Kaldır seçenekleri.
// Yalnızca kullanıcının kendi (zaten ekranda gösterilen) fotoğrafını gösterir; veri okumaz ya da göndermez.

import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  useWindowDimensions,
  Animated,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// onizleme verilirse (Dosyalar'dan seçilen, henüz yüklenmemiş fotoğraf) o gösterilir ve altta Vazgeç / Kullan
// çıkar; "Kullan" denmedikçe hiçbir şey yüklenmez.
export default function ProfilFotoGoruntuleyici({
  gorunur,
  foto,
  kapat,
  degistir,
  kaldir,
  yukleniyor = false,
  onizleme = null,
  onizlemeOnayla,
  onizlemeIptal,
}) {
  const onizlemeModu = !!onizleme;
  const gosterilen = onizleme || foto;
  const kapatIstegi = onizlemeModu ? onizlemeIptal : kapat;
  const insets = useSafeAreaInsets();
  const { width: genislik } = useWindowDimensions();
  const kaydirmaRef = useRef(null);
  const buyutulmus = useRef(false);
  const sonDokunus = useRef(0);
  const opaklik = useRef(new Animated.Value(0)).current;

  // Hızlı açılış: sistemin yavaş kayma/solma animasyonu yerine kısa bir solma
  useEffect(() => {
    if (!gorunur) return;
    opaklik.setValue(0);
    Animated.timing(opaklik, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [gorunur, opaklik]);

  // Çift dokunuş: büyütülmüşse eski haline döner, değilse 2,5 kat büyütür (iOS)
  const ciftDokunus = () => {
    const simdi = Date.now();
    if (simdi - sonDokunus.current > 300) {
      sonDokunus.current = simdi;
      return;
    }
    sonDokunus.current = 0;
    const kaydirma = kaydirmaRef.current;
    if (!kaydirma?.scrollResponderZoomTo) return;
    if (buyutulmus.current) {
      kaydirma.scrollResponderZoomTo({ x: 0, y: 0, width: genislik, height: genislik, animated: true });
    } else {
      const boyut = genislik / 2.5;
      const kenar = (genislik - boyut) / 2;
      kaydirma.scrollResponderZoomTo({ x: kenar, y: kenar, width: boyut, height: boyut, animated: true });
    }
  };

  if (!gosterilen) return null;
  return (
    <Modal visible={gorunur} transparent animationType="none" onRequestClose={kapatIstegi} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <Animated.View style={[stiller.arkaplan, { opacity: opaklik }]}>
        {/* Boşluğa dokununca kapanır (önizlemede kazara vazgeçilmesin diye kapanmaz) */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onizlemeModu ? undefined : kapat}
          accessible={!onizlemeModu}
          accessibilityLabel="Kapat"
        />

        {onizlemeModu && (
          <Text style={[stiller.onizlemeBaslik, { top: insets.top + 22 }]} accessibilityRole="header">
            Profil fotoğrafın böyle görünecek
          </Text>
        )}

        {/* İki parmakla yakınlaştırma (iOS'un yerleşik özelliği; ek paket yok). Çift dokunuş: büyüt / geri al */}
        <ScrollView
          ref={kaydirmaRef}
          style={stiller.kaydirma}
          contentContainerStyle={stiller.kaydirmaIcerik}
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            buyutulmus.current = e.nativeEvent.zoomScale > 1.01;
          }}
          scrollEventThrottle={16}
        >
          <Pressable onPress={ciftDokunus} accessible={false}>
            <Image
              source={{ uri: gosterilen }}
              style={{ width: genislik, height: genislik }}
              resizeMode="contain"
              accessible
              accessibilityLabel="Profil fotoğrafı. İki parmakla yakınlaştırabilirsin."
            />
          </Pressable>
        </ScrollView>

        <TouchableOpacity
          onPress={kapatIstegi}
          style={[stiller.kapat, { top: insets.top + 12 }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        {yukleniyor && (
          <View style={stiller.yukleniyor} accessibilityLiveRegion="polite" accessibilityLabel="Fotoğraf yükleniyor">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={stiller.yukleniyorYazi}>Yükleniyor...</Text>
          </View>
        )}

        <View style={[stiller.altSatir, { paddingBottom: insets.bottom + 20 }]}>
          {onizlemeModu ? (
            <>
              <TouchableOpacity onPress={onizlemeIptal} style={stiller.dugme} accessibilityRole="button">
                <Ionicons name="close-outline" size={20} color="#fff" />
                <Text style={stiller.dugmeYazi}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onizlemeOnayla}
                style={[stiller.dugme, stiller.birincil]}
                accessibilityRole="button"
                accessibilityHint="Bu fotoğrafı profil fotoğrafın yapar"
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={stiller.dugmeYazi}>Kullan</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={degistir}
                disabled={yukleniyor}
                style={[stiller.dugme, yukleniyor && stiller.pasif]}
                accessibilityRole="button"
                accessibilityState={{ disabled: yukleniyor }}
              >
                <Ionicons name="camera-outline" size={20} color="#fff" />
                <Text style={stiller.dugmeYazi}>Değiştir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={kaldir}
                disabled={yukleniyor}
                style={[stiller.dugme, yukleniyor && stiller.pasif]}
                accessibilityRole="button"
                accessibilityState={{ disabled: yukleniyor }}
              >
                <Ionicons name="trash-outline" size={20} color="#ED4956" />
                <Text style={[stiller.dugmeYazi, { color: "#ED4956" }]}>Kaldır</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const stiller = StyleSheet.create({
  arkaplan: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  kaydirma: { flexGrow: 0, width: "100%" },
  yukleniyor: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  yukleniyorYazi: { color: "#fff", fontSize: 15, fontWeight: "600" },
  pasif: { opacity: 0.4 },
  birincil: { backgroundColor: "#0095F6" },
  onizlemeBaslik: { position: "absolute", left: 16, right: 72, color: "#fff", fontSize: 17, fontWeight: "700" },
  kaydirmaIcerik: { alignItems: "center", justifyContent: "center" },
  kapat: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  altSatir: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingTop: 16,
  },
  dugme: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  dugmeYazi: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
