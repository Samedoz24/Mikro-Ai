// Hesap silme güvenlik ağı: kullanıcı profili (kullanicilar/{uid}) silindiğinde çalışır.
//
// Uygulama hesabı silerken verileri kendisi temizler; ama bir adım hata verirse ya da atlanırsa
// (örn. dershaneden ayrılma ağ hatası) veri ortada kalırdı. Sunucu, profil silindiği anda kimliğe
// bağlı her şeyi temizler:
//   1) Velilerin bağlı öğrenci listelerinden çıkarma ve bağlantı kodu kaydı
//   2) Dershane üyeliği: üyelik + özet + grup özeti silinir, koltuk boşalır (müdür artık görmez)
//   3) kullaniciUid'si bu kullanıcı olan soru belgeleri
//   4) Storage: kullanicilar/{uid}/, cozumDetayi/{uid}/, solution-cards/{uid}/, profil_fotograflari/{uid}.jpg
//
// GÜVENLİK: Yalnızca taklit edilemeyen kimlik (uid, belge yolundan gelir) kullanılır. Profildeki e-posta
// alanı istemci tarafından yazılabildiği için ASLA kullanılmaz: aksi halde biri profiline başkasının
// e-postasını yazıp profilini silerek o kişinin e-posta klasöründeki dosyaları sildirebilirdi.
// Eski sistemin e-posta klasörlerini, kimliği doğrulanmış kullanıcı olarak uygulama siler.
//
// Tekrar çalıştırılabilir (idempotent): her adım zaten temizse hiçbir şey yapmaz; hata olursa Firebase yeniden dener.

const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { veliBaglantilariniTemizle } = require("./veli");
const { kodKayitlariniSil } = require("./veliBaglanti");
const { uyelikSonlandir } = require("./kurum");

const db = () => getFirestore();
const UID_BICIMI = /^[A-Za-z0-9]{1,128}$/;
const TOPLU_BOYUT = 400;

// Kimliğe bağlı soru belgelerini siler; silinen sayıyı döndürür
const sorulariSil = async (uid) => {
  let silinen = 0;
  for (;;) {
    const snap = await db().collection("sorular").where("kullaniciUid", "==", uid).limit(TOPLU_BOYUT).get();
    if (snap.empty) return silinen;
    const batch = db().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    silinen += snap.size;
  }
};

// Kimliğe bağlı Storage dosyalarını siler. Önek "/" ile biter: "kullanicilar/abc/" başka bir
// kullanıcının "kullanicilar/abcd/" klasörüyle asla eşleşmez.
const dosyalariSil = async (uid) => {
  const kova = getStorage().bucket();
  for (const onek of [`kullanicilar/${uid}/`, `cozumDetayi/${uid}/`, `solution-cards/${uid}/`]) {
    await kova.deleteFiles({ prefix: onek, force: true });
  }
  await kova
    .file(`profil_fotograflari/${uid}.jpg`)
    .delete()
    .catch((hata) => {
      if (hata?.code !== 404) throw hata;
    });
};

// onceki: silinmeden önceki profil verisi (yalnızca kurumId ve rol okunur)
// revenueCatSil: (uid) => Promise — mağaza müşteri kaydını siler (KVKK). Hata verirse tetikleyici yeniden dener;
// önceki adımlar tekrar çalıştırılabilir olduğundan sorun olmaz.
const silinenHesabiTemizle = async (uid, onceki, { revenueCatSil } = {}) => {
  if (typeof uid !== "string" || !UID_BICIMI.test(uid)) return null;

  const sonuc = { veli: 0, kod: 0, kurum: false, soru: 0 };
  sonuc.veli = await veliBaglantilariniTemizle(uid);
  sonuc.kod = await kodKayitlariniSil(uid);

  // Dershane öğrencisiyse üyelik sonlandırılır (yönetici hesaplarına uyelikSonlandir zaten dokunmaz)
  const kurumId = typeof onceki?.kurumId === "string" ? onceki.kurumId : null;
  if (kurumId && onceki?.rol !== "yonetici") {
    sonuc.kurum = await uyelikSonlandir(uid, kurumId);
  }

  sonuc.soru = await sorulariSil(uid);
  await dosyalariSil(uid);
  await db().doc(`abonelikEsitleme/${uid}`).delete();
  if (typeof revenueCatSil === "function") sonuc.revenueCat = await revenueCatSil(uid);
  return sonuc;
};

module.exports = { silinenHesabiTemizle, sorulariSil, dosyalariSil };
