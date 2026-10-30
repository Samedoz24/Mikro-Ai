import { useCallback, useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { auth } from "../firebaseConfig";

export const YONETICI_RENGI = "#0F766E";
export const ROL_ETIKETLERI = { mudur: "Müdür", ogretmen: "Öğretmen" };

// Yönetici yetkisi, sunucunun kimlik belirtecine yazdığı kurumId ve kurumRol bilgilerinden gelir.
// Ekran her odaklandığında belirteç sunucudan yenilenir: geri alınan yetki en geç o zaman fark edilir.
// yetki: undefined = yükleniyor, null = yetki yok, { kurumId, kurumRol } = yetkili
export default function useYoneticiYetkisi() {
  const odakta = useIsFocused();
  const [yetki, setYetki] = useState(undefined);

  const yenile = useCallback(async () => {
    try {
      const kullanici = auth.currentUser;
      if (!kullanici) return;
      const sonuc = await kullanici.getIdTokenResult(true);
      const { kurumId, kurumRol } = sonuc.claims;
      setYetki(kurumId && kurumRol ? { kurumId, kurumRol } : null);
    } catch (hata) {
      console.log("Yönetici yetkisi okunamadı:", hata?.code);
      // Ağ hatasında daha önce okunmuş yetki korunur; hiç okunmadıysa yetkisiz sayılır
      setYetki((onceki) => (onceki === undefined ? null : onceki));
    }
  }, []);

  useEffect(() => {
    if (odakta) yenile();
  }, [odakta, yenile]);

  return { yetki, yenile };
}
