// Sınıf seçici: Hesabım > Sınıf Bilgim.
// Yalnızca listedeki sınıflar seçilebilir. Kaydetme bitene kadar pencere açık kalır;
// kaydedilemezse eski sınıfa dönülür ve kullanıcıya söylenir.

import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeContext";
import AltPencere from "./AltPencere";

export default function SinifSecici({ gorunur, kapat, siniflar, seciliSinif, sec }) {
  const { tema } = useTheme();
  const [kaydedilen, setKaydedilen] = useState(null);
  const [hata, setHata] = useState("");

  const kapatIstegi = () => {
    if (kaydedilen) return;
    setHata("");
    kapat();
  };

  const secimYap = async (sinif) => {
    if (kaydedilen) return;
    if (sinif === seciliSinif) {
      kapatIstegi();
      return;
    }
    setHata("");
    setKaydedilen(sinif);
    const basarili = await sec(sinif);
    setKaydedilen(null);
    if (basarili) kapat();
    else setHata("Sınıf kaydedilemedi. İnternet bağlantını kontrol edip tekrar dene.");
  };

  return (
    <AltPencere
      gorunur={gorunur}
      kapat={kapatIstegi}
      kapatilabilir={!kaydedilen}
      baslik="Sınıf Bilgim"
      aciklama="Sana uygun içerikler için sınıfını seç."
    >
      <View style={stiller.liste} accessibilityRole="radiogroup">
        {siniflar.map((sinif) => {
          const secili = sinif === seciliSinif;
          const kaydediliyor = kaydedilen === sinif;
          return (
            <TouchableOpacity
              key={sinif}
              style={[
                stiller.secenek,
                {
                  backgroundColor: secili ? "rgba(0,149,246,0.10)" : tema.kutuArkaplan,
                  borderColor: secili ? tema.anaButon : tema.kutuCerceve,
                },
              ]}
              activeOpacity={0.8}
              onPress={() => secimYap(sinif)}
              disabled={!!kaydedilen}
              accessibilityRole="radio"
              accessibilityState={{ selected: secili, checked: secili, disabled: !!kaydedilen }}
              accessibilityLabel={sinif}
            >
              <Ionicons
                name={sinif === "Mezun" ? "ribbon-outline" : "school-outline"}
                size={18}
                color={secili ? tema.anaButon : tema.ikincilMetin}
                style={{ marginRight: 12 }}
              />
              <Text
                style={[
                  stiller.yazi,
                  { color: tema.metin, fontWeight: secili ? "700" : "500" },
                ]}
              >
                {sinif}
              </Text>
              {kaydediliyor ? (
                <ActivityIndicator size="small" color={tema.anaButon} />
              ) : (
                <View style={[stiller.radyo, { borderColor: secili ? tema.anaButon : tema.kutuCerceve }]}>
                  {secili && <View style={[stiller.radyoIc, { backgroundColor: tema.anaButon }]} />}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {!!hata && (
        <View style={stiller.hataKutu} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle-outline" size={18} color={tema.hataKirmizi} />
          <Text style={[stiller.hataYazi, { color: tema.hataKirmizi }]}>{hata}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[stiller.kapatButon, { borderColor: tema.kutuCerceve, opacity: kaydedilen ? 0.5 : 1 }]}
        onPress={kapatIstegi}
        disabled={!!kaydedilen}
        accessibilityRole="button"
      >
        <Text style={[stiller.kapatYazi, { color: tema.metin }]}>Kapat</Text>
      </TouchableOpacity>
    </AltPencere>
  );
}

const stiller = StyleSheet.create({
  liste: { gap: 10 },
  secenek: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  yazi: { flex: 1, fontSize: 16 },
  radyo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radyoIc: { width: 10, height: 10, borderRadius: 5 },
  hataKutu: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  hataYazi: { flex: 1, fontSize: 13, lineHeight: 18 },
  kapatButon: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  kapatYazi: { fontSize: 16, fontWeight: "700" },
});
