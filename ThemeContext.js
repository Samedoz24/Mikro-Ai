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

export const ThemeProvider = ({ children }) => {
  const sistemTemasi = useColorScheme(); // Telefonun kendi ayarı
  const [temaModu, setTemaModu] = useState("system"); // 'light', 'dark', 'system'

  // Uygulama açıldığında kaydedilen tercihi yükle
  useEffect(() => {
    const tercihiYukle = async () => {
      const kaydedilenMod = await AsyncStorage.getItem("kullaniciTemaTercihi");
      if (kaydedilenMod) {
        setTemaModu(kaydedilenMod);
      }
    };
    tercihiYukle();
  }, []);

  // Tercihi değiştir ve kaydet
  const temaDegistir = async (yeniMod) => {
    setTemaModu(yeniMod);
    await AsyncStorage.setItem("kullaniciTemaTercihi", yeniMod);
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
