import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

// Kurum belgesini (ad, kontenjan, lisans vb.) canlı izler. Yetkisi olmayan ya da okunamayan
// durumda null döner; ekranlar bu bilgi olmadan da çalışır.
export default function useKurum(kurumId) {
  const [kurum, setKurum] = useState(null);

  useEffect(() => {
    if (!kurumId) {
      setKurum(null);
      return;
    }
    return onSnapshot(
      doc(db, "kurumlar", kurumId),
      (snap) => setKurum(snap.exists() ? snap.data() : null),
      (hata) => {
        console.log("Kurum bilgisi okunamadı:", hata?.code);
        setKurum(null);
      }
    );
  }, [kurumId]);

  return kurum;
}
