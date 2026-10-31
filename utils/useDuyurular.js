import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Müdürün duyuru yönetim listesini (kurumlar/{id}/duyurular) canlı izler. Yalnızca müdür okuyabilir.
// duyurular null ise henüz yüklenmedi; hata true ise liste alınamadı.
export default function useDuyurular(kurumId) {
  const [durum, setDurum] = useState({ duyurular: null, hata: false });

  useEffect(() => {
    if (!kurumId) {
      setDurum({ duyurular: null, hata: false });
      return;
    }
    return onSnapshot(
      collection(db, "kurumlar", kurumId, "duyurular"),
      (snap) =>
        setDurum({
          duyurular: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          hata: false,
        }),
      (hata) => {
        console.log("Duyurular okunamadı:", hata?.code);
        // Önceden okunmuş liste varsa korunur; yalnızca hata işareti eklenir
        setDurum((onceki) => ({ duyurular: onceki.duyurular, hata: true }));
      }
    );
  }, [kurumId]);

  return durum;
}
