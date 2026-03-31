import React, { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

// Firebase
import { auth, db, storage } from "../firebaseConfig";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function HomeScreen() {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [image, setImage] = useState(null);

  const fotoCekVeGonder = async () => {
    try {
      // 📸 Kamera izni
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("İzin gerekli", "Kamera izni vermelisin");
        return;
      }

      // 📸 Kamera aç
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
      });

      if (result.canceled) return;

      const uri = result.assets[0].uri;
      setImage(uri);

      setYukleniyor(true);

      // 🔄 Blob'a çevir
      const response = await fetch(uri);
      const blob = await response.blob();

      // ☁️ Firebase Storage yükleme
      const dosyaAdi = `kullanicilar/${
        auth.currentUser.uid
      }/sorular/${Date.now()}.jpg`;

      const storageRef = ref(storage, dosyaAdi);

      await uploadBytes(storageRef, blob);

      const downloadURL = await getDownloadURL(storageRef);

      // 🗄️ Firestore (benzersiz kayıt)
      await addDoc(collection(db, "sorular"), {
        kullaniciEposta: auth.currentUser.email,
        fotoLink: downloadURL,
        tarih: new Date().toISOString(),
        durum: "Bekliyor ⏳",
      });

      Alert.alert("Başarılı", "Fotoğraf yüklendi ✅");
    } catch (error) {
      console.log("HATA:", error);
      Alert.alert("Hata", error.message);
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 20 }}>
        Soruyu Çek 📸
      </Text>

      {image && (
        <Image
          source={{ uri: image }}
          style={{
            width: 220,
            height: 220,
            borderRadius: 10,
            marginBottom: 20,
          }}
        />
      )}

      <TouchableOpacity
        onPress={fotoCekVeGonder}
        style={{
          backgroundColor: "#6C5CE7",
          padding: 15,
          borderRadius: 10,
          width: "80%",
          alignItems: "center",
        }}
      >
        {yukleniyor ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontSize: 18 }}>
            📸 Fotoğraf Çek ve Gönder
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
