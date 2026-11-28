// Hesap türü (rol) seçici: kayıt formu ve "Profilini Tamamla". Görünümü sınıf seçiciyle aynıdır.
// Yalnızca Öğrenci ve Veli seçilebilir (yönetici rolünü yalnızca sunucu verir; utils/profilKurallari.js).
// Rol kayıttan sonra değiştirilemez (firestore.rules), bu yüzden pencerede ayrıca belirtilir.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeContext";
import AltPencere from "./AltPencere";

export const ROL_SECENEKLERI = [
  { deger: "ogrenci", etiket: "Öğrenci", ikon: "school-outline" },
  { deger: "veli", etiket: "Veli", ikon: "people-outline" },
];

export const rolEtiketi = (deger) => ROL_SECENEKLERI.find((r) => r.deger === deger)?.etiket || "";

export default function RolSecici({ gorunur, kapat, seciliRol, sec }) {
  const { tema } = useTheme();

  return (
    <AltPencere
      gorunur={gorunur}
      kapat={kapat}
      kapatilabilir
      baslik="Hesap Türü"
      aciklama="Hesap türü daha sonra değiştirilemez."
    >
      <View style={stiller.liste} accessibilityRole="radiogroup">
        {ROL_SECENEKLERI.map(({ deger, etiket, ikon }) => {
          const secili = deger === seciliRol;
          return (
            <TouchableOpacity
              key={deger}
              style={[
                stiller.secenek,
                {
                  backgroundColor: secili ? "rgba(0,149,246,0.10)" : tema.kutuArkaplan,
                  borderColor: secili ? tema.anaButon : tema.kutuCerceve,
                },
              ]}
              activeOpacity={0.8}
              onPress={() => {
                sec(deger);
                kapat();
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: secili, checked: secili }}
              accessibilityLabel={etiket}
            >
              <Ionicons
                name={ikon}
                size={18}
                color={secili ? tema.anaButon : tema.ikincilMetin}
                style={{ marginRight: 12 }}
              />
              <Text style={[stiller.yazi, { color: tema.metin, fontWeight: secili ? "700" : "500" }]}>{etiket}</Text>
              <View style={[stiller.radyo, { borderColor: secili ? tema.anaButon : tema.kutuCerceve }]}>
                {secili && <View style={[stiller.radyoIc, { backgroundColor: tema.anaButon }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[stiller.kapatButon, { borderColor: tema.kutuCerceve }]}
        onPress={kapat}
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
  radyo: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radyoIc: { width: 10, height: 10, borderRadius: 5 },
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
