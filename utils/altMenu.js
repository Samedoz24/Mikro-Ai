import { useSafeAreaInsets } from "react-native-safe-area-context";

// Alt menü (yüzen kapsül) ölçüleri. Menü sayfanın üstünde yüzer; içerik arkasından akar.
// Bu yüzden her sekme ekranı en altına menü yüksekliği kadar boşluk bırakır (useAltMenuBoslugu).
export const ALT_MENU_UST_BOSLUK = 8;
export const ALT_MENU_KAPSUL = 64;

// Kapsülün altındaki boşluk: cihazın alt güvenli alanından biraz az, en az 10
export const altMenuAltBoslugu = (altGuvenliAlan) =>
  Math.max((Number(altGuvenliAlan) || 0) - 4, 10);

// Menünün ekranın altından kapladığı toplam yükseklik
export const altMenuYuksekligi = (altGuvenliAlan) =>
  ALT_MENU_UST_BOSLUK + ALT_MENU_KAPSUL + altMenuAltBoslugu(altGuvenliAlan);

// Ekranların en altına bırakacağı boşluk (menü yüksekliği + isteğe bağlı ek)
export default function useAltMenuBoslugu(ek = 0) {
  const insets = useSafeAreaInsets();
  return altMenuYuksekligi(insets.bottom) + ek;
}
