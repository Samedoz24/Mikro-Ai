// Sahipsiz veri temizliği (KVKK: amacı kalmayan kişisel veri silinir). İKİ AŞAMALI ve denetlenebilir:
//
//   1) RAPOR: Sahibi BUGÜN var olmayan veriler listelenir, hiçbir şey silinmez. Rapor ayarlar/temizlik
//      belgesine yazılır (istemciye kapalı) ve durum "rapor-hazir" olur.
//   2) SİLME: Yalnızca bir insan Console'dan durum alanını "onaylandi" yaparsa, raporda listelenen öğeler
//      silinir. Her öğe silinmeden hemen önce YENİDEN denetlenir: o arada aynı kimlikle ya da e-postayla
//      hesap açıldıysa dokunulmaz. Rapordan sonra sahipsiz kalan yeni veri silinmez (yeni rapor gerekir).
//
// Kesin kurallar:
//   - Var olan bir Firebase hesabına ait hiçbir şey listelenmez ve silinmez.
//   - Sahibi belirsiz olan (kimlik ya da e-posta biçiminde olmayan) klasörler yalnızca raporlanır, silinmez.
//   - Klasörler tam ad eşleşmesiyle ve "/" ile biten önekle silinir (başka klasöre taşma olmaz).
//
// Gece görevinden (lisansKontrol) çağrılır; durum "tamamlandi" ise bir şey yapmaz.

const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const { silinenHesabiTemizle } = require("./hesapTemizlik");
const { uyelikSonlandir } = require("./kurum");
const { kimlikYazilabilirMi } = require("./goc");

const db = () => getFirestore();
const DURUM = "ayarlar/temizlik";
const KIMLIK_BICIMI = /^[A-Za-z0-9]{20,128}$/;
const EPOSTA_BICIMI = /^[^\s@/]+@[^\s@/]+$/;
const SAYFA = 300;

const zamanMs = (deger) => {
  if (deger && typeof deger.toMillis === "function") return deger.toMillis();
  if (typeof deger === "string") {
    const ms = Date.parse(deger);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
};
const normEposta = (e) => (typeof e === "string" ? e.trim().toLowerCase() : "");

// Tüm Firebase hesapları: kimlikler ve e-posta -> { uid, olusturmaMs }
const hesaplariTopla = async () => {
  const kimlikler = new Set();
  const epostalar = new Map();
  let sayfa;
  do {
    const sonuc = await getAuth().listUsers(1000, sayfa);
    for (const k of sonuc.users) {
      kimlikler.add(k.uid);
      if (k.email) epostalar.set(normEposta(k.email), { uid: k.uid, olusturmaMs: Date.parse(k.metadata.creationTime) });
    }
    sayfa = sonuc.pageToken;
  } while (sayfa);
  return { kimlikler, epostalar };
};

const tumBelgeler = async function* (koleksiyonRef) {
  let imlec = null;
  for (;;) {
    let sorgu = koleksiyonRef.orderBy("__name__").limit(SAYFA);
    if (imlec) sorgu = sorgu.startAfter(imlec);
    const snap = await sorgu.get();
    if (snap.empty) return;
    for (const d of snap.docs) yield d;
    imlec = snap.docs[snap.docs.length - 1];
    if (snap.size < SAYFA) return;
  }
};

// Bir soru, var olan bir hesaba ait mi?
const soruSahibiVarMi = (veri, hesaplar) => {
  if (typeof veri.kullaniciUid === "string" && veri.kullaniciUid) return hesaplar.kimlikler.has(veri.kullaniciUid);
  const hesap = hesaplar.epostalar.get(normEposta(veri.kullaniciEposta));
  return kimlikYazilabilirMi(zamanMs(veri.tarih), hesap || null);
};

// ---------------------------------------------------------------------------- 1) RAPOR
const raporOlustur = async () => {
  const hesaplar = await hesaplariTopla();
  const kimlikler = new Set(); // sahipsiz kimlikler
  const epostaSorulari = [];
  const uyelikler = [];
  const epostaKlasorleri = new Set();
  const belirsizKlasorler = new Set();

  const kimlikGor = (uid) => {
    if (typeof uid === "string" && KIMLIK_BICIMI.test(uid) && !hesaplar.kimlikler.has(uid)) kimlikler.add(uid);
  };

  for await (const d of tumBelgeler(db().collection("kullanicilar"))) kimlikGor(d.id);
  for await (const d of tumBelgeler(db().collection("baglantiKodlari"))) kimlikGor(d.data().uid);
  for await (const d of tumBelgeler(db().collection("sorular"))) {
    const veri = d.data();
    if (soruSahibiVarMi(veri, hesaplar)) continue;
    if (typeof veri.kullaniciUid === "string" && veri.kullaniciUid) kimlikGor(veri.kullaniciUid);
    else epostaSorulari.push(d.id);
  }
  for (const kurumRef of await db().collection("kurumlar").listDocuments()) {
    for await (const uye of tumBelgeler(kurumRef.collection("uyeler"))) {
      if (!hesaplar.kimlikler.has(uye.id)) uyelikler.push({ kurumId: kurumRef.id, uid: uye.id });
    }
  }

  // Storage: üst klasör adları
  const [dosyalar] = await getStorage().bucket().getFiles();
  for (const dosya of dosyalar) {
    const parca = dosya.name.split("/");
    if (parca[0] === "profil_fotograflari" && parca.length === 2) {
      kimlikGor(parca[1].replace(/\.jpg$/, ""));
      continue;
    }
    if (!["kullanicilar", "cozumDetayi", "solution-cards"].includes(parca[0]) || parca.length < 3) continue;
    const ad = parca[1];
    if (KIMLIK_BICIMI.test(ad)) kimlikGor(ad);
    else if (EPOSTA_BICIMI.test(ad) && parca[0] !== "kullanicilar") {
      if (!hesaplar.epostalar.has(normEposta(ad))) epostaKlasorleri.add(`${parca[0]}/${ad}`);
    } else belirsizKlasorler.add(`${parca[0]}/${ad}`);
  }

  return {
    kimlikler: [...kimlikler].sort(),
    epostaSorulari: epostaSorulari.sort(),
    uyelikler,
    epostaKlasorleri: [...epostaKlasorleri].sort(),
    belirsizKlasorler: [...belirsizKlasorler].sort(), // yalnızca bilgi: SİLİNMEZ
  };
};

// ---------------------------------------------------------------------------- 2) SİLME (onaylı rapor)
const raporuUygula = async (rapor) => {
  const hesaplar = await hesaplariTopla(); // silme anındaki güncel durum
  const sonuc = { kimlik: 0, soru: 0, uyelik: 0, klasor: 0, atlanan: 0 };
  const kova = getStorage().bucket();

  for (const uid of rapor.kimlikler || []) {
    if (!KIMLIK_BICIMI.test(uid) || hesaplar.kimlikler.has(uid)) {
      sonuc.atlanan++;
      continue;
    }
    const profilRef = db().doc(`kullanicilar/${uid}`);
    const profil = await profilRef.get();
    await silinenHesabiTemizle(uid, profil.exists ? profil.data() : null);
    if (profil.exists) await profilRef.delete();
    await db().doc(`kotaSayaclari/h_${uid}`).delete();
    sonuc.kimlik++;
  }

  for (const id of rapor.epostaSorulari || []) {
    const ref = db().doc(`sorular/${id}`);
    const snap = await ref.get();
    if (!snap.exists) continue;
    if (soruSahibiVarMi(snap.data(), hesaplar)) {
      sonuc.atlanan++;
      continue;
    }
    await ref.delete();
    sonuc.soru++;
  }

  for (const { kurumId, uid } of rapor.uyelikler || []) {
    if (hesaplar.kimlikler.has(uid)) {
      sonuc.atlanan++;
      continue;
    }
    if (await uyelikSonlandir(uid, kurumId)) sonuc.uyelik++;
  }

  for (const klasor of rapor.epostaKlasorleri || []) {
    const [ust, ad] = klasor.split("/");
    if (!["cozumDetayi", "solution-cards"].includes(ust) || !EPOSTA_BICIMI.test(ad || "")) {
      sonuc.atlanan++;
      continue;
    }
    if (hesaplar.epostalar.has(normEposta(ad))) {
      sonuc.atlanan++;
      continue;
    }
    await kova.deleteFiles({ prefix: `${ust}/${ad}/`, force: true });
    sonuc.klasor++;
  }
  return sonuc;
};

// Gece adımı: rapor yoksa hazırlar; onaylandıysa uygular; aksi halde bir şey yapmaz
const sahipsizVeriAdimi = async () => {
  const ref = db().doc(DURUM);
  const mevcut = (await ref.get()).data();
  if (!mevcut) {
    const rapor = await raporOlustur();
    const ozet = Object.fromEntries(Object.entries(rapor).map(([k, v]) => [k, v.length]));
    await ref.set({ durum: "rapor-hazir", rapor, ozet, raporTarihi: FieldValue.serverTimestamp() });
    return { islem: "rapor", ozet };
  }
  // "uygulaniyor": önceki çalışma yarıda kaldıysa kaldığı yerden devam eder (silme tekrar çalıştırılabilir)
  if (mevcut.durum === "onaylandi" || mevcut.durum === "uygulaniyor") {
    await ref.update({ durum: "uygulaniyor" });
    const sonuc = await raporuUygula(mevcut.rapor || {});
    await ref.update({ durum: "tamamlandi", sonuc, tamamlanma: FieldValue.serverTimestamp() });
    return { islem: "silme", sonuc };
  }
  return { islem: "yok", durum: mevcut.durum };
};

module.exports = { raporOlustur, raporuUygula, sahipsizVeriAdimi };
