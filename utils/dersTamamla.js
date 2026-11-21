import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { cozumYukle } from "./cozumYukleyici";
import { dersTahminEt, dersBilgisiVar, dersAdiniDuzelt, digerYerineDers } from "./ders";

// Çözülmüş ama belgesinde ders alanı olmayan sorulara (yeni n8n akışı ders yazmıyor) ders ekler:
//  1) çözüm dosyasında "subject" varsa onu kullanır,
//  2) yoksa konu başlığı ve soru metninden tahmin eder,
//  3) emin olamazsa hiçbir şey yazmaz (soru "Diğer"de kalır).
// Kullanıcının elle seçtiği ders (dersKaynak: "kullanici") ve n8n'in yazdığı ders asla ezilmez.

const denemeSayisi = new Map();
const EN_FAZLA_DENEME = 3;

let kuyruk = Promise.resolve();

const tamamla = async (soru, eposta) => {
  if (soru.durum !== "Çözüldü" || dersBilgisiVar(soru)) return null;

  const onceki = denemeSayisi.get(soru.id) || 0;
  if (onceki >= EN_FAZLA_DENEME) return null;
  denemeSayisi.set(soru.id, onceki + 1);

  try {
    const { cozumDetayi } = await cozumYukle(soru, eposta);
    if (!cozumDetayi) return null; // çözüm dosyası henüz yok, sonraki güncellemede tekrar denenir

    const dosyadakiDers = dersAdiniDuzelt(
      cozumDetayi.subject || cozumDetayi.lesson
    );
    const ders =
      dosyadakiDers ||
      dersTahminEt({ topic: cozumDetayi.topic, question: cozumDetayi.question });
    if (!ders) {
      denemeSayisi.set(soru.id, EN_FAZLA_DENEME); // karar verilemedi, boşuna tekrar denenmez
      return null;
    }

    await updateDoc(doc(db, "sorular", soru.id), {
      ders,
      dersKaynak: dosyadakiDers ? "cozum" : "tahmin",
    });
    return ders;
  } catch (hata) {
    console.log("Ders tamamlanamadı:", soru.id, hata?.code || hata?.message);
    return null;
  }
};

// İstekler art arda (sırayla) işlenir; çok sayıda soru aynı anda sunucuyu yormaz.
export const dersiTamamla = (soru, eposta) => {
  kuyruk = kuyruk.then(() => tamamla(soru, eposta)).catch(() => null);
  return kuyruk;
};

// n8n dersi "Diğer" yazdı ama konu başlığı dersi açıkça gösteriyorsa (ör. "Estetik" → Felsefe) dersi düzeltir.
// Dosya indirmez (konu belgede); öğrencinin elle seçtiği derse dokunmaz; her soru için en fazla birkaç deneme.
const duzeltmeDenemesi = new Map();

const digerDuzelt = async (soru) => {
  const ders = digerYerineDers(soru);
  if (!ders) return null;
  const onceki = duzeltmeDenemesi.get(soru.id) || 0;
  if (onceki >= EN_FAZLA_DENEME) return null;
  duzeltmeDenemesi.set(soru.id, onceki + 1);
  try {
    await updateDoc(doc(db, "sorular", soru.id), { ders, dersKaynak: "tahmin" });
    return ders;
  } catch (hata) {
    console.log("Ders düzeltilemedi:", soru.id, hata?.code || hata?.message);
    return null;
  }
};

export const digerDersiDuzelt = (soru) => {
  kuyruk = kuyruk.then(() => digerDuzelt(soru)).catch(() => null);
  return kuyruk;
};
