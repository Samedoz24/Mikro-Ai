import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { gruplariHazirla } from "./kurumIstatistik";

// Dershanenin gruplarını (sınıf/şube) canlı izler: [{ id, ad }], ada göre sıralı.
// Grup adlarını tüm yöneticiler okuyabilir. gruplar null ise henüz yüklenmedi.
export default function useGruplar(kurumId) {
  const [gruplar, setGruplar] = useState(null);

  useEffect(() => {
    if (!kurumId) {
      setGruplar(null);
      return;
    }
    return onSnapshot(
      collection(db, "kurumlar", kurumId, "gruplar"),
      (snap) =>
        setGruplar(
          gruplariHazirla(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        ),
      (hata) => {
        console.log("Gruplar okunamadı:", hata?.code);
        // Grup listesi alınamasa da ekranlar çalışır: boş liste varsayılır
        setGruplar((onceki) => onceki ?? []);
      }
    );
  }, [kurumId]);

  return gruplar;
}
