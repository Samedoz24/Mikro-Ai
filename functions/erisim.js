// KVKK erişim kaydı: müdür öğrencinin sorularına/çözümlerine YALNIZCA bu fonksiyonlar üzerinden ulaşır.
// Her erişimde önce kayıt yazılır, ardından veri verilir; kayıt yazılamazsa veri verilmez.
//
// Veri:
//   kurumlar/{k}/erisimKayitlari/{id}   { yoneticiUid, yoneticiEposta, ogrenciUid, tur, zaman }
//        tur: 'soru-listesi' | 'soru-detay' | 'rapor'. Soru içeriği ya da soru kimliği TUTULMAZ.
//        Aynı (müdür, öğrenci, tür) için 15 dakikalık pencerede tek kayıt tutulur (kimlik belirlidir).
//   kurumlar/{k}/uyeler/{uid}.sonYonetimErisimi   öğrencinin "son erişim" satırı için zaman
// İstemci bu yollara yazamaz (güvenlik kuralları); müdür kayıtları okur, öğrenci yalnızca kendi üye
// belgesindeki son erişim zamanını okur.

const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { HttpsError } = require("firebase-functions/v2/https");
const { mudurDogrula } = require("./kurum");

const db = () => getFirestore();

const PENCERE_MS = 15 * 60 * 1000;
const SAKLAMA_MS = 365 * 24 * 60 * 60 * 1000; // 12 ay
const TURLER = ["soru-listesi", "soru-detay", "rapor"];
const UID_BICIMI = /^[A-Za-z0-9_-]{1,128}$/;
const SORU_KIMLIGI = /^[A-Za-z0-9]{1,64}$/;
const EN_FAZLA_SORU = 1000;
const EN_FAZLA_DOSYA = 4 * 1024 * 1024; // callable yanıt sınırı (10 MB) için güvenli pay
const TOPLU_BOYUT = 200;

const uidKontrol = (uid) => {
  if (typeof uid !== "string" || !UID_BICIMI.test(uid)) {
    throw new HttpsError("invalid-argument", "uid-gecersiz");
  }
  return uid;
};

const soruKimligiKontrol = (id) => {
  if (typeof id !== "string" || !SORU_KIMLIGI.test(id)) {
    throw new HttpsError("invalid-argument", "soru-gecersiz");
  }
  return id;
};

// Erişimi kaydeder (ve öğrencinin son erişim zamanını günceller). Öğrenci bu kurumun üyesi değilse
// hiçbir şey yazılmaz ve veri verilmez.
const erisimiKaydet = async (yonetici, kurumRef, ogrenciUid, tur, simdi = Date.now()) => {
  if (!TURLER.includes(tur)) throw new HttpsError("invalid-argument", "tur-gecersiz");
  const pencere = Math.floor(simdi / PENCERE_MS);
  const kayitRef = kurumRef
    .collection("erisimKayitlari")
    .doc(`${yonetici.uid}_${ogrenciUid}_${tur}_${pencere}`);
  const uyeRef = kurumRef.collection("uyeler").doc(ogrenciUid);

  await db().runTransaction(async (islem) => {
    const [uye, kayit] = await Promise.all([islem.get(uyeRef), islem.get(kayitRef)]);
    if (!uye.exists) throw new HttpsError("not-found", "ogrenci-yok");
    if (!kayit.exists) {
      islem.set(kayitRef, {
        yoneticiUid: yonetici.uid,
        yoneticiEposta: yonetici.eposta,
        ogrenciUid,
        tur,
        zaman: Timestamp.fromMillis(simdi),
      });
    }
    islem.update(uyeRef, { sonYonetimErisimi: Timestamp.fromMillis(simdi) });
  });
};

const sahiplikKontrol = async (soruId) => {
  const snap = await db().doc(`sorular/${soruId}`).get();
  const veri = snap.data();
  if (!snap.exists || typeof veri?.kullaniciUid !== "string") {
    throw new HttpsError("not-found", "soru-yok");
  }
  return { id: snap.id, veri, ogrenciUid: veri.kullaniciUid };
};

// İstemciye giden soru: kalıcı anahtar içeren bağlantılar çıkarılır, yalnızca ekranın gerektirdiği alanlar kalır
const SORU_ALANLARI = [
  "kullaniciUid", "kullaniciEposta", "tarih", "durum", "ders", "subject", "lesson", "topic", "subtopic",
  "konu", "dersKaynak", "okunduMu", "jsonPath", "firebasePath",
];

const tarihDegeri = (deger) => {
  if (deger && typeof deger.toMillis === "function") return deger.toMillis();
  return deger ?? null;
};

const sorulariHazirla = (soruId, veri) => {
  const cikti = { id: soruId };
  for (const alan of SORU_ALANLARI) {
    if (veri[alan] === undefined) continue;
    cikti[alan] = alan === "tarih" ? tarihDegeri(veri[alan]) : veri[alan];
  }
  // Fotoğraf varlığı bildirilir; bağlantının kendisi verilmez
  cikti.fotoVar = typeof veri.fotoLink === "string" && veri.fotoLink.length > 0;
  return cikti;
};

// ---------------------------------------------------------------------------
// Storage okuma (Admin SDK). Yolun sahibi öğrenci olmak zorundadır.
// ---------------------------------------------------------------------------
const bucket = () => getStorage().bucket();

const dosyaOku = async (yol) => {
  const dosya = bucket().file(yol);
  const [varMi] = await dosya.exists();
  if (!varMi) return null;
  const [meta] = await dosya.getMetadata();
  if (Number(meta.size) > EN_FAZLA_DOSYA) return null;
  const [icerik] = await dosya.download();
  return { icerik, tur: meta.contentType || "application/octet-stream" };
};

// fotoLink'ten Storage yolu: yalnızca bu projenin kovası ve öğrencinin kendi klasörü kabul edilir
const fotoYolu = (fotoLink, ogrenciUid) => {
  if (typeof fotoLink !== "string") return null;
  let url;
  try {
    url = new URL(fotoLink);
  } catch (e) {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "firebasestorage.googleapis.com") return null;
  const eslesme = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!eslesme || eslesme[1] !== bucket().name) return null;
  let yol;
  try {
    yol = decodeURIComponent(eslesme[2]);
  } catch (e) {
    return null;
  }
  const parcalar = yol.split("/");
  if (parcalar.length < 3 || parcalar[0] !== "kullanicilar" || parcalar[1] !== ogrenciUid) return null;
  if (parcalar.some((p) => p === "" || p === "." || p === "..")) return null;
  return yol;
};

const veriAdresi = (dosya) =>
  dosya ? `data:${dosya.tur};base64,${dosya.icerik.toString("base64")}` : null;

// Çözüm dosyası için aranacak yollar (istemcideki cozumYukleyici ile aynı mantık)
const YOL_BICIMI = /^(cozumDetayi|solution-cards)\/[^/]+\/[^/]+$/;
const zamanDamgasi = (soruId, veri) => {
  const link = veri.fotoLink;
  if (typeof link === "string") {
    const a = link.match(/(\d{13})/);
    if (a) return a[1];
    const b = link.match(/(\d+)\.(jpg|jpeg|png)/i);
    if (b) return b[1];
  }
  return soruId;
};
const adayYollar = (soruId, veri, klasor, uzanti, kayitliYol) => {
  const zaman = zamanDamgasi(soruId, veri);
  const yollar = [];
  const ekle = (yol) => {
    if (yol && !yollar.includes(yol)) yollar.push(yol);
  };
  if (typeof kayitliYol === "string" && YOL_BICIMI.test(kayitliYol)) ekle(kayitliYol);
  ekle(`${klasor}/${veri.kullaniciUid}/${zaman}.${uzanti}`);
  if (typeof veri.kullaniciEposta === "string" && veri.kullaniciEposta) {
    ekle(`${klasor}/${veri.kullaniciEposta}/${zaman}.${uzanti}`);
  }
  return yollar;
};

// Yalnızca öğrencinin UID'si ya da e-postası klasörü altındaki yollar okunur
const yolOgrenciyeAitMi = (yol, veri) => {
  const parcalar = yol.split("/");
  return (
    parcalar.length === 3 &&
    parcalar.every((p) => p !== "" && p !== "." && p !== "..") &&
    (parcalar[1] === veri.kullaniciUid || (veri.kullaniciEposta && parcalar[1] === veri.kullaniciEposta))
  );
};

const ilkDosya = async (yollar) => {
  let hata = false;
  for (const yol of yollar) {
    try {
      const dosya = await dosyaOku(yol);
      if (dosya) return { dosya };
    } catch (e) {
      console.log("Çözüm dosyası okunamadı:", e?.code || e?.message);
      hata = true;
    }
  }
  return { dosya: null, hata };
};

// ---------------------------------------------------------------------------
// Callable'lar (hepsi yalnızca müdür)
// ---------------------------------------------------------------------------

// Öğrencinin soru listesi. Girdi: { uid }
const ogrenciSorulariGetir = async (uid, token, veri) => {
  const ogrenciUid = uidKontrol(veri?.uid);
  const { kurumRef, eposta } = await mudurDogrula(uid, token);
  await erisimiKaydet({ uid, eposta }, kurumRef, ogrenciUid, "soru-listesi");

  const snap = await db()
    .collection("sorular")
    .where("kullaniciUid", "==", ogrenciUid)
    .limit(EN_FAZLA_SORU)
    .get();
  return { sorular: snap.docs.map((d) => sorulariHazirla(d.id, d.data())) };
};

// Bir sorunun çözümü ve fotoğrafı. Girdi: { soruId }
const soruCozumuGetir = async (uid, token, veri) => {
  const soruId = soruKimligiKontrol(veri?.soruId);
  const { kurumRef, eposta } = await mudurDogrula(uid, token);
  const soru = await sahiplikKontrol(soruId);
  await erisimiKaydet({ uid, eposta }, kurumRef, soru.ogrenciUid, "soru-detay");

  const belge = soru.veri;
  let cozum = null;
  if (belge.cozumDetayi && typeof belge.cozumDetayi === "object") cozum = belge.cozumDetayi;
  else if (typeof belge.cozumDetayi === "string" && belge.cozumDetayi.trim().startsWith("{")) {
    try {
      cozum = JSON.parse(belge.cozumDetayi);
    } catch (e) {}
  }
  let hata = false;
  if (!cozum) {
    const yollar = adayYollar(soruId, belge, "cozumDetayi", "json", belge.jsonPath).filter((y) =>
      yolOgrenciyeAitMi(y, belge)
    );
    const sonuc = await ilkDosya(yollar);
    if (sonuc.dosya) {
      try {
        cozum = JSON.parse(sonuc.dosya.icerik.toString("utf8"));
      } catch (e) {
        hata = true;
      }
    }
    hata = hata || !!sonuc.hata;
  }
  // Benzer sorular dosyada yoksa belgede yazılı olanlar kullanılır
  if (cozum && typeof cozum === "object") {
    for (const alan of ["similarQuestions", "benzerSorular"]) {
      const dosyadaVar = Array.isArray(cozum[alan]) && cozum[alan].length > 0;
      if (!dosyadaVar && Array.isArray(belge[alan]) && belge[alan].length > 0) {
        cozum = { ...cozum, [alan]: belge[alan] };
      }
    }
  }

  const kartYollari = adayYollar(soruId, belge, "solution-cards", "png", belge.firebasePath).filter((y) =>
    yolOgrenciyeAitMi(y, belge)
  );
  const kart = await ilkDosya(kartYollari);

  let fotograf = null;
  const fYol = fotoYolu(belge.fotoLink, soru.ogrenciUid);
  if (fYol) {
    try {
      fotograf = veriAdresi(await dosyaOku(fYol));
    } catch (e) {
      hata = true;
    }
  }

  return {
    cozum: cozum && typeof cozum === "object" ? cozum : null,
    kartResmi: veriAdresi(kart.dosya),
    fotograf,
    hata: hata || !!kart.hata,
  };
};

// Soru listesindeki küçük resim için fotoğraf. Girdi: { soruId }
const soruFotografiGetir = async (uid, token, veri) => {
  const soruId = soruKimligiKontrol(veri?.soruId);
  const { kurumRef, eposta } = await mudurDogrula(uid, token);
  const soru = await sahiplikKontrol(soruId);
  await erisimiKaydet({ uid, eposta }, kurumRef, soru.ogrenciUid, "soru-listesi");
  const yol = fotoYolu(soru.veri.fotoLink, soru.ogrenciUid);
  if (!yol) return { fotograf: null };
  try {
    return { fotograf: veriAdresi(await dosyaOku(yol)) };
  } catch (e) {
    console.log("Fotoğraf okunamadı:", e?.code || e?.message);
    return { fotograf: null };
  }
};

// Rapor (PDF) oluşturulurken istemci çağırır; özet verisi doğrudan okunduğu için en iyi çaba kaydıdır.
const raporKaydi = async (uid, token, veri) => {
  const ogrenciUid = uidKontrol(veri?.uid);
  const { kurumRef, eposta } = await mudurDogrula(uid, token);
  await erisimiKaydet({ uid, eposta }, kurumRef, ogrenciUid, "rapor");
  return { tamam: true };
};

// ---------------------------------------------------------------------------
// KVKK: saklama ve anonimleştirme (her gece çalışır)
//   1) 12 aydan eski erişim kayıtları silinir.
//   2) Hesabı silinen öğrencinin kayıtlarından kimliği (ogrenciUid) kaldırılır; kayıt, yöneticinin
//      ne zaman erişim yaptığının denetim izi olarak saklama süresi dolana kadar kalır ama artık kimseyle eşleşmez.
// Kurumlar listDocuments ile gezilir: belgesi silinmiş olsa bile altındaki kayıtlar yetim kalmaz.
// ---------------------------------------------------------------------------
const kurumReferanslari = async () => db().collection("kurumlar").listDocuments();

const eskiKayitlariSil = async (simdi = Date.now()) => {
  const sinir = Timestamp.fromMillis(simdi - SAKLAMA_MS);
  let silinen = 0;
  for (const kurumRef of await kurumReferanslari()) {
    for (;;) {
      const eski = await kurumRef
        .collection("erisimKayitlari")
        .where("zaman", "<", sinir)
        .limit(TOPLU_BOYUT)
        .get();
      if (eski.empty) break;
      const batch = db().batch();
      eski.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      silinen += eski.size;
    }
  }
  return silinen;
};

const silinenOgrencileriAnonimlestir = async () => {
  let anonim = 0;
  for (const kurumRef of await kurumReferanslari()) {
    const koleksiyon = kurumRef.collection("erisimKayitlari");
    let imlec = null;
    for (;;) {
      let sorgu = koleksiyon.orderBy("__name__").limit(TOPLU_BOYUT);
      if (imlec) sorgu = sorgu.startAfter(imlec);
      const sayfa = await sorgu.get();
      if (sayfa.empty) break;
      imlec = sayfa.docs[sayfa.docs.length - 1];

      const uidler = [
        ...new Set(sayfa.docs.map((d) => d.data().ogrenciUid).filter((u) => typeof u === "string" && u)),
      ];
      if (uidler.length > 0) {
        const profiller = await db().getAll(...uidler.map((u) => db().doc(`kullanicilar/${u}`)));
        const silinenler = new Set(uidler.filter((_, i) => !profiller[i].exists));
        const batch = db().batch();
        let sayac = 0;
        for (const d of sayfa.docs) {
          if (silinenler.has(d.data().ogrenciUid)) {
            batch.update(d.ref, { ogrenciUid: FieldValue.delete() });
            sayac++;
          }
        }
        if (sayac > 0) await batch.commit();
        anonim += sayac;
      }
      if (sayfa.size < TOPLU_BOYUT) break;
    }
  }
  return anonim;
};

module.exports = {
  ogrenciSorulariGetir,
  soruCozumuGetir,
  soruFotografiGetir,
  raporKaydi,
  eskiKayitlariSil,
  silinenOgrencileriAnonimlestir,
  erisimiKaydet,
  fotoYolu,
};
