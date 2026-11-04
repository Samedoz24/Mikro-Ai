import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  Keyboard,
  Platform,
  StyleSheet,
  TouchableOpacity,
  AccessibilityInfo,
} from "react-native";
import { CommonActions } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { gostergeKonumu, ikonAdi } from "../utils/sekmeAyarlari";
import { ALT_MENU_KAPSUL, altMenuAltBoslugu } from "../utils/altMenu";

const KAPSUL_YUKSEKLIGI = ALT_MENU_KAPSUL;
const IC_BOSLUK = 6; // kapsülün iç kenar boşluğu
const HAP_YAN_BOSLUK = 4; // hapın sekme genişliğinden payı

// Tüm roller için alt menü: sayfaların altında yüzen yuvarlak bir kapsül. Seçili sekme renkli bir hap
// içinde (dolu ikon + yazı) görünür; sekme değişince bu hap yumuşakça yan sekmeye kayar.
// Sayfalar anında değişir (sayfa kayma animasyonu yok).
export default function AltMenu({
  state,
  descriptors,
  navigation,
  tema,
  rozetStili,
}) {
  const insets = useSafeAreaInsets();
  const [satirGenisligi, setSatirGenisligi] = useState(0);
  const [klavyeAcik, setKlavyeAcik] = useState(false);
  const kayma = useRef(new Animated.Value(0)).current;
  const hareketAzalt = useRef(false);
  const ilkKonum = useRef(true);

  useEffect(() => {
    let canli = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((azalt) => {
        if (canli) hareketAzalt.current = !!azalt;
      })
      .catch(() => {});
    return () => {
      canli = false;
    };
  }, []);

  // Klavye açılınca menü gizlenir (yazı alanını kapatmasın)
  useEffect(() => {
    const goster = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKlavyeAcik(true)
    );
    const gizle = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKlavyeAcik(false)
    );
    return () => {
      goster.remove();
      gizle.remove();
    };
  }, []);

  const sayi = state.routes.length;
  const sekmeGenisligi = sayi > 0 ? satirGenisligi / sayi : 0;
  const hapGenisligi = Math.max(0, sekmeGenisligi - HAP_YAN_BOSLUK * 2);
  const hedef = gostergeKonumu(state.index, satirGenisligi, sayi, hapGenisligi);

  useEffect(() => {
    if (satirGenisligi <= 0) return undefined;
    // İlk yerleşimde ve "hareketi azalt" açıkken kayma olmadan doğrudan konumlanır
    if (ilkKonum.current || hareketAzalt.current) {
      ilkKonum.current = false;
      kayma.setValue(hedef);
      return undefined;
    }
    const animasyon = Animated.spring(kayma, {
      toValue: hedef,
      friction: 9,
      tension: 120,
      useNativeDriver: true,
    });
    animasyon.start();
    return () => animasyon.stop();
  }, [hedef, satirGenisligi, kayma]);

  const odaktakiSecenekler =
    descriptors[state.routes[state.index]?.key]?.options || {};
  if (klavyeAcik && odaktakiSecenekler.tabBarHideOnKeyboard) return null;

  return (
    <View
      // Dış alan şeffaftır ve dokunmayı arkadaki içeriğe geçirir; yalnızca kapsül dokunmayı yakalar
      pointerEvents="box-none"
      style={[styles.dis, { paddingBottom: altMenuAltBoslugu(insets.bottom) }]}
    >
      <View
        style={[
          styles.kapsul,
          {
            backgroundColor: tema.kutuArkaplan,
            borderColor: tema.kutuCerceve,
          },
        ]}
      >
        <View
          style={styles.satir}
          onLayout={(e) => setSatirGenisligi(e.nativeEvent.layout.width)}
        >
          {satirGenisligi > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.hap,
                {
                  width: hapGenisligi,
                  backgroundColor: tema.anaButon,
                  transform: [{ translateX: kayma }],
                },
              ]}
            />
          )}
          {state.routes.map((route, indeks) => {
            const { options } = descriptors[route.key];
            const secili = state.index === indeks;
            const renk = secili ? "#FFFFFF" : tema.ikincilMetin;
            const baslik = options.title ?? route.name;
            const rozet = options.tabBarBadge;

            const basinca = () => {
              const olay = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!secili && !olay.defaultPrevented) {
                navigation.dispatch({
                  ...CommonActions.navigate({ name: route.name, merge: true }),
                  target: state.key,
                });
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                style={styles.sekme}
                activeOpacity={0.7}
                onPress={basinca}
                onLongPress={() =>
                  navigation.emit({ type: "tabLongPress", target: route.key })
                }
                accessibilityRole="tab"
                accessibilityState={{ selected: secili }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? baslik}
                testID={options.tabBarButtonTestID}
              >
                <View>
                  <Ionicons
                    name={ikonAdi(route.name, secili)}
                    size={23}
                    color={renk}
                  />
                  {rozet !== undefined && rozet !== null && (
                    <View
                      style={[
                        styles.rozet,
                        { backgroundColor: rozetStili?.backgroundColor },
                      ]}
                    >
                      <Text
                        style={[styles.rozetYazi, { color: rozetStili?.color }]}
                      >
                        {String(rozet)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  maxFontSizeMultiplier={1.15}
                  style={[
                    styles.etiket,
                    { color: renk, fontWeight: secili ? "700" : "500" },
                  ]}
                >
                  {baslik}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dis: {
    // Sayfanın üstünde yüzer: içerik kapsülün arkasından akar (opak şerit yok)
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  kapsul: {
    height: KAPSUL_YUKSEKLIGI,
    borderRadius: KAPSUL_YUKSEKLIGI / 2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: IC_BOSLUK,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  satir: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: IC_BOSLUK,
  },
  hap: {
    position: "absolute",
    top: IC_BOSLUK,
    bottom: IC_BOSLUK,
    left: 0,
    borderRadius: (KAPSUL_YUKSEKLIGI - IC_BOSLUK * 2) / 2,
  },
  sekme: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  etiket: { fontSize: 10, marginTop: 2, paddingHorizontal: 2 },
  rozet: {
    position: "absolute",
    top: -5,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  rozetYazi: { fontSize: 11, fontWeight: "bold" },
});
