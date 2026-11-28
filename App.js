import React, { useState, useEffect, useRef } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { auth, db } from "./firebaseConfig";
import {
  onAuthStateChanged,
  signOut,
  sendEmailVerification,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider, useTheme } from "./ThemeContext";

import {
  sendQuestionSolvedNotification,
  registerForPushNotificationsAsync,
  setupSmartNotifications,
} from "./utils/notificationManager";

import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import HistoryScreen from "./screens/HistoryScreen";
import ParentDashboard from "./screens/ParentDashboard";
import OnboardingScreen from "./screens/OnboardingScreen";
import YasOnayScreen from "./screens/YasOnayScreen";
import YoneticiAnaEkran from "./screens/YoneticiAnaEkran";
import OgrenciListesiEkrani from "./screens/OgrenciListesiEkrani";
import GenelBakisEkrani from "./screens/GenelBakisEkrani";
import useDuyuruKutusu from "./utils/useDuyuruKutusu";
import { DuyuruContext } from "./utils/DuyuruContext";
import AltMenu from "./screens/AltMenu";
import { rozetDegeri, sekmeEtiketi } from "./utils/sekmeAyarlari";
import { yoneticiOl, kurumHataMesaji } from "./utils/kurumIstemci";
import { PremiumProvider } from "./PremiumContext";
import { magazaKullanicisiniAyarla, magazaGirisiniUnut } from "./utils/magaza";
import { dersiTamamla, digerDersiDuzelt } from "./utils/dersTamamla";
import {
  dersBul,
  dersBilgisiVar,
  yeniCozumMu,
  digerYerineDers,
} from "./utils/ders";
import ErrorBoundary from "./ErrorBoundary";
import { adSoyadTemizle } from "./utils/profilDogrulama";
import { tanitimGosterilsinMi } from "./utils/tanitim";
import SeriKutlama from "./screens/SeriKutlama";
import { onayGecerliMi } from "./utils/onayMetni";
import ProfilTamamla from "./screens/ProfilTamamla";
import {
  BEKLEYEN_PROFIL_ANAHTARI,
  bekleyenProfilCoz,
  yeniProfilBelgesi,
  rolCoz,
  profilEksikleri,
  yoneticiDenemesiSonucu,
} from "./utils/profilKurallari";

const Tab = createBottomTabNavigator();

// Tüm rozetler (okunmamış sayısı) aynı görünümde
const ROZET_STILI = {
  backgroundColor: "#EF4444",
  color: "#FFFFFF",
  fontSize: 12,
  fontWeight: "bold",
};

// Yönetici hesabının her girişinde sunucudan yetki yenilenir. Davet yoksa ya da e-posta doğrulanmamışsa
// giriş reddedilir. Dönen değer: { basarili: true } ya da { basarili: false, baslik, mesaj }
const yoneticiYetkisiAl = async (kullanici) => {
  try {
    await yoneticiOl();
    // Yeni yetki kimlik belirtecine ancak yenilenince yazılır
    await kullanici.getIdToken(true);
    return { basarili: true };
  } catch (e) {
    console.log("Yönetici yetkisi alınamadı:", e?.code, e?.message);
    if (e?.message === "eposta-dogrulanmadi") {
      let ek = "";
      try {
        await sendEmailVerification(kullanici);
        ek =
          " Adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra tekrar giriş yap.";
      } catch (gonderimHatasi) {
        console.log("Doğrulama e-postası gönderilemedi:", gonderimHatasi?.code);
        ek = " Doğrulama bağlantısı gönderilemedi, biraz sonra tekrar dene.";
      }
      return {
        basarili: false,
        baslik: "E-posta Doğrulanmadı",
        mesaj: kurumHataMesaji(e) + ek,
      };
    }
    return {
      basarili: false,
      baslik: "Yönetici Girişi Yapılamadı",
      mesaj: kurumHataMesaji(e),
    };
  }
};

function MainApp() {
  const [kullanici, setKullanici] = useState(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  // Rol profil okunup doğrulanana kadar BOŞ: rol belirlenmeden öğrenci/veli/yönetici işleri başlamaz
  const [kullaniciRolu, setKullaniciRolu] = useState(null);
  // "Profilini Tamamla" gerekiyorsa: { mod: "yeni" | "tamamla", rolSabit?, onerilenAd?, mevcutSinif? }
  const [profilGerekli, setProfilGerekli] = useState(null);
  const [gosterOnboarding, setGosterOnboarding] = useState(false);
  const [onayGerekli, setOnayGerekli] = useState(false);
  // Rol uyuşmazlığıyla giriş reddedilince giriş ekranının yükleniyor durumunu sıfırlar
  const [girisReddi, setGirisReddi] = useState(0);
  const [okunmamisSayisi, setOkunmamisSayisi] = useState(0);
  // n8n bir soruyu birden çok kez güncelleyebilir; her soru için yalnızca bir kez bildirim gönderilir
  const bildirilenSorular = useRef(new Set());
  const [premiumMu, setPremiumMu] = useState(false);
  // Premium'un kaynağı (dershane / abonelik / elle): yalnızca Hesabım'daki görünüm için; sunucu yazar
  const [premiumKaynaklari, setPremiumKaynaklari] = useState(null);
  // Öğrencinin dershane duyuruları: tek dinleyici, rozet ve liste için paylaşılır
  const duyuruKutusu = useDuyuruKutusu(
    kullaniciRolu === "ogrenci" && kullanici ? kullanici.uid : null
  );

  const { tema } = useTheme();

  useEffect(() => {
    const abonelik = onAuthStateChanged(auth, async (aktifKullanici) => {
      if (aktifKullanici) {
        try {
          // Rol belirleme (28 Kasım): giriş ekranında rol seçilmez; rol yalnızca profilden (istemci yalnızca ilk
          // oluşturmada öğrenci/veli yazabilir) ya da sunucudan (yönetici: doğrulanmış e-posta + davet) gelir.
          const userDocRef = doc(db, "kullanicilar", aktifKullanici.uid);
          let userDoc = await getDoc(userDocRef);
          // Apple ile ilk girişte Apple'ın verdiği ad (yalnızca bir kez gelir); kullanıldıktan sonra silinir
          const bekleyenAdSoyad = adSoyadTemizle(await AsyncStorage.getItem("bekleyenAdSoyad"));
          // E-postayla kayıt formunun bilgileri (yalnızca aynı e-posta + kısa süre; utils/profilKurallari.js)
          const bekleyenMetin = await AsyncStorage.getItem(BEKLEYEN_PROFIL_ANAHTARI);
          await AsyncStorage.multiRemove(["bekleyenAdSoyad", BEKLEYEN_PROFIL_ANAHTARI, "hedefRol"]);
          const onerilenAd = bekleyenAdSoyad || adSoyadTemizle(aktifKullanici.displayName);

          // Girişi reddedip oturumu kapatır; giriş ekranının yükleniyor durumunu sıfırlar
          const girisiReddet = async (baslik, mesaj) => {
            await signOut(auth);
            Alert.alert(baslik, mesaj);
            setKullanici(null);
            setKullaniciRolu(null);
            setProfilGerekli(null);
            setGirisReddi((n) => n + 1);
            setYukleniyor(false);
          };

          let yoneticiYetkisiYeniAlindi = false;
          let yeniOlusturuldu = false;

          if (!userDoc.exists()) {
            // 1) Yönetici daveti var mı? Yalnızca doğrulanmış e-postada sorulur (sunucu da doğrular). Davet yoksa
            //    normal kullanıcı akışı; başka her hata (lisans geçersiz, davet kullanılmış, ağ...) girişi durdurur.
            if (aktifKullanici.emailVerified === true) {
              let hata = null;
              try {
                await yoneticiOl();
              } catch (e) {
                hata = e;
              }
              const sonuc = yoneticiDenemesiSonucu(hata);
              if (sonuc === "yonetici") {
                await aktifKullanici.getIdToken(true);
                yoneticiYetkisiYeniAlindi = true;
                userDoc = await getDoc(userDocRef);
              } else if (sonuc === "dur") {
                console.log("Yönetici kontrolü:", hata?.code, hata?.message);
                await girisiReddet("Giriş Yapılamadı", kurumHataMesaji(hata));
                return;
              }
            }
          }

          if (!userDoc.exists()) {
            // 2) E-postayla kayıt: formdaki bilgilerle profil oluşturulur
            const bekleyen = bekleyenProfilCoz(bekleyenMetin, aktifKullanici.email);
            if (bekleyen) {
              await setDoc(userDocRef, yeniProfilBelgesi({ profil: bekleyen, eposta: aktifKullanici.email }));
              userDoc = await getDoc(userDocRef);
              yeniOlusturuldu = true;
            } else {
              // 3) Google/Apple ile ilk giriş: "Profilini Tamamla" (tamamlanmadan uygulamaya girilmez)
              setKullaniciRolu(null);
              setPremiumMu(false);
              setPremiumKaynaklari(null);
              setOnayGerekli(true);
              setGosterOnboarding(false);
              setProfilGerekli({ mod: "yeni", onerilenAd });
              setKullanici(aktifKullanici);
              setYukleniyor(false);
              return;
            }
          }

          const veri = userDoc.data();
          const gercekRol = rolCoz(veri);
          if (gercekRol === null) {
            await girisiReddet("Giriş Yapılamadı", "Hesap türün tanınamadı. Lütfen destek ile iletişime geç.");
            return;
          }

          // Yönetici: her girişte sunucu daveti yeniden doğrular ve rol değişikliğini (müdür/rehber öğretmen) uygular
          if (gercekRol === "yonetici" && !yoneticiYetkisiYeniAlindi) {
            const sonuc = await yoneticiYetkisiAl(aktifKullanici);
            if (!sonuc.basarili) {
              await girisiReddet(sonuc.baslik, sonuc.mesaj);
              return;
            }
          }

          // Kayıt formunda onay verildiyse profil oluşturulurken kaydedildi (onay ekranı tekrar çıkmaz); Google/Apple
          // ile gelenler ve onayı eski sürümde kalanlar için role özel onay ekranı gösterilir
          setOnayGerekli(!onayGecerliMi(veri.yasOnayi));
          setPremiumMu(veri.premiumMu === true);
          setPremiumKaynaklari(veri.premiumKaynaklari ?? null);
          // Tanıtım sayfaları öğrenci özelliklerini anlatır; yalnızca yeni öğrenciye (28 Kasım kararı)
          setGosterOnboarding(yeniOlusturuldu && tanitimGosterilsinMi(gercekRol));

          // Eski hesaplarda ad ya da sınıf eksikse bir kez "Profilini Tamamla" (rol sabit, değiştirilemez)
          const eksik = profilEksikleri(veri);
          if (eksik.length > 0) {
            setKullaniciRolu(null);
            setProfilGerekli({
              mod: "tamamla",
              rolSabit: gercekRol,
              onerilenAd: veri.adSoyad || onerilenAd,
              mevcutSinif: veri.sinif,
            });
          } else {
            setProfilGerekli(null);
            setKullaniciRolu(gercekRol);
            await AsyncStorage.setItem("kullaniciRolu", gercekRol);
          }
        } catch (e) {
          // Güvenli tarafta kal: rol belirlenemediyse (ağ hatası, beklenmedik durum) içeri alınmaz; oturum kapatılır
          console.log("Kapı bekçisi hatası:", e?.code || e?.message);
          try {
            await signOut(auth);
          } catch (cikisHatasi) {}
          setKullanici(null);
          setKullaniciRolu(null);
          setProfilGerekli(null);
          setGirisReddi((n) => n + 1);
          setYukleniyor(false);
          Alert.alert("Giriş Yapılamadı", "Bir sorun oluştu. İnternet bağlantını kontrol edip tekrar dene.");
          return;
        }

        setKullanici(aktifKullanici);
      } else {
        // Ortak telefonda önceki kişinin Premium görünümü ve rolü sonraki kişiye kalmasın
        setPremiumMu(false);
        setPremiumKaynaklari(null);
        setKullaniciRolu(null);
        setProfilGerekli(null);
        setKullanici(null);
      }
      setYukleniyor(false);
    });

    return () => abonelik();
  }, []);

  // Mağaza (RevenueCat) oturumu: yalnızca yaş/şart onayını vermiş öğrenci için, kimlik = Firebase uid.
  // Oturum kapanınca doğrulanmış mağaza kimliği unutulur (SDK kimliği bırakılmaz; hesap silmede hesapSilici bırakır).
  useEffect(() => {
    if (!kullanici) {
      magazaGirisiniUnut();
      return;
    }
    if (onayGerekli || profilGerekli || kullaniciRolu !== "ogrenci") return;
    magazaKullanicisiniAyarla(kullanici.uid).catch((e) =>
      console.log("Mağaza oturumu açılamadı:", e?.code)
    );
  }, [kullanici, onayGerekli, profilGerekli, kullaniciRolu]);

  // Premium durumu canlı izlenir: satın alma sonrası sunucu güncelleyince arayüz yenilenir
  useEffect(() => {
    if (!kullanici || onayGerekli || profilGerekli) return;

    const abonelik = onSnapshot(
      doc(db, "kullanicilar", kullanici.uid),
      (snap) => {
        setPremiumMu(snap.data()?.premiumMu === true);
        setPremiumKaynaklari(snap.data()?.premiumKaynaklari ?? null);
      },
      (hata) => console.log("Premium dinleme hatası:", hata?.code)
    );

    return () => abonelik();
  }, [kullanici, onayGerekli, profilGerekli]);

  useEffect(() => {
    const bildirimleriKur = async () => {
      // Onay verilmeden bildirim izni istenmez
      if (!kullanici || onayGerekli || profilGerekli || !kullaniciRolu) return;

      try {
        const bildirimAyar = await AsyncStorage.getItem("bildirimAktif");
        const aktif = bildirimAyar !== null ? JSON.parse(bildirimAyar) : true;

        if (aktif) {
          const izin = await registerForPushNotificationsAsync();
          if (izin) {
            await setupSmartNotifications(kullaniciRolu);
          }
        }
      } catch (error) {
        console.log("Bildirim kurulum hatası:", error);
      }
    };

    bildirimleriKur();
  }, [kullanici, kullaniciRolu, onayGerekli, profilGerekli]);

  useEffect(() => {
    if (!kullanici || kullaniciRolu !== "ogrenci") return;

    const q = query(
      collection(db, "sorular"),
      where("kullaniciUid", "==", kullanici.uid)
    );

    const abonelik = onSnapshot(q, (snapshot) => {
      let okunmamisAdet = 0;
      snapshot.forEach((doc) => {
        const veri = doc.data();
        if (yeniCozumMu(veri)) okunmamisAdet++;
      });
      setOkunmamisSayisi(okunmamisAdet);

      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const veri = change.doc.data();
          if (
            yeniCozumMu(veri) &&
            !bildirilenSorular.current.has(change.doc.id)
          ) {
            bildirilenSorular.current.add(change.doc.id);
            const dersAdi = dersBilgisiVar(veri) ? dersBul(veri) : "";
            sendQuestionSolvedNotification(dersAdi);
          }
        }
      });

      // Dersi olmayan çözülmüş sorulara ders ekle. Bu güncelleme belgeyi "değişti" gösterir;
      // eski sorular için sahte "çözüm hazır" bildirimi çıkmasın diye önce işaretlenir.
      snapshot.docs.forEach((belge) => {
        const veri = belge.data();
        if (veri.durum === "Çözüldü" && !dersBilgisiVar(veri)) {
          bildirilenSorular.current.add(belge.id);
          dersiTamamla({ id: belge.id, ...veri }, kullanici.email);
        } else if (digerYerineDers(veri)) {
          // n8n "Diğer" yazdı ama konu dersi gösteriyor (ör. "Varlık felsefesi" → Felsefe)
          bildirilenSorular.current.add(belge.id);
          digerDersiDuzelt({ id: belge.id, ...veri });
        }
      });
    });

    return () => abonelik();
  }, [kullanici, kullaniciRolu]);

  // "Profilini Tamamla" bitti: yeni profilde yaş/şart onayı ve (öğrenciye) tanıtım gösterilir
  const profilTamamlandi = async (profil) => {
    const yeni = profilGerekli?.mod === "yeni";
    if (yeni) {
      setOnayGerekli(true);
      setPremiumMu(false);
      setPremiumKaynaklari(null);
      setGosterOnboarding(tanitimGosterilsinMi(profil.rol));
    }
    setKullaniciRolu(profil.rol);
    setProfilGerekli(null);
    try {
      await AsyncStorage.setItem("kullaniciRolu", profil.rol);
    } catch (e) {}
  };

  if (yukleniyor) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: tema.arkaplan,
        }}
      >
        <ActivityIndicator size="large" color={tema.anaButon} />
      </View>
    );
  }

  if (!kullanici) {
    return (
      <LoginScreen
        setKullaniciRolu={setKullaniciRolu}
        girisReddi={girisReddi}
      />
    );
  }

  if (profilGerekli) {
    return (
      <ProfilTamamla
        kullanici={kullanici}
        mod={profilGerekli.mod}
        rolSabit={profilGerekli.rolSabit}
        onerilenAd={profilGerekli.onerilenAd}
        mevcutSinif={profilGerekli.mevcutSinif}
        onTamamlandi={profilTamamlandi}
      />
    );
  }

  // Rol doğrulanmadan hiçbir sekme açılmaz (güvenli taraf)
  if (!kullaniciRolu) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: tema.arkaplan }}>
        <ActivityIndicator size="large" color={tema.anaButon} />
      </View>
    );
  }

  if (onayGerekli) {
    return (
      <YasOnayScreen
        kullanici={kullanici}
        rol={kullaniciRolu}
        onOnaylandi={() => setOnayGerekli(false)}
      />
    );
  }

  if (gosterOnboarding) {
    return <OnboardingScreen onTamamla={() => setGosterOnboarding(false)} />;
  }

  // 🚀 DÜZELTME: NavigationContainer buradan silindi, en dıştaki (ölümsüz) App bileşenine taşındı.
  return (
    <PremiumProvider premiumMu={premiumMu} premiumKaynaklari={premiumKaynaklari} rol={kullaniciRolu}>
      <DuyuruContext.Provider value={duyuruKutusu}>
        <Tab.Navigator
          // Sayfalar anında değişir; yalnızca alt menüdeki gösterge kayar (AltMenu)
          tabBar={(props) => (
            <AltMenu {...props} tema={tema} rozetStili={ROZET_STILI} />
          )}
          screenOptions={{
            animation: "none",
            headerShown: false,
            tabBarHideOnKeyboard: true,
          }}
        >
          {kullaniciRolu === "ogrenci" ? (
            <>
              <Tab.Screen
                name="Ana Sayfa"
                component={HomeScreen}
                options={{ title: "Kamera" }}
              />
              <Tab.Screen
                name="Hata Defteri"
                component={HistoryScreen}
                options={{
                  title: "Geçmiş Sorular",
                  tabBarBadge: rozetDegeri(okunmamisSayisi),
                  tabBarAccessibilityLabel: sekmeEtiketi(
                    "Geçmiş Sorular",
                    okunmamisSayisi
                  ),
                }}
              />
              <Tab.Screen
                name="Profil"
                component={ProfileScreen}
                options={{
                  title: "Hesabım",
                  tabBarBadge: rozetDegeri(duyuruKutusu.okunmamis),
                  tabBarAccessibilityLabel: sekmeEtiketi(
                    "Hesabım",
                    duyuruKutusu.okunmamis,
                    "yeni duyuru"
                  ),
                }}
              />
            </>
          ) : kullaniciRolu === "yonetici" ? (
            <>
              <Tab.Screen
                name="Genel Bakış"
                component={GenelBakisEkrani}
                options={{ title: "Genel Bakış" }}
              />
              <Tab.Screen
                name="Öğrenciler"
                component={OgrenciListesiEkrani}
                options={{ title: "Öğrenciler" }}
              />
              <Tab.Screen
                name="Yönetim"
                component={YoneticiAnaEkran}
                options={{ title: "Dershane" }}
              />
              <Tab.Screen
                name="Profil"
                component={ProfileScreen}
                options={{ title: "Hesabım" }}
              />
            </>
          ) : (
            <>
              <Tab.Screen
                name="Veli Paneli"
                component={ParentDashboard}
                options={{ title: "Yönetim Paneli" }}
              />
              <Tab.Screen
                name="Profil"
                component={ProfileScreen}
                options={{ title: "Hesabım" }}
              />
            </>
          )}
        </Tab.Navigator>
        {/* Seri kutlaması: soru gönderildikten 10 sn sonra hangi ekranda olunursa olunsun (yalnızca öğrenci) */}
        <SeriKutlama kullaniciUid={kullaniciRolu === "ogrenci" && kullanici ? kullanici.uid : null} />
      </DuyuruContext.Provider>
    </PremiumProvider>
  );
}

// 🚀 MİMARİ DÜZELTME: NavigationContainer artık uygulamanın en tepesinde ve hiçbir zaman silinmeyecek.
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <NavigationContainer>
            <MainApp />
          </NavigationContainer>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
