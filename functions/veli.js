// Veli bağlantıları: bir kullanıcı (öğrenci) belgesi silindiğinde, onu listesinde tutan velilerin
// bagliOgrenciIdleri ve bagliOgrenciler listelerinden çıkarılır. Veli paneli kimlik listesini
// bagliOgrenciler'den tamamladığı için iki listeden de silinmesi gerekir.

const { getFirestore } = require("firebase-admin/firestore");

const db = () => getFirestore();

// Saf: velinin belgesinden silinen öğrenciyi çıkarılmış listeler (değişiklik yoksa null)
const listedenCikar = (veli, silinenUid) => {
  const idler = Array.isArray(veli?.bagliOgrenciIdleri) ? veli.bagliOgrenciIdleri : [];
  const liste = Array.isArray(veli?.bagliOgrenciler) ? veli.bagliOgrenciler : [];
  const yeniIdler = idler.filter((id) => id !== silinenUid);
  const yeniListe = liste.filter((o) => !(o && typeof o === "object" && o.id === silinenUid));
  if (yeniIdler.length === idler.length && yeniListe.length === liste.length) return null;
  return { bagliOgrenciIdleri: yeniIdler, bagliOgrenciler: yeniListe };
};

// Silinen kullanıcıyı tüm velilerin listelerinden çıkarır; güncellenen veli sayısını döndürür.
// Tekrar çalıştırılabilir (idempotent): zaten temizse hiçbir şey yazmaz.
const veliBaglantilariniTemizle = async (silinenUid) => {
  if (typeof silinenUid !== "string" || !silinenUid) return 0;
  const veliler = await db()
    .collection("kullanicilar")
    .where("bagliOgrenciIdleri", "array-contains", silinenUid)
    .get();
  let guncellenen = 0;
  for (const belge of veliler.docs) {
    const degisti = await db().runTransaction(async (tx) => {
      const guncel = await tx.get(belge.ref);
      if (!guncel.exists) return false;
      const yeni = listedenCikar(guncel.data(), silinenUid);
      if (!yeni) return false;
      tx.update(belge.ref, yeni);
      return true;
    });
    if (degisti) guncellenen += 1;
  }
  return guncellenen;
};

module.exports = { listedenCikar, veliBaglantilariniTemizle };
