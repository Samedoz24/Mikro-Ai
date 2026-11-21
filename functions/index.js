const { initializeApp } = require("firebase-admin/app");
const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const kurum = require("./kurum");
const ozet = require("./ozet");
const duyuru = require("./duyuru");
const erisim = require("./erisim");
const platform = require("./platform");
const veli = require("./veli");
const kota = require("./kota");
const veliBaglanti = require("./veliBaglanti");
const hesapTemizlik = require("./hesapTemizlik");

initializeApp();

// enforceAppCheck: uygulamadan gelen her istek geçerli bir App Check belgesi taşımalı (iOS'ta Apple App Attest).
// Belgesiz ya da geçersiz belgeli istekler fonksiyon koduna ulaşmadan reddedilir (kurcalanmış programlar, botlar).
// Bu ayar yalnızca callable fonksiyonları etkiler; zamanlanmış görevler ve veritabanı tetikleyicileri etkilenmez.
const ORTAK = { region: "europe-west1", maxInstances: 10, enforceAppCheck: true };

// Gece görevleri: Cloud Run bazen soğuk başlatmada örnek bulamayıp isteği reddeder ("aborted after waiting too long
// for an available instance"). Görev kodumuza hiç ulaşmadan başarısız olur; bu yüzden hata alırsa 5 kez denenir.
// Görevlerin ikisi de tekrar çalıştırılabilir (idempotent) yazılmıştır.
const GECE_GOREVI = {
  region: "europe-west1",
  timeZone: "Europe/Istanbul",
  timeoutSeconds: 540,
  retryCount: 5,
  minBackoffSeconds: 60,
  maxBackoffSeconds: 600,
  maxRetrySeconds: 3600,
};

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

// Müdür öğretmen davet eder / kaldırır. Girdi: { eposta }
exports.ogretmenDavetEt = onCall(ORTAK, (request) =>
  kurum.ogretmenDavetEt(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.yoneticiKaldir = onCall(ORTAK, (request) =>
  kurum.yoneticiKaldir(kurum.girisliUid(request), request.auth.token, request.data)
);

// Müdür bir öğrenciyi dershaneden çıkarır. Girdi: { uid }
exports.ogrenciCikar = onCall(ORTAK, (request) =>
  kurum.ogrenciCikar(kurum.girisliUid(request), request.auth.token, request.data)
);

// Müdür kurumun öğrenci kayıt kodunu yeniler; eski kod anında geçersiz olur
exports.kodYenile = onCall(ORTAK, (request) =>
  kurum.kodYenile(kurum.girisliUid(request), request.auth.token)
);

// Müdür gruplarını (sınıf/şube) ve öğretmen kapsamlarını yönetir
exports.grupOlustur = onCall(ORTAK, (request) =>
  kurum.grupOlustur(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.grupAdiDegistir = onCall(ORTAK, (request) =>
  kurum.grupAdiDegistir(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.grupSil = onCall(ORTAK, (request) =>
  kurum.grupSil(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.ogrenciGrupAta = onCall(ORTAK, (request) =>
  kurum.ogrenciGrupAta(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.ogretmenKapsamAta = onCall(ORTAK, (request) =>
  kurum.ogretmenKapsamAta(kurum.girisliUid(request), request.auth.token, request.data)
);

// Müdür öğrencilere duyuru gönderir / siler
exports.duyuruGonder = onCall(ORTAK, (request) =>
  duyuru.duyuruGonder(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.duyuruSil = onCall(ORTAK, (request) =>
  duyuru.duyuruSil(kurum.girisliUid(request), request.auth.token, request.data)
);

// Platform yöneticisi (yalnızca platformYoneticileri/{eposta} belgesi olan, e-postası doğrulanmış hesap)
exports.platformYetkisi = onCall(ORTAK, (request) =>
  platform.platformYetkisi(kurum.girisliUid(request), request.auth.token)
);

exports.kurumOlustur = onCall(ORTAK, (request) =>
  platform.kurumOlustur(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.kurumListele = onCall(ORTAK, (request) =>
  platform.kurumListele(kurum.girisliUid(request), request.auth.token)
);

// Dershane yaşam döngüsü (yalnızca platform yöneticisi). Kapatma çok üyeli kurumlarda uzun sürebilir.
exports.kurumAskiyaAl = onCall(ORTAK, (request) =>
  platform.kurumAskiyaAl(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.kurumYenidenAc = onCall(ORTAK, (request) =>
  platform.kurumYenidenAc(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.kurumKapat = onCall({ ...ORTAK, timeoutSeconds: 540 }, (request) =>
  platform.kurumKapat(kurum.girisliUid(request), request.auth.token, request.data)
);

// Soru gönderme ve günlük kota: kota sunucuda (hesap + cihaz başına) sayılır, soru belgesini sunucu oluşturur
exports.soruGonder = onCall(ORTAK, (request) =>
  kota.soruGonder(kurum.girisliUid(request), request.auth.token, request.data)
);

// Veli–öğrenci bağlantısı (yalnızca sunucu kurar). Öğrenci kendi kodunu alır; veli kodla bağlanır/kaldırır.
exports.baglantiKoduAl = onCall(ORTAK, (request) =>
  veliBaglanti.baglantiKoduAl(kurum.girisliUid(request))
);

exports.veliBagla = onCall(ORTAK, (request) =>
  veliBaglanti.veliBagla(kurum.girisliUid(request), request.data)
);

exports.veliBaglantisiKaldir = onCall(ORTAK, (request) =>
  veliBaglanti.veliBaglantisiKaldir(kurum.girisliUid(request), request.data)
);

// Öğrencinin kendi veli bağlantıları üzerindeki denetimi: bağlı velileri görme, kaldırma, kodu yenileme
exports.ogrenciVelileriGetir = onCall(ORTAK, (request) =>
  veliBaglanti.ogrenciVelileriGetir(kurum.girisliUid(request))
);

exports.ogrenciVeliKaldir = onCall(ORTAK, (request) =>
  veliBaglanti.ogrenciVeliKaldir(kurum.girisliUid(request), request.data)
);

exports.baglantiKoduYenile = onCall(ORTAK, (request) =>
  veliBaglanti.baglantiKoduYenile(kurum.girisliUid(request))
);

exports.kotaDurumu = onCall(ORTAK, (request) =>
  kota.kotaDurumu(kurum.girisliUid(request), request.auth.token, request.data)
);

// Müdür öğrenci verisine yalnızca bu fonksiyonlarla ulaşır; her erişim önce kaydedilir (KVKK)
// Yanıtlar büyük olabileceğinden bellek/süre payı artırılmıştır.
const ERISIM = { ...ORTAK, memory: "512MiB", timeoutSeconds: 60 };

exports.ogrenciSorulariGetir = onCall(ERISIM, (request) =>
  erisim.ogrenciSorulariGetir(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.soruCozumuGetir = onCall(ERISIM, (request) =>
  erisim.soruCozumuGetir(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.soruFotografiGetir = onCall(ERISIM, (request) =>
  erisim.soruFotografiGetir(kurum.girisliUid(request), request.auth.token, request.data)
);

exports.raporKaydi = onCall(ORTAK, (request) =>
  erisim.raporKaydi(kurum.girisliUid(request), request.auth.token, request.data)
);

// Erişim kayıtları 12 ay saklanır, sonra silinir
exports.erisimKayitlariniTemizle = onSchedule(
  { ...GECE_GOREVI, schedule: "every day 03:30" },
  async () => {
    // Sırayla çalışır (aynı belgelere eş zamanlı dokunmasın); biri hata verse diğeri yine denenir
    const sonuc = { anonim: null, silinen: null };
    let ilkHata = null;
    try {
      sonuc.anonim = await erisim.silinenOgrencileriAnonimlestir();
    } catch (hata) {
      ilkHata = hata;
    }
    try {
      sonuc.silinen = await erisim.eskiKayitlariSil();
    } catch (hata) {
      ilkHata = ilkHata || hata;
    }
    console.log("Anonimleştirilen:", sonuc.anonim, "Silinen:", sonuc.silinen);
    if (ilkHata) throw ilkHata;
  }
);

// Her gece süresi dolan lisansları kapatır
exports.lisansKontrol = onSchedule(
  { ...GECE_GOREVI, schedule: "every day 03:00" },
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

// Kullanıcı profili silinince (hesap silme) kimliğe bağlı tüm veri sunucuda da temizlenir: veli bağlantıları,
// bağlantı kodu, dershane üyeliği (müdür ekranından kalkar, koltuk boşalır), soru belgeleri ve Storage dosyaları.
// Uygulamanın temizliği yarıda kalsa bile hiçbir şey ortada kalmaz. Ayrıntı ve güvenlik notu: hesapTemizlik.js
// Tekrar çalıştırılabilir; geçici hata olursa Firebase yeniden dener. (Ad, daha önce yayınlanan fonksiyonla aynı kalır.)
exports.veliBaglantilariniTemizle = onDocumentDeleted(
  { document: "kullanicilar/{uid}", region: "europe-west1", maxInstances: 5, retry: true, timeoutSeconds: 300 },
  async (event) => {
    const sonuc = await hesapTemizlik.silinenHesabiTemizle(event.params.uid, event.data?.data());
    console.log("Silinen hesap temizlendi:", JSON.stringify(sonuc));
  }
);
