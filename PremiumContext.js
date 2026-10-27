import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import PremiumModal from "./screens/PremiumModal";

// Premium durumunu ve ortak premium penceresini uygulamanın her yerine sunar.
// premiumMu değeri Firestore'dan canlı gelir; satın alma sonrası sunucu
// güncellediğinde arayüz kendiliğinden yenilenir.
const PremiumContext = createContext({
  premiumMu: false,
  premiumAc: () => {},
});

export const PremiumProvider = ({ premiumMu, rol, children }) => {
  const [modal, setModal] = useState({ gorunur: false, neden: null });

  // Veli hesaplarında günlük soru hakkı olmadığı için premium sunulmaz
  const premiumAc = useCallback(
    (neden) => {
      if (rol === "veli" || premiumMu) return;
      setModal({ gorunur: true, neden });
    },
    [rol, premiumMu]
  );

  const kapat = useCallback(
    () => setModal((onceki) => ({ ...onceki, gorunur: false })),
    []
  );

  // Satın alma tamamlanıp premium aktif olunca pencere kendiliğinden kapanır
  useEffect(() => {
    if (premiumMu && modal.gorunur) kapat();
  }, [premiumMu, modal.gorunur, kapat]);

  const deger = useMemo(() => ({ premiumMu, premiumAc }), [premiumMu, premiumAc]);

  return (
    <PremiumContext.Provider value={deger}>
      {children}
      <PremiumModal
        gorunur={modal.gorunur}
        neden={modal.neden}
        onKapat={kapat}
      />
    </PremiumContext.Provider>
  );
};

export const usePremium = () => useContext(PremiumContext);
