// Öğrencinin veli bağlantıları üzerindeki denetimi: bağlantı kodunu görme/paylaşma, hesabına bağlı
// velileri görme ve kaldırma, kodu yenileme (eski kod geçersiz olur). Tüm işlemler sunucuda yapılır.

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Share, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AltPencere from "./AltPencere";
import { useTheme } from "../ThemeContext";
import {
  bagliVelileriGetir,
  veliErisiminiKaldir,
  baglantiKoduYenile,
  veliDenetimHataMesaji,
} from "../utils/baglanti";

const TEHLIKE = "#ED4956";

export default function VeliBaglantiPenceresi({ gorunur, kapat, kod, onKodYenilendi }) {
  const { tema } = useTheme();
  const [kodGorunur, setKodGorunur] = useState(false);
  const [veliler, setVeliler] = useState(null); // null: yükleniyor
  const [listeHatasi, setListeHatasi] = useState(false);
  const [islem, setIslem] = useState(null); // "yenile" | veliId

  const listeyiYukle = useCallback(async () => {
    setListeHatasi(false);
    setVeliler(null);
    try {
      setVeliler(await bagliVelileriGetir());
    } catch (e) {
      console.log("Bağlı veliler alınamadı:", e?.code);
      setListeHatasi(true);
      setVeliler([]);
    }
  }, []);

  useEffect(() => {
    if (!gorunur) return;
    setKodGorunur(false);
    listeyiYukle();
  }, [gorunur, listeyiYukle]);

  const paylas = () => {
    if (!kod) return;
    Share.share({
      message: `Mikro veli bağlantı kodum: ${kod}\nMikro veli hesabında öğrenci eklerken bu kodu girebilirsin.`,
    }).catch(() => {});
  };

  const kaldir = (veli) => {
    Alert.alert(
      "Erişimi Kaldır",
      `${veli.isim} artık soru geçmişini ve çalışma istatistiklerini göremeyecek. Tekrar bağlanabilmesi için ona yeni kodu vermen gerekir.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Kaldır",
          style: "destructive",
          onPress: async () => {
            setIslem(veli.id);
            try {
              await veliErisiminiKaldir(veli.id);
              setVeliler((onceki) => (onceki || []).filter((v) => v.id !== veli.id));
            } catch (e) {
              Alert.alert("Kaldırılamadı", veliDenetimHataMesaji(e));
            } finally {
              setIslem(null);
            }
          },
        },
      ]
    );
  };

  const yenile = () => {
    Alert.alert(
      "Kodu Yenile",
      "Yeni bir kod oluşturulacak ve eski kod hemen geçersiz olacak. Zaten bağlı veliler bağlı kalır; istemediğin biri varsa listeden kaldır.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Yenile",
          onPress: async () => {
            setIslem("yenile");
            try {
              const yeni = await baglantiKoduYenile();
              if (yeni) {
                onKodYenilendi?.(yeni);
                setKodGorunur(true);
              }
            } catch (e) {
              Alert.alert("Yenilenemedi", veliDenetimHataMesaji(e));
            } finally {
              setIslem(null);
            }
          },
        },
      ]
    );
  };

  const mesgul = islem !== null;

  return (
    <AltPencere
      gorunur={gorunur}
      kapat={kapat}
      kapatilabilir={!mesgul}
      baslik="Veli Bağlantısı"
      aciklama="Kodu yalnızca veline ver. Kodu bilen kişi soru geçmişini ve çalışma istatistiklerini görebilir."
    >
      {/* Kod */}
      <View style={[stiller.kutu, { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve }]}>
        <Text style={[stiller.etiket, { color: tema.ikincilMetin }]}>Bağlantı kodun</Text>
        <TouchableOpacity
          onPress={() => setKodGorunur((g) => !g)}
          accessibilityRole="button"
          accessibilityLabel={kodGorunur && kod ? `Bağlantı kodu ${kod.split("").join(" ")}` : "Bağlantı kodunu göster"}
          style={stiller.kodSatir}
        >
          <Text style={[stiller.kod, { color: tema.metin }]} selectable={kodGorunur}>
            {kod ? (kodGorunur ? kod : "••••••") : "Hazırlanıyor..."}
          </Text>
          <Ionicons name={kodGorunur ? "eye-off-outline" : "eye-outline"} size={22} color={tema.ikincilMetin} />
        </TouchableOpacity>
        <View style={stiller.dugmeSatir}>
          <TouchableOpacity
            onPress={paylas}
            disabled={!kod || mesgul}
            accessibilityRole="button"
            style={[stiller.dugme, { backgroundColor: tema.anaButon, opacity: !kod || mesgul ? 0.5 : 1 }]}
          >
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={stiller.dugmeYazi}>Veline Gönder</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={yenile}
            disabled={!kod || mesgul}
            accessibilityRole="button"
            accessibilityHint="Eski kod geçersiz olur"
            style={[stiller.dugme, stiller.ikincil, { borderColor: tema.kutuCerceve, opacity: !kod || mesgul ? 0.5 : 1 }]}
          >
            {islem === "yenile" ? (
              <ActivityIndicator size="small" color={tema.metin} />
            ) : (
              <Ionicons name="refresh-outline" size={18} color={tema.metin} />
            )}
            <Text style={[stiller.dugmeYazi, { color: tema.metin }]}>Kodu Yenile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bağlı veliler */}
      <Text style={[stiller.bolumBaslik, { color: tema.metin }]} accessibilityRole="header">
        Hesabına bağlı veliler
      </Text>
      {veliler === null ? (
        <ActivityIndicator style={{ marginVertical: 16 }} color={tema.anaButon} />
      ) : listeHatasi ? (
        <TouchableOpacity onPress={listeyiYukle} accessibilityRole="button" style={stiller.bosSatir}>
          <Text style={{ color: tema.ikincilMetin, textAlign: "center" }}>
            Liste alınamadı. Tekrar denemek için dokun.
          </Text>
        </TouchableOpacity>
      ) : veliler.length === 0 ? (
        <Text style={[stiller.bosSatir, { color: tema.ikincilMetin, textAlign: "center" }]}>
          Henüz bağlı veli yok.
        </Text>
      ) : (
        veliler.map((veli) => (
          <View
            key={veli.id}
            style={[stiller.veliSatir, { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve }]}
          >
            <Ionicons name="person-circle-outline" size={28} color={tema.ikincilMetin} />
            <Text style={[stiller.veliIsim, { color: tema.metin }]} numberOfLines={1}>
              {veli.isim}
            </Text>
            <TouchableOpacity
              onPress={() => kaldir(veli)}
              disabled={mesgul}
              accessibilityRole="button"
              accessibilityLabel={`${veli.isim} erişimini kaldır`}
              style={[stiller.kaldir, { opacity: mesgul && islem !== veli.id ? 0.5 : 1 }]}
            >
              {islem === veli.id ? (
                <ActivityIndicator size="small" color={TEHLIKE} />
              ) : (
                <Text style={stiller.kaldirYazi}>Kaldır</Text>
              )}
            </TouchableOpacity>
          </View>
        ))
      )}
    </AltPencere>
  );
}

const stiller = StyleSheet.create({
  kutu: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 20 },
  etiket: { fontSize: 13, fontWeight: "600" },
  kodSatir: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 14 },
  kod: { fontSize: 30, fontWeight: "800", letterSpacing: 6 },
  dugmeSatir: { flexDirection: "row", gap: 10 },
  dugme: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ikincil: { backgroundColor: "transparent", borderWidth: 1 },
  dugmeYazi: { color: "#fff", fontWeight: "700", fontSize: 14 },
  bolumBaslik: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  bosSatir: { paddingVertical: 16 },
  veliSatir: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 10,
  },
  veliIsim: { flex: 1, fontSize: 15, fontWeight: "600" },
  kaldir: { paddingVertical: 6, paddingHorizontal: 12, minWidth: 64, alignItems: "center" },
  kaldirYazi: { color: TEHLIKE, fontWeight: "700", fontSize: 14 },
});
