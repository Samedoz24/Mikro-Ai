import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Kurum öğrenci özetlerini (kurumlar/{id}/ozet) dinler. Genel Bakış ve Öğrenciler ekranı aynı
// kurumu izlediği için dinleme bu ekranlar arasında paylaşılır: her güncelleme bir kez okunur.
// Dinleyici, kullanan son ekran kapanınca durdurulur.
const kayitlar = new Map(); // kurumId -> { aboneler: Set, durum, iptal }

const BASLANGIC = { ozetler: null, hata: false };

const yayinla = (kayit) =>
  kayit.aboneler.forEach((abone) => abone(kayit.durum));

const kayitAc = (kurumId) => {
  const kayit = { aboneler: new Set(), durum: BASLANGIC, iptal: () => {} };
  kayit.iptal = onSnapshot(
    collection(db, "kurumlar", kurumId, "ozet"),
    (snap) => {
      kayit.durum = {
        ozetler: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        hata: false,
      };
      yayinla(kayit);
    },
    (hata) => {
      console.log("Öğrenci özetleri okunamadı:", hata?.code);
      // Önceden okunmuş veri varsa korunur; yalnızca hata işareti eklenir
      kayit.durum = { ozetler: kayit.durum.ozetler, hata: true };
      yayinla(kayit);
    }
  );
  kayitlar.set(kurumId, kayit);
  return kayit;
};

/**
 * @returns { ozetler: null | Array, hata: boolean }
 *  ozetler null ise henüz yüklenmedi; kurumId yoksa her zaman null.
 */
export default function useKurumOzetleri(kurumId) {
  const [durum, setDurum] = useState(
    () => (kurumId && kayitlar.get(kurumId)?.durum) || BASLANGIC
  );

  useEffect(() => {
    if (!kurumId) {
      setDurum(BASLANGIC);
      return;
    }
    const kayit = kayitlar.get(kurumId) || kayitAc(kurumId);
    kayit.aboneler.add(setDurum);
    setDurum(kayit.durum);
    return () => {
      kayit.aboneler.delete(setDurum);
      if (kayit.aboneler.size === 0) {
        kayit.iptal();
        // Aynı kurum için yeni bir kayıt açılmışsa ona dokunulmaz
        if (kayitlar.get(kurumId) === kayit) kayitlar.delete(kurumId);
      }
    };
  }, [kurumId]);

  return durum;
}
