import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
} from "react-native";
import { colors } from "../theme";
import { Ionicons } from "@expo/vector-icons";

export default function ParentDashboard() {
  const sistemTemasi = useColorScheme();
  const tema = sistemTemasi === "dark" ? colors.dark : colors.light;

  // Veli Kontrol Stateleri
  const [veliModalGorunur, setVeliModalGorunur] = useState(false);
  const [ogrenciKoduInput, setOgrenciKoduInput] = useState("");
  const [bagliOgrenci, setBagliOgrenci] = useState(null);

  // WhatsApp Raporlama Stateleri
  const [whatsappNo, setWhatsappNo] = useState("");
  const [raporAktif, setRaporAktif] = useState(false);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tema.arkaplan }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Üst Bilgi Alanı */}
      <View style={styles.header}>
        <Text style={[styles.baslik, { color: tema.metin }]}>
          Veli Kontrol Paneli
        </Text>
        <Text style={{ color: tema.ikincilMetin }}>
          Öğrencinizin gelişimini buradan takip edin.
        </Text>
      </View>

      {/* 1. BÖLÜM: ÖĞRENCİ BAĞLAMA (Eğer öğrenci yoksa buton, varsa isim çıkar) */}
      <View
        style={[
          styles.kutu,
          { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
        ]}
      >
        <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
          Bağlı Öğrenci
        </Text>
        {bagliOgrenci ? (
          <View style={styles.ogrenciKart}>
            <Ionicons
              name="person-circle-outline"
              size={40}
              color={tema.anaButon}
            />
            <Text style={[styles.ogrenciIsim, { color: tema.metin }]}>
              {bagliOgrenci}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setVeliModalGorunur(true)}
            style={[styles.anaButonStil, { backgroundColor: tema.anaButon }]}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.anaButonYazi}>Öğrenci Kodu Gir</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. BÖLÜM: WHATSAPP RAPORLAMA (Arkadaşının n8n sistemi için) */}
      <View
        style={[
          styles.kutu,
          { backgroundColor: tema.kutuArkaplan, borderColor: tema.kutuCerceve },
        ]}
      >
        <Text
          style={[styles.kutuBaslik, { color: tema.metin, marginBottom: 15 }]}
        >
          WhatsApp Raporlama (Cuma Günleri)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: tema.arkaplan,
              color: tema.metin,
              borderColor: tema.kutuCerceve,
            },
          ]}
          placeholder="Örn: 5xxxxxxxxx"
          placeholderTextColor={tema.ikincilMetin}
          keyboardType="phone-pad"
          value={whatsappNo}
          onChangeText={setWhatsappNo}
        />
        <View style={styles.switchSatir}>
          <Text style={[styles.switchYazi, { color: tema.metin }]}>
            Haftalık Rapor İstiyorum
          </Text>
          <Switch
            value={raporAktif}
            onValueChange={setRaporAktif}
            trackColor={{ false: tema.kutuCerceve, true: tema.anaButon }}
            thumbColor={"#fff"}
          />
        </View>
      </View>

      {/* 3. BÖLÜM: İSTATİSTİKLER (Öğrenci bağlandıysa gösterilecek) */}
      <Text style={[styles.altBaslik, { color: tema.metin }]}>
        Haftalık Özet
      </Text>
      <View style={styles.istatistikKutusu}>
        <View
          style={[
            styles.kart,
            {
              backgroundColor: tema.kutuArkaplan,
              borderColor: tema.kutuCerceve,
            },
          ]}
        >
          <Text style={[styles.kartSayi, { color: tema.anaButon }]}>
            {bagliOgrenci ? "12" : "-"}
          </Text>
          <Text style={[styles.kartYazi, { color: tema.ikincilMetin }]}>
            Çözülen Soru
          </Text>
        </View>
        <View
          style={[
            styles.kart,
            {
              backgroundColor: tema.kutuArkaplan,
              borderColor: tema.kutuCerceve,
            },
          ]}
        >
          <Text style={[styles.kartSayi, { color: tema.aiButon }]}>
            {bagliOgrenci ? "%85" : "-"}
          </Text>
          <Text style={[styles.kartYazi, { color: tema.ikincilMetin }]}>
            Başarı Oranı
          </Text>
        </View>
      </View>

      {/* 4. BÖLÜM: SON ETKİNLİKLER */}
      <Text style={[styles.altBaslik, { color: tema.metin }]}>
        Son Çözülenler
      </Text>
      {bagliOgrenci ? (
        [1, 2].map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.listeElemani,
              {
                backgroundColor: tema.kutuArkaplan,
                borderColor: tema.kutuCerceve,
              },
            ]}
          >
            <View>
              <Text style={[styles.listeBaslik, { color: tema.metin }]}>
                Matematik Sorusuz
              </Text>
              <Text
                style={{ color: tema.ikincilMetin, fontSize: 12, marginTop: 4 }}
              >
                Bugün
              </Text>
            </View>
            <View
              style={[
                styles.durumKutusu,
                { backgroundColor: tema.aiButon + "20" },
              ]}
            >
              <Text style={{ color: tema.aiButon, fontWeight: "bold" }}>
                Çözüldü
              </Text>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <Text
          style={{
            color: tema.ikincilMetin,
            textAlign: "center",
            marginTop: 10,
            marginBottom: 30,
          }}
        >
          Öğrenci bağladığınızda veriler burada görünecektir.
        </Text>
      )}

      <View style={{ height: 40 }} />

      {/* Öğrenci Ekleme Modalı */}
      <Modal visible={veliModalGorunur} animationType="fade" transparent={true}>
        <View style={styles.modalArkaplan}>
          <View
            style={[styles.modalKutu, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Text style={[styles.modalBaslik, { color: tema.metin }]}>
              Öğrenci Kodu
            </Text>
            <Text
              style={[
                {
                  color: tema.ikincilMetin,
                  textAlign: "center",
                  marginBottom: 15,
                },
              ]}
            >
              Öğrencinin profilinde yazan 6 haneli bağlantı kodunu girin.
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: tema.arkaplan,
                  color: tema.metin,
                  borderColor: tema.kutuCerceve,
                },
              ]}
              placeholder="XXXXXX"
              placeholderTextColor={tema.ikincilMetin}
              maxLength={6}
              autoCapitalize="characters"
              value={ogrenciKoduInput}
              onChangeText={setOgrenciKoduInput}
            />
            <View style={styles.modalButonSatir}>
              <TouchableOpacity
                onPress={() => setVeliModalGorunur(false)}
                style={styles.modalIptalButon}
              >
                <Text style={{ color: tema.ikincilMetin, fontWeight: "bold" }}>
                  İptal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setBagliOgrenci("Öğrenci Bağlandı");
                  setVeliModalGorunur(false);
                }}
                style={[
                  styles.modalOnayButon,
                  { backgroundColor: tema.anaButon },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "bold" }}>Bağla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 20, marginTop: 10 },
  baslik: { fontSize: 24, fontWeight: "bold", marginBottom: 5 },

  kutu: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  kutuBaslik: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },

  anaButonStil: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
  },
  anaButonYazi: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 10,
    fontSize: 16,
  },

  ogrenciKart: { flexDirection: "row", alignItems: "center" },
  ogrenciIsim: { fontSize: 18, fontWeight: "bold", marginLeft: 10 },

  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  switchSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
  },
  switchYazi: { fontSize: 16, fontWeight: "500" },

  altBaslik: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  istatistikKutusu: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  kart: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginHorizontal: 5,
  },
  kartSayi: { fontSize: 24, fontWeight: "bold", marginBottom: 5 },
  kartYazi: { fontSize: 12, fontWeight: "500", textAlign: "center" },

  listeElemani: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  listeBaslik: { fontSize: 16, fontWeight: "600" },
  durumKutusu: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },

  modalArkaplan: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalKutu: { borderRadius: 15, padding: 20 },
  modalBaslik: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 15,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 2,
  },
  modalButonSatir: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  modalIptalButon: { padding: 15, flex: 1, alignItems: "center" },
  modalOnayButon: {
    padding: 15,
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
  },
});
