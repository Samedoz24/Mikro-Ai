// HTML'e gömülecek metni güvenli hale getirir. Yapay zekâ çıktısı "<", ">" ya da "&"
// içerebilir (ör. "x < 5"); kaçışsız eklenirse PDF bozulur ya da istenmeyen işaretleme çalışır.
export const htmlKacis = (deger) =>
  String(deger ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Kaçışlı metin + satır sonlarını koru
export const htmlMetin = (deger) => htmlKacis(deger).replace(/\r?\n/g, "<br/>");
