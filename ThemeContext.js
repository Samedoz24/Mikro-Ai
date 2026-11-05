import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "./theme";

const ThemeContext = createContext();
const GECERLI_MODLAR = ["light", "dark", "system"];

export const ThemeProvider = ({ children }) => {
  const sistemTemasi = useColorScheme(); // Telefonun kendi ayarı
  const [temaModu, setTemaModu] = useState("system"); // 'light', 'dark', 'system'

  // Uygulama açıldığında kaydedilen tercihi yükle
  useEffect(() => {
    const tercihiYukle = async () => {
      try {
        const kaydedilenMod = await AsyncStorage.getItem("kullaniciTemaTercihi");
        // Yalnızca geçerli değerler kabul edilir; bozuk kayıt "system"e düşer
        if (GECERLI_MODLAR.includes(kaydedilenMod)) {
          setTemaModu(kaydedilenMod);
        }
      } catch {}
    };
    tercihiYukle();
  }, []);

  // Tercihi değiştir ve kaydet
  const temaDegistir = async (yeniMod) => {
    if (!GECERLI_MODLAR.includes(yeniMod)) return;
    setTemaModu(yeniMod);
    try {
      await AsyncStorage.setItem("kullaniciTemaTercihi", yeniMod);
    } catch {}
  };

  // ⚡ HATANIN ÇÖZÜMÜ: useMemo ile temayı React'ın hafızasına sabitleyip anında tetiklemek
  const tema = useMemo(() => {
    if (temaModu === "system") {
      return sistemTemasi === "dark" ? colors.dark : colors.light;
    }
    return temaModu === "dark" ? colors.dark : colors.light;
  }, [temaModu, sistemTemasi]);

  return (
    <ThemeContext.Provider value={{ temaModu, temaDegistir, tema }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
