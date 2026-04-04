import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // Bildirim üstten düşsün
    shouldShowList: true, // Bildirim merkezinde listelensin
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
    console.log("Kullanıcı bildirim izni vermedi.");
    return false;
  }

  console.log("Yerel bildirim izni başarıyla alındı!");
  return true;
}

// ⏰ Her Akşam 19:00 Hatırlatıcısı
export async function scheduleDailyReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🔥 Serin Tehlikede!",
      body: "Bugün henüz soru çözmedin. Serini kaybetmemek için hemen bir soru tara!",
    },
    trigger: {
      hour: 19,
      minute: 0,
      repeats: true,
      channelId: "default", // 🚀 HATA ÇÖZÜMÜ: Android için Kanal ID'si eklendi
    },
  });
  console.log("Günlük hatırlatıcı kuruldu.");
}

// ❌ Bildirimleri Kapatma
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log("Bildirimler iptal edildi.");
}
