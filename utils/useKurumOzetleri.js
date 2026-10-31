import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { KAPSAM_TUM, kapsamAnahtari } from "./kurumKapsam";

// Öğrenci özetlerini dinler. Kapsam "tum" ise kurum geneli koleksiyon (kurumlar/{id}/ozet),
// "gruplar" ise yetkili olunan her grubun koleksiyonu (kurumlar/{id}/gruplar/{g}/ozet) dinlenir ve
// birleştirilir. Ekranlar aynı kapsamı izlediğinde dinleme paylaşılır: her güncelleme bir kez okunur.
// Dinleyiciler, kullanan son ekran kapanınca durdurulur.
const kayitlar = new Map(); // anahtar -> { aboneler: Set, durum, iptaller: [] }

const BASLANGIC = { ozetler: null, hata: false };

const yayinla = (kayit) =>
  kayit.aboneler.forEach((abone) => abone(kayit.durum));

const yollariBul = (kurumId, kapsam, gruplar) =>
  kapsam === KAPSAM_TUM
    ? [["kurumlar", kurumId, "ozet"]]
    : gruplar.map((g) => ["kurumlar", kurumId, "gruplar", g, "ozet"]);

const kayitAc = (anahtar, kurumId, kapsam, gruplar) => {
  const kayit = { aboneler: new Set(), durum: BASLANGIC, iptaller: [] };
  kayitlar.set(anahtar, kayit);

  const yollar = yollariBul(kurumId, kapsam, gruplar);
  if (yollar.length === 0) {
    // Hiç grubu olmayan öğretmen: dinlenecek bir şey yok, liste boştur
    kayit.durum = { ozetler: [], hata: false };
    return kayit;
  }

  const parcalar = new Map(); // yol sırası -> belgeler
  const hatalilar = new Set();

  const guncelle = () => {
    // İlk yüklemede her parça yanıt verene (veri ya da hata) kadar liste "yükleniyor" kalır
    if (parcalar.size + hatalilar.size < yollar.length) return;
    const birlesik = new Map();
    parcalar.forEach((belgeler) =>
      belgeler.forEach((b) => birlesik.set(b.id, b))
    );
    kayit.durum = {
      ozetler: parcalar.size > 0 ? [...birlesik.values()] : null,
      hata: hatalilar.size > 0,
    };
    yayinla(kayit);
  };

  yollar.forEach((yol, i) => {
    kayit.iptaller.push(
      onSnapshot(
        collection(db, ...yol),
        (snap) => {
          parcalar.set(
            i,
            snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          );
          hatalilar.delete(i);
          guncelle();
        },
        (hata) => {
          console.log("Öğrenci özetleri okunamadı:", hata?.code);
          // Bu parça daha önce okunduysa eski verisi korunur; yalnızca hata işareti eklenir
          hatalilar.add(i);
          guncelle();
        }
      )
    );
  });
  return kayit;
};

/**
 * @param kurumId  kurum kimliği
 * @param kapsam   "tum" (varsayılan) ya da "gruplar"
 * @param gruplar  kapsam "gruplar" ise grup kimlikleri
 * @returns { ozetler: null | Array, hata: boolean }
 *  ozetler null ise henüz yüklenmedi; kurumId yoksa her zaman null.
 */
export default function useKurumOzetleri(
  kurumId,
  kapsam = KAPSAM_TUM,
  gruplar = []
) {
  const anahtar = kurumId
    ? `${kurumId}|${kapsamAnahtari(kapsam, gruplar)}`
    : null;
  const [durum, setDurum] = useState(
    () => (anahtar && kayitlar.get(anahtar)?.durum) || BASLANGIC
  );

  useEffect(() => {
    if (!anahtar) {
      setDurum(BASLANGIC);
      return;
    }
    const kayit =
      kayitlar.get(anahtar) || kayitAc(anahtar, kurumId, kapsam, gruplar);
    kayit.aboneler.add(setDurum);
    setDurum(kayit.durum);
    return () => {
      kayit.aboneler.delete(setDurum);
      if (kayit.aboneler.size === 0) {
        kayit.iptaller.forEach((iptal) => iptal());
        // Aynı anahtar için yeni bir kayıt açılmışsa ona dokunulmaz
        if (kayitlar.get(anahtar) === kayit) kayitlar.delete(anahtar);
      }
    };
    // gruplar dizisi her çağrıda yeni olabilir; içeriği anahtarda olduğu için anahtar yeterlidir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar]);

  return durum;
}
