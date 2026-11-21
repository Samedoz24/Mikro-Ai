import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Switch,
  Image,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
  Pressable,
  StatusBar,
  Share,
  Linking,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useIsFocused } from "@react-navigation/native";

// Firebase Kütüphaneleri
import { auth, db, storage } from "../firebaseConfig";
import { appCheckBasligi } from "../utils/appCheck";
import { baglantiKoduAl } from "../utils/baglanti";
import KurumKarti from "./KurumKarti";
import VeliBaglantiPenceresi from "./VeliBaglantiPenceresi";
import ProfilFotoGoruntuleyici from "./ProfilFotoGoruntuleyici";
import { oturumuKapat } from "../utils/oturum";
import PlatformKarti from "./PlatformKarti";
import useAltMenuBoslugu from "../utils/altMenu";
import {
  ROZETLER,
  kazanilanRozetIdleri,
  soruIstatistigi,
} from "../utils/rozetler";
import {
  doc,
  setDoc,
  updateDoc,
  deleteField,
  onSnapshot,
  collection,
  query,
  where,
  getDoc,
  arrayUnion,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";

// 🚀 DÜZELTME: Yeni akıllı bildirim yöneticilerimiz eklendi
import {
  registerForPushNotificationsAsync,
  cancelAllNotifications,
  setupSmartNotifications,
} from "../utils/notificationManager";

import {
  htmlSablonUret as yasalHtmlSablonu,
  KULLANIM_KOSULLARI_ICERIK,
} from "../utils/yasalMetinler";
import {
  hesabiTamamenSil,
  girisYonteminiBul,
  SILME_IPTAL,
} from "../utils/hesapSilici";

import { useTheme } from "../ThemeContext";
import { usePremium } from "../PremiumContext";
import { yerelTarih } from "../utils/tarih";
import { dersBul } from "../utils/ders";
import { kotaDurumuGetir } from "../utils/kotaIstemci";
import { colors } from "../theme";
import * as Application from "expo-application";
import GorunumSecici from "./GorunumSecici";
import SinifSecici from "./SinifSecici";
import HesapSilPenceresi, { ONAY_METNI } from "./HesapSilPenceresi";
import RozetKutlama from "./RozetKutlama";
import { puanHesapla, seviyeBilgisi, EN_YUKSEK_SEVIYE } from "../utils/seviye";
import {
  AD_SOYAD_EN_FAZLA,
  adSoyadTemizle,
  profilFotoGecerliMi,
  gorunenEposta,
  gorunenIsim,
} from "../utils/profilDogrulama";

// 13 yaş şartı nedeniyle liste 8. sınıftan başlar
const SINIFLAR = [
  "8. Sınıf",
  "9. Sınıf",
  "10. Sınıf",
  "11. Sınıf",
  "12. Sınıf",
  "Mezun",
];

// Bilinen roller; rol alanı olmayan eski hesaplar öğrenci sayılır (sunucudaki kuralla aynı)
const BILINEN_ROLLER = ["ogrenci", "veli", "yonetici"];
const rolNormalize = (deger) =>
  deger == null ? "ogrenci" : BILINEN_ROLLER.includes(deger) ? deger : "bilinmiyor";
const ROL_ADLARI = { ogrenci: "Öğrenci", veli: "Veli", yonetici: "Yönetici" };
const rolEtiketi = (rol) => ROL_ADLARI[rol] || "Kullanıcı";

// Dosyalar seçici ve fotoğraf düzenleyici yalnızca "Dosyalar" seçilince yüklenir: bu yerel parçaları içermeyen
// eski bir derlemede uygulama açılışta çökmez, yalnızca bu seçenek kullanılamaz.
const dosyaModulleriniYukle = () => {
  try {
    const DocumentPicker = require("expo-document-picker");
    const { ImageManipulator, SaveFormat } = require("expo-image-manipulator");
    return { DocumentPicker, ImageManipulator, SaveFormat };
  } catch (e) {
    console.log("Dosya seçici kullanılamıyor:", e?.message);
    return null;
  }
};

// Profil fotoğrafı: Dosyalar'dan seçilen ham dosya için üst sınır; kaydedilen kare fotoğrafın kenarı
const FOTO_DOSYA_EN_FAZLA = 25 * 1024 * 1024;
const PROFIL_FOTO_KENAR = 1024;
// iOS menüsünün kapanma animasyonu (bu sürede yeni pencere açılamaz)
const MENU_KAPANMA_MS = 600;

export default function ProfileScreen() {
  const user = auth.currentUser;
  const insets = useSafeAreaInsets();
  // Yüzen alt menünün altında kalmamak için
  const altMenuBoslugu = useAltMenuBoslugu(20);
  const { premiumMu: premiumAktif, premiumAc } = usePremium();
  const isFocused = useIsFocused();

  const { tema, temaModu } = useTheme();
  const isGercektenKaranlik = tema.arkaplan === colors.dark.arkaplan;

  // Rol yüklenene kadar null: öğrenciye özel işler (kota, rozet kaydı) ve kartlar rol kesinleşmeden çalışmaz.
  // Asıl kaynak Firestore profilidir; telefonda saklanan değer yalnızca ilk görüntü için kullanılır.
  const [rol, setRol] = useState(null);
  const [sinifModalGorunur, setSinifModalGorunur] = useState(false);
  const [seciliSinif, setSeciliSinif] = useState("Sınıf Seçilmedi");

  const [temaModalGorunur, setTemaModalGorunur] = useState(false);

  const [adSoyad, setAdSoyad] = useState("");
  const [isimDuzenleniyor, setIsimDuzenleniyor] = useState(false);

  const [bildirimAktif, setBildirimAktif] = useState(true);
  const [premiumMu, setPremiumMu] = useState(false);

  const [profilFoto, setProfilFoto] = useState(null);
  const [fotoYukleniyor, setFotoYukleniyor] = useState(false);

  // Sunucudan gelen kota bilgisi: { kalan, sinir, ucretsizSinir, premiumSinir } (yüklenene kadar null)
  const [kota, setKota] = useState(null);
  const [seriGunu, setSeriGunu] = useState(0);
  const [baglantiKodu, setBaglantiKodu] = useState("Yükleniyor...");
  const [veliPenceresiGorunur, setVeliPenceresiGorunur] = useState(false);
  const [fotoGoruntuleyiciAcik, setFotoGoruntuleyiciAcik] = useState(false);
  const fotoSecimiSuruyor = useRef(false);
  const [onizlemeUri, setOnizlemeUri] = useState(null);

  // Fotoğraf önceden belleğe alınır: tam ekran görünüm dokunur dokunmaz açılır
  useEffect(() => {
    if (typeof profilFoto === "string" && profilFoto.startsWith("https://")) {
      Image.prefetch(profilFoto).catch(() => {});
    }
  }, [profilFoto]);

  const [toplamSoru, setToplamSoru] = useState(0);
  const [okunanCozum, setOkunanCozum] = useState(0);
  const [farkliDers, setFarkliDers] = useState(0);
  // Kalıcı rozetler: undefined = henüz yüklenmedi, null = belgede alan yok, dizi = kayıtlı rozet id'leri
  const [rozetKaydi, setRozetKaydi] = useState(undefined);
  const rozetIslenen = useRef(new Set());
  // Kutlama sırası: her öğe aynı anda kazanılan rozetlerin listesi
  const [kutlamaSirasi, setKutlamaSirasi] = useState([]);
  const [bildirimKaydediliyor, setBildirimKaydediliyor] = useState(false);
  const [dersIstatistikleri, setDersIstatistikleri] = useState([]);
  const [istatistikYukleniyor, setIstatistikYukleniyor] = useState(true);

  const [webViewModalGorunur, setWebViewModalGorunur] = useState(false);
  const [webViewBaslik, setWebViewBaslik] = useState("");
  const [webViewHtml, setWebViewHtml] = useState("");

  const [hesapSilModalGorunur, setHesapSilModalGorunur] = useState(false);
  const [silOnayMetni, setSilOnayMetni] = useState("");
  const [hesapSiliniyor, setHesapSiliniyor] = useState(false);
  const [silSifre, setSilSifre] = useState("");
  // Silme sırasında belge dinleyicisinin kullanıcı belgesini yeniden oluşturmasını engeller
  const silmeSurecte = useRef(false);

  // Bağlantı kodunun baglantiKodlari kaydı bu oturumda bir kez doğrulanır
  const kodKontrolEdildi = useRef(false);

  // Kalan günlük soru hakkı sunucudan okunur (kota sunucuda, hesap + cihaz başına sayılır).
  // Sayfa her açıldığında ve premium durumu değişince yenilenir. Yalnızca öğrenciler soru gönderir.
  useEffect(() => {
    if (!user || !isFocused || rol !== "ogrenci") return undefined;
    let iptal = false;
    kotaDurumuGetir()
      .then((durum) => {
        if (iptal || !durum) return;
        const sayiMi = (d) => Number.isInteger(d) && d >= 0;
        if (!sayiMi(durum.kalan) || !sayiMi(durum.sinir)) return;
        setKota({
          kalan: Math.min(durum.kalan, durum.sinir),
          sinir: durum.sinir,
          ucretsizSinir: sayiMi(durum.ucretsizSinir) ? durum.ucretsizSinir : null,
          premiumSinir: sayiMi(durum.premiumSinir) ? durum.premiumSinir : null,
        });
      })
      .catch((hata) => console.log("Kota durumu alınamadı:", hata?.code));
    return () => {
      iptal = true;
    };
  }, [user, isFocused, rol, premiumAktif]);

  useEffect(() => {
    let abonelik = () => {};

    const verileriCanliDinle = async () => {
      if (!user) return;

      const kayitliRol = await AsyncStorage.getItem("kullaniciRolu");
      setRol(rolNormalize(kayitliRol));

      const kayitliSinif = await AsyncStorage.getItem("seciliSinif");
      if (SINIFLAR.includes(kayitliSinif)) setSeciliSinif(kayitliSinif);

      const kayitliAdSoyad = await AsyncStorage.getItem("adSoyad");
      if (kayitliAdSoyad) setAdSoyad(adSoyadTemizle(kayitliAdSoyad));

      const kayitliFoto = await AsyncStorage.getItem("profilFoto");
      if (profilFotoGecerliMi(user.uid, kayitliFoto)) setProfilFoto(kayitliFoto);

      const kayitliSeri = await AsyncStorage.getItem("seriGunu");
      if (kayitliSeri) setSeriGunu(parseInt(kayitliSeri));

      const bildirimAyar = await AsyncStorage.getItem("bildirimAktif");
      if (bildirimAyar !== null) setBildirimAktif(JSON.parse(bildirimAyar));

      const kullaniciRef = doc(db, "kullanicilar", user.uid);
      kodKontrolEdildi.current = false;

      abonelik = onSnapshot(
        kullaniciRef,
        async (kullaniciSnap) => {
          if (kullaniciSnap.exists()) {
            const data = kullaniciSnap.data();

            if (SINIFLAR.includes(data.sinif)) setSeciliSinif(data.sinif);
            if (typeof data.adSoyad === "string" && data.adSoyad)
              setAdSoyad(adSoyadTemizle(data.adSoyad));
            if (data.bildirimAktif !== undefined)
              setBildirimAktif(data.bildirimAktif);
            setRozetKaydi(Array.isArray(data.rozetler) ? data.rozetler : null);

            if (data.premiumMu !== undefined) {
              setPremiumMu(data.premiumMu === true);
            }

            if (typeof data.baglantiKodu === "string") {
              setBaglantiKodu(data.baglantiKodu);
            }
            setRol(rolNormalize(data.rol));

            // Kod sunucuda üretilir ve kaydı sunucuda doğrulanır (eski hesaplar da burada taşınır)
            const ogrenciMi = (data.rol ?? "ogrenci") === "ogrenci";
            if (ogrenciMi && !kodKontrolEdildi.current) {
              kodKontrolEdildi.current = true;
              try {
                const kod = await baglantiKoduAl();
                if (kod) setBaglantiKodu(kod);
              } catch (e) {
                kodKontrolEdildi.current = false;
                console.log("Kod ekleme hatası", e?.code || e?.message);
              }
            }

            if (data.seriGunu !== undefined) {
              setSeriGunu(data.seriGunu);
              await AsyncStorage.setItem("seriGunu", String(data.seriGunu));
            } else {
              setSeriGunu(1);
              try {
                await updateDoc(kullaniciRef, { seriGunu: 1 });
              } catch (e) {
                console.log("Seri ekleme hatası", e);
              }
            }

            if (profilFotoGecerliMi(user.uid, data.profilFoto)) {
              setProfilFoto(data.profilFoto);
              await AsyncStorage.setItem("profilFoto", data.profilFoto);
            }
          } else {
            if (silmeSurecte.current) return;

            try {
              // Profil oluşturulur; bağlantı kodunu belge dinleyicisi sunucudan alır
              await setDoc(kullaniciRef, {
                eposta: user.email,
                rol: kayitliRol === "veli" ? "veli" : "ogrenci",
                kayitTarihi: new Date().toISOString(),
                bildirimAktif: true,
                seriGunu: 1,
              });
            } catch (yazmaHatasi) {
              console.log(
                "Kullanıcı belge oluşturma hatası:",
                yazmaHatasi.message
              );
            }
          }
        },
        (error) => {
          console.log("Firebase Canlı Dinleme Hatası:", error.message);
        }
      );
    };

    verileriCanliDinle();

    return () => abonelik();
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, "sorular"), where("kullaniciUid", "==", user.uid));

    const abonelik = onSnapshot(
      q,
      (snapshot) => {
        let total = 0;
        const dersSayaclari = {};
        const sorular = [];

        snapshot.forEach((doc) => {
          total++;
          const data = doc.data();
          sorular.push(data);
          const ders = dersBul(data);
          dersSayaclari[ders] = (dersSayaclari[ders] || 0) + 1;
        });

        const ist = soruIstatistigi(sorular, dersBul);
        setToplamSoru(total);
        setOkunanCozum(ist.okunanCozum);
        setFarkliDers(ist.farkliDers);

        if (total > 0) {
          const istatistikDizisi = Object.keys(dersSayaclari).map(
            (dersAdi) => ({
              ders: dersAdi,
              sayi: dersSayaclari[dersAdi],
              yuzde: Math.round((dersSayaclari[dersAdi] / total) * 100),
            })
          );

          istatistikDizisi.sort((a, b) => b.sayi - a.sayi);
          setDersIstatistikleri(istatistikDizisi);
        } else {
          setDersIstatistikleri([]);
        }

        setIstatistikYukleniyor(false);
      },
      (error) => {
        console.log("İstatistik çekme hatası:", error);
        setIstatistikYukleniyor(false);
      }
    );

    return () => abonelik();
  }, [user]);

  const internetVarMi = async () => {
    try {
      await Promise.race([
        fetch("https://www.google.com", { method: "HEAD" }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 3000)
        ),
      ]);
      return true;
    } catch (error) {
      return false;
    }
  };

  // Abonelik kartı metni: sayılar sunucudaki ayardan gelir; henüz yüklenmediyse sayı yazılmaz
  const abonelikAciklamasi = (premium, k) => {
    const ucretsiz = k?.ucretsizSinir;
    const prem = k?.premiumSinir;
    if (premium) {
      return Number.isInteger(prem)
        ? `Günde ${prem} soru ve PDF indirme aktif.`
        : "Premium soru hakkı ve PDF indirme aktif.";
    }
    if (Number.isInteger(ucretsiz) && Number.isInteger(prem)) {
      return `Günde ${ucretsiz} soru. Premium ile günde ${prem} soru ve PDF indirme.`;
    }
    return "Premium ile daha fazla günlük soru ve PDF indirme.";
  };

  // Sınıf yalnızca listeden seçilir; önce sunucuya yazılır, başarılı olursa ekranda ve cihazda güncellenir
  const sinifKaydet = async (sinif) => {
    if (!SINIFLAR.includes(sinif) || !user) return false;
    try {
      await updateDoc(doc(db, "kullanicilar", user.uid), { sinif });
      setSeciliSinif(sinif);
      await AsyncStorage.setItem("seciliSinif", sinif);
      return true;
    } catch (e) {
      console.log("Sınıf kaydedilemedi:", e?.code);
      return false;
    }
  };

  // Düzenlemeye başlarken kayıtlı isim saklanır; kaydedilemezse ona dönülür
  const kayitliIsim = useRef("");

  const isimDuzenlemeyiAc = () => {
    kayitliIsim.current = adSoyad;
    setIsimDuzenleniyor(true);
  };

  const isimKaydet = async () => {
    const temiz = adSoyadTemizle(adSoyad);
    if (!temiz) {
      setAdSoyad(kayitliIsim.current);
      setIsimDuzenleniyor(false);
      return;
    }
    setAdSoyad(temiz);
    setIsimDuzenleniyor(false);
    if (temiz === kayitliIsim.current) return;
    try {
      if (user) {
        await updateDoc(doc(db, "kullanicilar", user.uid), { adSoyad: temiz });
      }
      await AsyncStorage.setItem("adSoyad", temiz);
    } catch (e) {
      console.log("İsim kaydedilemedi:", e?.code);
      setAdSoyad(kayitliIsim.current);
      Alert.alert(
        "İsim Kaydedilemedi",
        "İnternet bağlantınızı kontrol edip tekrar deneyin."
      );
    }
  };

  // Fotoğrafın nereden alınacağı. iOS'ta sistemin kendi menüsü kullanılır: tam ekran görünümün üstünde
  // açılır, görünüm kapanmaz; seçim ekranı da görünümün üstüne gelir.
  const fotoKaynagiSec = () => {
    const islemler = [
      () => profilFotografiSec("kamera"),
      () => profilFotografiSec("galeri"),
      () => profilFotografiSec("dosya"),
    ];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: "Profil Fotoğrafı", options: ["Kamera", "Fotoğraflar", "Dosyalar", "İptal"], cancelButtonIndex: 3 },
        (secim) => {
          // Menü kapanırken iOS yeni bir pencere (Dosyalar, uyarı) açamaz: kapanma bitince açılır
          if (secim >= 0 && secim < islemler.length) setTimeout(islemler[secim], MENU_KAPANMA_MS);
        }
      );
    } else {
      Alert.alert("Profil Fotoğrafı", "Fotoğrafı nereden eklemek istersin?", [
        { text: "Kamera", onPress: islemler[0] },
        { text: "Fotoğraflar", onPress: islemler[1] },
        { text: "Dosyalar", onPress: islemler[2] },
        { text: "İptal", style: "cancel" },
      ]);
    }
  };

  // Fotoğraf varsa tam ekran gösterilir (Değiştir / Kaldır orada); yoksa kaynak seçimi açılır
  const fotoAksiyonMenusu = () => {
    if (profilFoto) setFotoGoruntuleyiciAcik(true);
    else fotoKaynagiSec();
  };

  // Önizleme: "Kullan" denirse yüklenir; vazgeçilirse geçici kopya cihazdan silinir
  const onizlemeOnayla = async () => {
    const uri = onizlemeUri;
    setOnizlemeUri(null);
    if (uri) await profilFotografiYukle(uri);
  };

  const onizlemeIptal = () => {
    const uri = onizlemeUri;
    setOnizlemeUri(null);
    if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  };

  // Görünüm açık kalır; yeni fotoğraf yüklenince görünümde hemen yenisi görünür
  const goruntuleyicidenDegistir = () => fotoKaynagiSec();

  // Kaldırılınca fotoğraf kalmadığı için görünüm kendiliğinden kapanır
  const goruntuleyicidenKaldir = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Profil fotoğrafın kaldırılsın mı?",
          options: ["Fotoğrafı Kaldır", "Vazgeç"],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        (secim) => {
          if (secim === 0) setTimeout(profilFotografiKaldir, MENU_KAPANMA_MS);
        }
      );
    } else {
      Alert.alert("Fotoğrafı Kaldır", "Profil fotoğrafın kaldırılsın mı?", [
        { text: "Vazgeç", style: "cancel" },
        { text: "Kaldır", style: "destructive", onPress: profilFotografiKaldir },
      ]);
    }
  };

  const profilFotografiKaldir = async () => {
    setFotoYukleniyor(true);
    const baglanti = await internetVarMi();
    if (!baglanti) {
      setFotoYukleniyor(false);
      Alert.alert(
        "Bağlantı Hatası",
        "İnternet bağlantınız olmadığı için fotoğraf kaldırılamadı."
      );
      return;
    }

    try {
      setProfilFoto(null);
      await AsyncStorage.removeItem("profilFoto");

      if (user) {
        const kullaniciRef = doc(db, "kullanicilar", user.uid);
        await updateDoc(kullaniciRef, { profilFoto: deleteField() });

        const fotoRef = ref(storage, `profil_fotograflari/${user.uid}.jpg`);
        await deleteObject(fotoRef).catch((err) =>
          console.log("Dosya zaten yok:", err)
        );
      }
    } catch (error) {
      console.log("Fotoğraf kaldırma hatası:", error);
      Alert.alert("Hata", "Fotoğraf kaldırılırken bir sorun oluştu.");
    } finally {
      setFotoYukleniyor(false);
    }
  };

  // İzin iste; reddedilmişse ayarları açma seçeneği sun
  const izinIste = async (kameraMi) => {
    const { status } = kameraMi
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status === "granted") return true;
    Alert.alert(
      "İzin Gerekli",
      kameraMi
        ? "Fotoğraf çekebilmek için kamera izni vermelisin."
        : "Fotoğraf seçebilmek için galeri erişim izni vermelisin.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Ayarları Aç", onPress: () => Linking.openSettings().catch(() => {}) },
      ]
    );
    return false;
  };

  // Dosyalar uygulamasından fotoğraf: yalnızca resim türleri; dosya gerçekten resim olarak açılabilmeli.
  // Kare kırpılır, en fazla 1024 piksele küçültülür ve JPEG'e çevrilir (resim olmayan dosya yüklenemez,
  // boyut sunucu sınırını aşamaz). Dönüş: yerel JPEG adresi ya da null.
  const dosyadanFotoAl = async () => {
    const moduller = dosyaModulleriniYukle();
    if (!moduller) {
      Alert.alert(
        "Kullanılamıyor",
        "Dosyalardan fotoğraf seçmek için uygulamanın güncel sürümü gerekiyor."
      );
      return null;
    }
    const { DocumentPicker, ImageManipulator, SaveFormat } = moduller;
    let sonuc;
    try {
      sonuc = await DocumentPicker.getDocumentAsync({
        type: ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"],
        copyToCacheDirectory: true,
        multiple: false,
      });
    } catch (e) {
      // Paket, açamadığı bir pencere için "seçim sürüyor" durumunda kalabiliyor; kullanıcıya yol gösterilir
      console.log("Dosya seçici açılamadı:", e?.message);
      Alert.alert(
        "Dosyalar Açılamadı",
        String(e?.message || "").includes("in progress")
          ? "Dosya seçici şu an meşgul. Uygulamayı tamamen kapatıp açtıktan sonra tekrar dene."
          : "Dosya seçici açılamadı. Lütfen tekrar dene."
      );
      return null;
    }
    if (sonuc.canceled || !sonuc.assets?.[0]) return null;
    const dosya = sonuc.assets[0];
    if (typeof dosya.mimeType !== "string" || !dosya.mimeType.startsWith("image/")) {
      Alert.alert("Desteklenmeyen Dosya", "Lütfen bir fotoğraf dosyası seç.");
      return null;
    }
    if (Number.isFinite(dosya.size) && dosya.size > FOTO_DOSYA_EN_FAZLA) {
      Alert.alert("Dosya Çok Büyük", "Lütfen 25 MB'tan küçük bir fotoğraf seç.");
      return null;
    }
    try {
      const resim = await ImageManipulator.manipulate(dosya.uri).renderAsync();
      const kenar = Math.min(resim.width, resim.height);
      const kare = await ImageManipulator.manipulate(dosya.uri)
        .crop({
          originX: Math.floor((resim.width - kenar) / 2),
          originY: Math.floor((resim.height - kenar) / 2),
          width: kenar,
          height: kenar,
        })
        .resize({ width: Math.min(kenar, PROFIL_FOTO_KENAR) })
        .renderAsync();
      const kayit = await kare.saveAsync({ format: SaveFormat.JPEG, compress: 0.5 });
      return kayit.uri;
    } catch (e) {
      console.log("Dosya fotoğraf olarak açılamadı:", e?.message);
      Alert.alert("Fotoğraf Açılamadı", "Bu dosya bir fotoğraf olarak açılamadı. Başka bir dosya dene.");
      return null;
    }
  };

  // kaynak: "kamera" | "galeri" | "dosya". Üç yolda da kare fotoğraf aynı güvenli yoldan yüklenir.
  // Bir seçim sürerken yenisi başlatılmaz (art arda dokunuşta seçiciler birbirini engelliyordu).
  const profilFotografiSec = async (kaynak = "galeri") => {
    if (fotoSecimiSuruyor.current || onizlemeUri) return;
    fotoSecimiSuruyor.current = true;
    try {
      await profilFotografiSecIc(kaynak);
    } catch (e) {
      console.log("Fotoğraf seçilemedi:", e?.message);
      Alert.alert("Fotoğraf Seçilemedi", "Lütfen tekrar dene.");
    } finally {
      fotoSecimiSuruyor.current = false;
    }
  };

  const profilFotografiSecIc = async (kaynak) => {
    let secilenFotoUri = null;
    if (kaynak === "dosya") {
      // Dosyalar'ın kendi onay ekranı yok: fotoğraf önce önizlemede gösterilir, "Kullan" denirse yüklenir
      const uri = await dosyadanFotoAl();
      if (!uri) return;
      if (fotoGoruntuleyiciAcik) setOnizlemeUri(uri);
      // Görünüm kapalıyken seçici tamamen kapandıktan sonra açılır (iOS kapanan pencerenin üstüne açamaz)
      else setTimeout(() => setOnizlemeUri(uri), MENU_KAPANMA_MS);
      return;
    } else {
      const kameraMi = kaynak === "kamera";
      if (!(await izinIste(kameraMi))) return;
      const secenekler = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.3 };
      const result = kameraMi
        ? await ImagePicker.launchCameraAsync(secenekler)
        : await ImagePicker.launchImageLibraryAsync(secenekler);
      if (!result.canceled) secilenFotoUri = result.assets?.[0]?.uri || null;
    }
    if (secilenFotoUri) await profilFotografiYukle(secilenFotoUri);
  };

  const profilFotografiYukle = async (secilenFotoUri) => {
    setFotoYukleniyor(true);
    const baglanti = await internetVarMi();
    if (!baglanti) {
      setFotoYukleniyor(false);
      Alert.alert(
        "Bağlantı Hatası",
        "Lütfen internet bağlantınızı kontrol edip tekrar deneyin."
      );
      return;
    }

    // Yükleme başarısız olursa eski fotoğrafa dönülür (önceden fotoğraf ekrandan tamamen kayboluyordu)
    const oncekiFoto = profilFoto;
    setProfilFoto(secilenFotoUri);

    try {
      if (user) {
        const dosyaYolu = `profil_fotograflari/${user.uid}.jpg`;
        const encodedYol = encodeURIComponent(dosyaYolu);
        const bucket =
          storage.app.options.storageBucket ||
          "project-21-3e377.firebasestorage.app";
        const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodedYol}`;
        const token = await user.getIdToken();

        const uploadResult = await FileSystem.uploadAsync(url, secilenFotoUri, {
          httpMethod: "POST",
          headers: {
            "Content-Type": "image/jpeg",
            Authorization: `Bearer ${token}`,
            ...(await appCheckBasligi()),
          },
        });

        if (uploadResult.status !== 200) {
          throw new Error(`Yükleme başarısız! Sunucu kodu: ${uploadResult.status}`);
        }

        const data = JSON.parse(uploadResult.body);
        const erisimAnahtari = String(data?.downloadTokens || "").split(",")[0].trim();
        const indirmeURL = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedYol}?alt=media&token=${erisimAnahtari}`;
        if (!profilFotoGecerliMi(user.uid, indirmeURL)) {
          throw new Error("Beklenmeyen yükleme yanıtı.");
        }

        const kullaniciRef = doc(db, "kullanicilar", user.uid);
        await updateDoc(kullaniciRef, { profilFoto: indirmeURL });
        await AsyncStorage.setItem("profilFoto", indirmeURL);
        setProfilFoto(indirmeURL);
      }
    } catch (error) {
      console.log("Fotoğraf yükleme hatası:", error?.message);
      Alert.alert("Hata", "Fotoğraf yüklenirken sorun oluştu. Önceki fotoğrafın korunuyor.");
      setProfilFoto(oncekiFoto);
    } finally {
      setFotoYukleniyor(false);
    }
  };

  // Bildirim anahtarı: önce izin, sonra sunucuya kayıt; ikisi de başarılıysa anahtar değişir.
  // Başarısız olursa anahtar eski haline döner ve kullanıcıya söylenir (eskiden hata yutuluyordu).
  const bildirimAyariniDegistir = async (deger) => {
    if (!user || bildirimKaydediliyor) return;
    const onceki = bildirimAktif;
    setBildirimKaydediliyor(true);
    setBildirimAktif(deger);
    try {
      if (deger) {
        const izinVerildi = await registerForPushNotificationsAsync();
        if (!izinVerildi) {
          setBildirimAktif(onceki);
          Alert.alert(
            "İzin Gerekli",
            "Bildirim almak için telefon ayarlarından Mikro'ya bildirim izni vermelisin.",
            [
              { text: "Vazgeç", style: "cancel" },
              {
                text: "Ayarları Aç",
                onPress: () => Linking.openSettings().catch(() => {}),
              },
            ]
          );
          return;
        }
      }

      await updateDoc(doc(db, "kullanicilar", user.uid), {
        bildirimAktif: deger,
      });
      await AsyncStorage.setItem("bildirimAktif", JSON.stringify(deger));
    } catch (e) {
      console.log("Bildirim ayarı kaydedilemedi:", e?.code);
      setBildirimAktif(onceki);
      Alert.alert(
        "Ayar Kaydedilemedi",
        "İnternet bağlantını kontrol edip tekrar dene."
      );
      return;
    } finally {
      setBildirimKaydediliyor(false);
    }

    // Hatırlatıcılar yalnızca bu cihazda kurulur/kaldırılır; hata ayarın kendisini bozmaz
    try {
      await cancelAllNotifications();
      if (deger) {
        await setupSmartNotifications(rol);
        Alert.alert(
          "Bildirimler Açıldı",
          "Sana özel hatırlatıcılar kuruldu."
        );
      }
    } catch (e) {
      console.log("Hatırlatıcılar kurulamadı:", e?.message);
    }
  };

  const cikisYap = () => {
    Alert.alert(
      "Çıkış",
      "Hesabınızdan çıkış yapmak istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Evet",
          onPress: async () => {
            try {
              // Bildirimler, çözüm önbelleği, profil bilgileri ve Google oturumu temizlenir (utils/oturum.js)
              await oturumuKapat();
            } catch (error) {
              console.log("Çıkış hatası:", error);
            }
          },
        },
      ]
    );
  };

  // Aboneliği mağazanın kendi ayar sayfasından yönetir/iptal ederiz
  const abonelikYonet = () => {
    const url =
      Platform.OS === "ios"
        ? "https://apps.apple.com/account/subscriptions"
        : "https://play.google.com/store/account/subscriptions";
    Linking.openURL(url).catch(() =>
      Alert.alert("Hata", "Abonelik ayarları açılamadı.")
    );
  };

  // Bağlantı kodu ve bağlı veliler: ekranda sürekli açık durmaz, pencerede gösterilir (kaldırma, kodu yenileme)
  const baglantiKodunuGoster = () => {
    if (!baglantiKodu) return;
    setVeliPenceresiGorunur(true);
  };

  const bizeUlasin = () => {
    Linking.openURL(
      "mailto:destek@mikroai.com?subject=Mikro AI Destek Talebi&body=Merhaba, şöyle bir konu hakkında yardıma ihtiyacım var: "
    ).catch(() => {
      Alert.alert(
        "Hata",
        "Telefonunuzda kurulu bir mail uygulaması bulunamadı."
      );
    });
  };

  const uygulamayiPaylas = async () => {
    try {
      await Share.share({
        message:
          "Mikro AI ile çözemediğim soru kalmadı! 🚀 Yapay zeka destekli bu harika eğitim uygulaması çok yakında App Store ve Google Play'de. Hazır ol!",
      });
    } catch (error) {
      console.log("Paylaşım hatası:", error);
    }
  };

  const guvenliHesabiSil = async () => {
    if (silOnayMetni !== ONAY_METNI) {
      Alert.alert("Hata", "Lütfen kutucuğa büyük harflerle SİL yazın.");
      return;
    }
    if (!user) return;

    if (girisYonteminiBul(user) === "password" && !silSifre) {
      Alert.alert(
        "Şifre Gerekli",
        "Güvenliğiniz için hesap şifrenizi girmeniz gerekiyor."
      );
      return;
    }

    setHesapSiliniyor(true);
    silmeSurecte.current = true;
    try {
      await hesabiTamamenSil(user, silSifre);
      await cancelAllNotifications();
    } catch (error) {
      silmeSurecte.current = false;
      setHesapSiliniyor(false);

      if (error?.code === SILME_IPTAL) return;

      const kod = error?.code || "";
      let mesaj =
        "Hesap silme tamamlanamadı. İnternet bağlantınızı kontrol edip tekrar deneyin. İşlem tekrarlandığında kaldığı yerden devam eder.";

      if (
        kod === "auth/wrong-password" ||
        kod === "auth/invalid-credential" ||
        kod === "auth/invalid-login-credentials"
      ) {
        mesaj = "Şifre yanlış. Lütfen tekrar deneyin.";
      } else if (kod === "auth/user-mismatch") {
        mesaj =
          girisYonteminiBul(user) === "apple"
            ? "Farklı bir Apple hesabıyla doğrulama yapıldı. Bu hesaba ait Apple kimliğini kullanın."
            : "Farklı bir Google hesabı seçtiniz. Hesabınızla aynı hesabı seçin.";
      } else if (error?.asama === "apple") {
        mesaj =
          "Apple bağlantısı iptal edilemediği için hesap silinmedi; hiçbir veriniz silinmedi. Lütfen biraz sonra tekrar deneyin.";
      } else if (kod === "auth/too-many-requests") {
        mesaj = "Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.";
      } else if (kod === "auth/network-request-failed") {
        mesaj = "İnternet bağlantısı yok. Bağlantınızı kontrol edip tekrar deneyin.";
      }

      console.log("Hesap silme hatası:", kod, error?.message);
      Alert.alert("Hesap Silinemedi", mesaj);
    }
  };

  const htmlSablonUret = (baslik, altBaslik, icerikHtml) =>
    yasalHtmlSablonu(isGercektenKaranlik, baslik, altBaslik, icerikHtml);

  const acNasilKullanilir = () => {
    const icerik = `
      <div class="card">
        <p>Mikro AI, çözemediğin soruları saniyeler içinde analiz eden ve sana özel adım adım çözüm yolları üreten akıllı eğitim asistanındır.</p>
      </div>
      
      <h2>📸 1. Soruyu Gönder</h2>
      <ul>
        <li>Ana ekrandaki <span class="highlight">Kamerayı Aç</span> butonunu kullan.</li>
        <li>Soruyu net bir şekilde kadraja al ve fotoğrafını çek.</li>
        <li>Karmaşıklığı önlemek için ekranda sadece <span class="highlight">tek bir soru</span> olmasına dikkat et.</li>
      </ul>

      <h2>🧠 2. Analiz ve Çözüm</h2>
      <ul>
        <li>Yapay zeka sorunun konusunu ve çözüm mantığını anında çıkarır.</li>
        <li>Kullanılan formülleri ve mantıksal adımları detaylıca oku.</li>
        <li>Çözümü cihazına indirmek için <span class="highlight">Çözüm Kartını İndir</span> butonuna dokun.</li>
      </ul>

      <h2>🎯 3. Benzer Sorularla Pekiştir</h2>
      <ul>
        <li>Çözümün altındaki zorluk seviyelerini seçerek benzer sorular üret.</li>
        <li>Pratik testleri çözerek konuyu tam olarak öğrendiğinden emin ol.</li>
      </ul>

      <h2>📊 4. Hata Defteri Yönetimi</h2>
      <ul>
        <li>Tüm geçmişin otomatik olarak arşivlenir.</li>
        <li>PDF oluşturma özelliği ile kendine özel <span class="highlight">çalışma fasikülleri</span> hazırla.</li>
      </ul>
    `;
    setWebViewBaslik("Nasıl Kullanılır?");
    setWebViewHtml(
      htmlSablonUret("Kullanım Rehberi", "Öğrenci Portalı", icerik)
    );
    setWebViewModalGorunur(true);
  };

  const acKullanimKosullari = () => {
    setWebViewBaslik("Kullanım Koşulları");
    setWebViewHtml(
      htmlSablonUret("Yasal Şartlar", "Hukuki Metin", KULLANIM_KOSULLARI_ICERIK)
    );
    setWebViewModalGorunur(true);
  };

  // Sürüm uygulamanın kendisinden okunur (elle yazılan numara güncellemelerde unutuluyordu)
  const uygulamaSurumu = (() => {
    const surum = Application.nativeApplicationVersion;
    const derleme = Application.nativeBuildVersion;
    if (!surum) return "Sürüm bilgisi yok";
    return derleme ? `Sürüm ${surum} (${derleme})` : `Sürüm ${surum}`;
  })();

  const getAvatarHarf = () =>
    gorunenIsim(adSoyad, user?.email, rolEtiketi(rol))
      .charAt(0)
      .toLocaleUpperCase("tr-TR");

  // Puan yalnızca azalmayan sayılardan gelir (soru ve okunan çözüm); seviye düşmez. Bkz. utils/seviye.js
  const seviye = seviyeBilgisi(puanHesapla({ toplamSoru, okunanCozum }));

  const kazanilanIdler = kazanilanRozetIdleri({
    toplamSoru,
    seriGunu,
    adSoyad,
    sinifSecildi: SINIFLAR.includes(seciliSinif),
    okunanCozum,
    farkliDers,
    seviye: seviye.seviye,
  });
  const kazanilanAnahtar = kazanilanIdler.join(",");

  // Kalıcı kayıt ile anlık koşul birleşir: bir kez kazanılan rozet seri bozulsa da kaybolmaz
  const rozetler = ROZETLER.map((r) => ({
    ...r,
    kazanildi:
      kazanilanIdler.includes(r.id) || (rozetKaydi || []).includes(r.id),
  }));
  const kazanilanRozetSayisi = rozetler.filter((r) => r.kazanildi).length;

  // Yeni kazanılan rozetler Firestore'a yazılır ve kullanıcıya bildirilir.
  // Belgede hiç rozet alanı yokken (ilk çalıştırma) mevcut rozetler sessizce kaydedilir.
  useEffect(() => {
    if (
      rol !== "ogrenci" ||
      !user ||
      !isFocused ||
      istatistikYukleniyor ||
      rozetKaydi === undefined
    )
      return;

    const kayitli = rozetKaydi || [];
    const yeniler = kazanilanIdler.filter(
      (id) => !kayitli.includes(id) && !rozetIslenen.current.has(id)
    );
    if (yeniler.length === 0) return;

    yeniler.forEach((id) => rozetIslenen.current.add(id));
    const bildirimGerekli = rozetKaydi !== null;

    updateDoc(doc(db, "kullanicilar", user.uid), {
      rozetler: arrayUnion(...yeniler),
    })
      .then(() => {
        if (!bildirimGerekli) return;
        const kazanilanlar = ROZETLER.filter((r) => yeniler.includes(r.id));
        if (kazanilanlar.length > 0) {
          setKutlamaSirasi((sira) => [...sira, kazanilanlar]);
        }
      })
      .catch((hata) => {
        // Yazılamadıysa bir sonraki açılışta yeniden denenir
        yeniler.forEach((id) => rozetIslenen.current.delete(id));
        console.log("Rozet kaydedilemedi:", hata?.code);
      });
  }, [
    rol,
    user,
    isFocused,
    istatistikYukleniyor,
    rozetKaydi,
    kazanilanAnahtar,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: tema.arkaplan }]}>
      <RozetKutlama
        rozetler={isFocused ? kutlamaSirasi[0] : null}
        bitti={() => setKutlamaSirasi((sira) => sira.slice(1))}
      />
      {isFocused && (
        <StatusBar
          barStyle={isGercektenKaranlik ? "light-content" : "dark-content"}
          backgroundColor="transparent"
          translucent={true}
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: altMenuBoslugu }}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: tema.anaButon,
              paddingTop: insets.top + 12,
              paddingBottom: 24,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={fotoAksiyonMenusu}
            disabled={fotoYukleniyor}
            accessibilityRole="button"
            accessibilityLabel={profilFoto ? "Profil fotoğrafını büyüt" : "Profil fotoğrafı ekle"}
          >
            {profilFoto ? (
              <Image source={{ uri: profilFoto }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{getAvatarHarf()}</Text>
            )}
            <View
              style={[
                styles.kameraIkonKutu,
                { backgroundColor: tema.anaButon },
              ]}
            >
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
            {fotoYukleniyor && (
              <View
                style={styles.avatarYukleniyor}
                accessibilityLabel="Profil fotoğrafı yükleniyor"
                accessibilityLiveRegion="polite"
              >
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.isimDuzenlemeKutu}>
            {isimDuzenleniyor ? (
              <View style={styles.isimInputKapsayici}>
                <TextInput
                  style={styles.isimInput}
                  value={adSoyad}
                  onChangeText={setAdSoyad}
                  autoFocus={true}
                  placeholder="İsminiz"
                  maxLength={AD_SOYAD_EN_FAZLA}
                  autoCorrect={false}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  onSubmitEditing={isimKaydet}
                  returnKeyType="done"
                  selectionColor="#fff"
                />
                <TouchableOpacity
                  onPress={isimKaydet}
                  style={styles.isimOnayButon}
                >
                  <Ionicons name="checkmark-circle" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 4,
                }}
                onPress={isimDuzenlemeyiAc}
                activeOpacity={0.7}
              >
                <Text style={styles.userName}>
                  {gorunenIsim(
                    adSoyad,
                    user?.email,
                    rolEtiketi(rol)
                  )}
                </Text>
                <View style={{ marginLeft: 8 }}>
                  <Ionicons
                    name="pencil"
                    size={22}
                    color="rgba(255,255,255,0.9)"
                  />
                </View>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.userEmail}>{gorunenEposta(user?.email)}</Text>

          {rol === "ogrenci" && (
            <View
              style={{
                alignItems: "center",
                width: "100%",
                paddingHorizontal: 40,
                marginTop: 10,
              }}
            >
              <View style={styles.seviyeVeXpKapsayici}>
                <Text style={styles.seviyeYazisi}>
                  Seviye {seviye.seviye}
                  <Text style={styles.seviyeMaksYazisi}> / {EN_YUKSEK_SEVIYE}</Text>
                </Text>
                <View style={styles.xpKutusu}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.xpYazisi}>
                    {seviye.puan.toLocaleString("tr-TR")} XP
                  </Text>
                </View>
              </View>
              <View
                style={styles.xpBarArkaplan}
                accessibilityRole="progressbar"
                accessibilityLabel={`Seviye ${seviye.seviye}`}
                accessibilityValue={{ min: 0, max: 100, now: seviye.yuzde }}
              >
                <View
                  style={[styles.xpBarDolu, { width: `${seviye.yuzde}%` }]}
                />
              </View>
              <Text style={styles.xpKalanYazi}>
                {seviye.enYuksekte
                  ? "En yüksek seviyedesin! 🎉"
                  : `Sonraki seviyeye ${seviye.kalanPuan.toLocaleString("tr-TR")} XP kaldı`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {rol === "ogrenci" && (
            <>
              <Text style={[styles.sectionTitle, { color: tema.metin }]}>
                🏆 Rozetler ({kazanilanRozetSayisi}/{rozetler.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 25 }}
              >
                {rozetler.map((rozet) => (
                  <View
                    key={rozet.id}
                    style={[
                      styles.rozetKutu,
                      {
                        backgroundColor: rozet.kazanildi
                          ? isGercektenKaranlik
                            ? "#1E293B"
                            : "#F0F9FF"
                          : tema.kutuArkaplan,
                        borderColor: rozet.kazanildi
                          ? tema.anaButon
                          : tema.kutuCerceve,
                        opacity: rozet.kazanildi ? 1 : 0.5,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>
                      {rozet.ikon}
                    </Text>
                    <Text style={[styles.rozetBaslik, { color: tema.metin }]}>
                      {rozet.baslik}
                    </Text>
                    <Text
                      style={[
                        styles.rozetAciklama,
                        { color: tema.ikincilMetin },
                      ]}
                    >
                      {rozet.aciklama}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          {rol === "ogrenci" && (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: tema.metin, marginTop: 5 },
                ]}
              >
                Gelişim Durumum
              </Text>
              <View
                style={[
                  styles.streakKutu,
                  {
                    backgroundColor: tema.kutuArkaplan,
                    borderColor: tema.anaButon,
                  },
                ]}
              >
                <Text style={styles.streakIkon}>🔥</Text>
                <View>
                  <Text style={[styles.streakBaslik, { color: tema.metin }]}>
                    {seriGunu} Günlük Seri
                  </Text>
                  <Text
                    style={[styles.streakAltYazi, { color: tema.ikincilMetin }]}
                  >
                    Her gün uğrayarak serini koru!
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.kutu,
                  {
                    backgroundColor: tema.kutuArkaplan,
                    borderColor: tema.kutuCerceve,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.kutuBaslik,
                    { color: tema.metin, marginBottom: 15 },
                  ]}
                >
                  📊 Soru Çözüm İstatistikleri
                </Text>

                {istatistikYukleniyor ? (
                  <ActivityIndicator size="small" color={tema.anaButon} />
                ) : (
                  <View>
                    <Text
                      style={{
                        color: tema.ikincilMetin,
                        marginBottom: 15,
                        fontSize: 14,
                      }}
                    >
                      Toplam Çözülen Soru:{" "}
                      <Text
                        style={{
                          color: tema.metin,
                          fontWeight: "bold",
                          fontSize: 16,
                        }}
                      >
                        {toplamSoru}
                      </Text>
                    </Text>

                    {dersIstatistikleri.length > 0 ? (
                      dersIstatistikleri.map((ist, index) => (
                        <View key={index} style={{ marginBottom: 12 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              marginBottom: 5,
                            }}
                          >
                            <Text
                              style={{
                                color: tema.metin,
                                fontSize: 13,
                                fontWeight: "500",
                              }}
                            >
                              {ist.ders}
                            </Text>
                            <Text
                              style={{
                                color: tema.anaButon,
                                fontSize: 13,
                                fontWeight: "bold",
                              }}
                            >
                              %{ist.yuzde}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.barArkaplan,
                              { backgroundColor: tema.kutuCerceve, height: 6 },
                            ]}
                          >
                            <View
                              style={[
                                styles.barDolu,
                                {
                                  backgroundColor: tema.anaButon,
                                  width: `${ist.yuzde}%`,
                                },
                              ]}
                            />
                          </View>
                        </View>
                      ))
                    ) : (
                      <Text
                        style={{
                          color: tema.ikincilMetin,
                          fontSize: 13,
                          fontStyle: "italic",
                        }}
                      >
                        Henüz yeterli istatistik oluşmadı. Soru çözmeye başla!
                      </Text>
                    )}
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.kutu,
                  {
                    backgroundColor: tema.kutuArkaplan,
                    borderColor: tema.kutuCerceve,
                  },
                ]}
              >
                <View style={styles.kutuUstBaslik}>
                  <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                    Günlük Soru Kotası
                  </Text>
                  <Text style={[styles.kotaSayi, { color: tema.anaButon }]}>
                    {kota ? `${kota.kalan} / ${kota.sinir}` : "—"}
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
                      {
                        backgroundColor: tema.anaButon,
                        width: `${
                          kota && kota.sinir > 0
                            ? Math.round((kota.kalan / kota.sinir) * 100)
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {rol === "ogrenci" && user?.uid && (
                <KurumKarti uid={user.uid} tema={tema} />
              )}

              {rol === "ogrenci" && (
                <View
                  style={[
                    styles.kutu,
                    {
                      backgroundColor: tema.kutuArkaplan,
                      borderColor: tema.kutuCerceve,
                    },
                  ]}
                >
                  <View style={styles.kutuUstBaslik}>
                    <Text style={[styles.kutuBaslik, { color: tema.metin }]}>
                      Abonelik
                    </Text>
                    <View
                      style={[
                        styles.abonelikRozet,
                        {
                          backgroundColor: premiumAktif
                            ? "rgba(245, 197, 24, 0.16)"
                            : tema.kutuCerceve,
                        },
                      ]}
                    >
                      {premiumAktif && (
                        <Ionicons
                          name="star"
                          size={12}
                          color={tema.premiumAltinMetin}
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text
                        style={[
                          styles.abonelikRozetYazi,
                          {
                            color: premiumAktif
                              ? tema.premiumAltinMetin
                              : tema.ikincilMetin,
                          },
                        ]}
                      >
                        {premiumAktif ? "Premium" : "Ücretsiz"}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      color: tema.ikincilMetin,
                      fontSize: 13,
                      lineHeight: 19,
                      marginBottom: 14,
                    }}
                  >
                    {abonelikAciklamasi(premiumAktif, kota)}
                  </Text>

                  <TouchableOpacity
                    onPress={
                      premiumAktif ? abonelikYonet : () => premiumAc("profil")
                    }
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    style={[
                      styles.abonelikButon,
                      { backgroundColor: tema.premiumAltin },
                    ]}
                  >
                    <Text
                      style={{
                        color: "#111111",
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      {premiumAktif ? "Aboneliği Yönet" : "Premium'a Geç"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                onPress={() => setSinifModalGorunur(true)}
                style={[
                  styles.menuItem,
                  { backgroundColor: tema.kutuArkaplan },
                ]}
              >
                <Ionicons
                  name="school-outline"
                  size={22}
                  color={tema.anaButon}
                  style={styles.menuIcon}
                />
                <View style={styles.menuMetinAlan}>
                  <Text style={[styles.menuBaslik, { color: tema.metin }]}>
                    Sınıf Bilgim
                  </Text>
                  <Text style={[styles.menuAlt, { color: tema.ikincilMetin }]}>
                    {seciliSinif}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={tema.ikincilMetin}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={baglantiKodunuGoster}
                accessibilityRole="button"
                accessibilityHint="Kodu, bağlı velileri ve kodu yenileme seçeneğini gösterir"
                style={[
                  styles.menuItem,
                  { backgroundColor: tema.kutuArkaplan },
                ]}
              >
                <Ionicons
                  name="link-outline"
                  size={22}
                  color={tema.anaButon}
                  style={styles.menuIcon}
                />
                <View style={styles.menuMetinAlan}>
                  <Text style={[styles.menuBaslik, { color: tema.metin }]}>
                    Veli Bağlantısı
                  </Text>
                  <Text style={[styles.menuAlt, { color: tema.ikincilMetin }]}>
                    {baglantiKodu ? "Kodun ve bağlı veliler" : "Hazırlanıyor..."}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={tema.ikincilMetin}
                />
              </TouchableOpacity>
            </>
          )}

          {/* Platform yönetimi: rolden bağımsız; yalnızca yetkili hesapta görünür (sunucu doğrular) */}
          {user?.uid && (
            <View style={{ marginTop: 20 }}>
              <PlatformKarti uid={user.uid} tema={tema} />
            </View>
          )}

          <Text
            style={[styles.sectionTitle, { color: tema.metin, marginTop: 25 }]}
          >
            Tercihler
          </Text>

          <TouchableOpacity
            onPress={() => setTemaModalGorunur(true)}
            style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Ionicons
              name="color-palette-outline"
              size={22}
              color={tema.anaButon}
              style={styles.menuIcon}
            />
            <View style={styles.menuMetinAlan}>
              <Text style={[styles.menuBaslik, { color: tema.metin }]}>
                Görünüm Modu
              </Text>
              <Text style={[styles.menuAlt, { color: tema.ikincilMetin }]}>
                {temaModu === "light"
                  ? "Açık Mod"
                  : temaModu === "dark"
                  ? "Koyu Mod"
                  : "Sistem Ayarı"}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={tema.ikincilMetin}
            />
          </TouchableOpacity>

          <View
            style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color={tema.anaButon}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuBaslik, { color: tema.metin, flex: 1 }]}>
              Bildirimleri Al
            </Text>
            <Switch
              value={bildirimAktif}
              onValueChange={bildirimAyariniDegistir}
              disabled={bildirimKaydediliyor}
              accessibilityLabel="Bildirimleri al"
              trackColor={{ false: tema.kutuCerceve, true: tema.anaButon }}
            />
          </View>

          <Text
            style={[styles.sectionTitle, { color: tema.metin, marginTop: 25 }]}
          >
            Destek ve Bilgi
          </Text>

          <TouchableOpacity
            onPress={uygulamayiPaylas}
            style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Ionicons
              name="share-social-outline"
              size={22}
              color={tema.metin}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuBaslik, { color: tema.metin }]}>
              Uygulamayı Paylaş
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={bizeUlasin}
            style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Ionicons
              name="mail-outline"
              size={22}
              color={tema.metin}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuBaslik, { color: tema.metin }]}>
              Bize Ulaşın / Hata Bildir
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={acNasilKullanilir}
            style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Ionicons
              name="help-circle-outline"
              size={22}
              color={tema.metin}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuBaslik, { color: tema.metin }]}>
              Nasıl Kullanılır?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={acKullanimKosullari}
            style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={tema.metin}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuBaslik, { color: tema.metin }]}>
              Kullanım Koşulları
            </Text>
          </TouchableOpacity>

          <View style={{ alignItems: "center", marginTop: 15 }}>
            <Text style={{ color: tema.ikincilMetin, fontSize: 13 }}>
              {uygulamaSurumu}
            </Text>
          </View>

          <Text
            style={[styles.sectionTitle, { color: tema.metin, marginTop: 30 }]}
          >
            Hesap Ayarları
          </Text>
          <TouchableOpacity
            onPress={cikisYap}
            style={[styles.menuItem, { backgroundColor: tema.kutuArkaplan }]}
          >
            <Ionicons
              name="log-out-outline"
              size={22}
              color={tema.metin}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuBaslik, { color: tema.metin }]}>
              Oturumu Kapat
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setHesapSilModalGorunur(true)}
            style={[
              styles.menuItem,
              {
                backgroundColor: tema.kutuArkaplan,
                borderColor: tema.hataKirmizi,
                borderWidth: 1,
              },
            ]}
          >
            <Ionicons
              name="trash-outline"
              size={22}
              color={tema.hataKirmizi}
              style={styles.menuIcon}
            />
            <Text style={[styles.menuBaslik, { color: tema.hataKirmizi }]}>
              Hesabımı Sil
            </Text>
          </TouchableOpacity>
        </View>

        <SinifSecici
          gorunur={sinifModalGorunur}
          kapat={() => setSinifModalGorunur(false)}
          siniflar={SINIFLAR}
          seciliSinif={seciliSinif}
          sec={sinifKaydet}
        />

        <GorunumSecici
          gorunur={temaModalGorunur}
          kapat={() => setTemaModalGorunur(false)}
        />

        <Modal
          visible={webViewModalGorunur}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setWebViewModalGorunur(false)}
        >
          <View style={styles.webViewModalOverlay}>
            <View
              style={[
                styles.webViewContainer,
                { backgroundColor: tema.arkaplan },
              ]}
            >
              <View
                style={[
                  styles.webViewHeader,
                  { borderBottomColor: tema.kutuCerceve },
                ]}
              >
                <Text
                  style={[styles.webViewHeaderBaslik, { color: tema.metin }]}
                >
                  {webViewBaslik}
                </Text>
                <TouchableOpacity
                  onPress={() => setWebViewModalGorunur(false)}
                  style={styles.webViewKapatButon}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="close-circle"
                    size={32}
                    color={tema.ikincilMetin}
                  />
                </TouchableOpacity>
              </View>
              <WebView
                originWhitelist={["*"]}
                source={{ html: webViewHtml }}
                style={{ flex: 1, backgroundColor: tema.arkaplan }}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </View>
        </Modal>

        <ProfilFotoGoruntuleyici
          gorunur={(fotoGoruntuleyiciAcik && !!profilFoto) || !!onizlemeUri}
          foto={profilFoto}
          onizleme={onizlemeUri}
          onizlemeOnayla={onizlemeOnayla}
          onizlemeIptal={onizlemeIptal}
          kapat={() => setFotoGoruntuleyiciAcik(false)}
          degistir={goruntuleyicidenDegistir}
          kaldir={goruntuleyicidenKaldir}
          yukleniyor={fotoYukleniyor}
        />

        <VeliBaglantiPenceresi
          gorunur={veliPenceresiGorunur}
          kapat={() => setVeliPenceresiGorunur(false)}
          kod={/^[A-Z0-9]{6}$/.test(baglantiKodu) ? baglantiKodu : null}
          onKodYenilendi={setBaglantiKodu}
        />

        <HesapSilPenceresi
          gorunur={hesapSilModalGorunur}
          kapat={() => {
            if (hesapSiliniyor) return;
            setHesapSilModalGorunur(false);
            setSilOnayMetni("");
            setSilSifre("");
          }}
          yontem={girisYonteminiBul(user)}
          sifre={silSifre}
          setSifre={setSilSifre}
          onay={silOnayMetni}
          setOnay={setSilOnayMetni}
          siliniyor={hesapSiliniyor}
          sil={guvenliHesabiSil}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
  },
  avatarYukleniyor: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { fontSize: 34, color: "#fff", fontWeight: "bold" },
  kameraIkonKutu: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  isimDuzenlemeKutu: {
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  isimInputKapsayici: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  isimInput: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
    minWidth: 120,
    maxWidth: 200,
    textAlign: "center",
    padding: 0,
    margin: 0,
  },
  isimOnayButon: {
    marginLeft: 10,
  },

  userName: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  userEmail: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 10,
  },

  seviyeVeXpKapsayici: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  seviyeYazisi: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    marginRight: 12,
  },
  seviyeMaksYazisi: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    fontSize: 13,
  },
  xpKutusu: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  xpYazisi: { color: "#fff", fontWeight: "bold", marginLeft: 5, fontSize: 14 },

  xpBarArkaplan: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  xpBarDolu: {
    height: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 3,
  },
  xpKalanYazi: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "500",
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    letterSpacing: 0.3,
  },

  rozetKutu: {
    width: 105,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    marginRight: 12,
  },
  rozetBaslik: {
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 5,
  },
  rozetAciklama: { fontSize: 10, textAlign: "center", marginTop: 2 },

  streakKutu: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  streakIkon: { fontSize: 32, marginRight: 15 },
  streakBaslik: { fontSize: 17, fontWeight: "bold" },
  streakAltYazi: { fontSize: 12, marginTop: 2 },

  kutu: { padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1 },
  kutuUstBaslik: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  kutuBaslik: { fontSize: 15, fontWeight: "bold" },
  kotaSayi: { fontSize: 16, fontWeight: "bold" },
  barArkaplan: {
    height: 8,
    borderRadius: 4,
    width: "100%",
    overflow: "hidden",
  },
  barDolu: { height: "100%", borderRadius: 4 },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  menuIcon: { marginRight: 15 },
  menuMetinAlan: { flex: 1 },
  menuBaslik: { fontSize: 15, fontWeight: "600" },
  menuAlt: { fontSize: 12, marginTop: 3 },


  abonelikRozet: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  abonelikRozetYazi: { fontSize: 12, fontWeight: "700" },
  abonelikButon: {
    height: 46,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },


  webViewModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  webViewContainer: {
    width: "100%",
    height: "90%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
  webViewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  webViewHeaderBaslik: {
    fontSize: 18,
    fontWeight: "bold",
  },
  webViewKapatButon: {
    padding: 2,
  },
});
