// Kullanım koşulları / yaş onayı: kayıt formu ve girişten sonraki onay ekranı (YasOnayScreen) AYNI role özel cümleyi
// ve AYNI kayıt biçimini kullanır (iki yerde ayrı metin olmasın). Onay hesabın kendi belgesine yazılır (yasOnayi);
// metin değişirse YAS_ONAYI_SURUMU artırılır ve herkesten yeniden istenir. Saf mantık.
import { ASGARI_YAS, YAS_ONAYI_SURUMU } from "./yasalMetinler";

// Bağlantı metninden önceki kısım (role özel yaş beyanı). Rol henüz seçilmediyse boş: yalnızca koşullar.
export const onayOnMetni = (rol) =>
  rol === "yonetici"
    ? "Dershanenin yetkilisi olduğumu, öğrenci verilerini yalnızca eğitim faaliyetleri için kullanacağımı ve "
    : rol === "veli"
      ? "18 yaşını doldurduğumu ve "
      : rol === "ogrenci"
        ? `${ASGARI_YAS} yaşını doldurduğumu, 18 yaşından küçükse velimin bilgisi dahilinde kullandığımı ve `
        : "";

export const kosullarBasligi = (rol) => (rol === "yonetici" ? "Yönetici Kullanım Koşulları" : "Kullanım Koşulları");

export const ONAY_SON_METNI = "'nı okuyup kabul ettiğimi onaylıyorum.";

// Hesaba yazılacak onay kaydı
export const onayKaydi = ({ rol, zaman = Date.now(), kaynak } = {}) => ({
  onaylandi: true,
  surum: YAS_ONAYI_SURUMU,
  tarih: new Date(zaman).toISOString(),
  rol: rol || "ogrenci",
  ...(kaynak ? { kaynak } : {}),
});

// Kayıtlı onay güncel mi? (değilse onay ekranı gösterilir)
export const onayGecerliMi = (yasOnayi) =>
  yasOnayi?.onaylandi === true && (yasOnayi?.surum ?? 0) >= YAS_ONAYI_SURUMU;
