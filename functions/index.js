const { initializeApp } = require("firebase-admin/app");
const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const kurum = require("./kurum");

initializeApp();

const ORTAK = { region: "europe-west1", maxInstances: 10 };

// Öğrenci kurum koduyla katılır. Girdi: { kod, onay: true }
exports.kurumaKatil = onCall(ORTAK, (request) =>
  kurum.kurumaKatil(kurum.girisliUid(request), request.data)
);

// Öğrenci kurumdan ayrılır
exports.kurumdanAyril = onCall(ORTAK, (request) =>
  kurum.kurumdanAyril(kurum.girisliUid(request))
);

// Davet edilmiş, e-postası doğrulanmış müdür/öğretmen yönetici yetkisi alır.
// Sonrasında istemci getIdToken(true) ile kimlik belirtecini yenilemelidir.
exports.yoneticiOl = onCall(ORTAK, (request) =>
  kurum.yoneticiOl(kurum.girisliUid(request), request.auth.token)
);

// Her gece süresi dolan lisansları kapatır
exports.lisansKontrol = onSchedule(
  { region: "europe-west1", schedule: "every day 03:00", timeZone: "Europe/Istanbul", timeoutSeconds: 540 },
  async () => {
    const kapatilan = await kurum.lisansKontrol();
    console.log("Kapatılan kurumlar:", kapatilan.join(", ") || "yok");
  }
);
