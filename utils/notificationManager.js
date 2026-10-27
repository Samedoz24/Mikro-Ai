import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ---------------------------------------------------------
// BİLDİRİM STRATEJİSİ (v4)
//
// Tekrarlayan "her gün" bildirimi YOKTUR. Tüm bildirimler son etkinliğe göre kurulan
// tek seferlik bildirimlerdir ve kullanıcı uygulamaya her döndüğünde yeniden hesaplanır.
// Böylece uygulamayı bırakan biri en fazla birkaç bildirim alır, sonra tamamen susulur.
//
//  Öğrenci
//   - Seri hatırlatıcı : yarın 19:30. Yarın uygulamaya girerse ertelenir; girmezse
//                        "bugün uğramadın" mesajı her zaman doğrudur.
//   - Geri kazanım     : 3. gün ve 7. gün 18:00, sonrası yok.
//   - Kota yenilendi   : yalnızca günlük hakkı bittiğinde, ertesi sabah 09:00 (tek sefer).
//  Veli
//   - Haftalık özet    : bir sonraki Cuma 18:00 (tek sefer, uygulamaya girince yenilenir).
//
// Tüm saatler cihazın yerel saatidir ve gece saatlerine denk gelmez.
// ---------------------------------------------------------

const SERI_SAATI = { saat: 19, dakika: 30 };
const GERI_KAZANIM_SAATI = { saat: 18, dakika: 0 };
const KOTA_SAATI = { saat: 9, dakika: 0 };
const HAFTALIK_RAPOR_SAATI = { saat: 18, dakika: 0 };
const CUMA = 5; // JavaScript Date.getDay(): 0=Pazar ... 5=Cuma

const KIMLIK = {
  seri: "streak-v4",
  gun3: "re-engage-3d-v4",
  gun7: "re-engage-7d-v4",
  kota: "quota-v4",
  haftalik: "weekly-v4",
};

// Önceki sürümlerde kurulmuş tekrarlayan bildirimler; cihazda kalmasınlar diye temizlenir.
const ESKI_KIMLIKLER = [
  "quota-v2",
  "streak-v2",
  "weekly-report-v2",
  "re-engage-v2",
  "quota-v3",
  "streak-v3",
  "weekly-v3",
  "re-engage-v3",
];

const KOTA_TARIHI_ANAHTARI = "bildirim:kotaYenilenmeTarihi";

// 🛡️ Bildirim İzni Alma
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return false;
  }

  return true;
}

// ---------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------

// `simdi`den `gunSonra` gün sonrasının, verilen yerel saatteki zamanı
const zamanUret = (simdi, gunSonra, { saat, dakika }) => {
  const tarih = new Date(simdi.getTime());
  tarih.setDate(tarih.getDate() + gunSonra);
  tarih.setHours(saat, dakika, 0, 0);
  return tarih;
};

// `simdi`den sonraki ilk Cuma gününün verilen saati (bugün Cuma ve saat geçmediyse bugün)
const sonrakiCuma = (simdi, { saat, dakika }) => {
  const bugunSaati = new Date(simdi.getTime());
  bugunSaati.setHours(saat, dakika, 0, 0);

  let fark = (CUMA - bugunSaati.getDay() + 7) % 7;
  if (fark === 0 && bugunSaati.getTime() <= simdi.getTime()) fark = 7;

  return zamanUret(simdi, fark, { saat, dakika });
};

const planla = (identifier, icerik, tarih) =>
  Notifications.scheduleNotificationAsync({
    identifier,
    content: { ...icerik, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tarih,
      channelId: "default",
    },
  });

const iptalEt = (identifier) =>
  Notifications.cancelScheduledNotificationAsync(identifier);

// Kullanıcı bildirimleri kapatmamış ve işletim sistemi izni vermiş mi?
const bildirimlerAcikMi = async () => {
  const ayar = await AsyncStorage.getItem("bildirimAktif");
  if (ayar !== null && JSON.parse(ayar) === false) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
};

const eskiBildirimleriTemizle = async () => {
  for (const kimlik of ESKI_KIMLIKLER) {
    await iptalEt(kimlik);
  }
};

// ---------------------------------------------------------
// Öğrenci bildirimleri
// ---------------------------------------------------------

async function seriHatirlatmasiniKur(simdi) {
  let seri = 0;
  try {
    seri = parseInt(await AsyncStorage.getItem("seriGunu"), 10) || 0;
  } catch (e) {}

  const icerik =
    seri >= 2
      ? {
          title: "🔥 Serin Bozulmak Üzere!",
          body: "Günlük serini kaybetmemek için bugün Mikro AI'ya uğraman yeterli.",
        }
      : {
          title: "📚 Bugün Bir Soru Çözelim mi?",
          body: "Takıldığın bir sorunun fotoğrafını çek, Mikro AI adım adım anlatsın.",
        };

  await iptalEt(KIMLIK.seri);
  await planla(KIMLIK.seri, icerik, zamanUret(simdi, 1, SERI_SAATI));
}

async function geriKazanimBildirimleriniKur(simdi) {
  await iptalEt(KIMLIK.gun3);
  await planla(
    KIMLIK.gun3,
    {
      title: "🤖 Seni Özledik!",
      body: "Çözemediğin bir soru mu var? Kameranı aç, Mikro AI anında anlatsın.",
    },
    zamanUret(simdi, 3, GERI_KAZANIM_SAATI)
  );

  await iptalEt(KIMLIK.gun7);
  await planla(
    KIMLIK.gun7,
    {
      title: "📖 Bir Haftadır Yoksun",
      body: "Takıldığın bir soru olursa Mikro AI yanında. Fotoğrafını çekip gönder.",
    },
    zamanUret(simdi, 7, GERI_KAZANIM_SAATI)
  );
}

// Kullanıcı yenilenme gününe ulaşıp uygulamaya döndüyse bekleyen kota bildirimi gereksizdir.
async function kotaBildirimiGerekliMiKontrolEt(simdi) {
  const kayit = await AsyncStorage.getItem(KOTA_TARIHI_ANAHTARI);
  if (!kayit) return;

  const yenilenmeGunuBasi = new Date(kayit);
  yenilenmeGunuBasi.setHours(0, 0, 0, 0);

  if (simdi.getTime() >= yenilenmeGunuBasi.getTime()) {
    await iptalEt(KIMLIK.kota);
    await AsyncStorage.removeItem(KOTA_TARIHI_ANAHTARI);
  }
}

// Günlük hak bittiğinde çağrılır: ertesi sabah 09:00'da tek seferlik "hakların yenilendi".
// Hata verse de çağıran akışı (soru gönderme) bozmaz.
export async function kotaYenilenmeHatirlatmasiKur(
  premiumMu = false,
  simdi = new Date()
) {
  try {
    if (!(await bildirimlerAcikMi())) return;

    const tarih = zamanUret(simdi, 1, KOTA_SAATI);

    await iptalEt(KIMLIK.kota);
    await planla(
      KIMLIK.kota,
      {
        title: "🎁 Günlük Hakların Yenilendi",
        body: premiumMu
          ? "Bugün için 50 yeni soru hakkın hazır."
          : "Bugün için 3 yeni soru hakkın hazır. Takıldığın soruyu şimdi gönder.",
      },
      tarih
    );
    await AsyncStorage.setItem(KOTA_TARIHI_ANAHTARI, tarih.toISOString());
  } catch (hata) {
    console.log("Kota bildirimi kurulamadı:", hata?.message);
  }
}

// ---------------------------------------------------------
// Veli bildirimi
// ---------------------------------------------------------

async function haftalikRaporuKur(simdi) {
  await iptalEt(KIMLIK.haftalik);
  await planla(
    KIMLIK.haftalik,
    {
      title: "📈 Haftalık Özet Hazır",
      body: "Öğrencinin bu haftaki soru çözüm istatistiklerini Yönetim Paneli'nden inceleyebilirsin.",
    },
    sonrakiCuma(simdi, HAFTALIK_RAPOR_SAATI)
  );
}

// ---------------------------------------------------------
// Giriş noktası: uygulama her açıldığında / giriş yapıldığında çağrılır.
// Her çağrıda bildirimler güncel zamana göre yeniden hesaplanır; çoğalmaz.
// ---------------------------------------------------------
export async function setupSmartNotifications(rol, simdi = new Date()) {
  await eskiBildirimleriTemizle();

  if (rol === "ogrenci") {
    await kotaBildirimiGerekliMiKontrolEt(simdi);
    await seriHatirlatmasiniKur(simdi);
    await geriKazanimBildirimleriniKur(simdi);
  } else if (rol === "veli") {
    await haftalikRaporuKur(simdi);
  }

  console.log("✅ Bildirimler güncellendi.");
}

// 🤖 Soru Çözüldüğünde Bildirim (Anında)
export async function sendQuestionSolvedNotification(dersAdi) {
  const dersMetni = dersAdi ? `${dersAdi} dersine ait s` : "S";

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🤖 Sorunun Çözümü Hazır!",
      body: `${dersMetni}orunun yapay zeka analizi ve çözüm kartı hazırlandı. Hemen incele!`,
      sound: true,
    },
    trigger: null,
  });
}

// ❌ Tüm Bildirimleri Kapatma
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(KOTA_TARIHI_ANAHTARI);
  console.log("Tüm bildirimler iptal edildi.");
}
