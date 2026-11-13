// Hesap silme penceresi: Hesabım > Hesabımı Sil.
// Yalnızca görünüm bileşenidir; silme işi ProfileScreen'deki guvenliHesabiSil → hesabiTamamenSil
// akışında yapılır (yeniden doğrulama, Apple bağlantısının iptali, veriler, en son hesap).
// Silme sürerken pencere kapatılamaz ve düğmeler kilitlidir.

import React, { useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ThemeContext";
import AltPencere from "./AltPencere";

export const ONAY_METNI = "SİL";

const SILINECEKLER = [
  { ikon: "camera-outline", metin: "Gönderdiğin soruların fotoğrafları ve çözümleri" },
  { ikon: "person-outline", metin: "Profil bilgilerin, fotoğrafın ve istatistiklerin" },
  { ikon: "people-outline", metin: "Veli bağlantıların ve bağlantı kodun" },
];

const DOGRULAMA_METNI = {
  google: "Güvenliğin için Google ile yeniden giriş yapman istenecek.",
  apple: "Güvenliğin için Apple ile yeniden doğrulama yapman istenecek.",
  password: "Güvenliğin için hesap şifreni girmen gerekiyor.",
};

export default function HesapSilPenceresi({
  gorunur,
  kapat,
  yontem,
  sifre,
  setSifre,
  onay,
  setOnay,
  siliniyor,
  sil,
}) {
  const { tema } = useTheme();
  // Klavye açılınca kutular ve düğmeler görünür kalsın: odaklanınca pencere en alta kaydırılır
  const kaydirma = useRef(null);
  const altaKaydir = () => setTimeout(() => kaydirma.current?.scrollToEnd({ animated: true }), 250);
  const onayTamam = onay === ONAY_METNI;
  const sifreGerekli = yontem === "password";
  const silinebilir = onayTamam && !siliniyor && (!sifreGerekli || !!sifre);

  return (
    <AltPencere
      gorunur={gorunur}
      kapat={kapat}
      kapatilabilir={!siliniyor}
      baslik="Hesabı Kalıcı Olarak Sil"
      kaydirmaRef={kaydirma}
    >
      <View style={stiller.uyariIkonKap}>
        <View style={[stiller.uyariIkon, { backgroundColor: "rgba(237,73,86,0.12)" }]}>
          <Ionicons name="warning" size={30} color={tema.hataKirmizi} />
        </View>
      </View>

      <Text style={[stiller.aciklama, { color: tema.ikincilMetin }]}>
        Şunlar kalıcı olarak silinir. Bu işlem{" "}
        <Text style={{ fontWeight: "700", color: tema.metin }}>geri alınamaz.</Text>
      </Text>

      <View style={[stiller.liste, { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve }]}>
        {SILINECEKLER.map(({ ikon, metin }) => (
          <View key={metin} style={stiller.satir}>
            <Ionicons name={ikon} size={18} color={tema.hataKirmizi} style={{ marginRight: 10 }} />
            <Text style={[stiller.satirYazi, { color: tema.metin }]}>{metin}</Text>
          </View>
        ))}
      </View>

      <Text style={[stiller.dogrulama, { color: tema.ikincilMetin }]}>
        {DOGRULAMA_METNI[yontem] || DOGRULAMA_METNI.password}
      </Text>

      {sifreGerekli && (
        <TextInput
          style={[stiller.kutu, { backgroundColor: tema.arkaplan, color: tema.metin, borderColor: tema.kutuCerceve }]}
          placeholder="Şifren"
          placeholderTextColor={tema.ikincilMetin}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          value={sifre}
          onChangeText={setSifre}
          onFocus={altaKaydir}
          editable={!siliniyor}
          accessibilityLabel="Hesap şifresi"
        />
      )}

      <Text style={[stiller.onayBaslik, { color: tema.metin }]}>Onaylamak için aşağıya SİL yaz:</Text>
      <TextInput
        style={[
          stiller.kutu,
          stiller.onayKutu,
          {
            backgroundColor: tema.arkaplan,
            color: tema.hataKirmizi,
            borderColor: onayTamam ? tema.hataKirmizi : tema.kutuCerceve,
          },
        ]}
        placeholder={ONAY_METNI}
        placeholderTextColor={tema.ikincilMetin}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={3}
        value={onay}
        // Türkçe büyük harf: "sil" yazılsa da "SİL" olur
        onChangeText={(t) => setOnay(t.toLocaleUpperCase("tr-TR"))}
        onFocus={altaKaydir}
        returnKeyType="done"
        editable={!siliniyor}
        accessibilityLabel="Onay metni"
      />

      <View style={stiller.butonSatir}>
        <TouchableOpacity
          style={[stiller.buton, { borderWidth: 1.5, borderColor: tema.kutuCerceve, opacity: siliniyor ? 0.5 : 1 }]}
          onPress={kapat}
          disabled={siliniyor}
          accessibilityRole="button"
        >
          <Text style={[stiller.butonYazi, { color: tema.metin }]}>Vazgeç</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[stiller.buton, { backgroundColor: silinebilir || siliniyor ? tema.hataKirmizi : tema.kutuCerceve }]}
          onPress={sil}
          disabled={!silinebilir}
          accessibilityRole="button"
          accessibilityState={{ disabled: !silinebilir, busy: siliniyor }}
        >
          {siliniyor ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[stiller.butonYazi, { color: silinebilir ? "#FFFFFF" : tema.ikincilMetin }]}>
              Hesabımı Sil
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </AltPencere>
  );
}

const stiller = StyleSheet.create({
  uyariIkonKap: { alignItems: "center", marginTop: 14, marginBottom: 12 },
  uyariIkon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  aciklama: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 12 },
  liste: { borderWidth: 1, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 14 },
  satir: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  satirYazi: { flex: 1, fontSize: 14, lineHeight: 19 },
  dogrulama: { fontSize: 13, textAlign: "center", lineHeight: 19, marginTop: 14, marginBottom: 12 },
  kutu: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 16, marginBottom: 12 },
  onayBaslik: { fontSize: 14, fontWeight: "600", textAlign: "center", marginBottom: 8 },
  onayKutu: { textAlign: "center", fontSize: 20, fontWeight: "700", letterSpacing: 3 },
  butonSatir: { flexDirection: "row", gap: 12, marginTop: 6 },
  buton: { flex: 1, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  butonYazi: { fontSize: 16, fontWeight: "700" },
});
