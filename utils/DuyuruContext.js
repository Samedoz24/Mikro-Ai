import { createContext, useContext } from "react";

// Öğrencinin duyuru kutusu uygulama genelinde bir kez dinlenir (App.js) ve buradan paylaşılır:
// hem Hesabım sekmesindeki rozet hem dershane kartındaki liste aynı veriyi kullanır.
export const DuyuruContext = createContext({
  duyurular: [],
  okunmamis: 0,
  esik: 0,
  okunduIsaretle: async () => {},
});

export const useOgrenciDuyurulari = () => useContext(DuyuruContext);
