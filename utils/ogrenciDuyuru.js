import { milisaniye } from "./kurumIstatistik";

// Öğrencinin duyuru kutusu için saf mantık: ağ kullanmaz, kolayca test edilir.
// Öğrenci iki kutuyu okur: tüm dershane ("hepsi") ve kendi grubu. Duyurular burada birleştirilir.

export const HEDEF_HEPSI = "hepsi";

const gecerli = (d) =>
  d &&
  typeof d.id === "string" &&
  typeof d.baslik === "string" &&
  d.baslik &&
  typeof d.metin === "string";

/**
 * İki kutunun belgelerini tek listeye çevirir: en yeni önde, aynı kimlik tekilleşir,
 * bozuk kayıtlar elenir. grupBelgeleri null olabilir (öğrenci grupsuz).
 * @returns [{ id, baslik, metin, grupaOzel, zamanMs }]
 */
export const duyurulariBirlestir = (hepsiBelgeleri, grupBelgeleri) => {
  const birlesik = new Map();
  [
    [hepsiBelgeleri, false],
    [grupBelgeleri, true],
  ].forEach(([belgeler, grupaOzel]) =>
    (Array.isArray(belgeler) ? belgeler : []).filter(gecerli).forEach((d) =>
      birlesik.set(d.id, {
        id: d.id,
        baslik: d.baslik,
        metin: d.metin,
        grupaOzel,
        zamanMs: milisaniye(d.olusturma),
      })
    )
  );
  return [...birlesik.values()].sort(
    (a, b) => (b.zamanMs ?? -Infinity) - (a.zamanMs ?? -Infinity)
  );
};

// En yeni duyurunun zamanı (yoksa null)
export const enYeniZaman = (duyurular) =>
  duyurular.reduce(
    (en, d) =>
      d.zamanMs !== null && (en === null || d.zamanMs > en) ? d.zamanMs : en,
    null
  );

/**
 * "Okundu" eşiği: bu zamandan sonra gelen duyurular yenidir.
 * Daha önce kaydedilmiş bir eşik varsa o kullanılır; yoksa (ilk kez) kuruma katılma zamanı:
 * yeni katılan öğrenciye eski duyurular "okunmamış" diye yığılmaz.
 */
export const okunduEsigi = (kayitliMs, katilmaMs) => {
  if (Number.isFinite(kayitliMs)) return kayitliMs;
  if (Number.isFinite(katilmaMs)) return katilmaMs;
  return 0;
};

export const yeniMi = (duyuru, esikMs) =>
  duyuru.zamanMs !== null && duyuru.zamanMs > esikMs;

export const okunmamisSayisi = (duyurular, esikMs) =>
  duyurular.filter((d) => yeniMi(d, esikMs)).length;
