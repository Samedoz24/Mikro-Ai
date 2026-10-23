import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
// 🚀 AKILLI BİLDİRİM STRATEJİLERİ (v3)
// ---------------------------------------------------------

export async function scheduleMidnightQuotaReminder() {
  await Notifications.scheduleNotificationAsync({
    identifier: "quota-v3", // 👈 Yeni Kimlik
    content: {
      title: "🎁 Günlük Kotan Yenilendi!",
      body: "Ücretsiz yapay zeka hakların sıfırlandı. Güne hemen bir soru çözerek başla!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 0,
      minute: 0,
      channelId: "default",
    },
  });
}

export async function scheduleStreakReminder() {
  await Notifications.scheduleNotificationAsync({
    identifier: "streak-v3", // 👈 Yeni Kimlik
    content: {
      title: "🔥 Serin Bozulmak Üzere!",
      body: "Bugün henüz Mikro AI'a uğramadın. Serini kaybetmemek için hemen bir soru tara!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 19,
      minute: 30,
      channelId: "default",
    },
  });
}

export async function scheduleWeeklyReportReminder(rol) {
  const mesaj =
    rol === "veli"
      ? "📈 Öğrencinizin bu haftaki soru çözüm istatistikleri güncellendi. Veli panelinden hemen inceleyin."
      : "📚 Bu hafta çok çalıştın! Hata defterin PDF olarak hazır, sınavdan önce tekrar etmeyi unutma.";

  await Notifications.scheduleNotificationAsync({
    identifier: "weekly-v3", // 👈 Yeni Kimlik
    content: {
      title: "Haftalık Raporun Hazır",
      body: mesaj,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 6, // Cuma
      hour: 18,
      minute: 0,
      channelId: "default",
    },
  });
}

export async function scheduleReEngagementReminder() {
  await Notifications.scheduleNotificationAsync({
    identifier: "re-engage-v3", // 👈 Yeni Kimlik
    content: {
      title: "🤖 Seni Özledik!",
      body: "Yapay zeka hocan seni bekliyor! Çözemediğin bir soru mu var? Hemen kameranı aç ve gönder.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60 * 60 * 24 * 3, // 3 Gün
      repeats: false,
      channelId: "default",
    },
  });
}

// 🧠 YEPYENİ AKILLI YÖNETİCİ (Reload Korumalı)
export async function setupSmartNotifications(rol) {
  // 1. ADIM: Mevcut kurulu bildirimleri kontrol et
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIds = scheduled.map((n) => n.identifier);

  // 2. ADIM: "Seni Özledik" bildirimini her girişte GÜNCELLE
  // Bu bildirim her reload'da 3 gün sonraya ötelenir, anında çalmaz.
  if (scheduledIds.includes("re-engage-v3")) {
    await Notifications.cancelScheduledNotificationAsync("re-engage-v3");
  }
  await scheduleReEngagementReminder();

  // 3. ADIM: Diğerlerini SADECE YOKSA kur (Reload'da anında çalmayı engelleyen yer burası)
  if (rol === "ogrenci") {
    if (!scheduledIds.includes("quota-v3")) {
      await scheduleMidnightQuotaReminder();
    }
    if (!scheduledIds.includes("streak-v3")) {
      await scheduleStreakReminder();
    }
  } else if (rol === "veli") {
    if (!scheduledIds.includes("weekly-v3")) {
      await scheduleWeeklyReportReminder("veli");
    }
  }

  // Eski v2 versiyonlarını telefondan temizleyelim (Bir defalık temizlik)
  await Notifications.cancelScheduledNotificationAsync("quota-v2");
  await Notifications.cancelScheduledNotificationAsync("streak-v2");
  await Notifications.cancelScheduledNotificationAsync("weekly-report-v2");
  await Notifications.cancelScheduledNotificationAsync("re-engage-v2");

  console.log("✅ Bildirimler akıllıca kontrol edildi ve kuruldu.");
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
  console.log("Tüm bildirimler iptal edildi.");
}
