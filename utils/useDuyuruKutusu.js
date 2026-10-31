import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { milisaniye } from "./kurumIstatistik";
import {
  HEDEF_HEPSI,
  duyurulariBirlestir,
  enYeniZaman,
  okunduEsigi,
  okunmamisSayisi,
} from "./ogrenciDuyuru";

// Öğrencinin duyuru kutusu: kurumun "hepsi" kutusu ile kendi grubunun kutusunu canlı izler ve
// hangi duyuruların okunmadığını hesaplar. Güvenlik kuralları yalnızca kurum üyesine okuma verir;
// bu yüzden kutular, üyelik kaydı doğrulandıktan sonra dinlenir.
// Okundu bilgisi cihazda tutulur (en yeni okunan duyurunun zamanı).
const belgeler = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

export default function useDuyuruKutusu(uid) {
  const [kurumId, setKurumId] = useState(null);
  const [uye, setUye] = useState(null); // null: üye değil ya da yükleniyor
  const [hepsi, setHepsi] = useState(null);
  const [grup, setGrup] = useState(null);
  // undefined: henüz okunmadı, null: kayıt yok, sayı: kayıtlı eşik
  const [kayitliEsik, setKayitliEsik] = useState(undefined);

  const anahtar = uid && kurumId ? `duyuruOkundu:${uid}:${kurumId}` : null;
  const uyeVar = uye !== null;
  const grupId = uye?.grupId ?? null;

  // Kullanıcı belgesi: hangi kurumda?
  useEffect(() => {
    if (!uid) {
      setKurumId(null);
      return;
    }
    return onSnapshot(
      doc(db, "kullanicilar", uid),
      (snap) => setKurumId(snap.data()?.kurumId || null),
      () => setKurumId(null)
    );
  }, [uid]);

  // Üyelik kaydı: grup ve katılma zamanı. Kayıt yoksa öğrenci üye değildir, kutular dinlenmez.
  useEffect(() => {
    setUye(null);
    if (!uid || !kurumId) return;
    return onSnapshot(
      doc(db, "kurumlar", kurumId, "uyeler", uid),
      (snap) =>
        setUye(
          snap.exists()
            ? {
                grupId: snap.data().grupId || null,
                katilmaMs: milisaniye(snap.data().katilma),
              }
            : null
        ),
      () => setUye(null)
    );
  }, [uid, kurumId]);

  useEffect(() => {
    setHepsi(null);
    if (!kurumId || !uyeVar) return;
    return onSnapshot(
      collection(
        db,
        "kurumlar",
        kurumId,
        "duyuruKutusu",
        HEDEF_HEPSI,
        "duyurular"
      ),
      (snap) => setHepsi(belgeler(snap)),
      (hata) => {
        console.log("Duyurular okunamadı:", hata?.code);
        setHepsi([]);
      }
    );
  }, [kurumId, uyeVar]);

  useEffect(() => {
    setGrup(null);
    if (!kurumId || !uyeVar || !grupId) return;
    return onSnapshot(
      collection(db, "kurumlar", kurumId, "duyuruKutusu", grupId, "duyurular"),
      (snap) => setGrup(belgeler(snap)),
      (hata) => {
        console.log("Grup duyuruları okunamadı:", hata?.code);
        setGrup([]);
      }
    );
  }, [kurumId, uyeVar, grupId]);

  // Okundu eşiği cihazdan okunur
  useEffect(() => {
    setKayitliEsik(undefined);
    if (!anahtar) return;
    let iptal = false;
    AsyncStorage.getItem(anahtar)
      .then((deger) => {
        if (!iptal) setKayitliEsik(deger === null ? null : Number(deger));
      })
      .catch(() => {
        if (!iptal) setKayitliEsik(null);
      });
    return () => {
      iptal = true;
    };
  }, [anahtar]);

  const duyurular = useMemo(
    () => (uyeVar ? duyurulariBirlestir(hepsi, grupId ? grup : null) : []),
    [uyeVar, hepsi, grup, grupId]
  );
  const esik = okunduEsigi(kayitliEsik, uye?.katilmaMs);
  // Eşik cihazdan okunana kadar rozet göstermeyiz (yanlış "yeni" yanıp sönmesin)
  const okunmamis =
    kayitliEsik === undefined ? 0 : okunmamisSayisi(duyurular, esik);

  // Tüm mevcut duyuruları okundu sayar
  const okunduIsaretle = useCallback(async () => {
    const enYeni = enYeniZaman(duyurular);
    if (enYeni === null || !anahtar) return;
    const yeniEsik = Math.max(enYeni, Number.isFinite(esik) ? esik : 0);
    setKayitliEsik(yeniEsik);
    try {
      await AsyncStorage.setItem(anahtar, String(yeniEsik));
    } catch (e) {
      console.log("Okundu bilgisi kaydedilemedi:", e?.message);
    }
  }, [duyurular, anahtar, esik]);

  return useMemo(
    () => ({ duyurular, okunmamis, esik, okunduIsaretle }),
    [duyurular, okunmamis, esik, okunduIsaretle]
  );
}
