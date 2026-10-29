const { initializeApp } = require("firebase-admin/app");
const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const kurum = require("./kurum");
const ozet = require("./ozet");

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

// Bir soru eklenir, güncellenir ya da silinirse sahibinin kurum özeti yenilenir
exports.soruOzetiniGuncelle = onDocumentWritten(
  { document: "sorular/{soruId}", region: "europe-west1", maxInstances: 5 },
  async (event) => {
    const uid = event.data?.after?.data()?.kullaniciUid || event.data?.before?.data()?.kullaniciUid;
    if (uid) await ozet.ozetYenile(uid);
  }
);

// Öğrenci adını değiştirirse kurum özetindeki isim de güncellenir
exports.isimOzetiniGuncelle = onDocumentWritten(
  { document: "kullanicilar/{uid}", region: "europe-west1", maxInstances: 5 },
  async (event) => {
    const once = event.data?.before?.data();
    const sonra = event.data?.after?.data();
    if (!sonra?.kurumId || sonra.rol === "yonetici") return;
    if (once?.adSoyad === sonra.adSoyad && once?.kurumId === sonra.kurumId) return;
    await ozet.ozetYenile(event.params.uid);
  }
);
