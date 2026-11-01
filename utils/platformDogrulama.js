// Platform yöneticisinin "Dershane Ekle" formu için saf mantık (ağ kullanmaz, kolayca test edilir).
// Asıl doğrulama sunucudadır; buradaki denetimler yalnızca hızlı ve anlaşılır geri bildirim içindir.

const EPOSTA_BICIMI = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;
const KONTROL_KARAKTERI = /[\u0000-\u001f\u007f]/;

export const AD_EN_FAZLA = 80;
export const KOLTUK_EN_FAZLA = 5000;

const ALFABE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Sunucudaki istek kimliği biçimi: 20 harf/rakam. Aynı form denemesi tekrar gönderilirse aynı kimlikle gider,
// böylece ağ kopması ya da çift dokunuş ikinci bir dershane açmaz.
export const yeniIstekKimligi = (rastgele = Math.random) =>
  Array.from(
    { length: 20 },
    () => ALFABE[Math.floor(rastgele() * ALFABE.length)]
  ).join("");

const iki = (n) => String(n).padStart(2, "0");

// Takvim günü gerçekten var mı?
const gunVarMi = (yil, ay, gun) => {
  const d = new Date(Date.UTC(yil, ay - 1, gun));
  return (
    d.getUTCFullYear() === yil &&
    d.getUTCMonth() === ay - 1 &&
    d.getUTCDate() === gun
  );
};

// "GG.AA.YYYY" (ya da "GG/AA/YYYY", "GG-AA-YYYY") -> "YYYY-AA-GG"; geçersizse null
export const tarihiCoz = (metin) => {
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(
    String(metin ?? "").trim()
  );
  if (!m) return null;
  const [gun, ay, yil] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!gunVarMi(yil, ay, gun)) return null;
  return `${yil}-${iki(ay)}-${iki(gun)}`;
};

// "YYYY-AA-GG" -> "GG.AA.YYYY"
export const tarihiGoster = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
};

// Bugünden itibaren N yıl sonrası (Türkiye takvimi), "GG.AA.YYYY". 29 Şubat'ta 28 Şubat'a düşer.
export const yilSonrasi = (yil, simdi = Date.now()) => {
  const tr = new Date(simdi + 3 * 60 * 60 * 1000);
  const hedefYil = tr.getUTCFullYear() + yil;
  let gun = tr.getUTCDate();
  const ay = tr.getUTCMonth() + 1;
  if (!gunVarMi(hedefYil, ay, gun)) gun = 28;
  return `${iki(gun)}.${iki(ay)}.${hedefYil}`;
};

// Form alanlarını denetler. Dönüş: { hata: "metin" } ya da { veri: { ad, koltuk, lisansBitis, mudurEposta } }
export const formuDenetle = (
  { ad, koltuk, tarih, eposta },
  simdi = Date.now()
) => {
  const temizAd = String(ad ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (temizAd.length < 2)
    return { hata: "Dershane adı en az 2 karakter olmalı." };
  if (temizAd.length > AD_EN_FAZLA)
    return { hata: `Dershane adı en fazla ${AD_EN_FAZLA} karakter olabilir.` };
  if (KONTROL_KARAKTERI.test(temizAd))
    return { hata: "Dershane adında geçersiz karakter var." };

  const koltukMetni = String(koltuk ?? "").trim();
  if (!/^\d{1,4}$/.test(koltukMetni))
    return {
      hata: `Koltuk sayısı 1 ile ${KOLTUK_EN_FAZLA} arasında bir tam sayı olmalı.`,
    };
  const koltukSayisi = Number(koltukMetni);
  if (koltukSayisi < 1 || koltukSayisi > KOLTUK_EN_FAZLA) {
    return { hata: `Koltuk sayısı 1 ile ${KOLTUK_EN_FAZLA} arasında olmalı.` };
  }

  const iso = tarihiCoz(tarih);
  if (!iso)
    return {
      hata: "Lisans bitiş tarihini GG.AA.YYYY biçiminde yaz (örn. 31.08.2027).",
    };
  const bitis = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
    20,
    59,
    59,
    999
  );
  if (bitis <= simdi)
    return { hata: "Lisans bitiş tarihi bugünden sonra olmalı." };
  if (bitis > simdi + 5 * 366 * 24 * 60 * 60 * 1000)
    return { hata: "Lisans bitiş tarihi en fazla 5 yıl sonrası olabilir." };

  const temizEposta = String(eposta ?? "")
    .trim()
    .toLowerCase();
  if (temizEposta.length > 254 || !EPOSTA_BICIMI.test(temizEposta)) {
    return { hata: "Müdürün e-posta adresini doğru yaz." };
  }

  return {
    veri: {
      ad: temizAd,
      koltuk: koltukSayisi,
      lisansBitis: iso,
      mudurEposta: temizEposta,
    },
  };
};

// Oluşturulan dershane için müdüre iletilecek mesaj
export const mudurMesaji = ({ ad, mudurEposta, kurumKodu }) =>
  `${ad} için Mikro yönetici hesabın hazır.\n\n` +
  `1) Mikro uygulamasını indir.\n` +
  `2) Giriş ekranında "Yönetici" sekmesini seç ve ${mudurEposta} e-posta adresinle giriş yap (e-postanı doğrulaman gerekir).\n` +
  `3) Dershane sekmesinden öğrencilerine verebileceğin kayıt kodunu görürsün: ${kurumKodu}`;

// Dershane durumu etiketi ve yapılabilecek işlemler (kural: sunucu yine de doğrular)
export const durumEtiketi = (durum) =>
  ({
    aktif: "Aktif",
    askida: "Askıda",
    kapatiliyor: "Kapatılıyor",
    kapatildi: "Kapalı",
    "suresi-doldu": "Süresi doldu",
  })[durum] || "Bilinmiyor";

export const eylemler = (durum) => ({
  askiyaAl: durum === "aktif",
  yenidenAc: durum === "askida",
  kapat: durum === "aktif" || durum === "askida" || durum === "kapatiliyor",
});

// Kapatma onayı: yazılan ad dershane adıyla (boşluklar sadeleştirilerek, büyük/küçük harf duyarlı) aynı mı?
export const adEslesiyor = (girilen, ad) => {
  const sade = (m) =>
    String(m ?? "")
      .replace(/\s+/g, " ")
      .trim();
  return sade(ad).length > 0 && sade(girilen) === sade(ad);
};
