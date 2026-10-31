import React, { useEffect, useState } from "react";
import { View, Modal, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OgrenciDetay from "./OgrenciDetay";
import OgrenciSorulari from "./OgrenciSorulari";
import SoruIncelemesi from "./SoruIncelemesi";

// Bir öğrencinin penceresi. İçeriği: öğrenci özeti -> soru listesi (yalnızca müdür) -> soru incelemesi.
// Hem Genel Bakış hem Öğrenciler ekranı bu pencereyi kullanır. satir yoksa pencere kapalıdır.
export default function OgrenciPenceresi({
  satir,
  tema,
  simdi,
  mudurMu,
  kurumAdi,
  onKapat,
}) {
  const insets = useSafeAreaInsets();
  const [gorunum, setGorunum] = useState({ tur: "ozet" });

  // Pencere kapanınca (ya da öğrenci dershaneden ayrılınca) görünüm özet ekranına döner
  useEffect(() => {
    if (!satir) setGorunum({ tur: "ozet" });
  }, [satir]);

  const kapat = () => {
    setGorunum({ tur: "ozet" });
    onKapat();
  };

  // Android geri tuşu / iOS aşağı çekme: önce bir adım geri, özetteyse pencereyi kapat
  const geriGit = () => {
    if (gorunum.tur === "soru") setGorunum({ tur: "sorular" });
    else if (gorunum.tur === "sorular") setGorunum({ tur: "ozet" });
    else kapat();
  };

  const ustBosluk = Platform.OS === "android" ? insets.top : 0;

  return (
    <Modal
      visible={!!satir}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={geriGit}
      onDismiss={kapat}
    >
      <View
        style={{
          flex: 1,
          paddingTop: ustBosluk,
          backgroundColor: tema.arkaplan,
        }}
      >
        {satir && (
          <OgrenciDetay
            satir={satir}
            tema={tema}
            simdi={simdi}
            onKapat={kapat}
            mudurMu={mudurMu}
            kurumAdi={kurumAdi}
            onSorulariAc={() => setGorunum({ tur: "sorular" })}
          />
        )}
        {satir && mudurMu && gorunum.tur !== "ozet" && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { paddingTop: ustBosluk, backgroundColor: tema.arkaplan },
            ]}
          >
            <OgrenciSorulari
              key={satir.id}
              ogrenciId={satir.id}
              isim={satir.isim}
              tema={tema}
              onGeri={geriGit}
              onSoruAc={(soru) => setGorunum({ tur: "soru", soru })}
            />
            {gorunum.tur === "soru" && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { paddingTop: ustBosluk, backgroundColor: tema.arkaplan },
                ]}
              >
                <SoruIncelemesi
                  key={gorunum.soru.id}
                  soru={gorunum.soru}
                  tema={tema}
                  onGeri={geriGit}
                />
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}
