// Premium'un kaynağı (yalnızca GÖRÜNÜM için). Kaynakları yalnızca sunucu yazar (firestore.rules sunucuAlanlari);
// uygulama yalnızca kendi profilinden okur. Premium'a, kotaya ya da yetkiye bu dosya karar VERMEZ: sunucu verir.
//   premiumKaynaklari = { kurum: true, abonelik: { aktif, bitis, urun }, elle: true }

const zamanMs = (deger) => {
  if (deger && typeof deger.toMillis === "function") return deger.toMillis();
  if (deger instanceof Date) return deger.getTime();
  if (typeof deger === "number" || typeof deger === "string") {
    const ms = new Date(deger).getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }
  return NaN;
};

// Dönüş: { kurum, abonelik, elle } — abonelik yalnızca aktif VE bitişi gelecekteyse true
export const premiumKaynagiCoz = (kaynaklar, simdi = Date.now()) => {
  const k = kaynaklar && typeof kaynaklar === "object" ? kaynaklar : {};
  const abonelik = k.abonelik && typeof k.abonelik === "object" ? k.abonelik : null;
  return {
    kurum: k.kurum === true,
    abonelik: !!abonelik && abonelik.aktif === true && zamanMs(abonelik.bitis) > simdi,
    elle: k.elle === true,
  };
};

// Hesabım > Abonelik kartı: açıklama metni ve "Aboneliği Yönet" düğmesi gösterilsin mi?
// Düğme yalnızca geçerli bir mağaza aboneliği varken gösterilir (dershane / elle Premium'da Apple'da yönetilecek
// bir abonelik yoktur).
export const abonelikKarti = ({ premiumMu, kaynak, ucretsizSinir, premiumSinir }) => {
  const sinirliMi = Number.isInteger(premiumSinir);
  if (!premiumMu) {
    return {
      aciklama:
        Number.isInteger(ucretsizSinir) && sinirliMi
          ? `Günde ${ucretsizSinir} soru. Premium ile günde ${premiumSinir} soru ve PDF indirme.`
          : "Premium ile daha fazla günlük soru ve PDF indirme.",
      yonetDugmesi: false,
      rozet: "Ücretsiz",
    };
  }
  const hak = sinirliMi ? `Günde ${premiumSinir} soru ve PDF indirme aktif.` : "Premium soru hakkı ve PDF indirme aktif.";
  if (kaynak?.kurum) {
    return {
      aciklama: kaynak.abonelik
        ? `Premium'un dershanenden geliyor. ${hak} Ayrıca bir App Store aboneliğin var; dershanen Premium sağladığı için dilersen aboneliğini iptal edebilirsin.`
        : `Premium'un dershanenden geliyor. ${hak}`,
      yonetDugmesi: kaynak.abonelik === true,
      rozet: "Premium · Dershane",
    };
  }
  return { aciklama: hak, yonetDugmesi: kaynak?.abonelik === true, rozet: "Premium" };
};
