// Yasal metinler ve bunları WebView'da gösteren HTML şablonu.
// Hem Profil ekranı hem de ilk giriş onay ekranı aynı metni kullanır.

// Onay metni/şartları değiştiğinde artırılır; kullanıcıdan yeniden onay istemek için kullanılır.
export const YAS_ONAYI_SURUMU = 1;

// Mikro AI'yı kullanabilmek için asgari yaş
export const ASGARI_YAS = 13;

export const htmlSablonUret = (isDark, baslik, altBaslik, icerikHtml) => {
  const bg = isDark ? "#121212" : "#FFFFFF";
  const metinRenk = isDark ? "#E5E7EB" : "#1F2937";
  const ikincilMetinRenk = isDark ? "#9CA3AF" : "#4B5563";
  const kutuBg = isDark ? "#1F2937" : "#F8FAFC";
  const cerceveRenk = isDark ? "#374151" : "#E2E8F0";
  const anaRenk = isDark ? "#818CF8" : "#4F46E5";

  return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <style>
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: ${bg};
          color: ${metinRenk};
          padding: 24px;
          margin: 0;
          line-height: 1.6;
        }
        .header-group { margin-bottom: 30px; }
        h1 {
          font-size: 28px;
          font-weight: 800;
          color: ${metinRenk};
          margin: 0 0 8px 0;
          letter-spacing: -0.8px;
        }
        .sub-title {
          font-size: 16px;
          color: ${anaRenk};
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 4px;
        }
        h2 {
          font-size: 19px;
          font-weight: 700;
          color: ${metinRenk};
          margin-top: 32px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
        }
        h2::before {
          content: "";
          width: 4px;
          height: 20px;
          background-color: ${anaRenk};
          margin-right: 12px;
          border-radius: 2px;
        }
        p, li {
          font-size: 15px;
          color: ${ikincilMetinRenk};
          margin-bottom: 16px;
        }
        ul {
          padding: 0;
          list-style: none;
          margin-bottom: 24px;
        }
        li {
          position: relative;
          padding-left: 28px;
          margin-bottom: 14px;
        }
        li::before {
          content: "→";
          position: absolute;
          left: 0;
          color: ${anaRenk};
          font-weight: bold;
        }
        .card {
          background-color: ${kutuBg};
          border: 1px solid ${cerceveRenk};
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 28px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }
        .highlight {
          color: ${metinRenk};
          font-weight: 700;
          background-color: ${anaRenk}20;
          padding: 2px 6px;
          border-radius: 6px;
        }
        .footer-note {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid ${cerceveRenk};
          font-size: 13px;
          text-align: center;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="header-group">
        <div class="sub-title">${altBaslik}</div>
        <h1>${baslik}</h1>
      </div>
      ${icerikHtml}
      <div class="footer-note">Mikro AI Eğitim Teknolojileri</div>
    </body>
    </html>
  `;
};

export const KULLANIM_KOSULLARI_ICERIK = `
  <div class="card">
    <p>Mikro AI platformuna hoş geldiniz. Bu belge, uygulamamızı kullanırken uyulması gereken kuralları ve veri güvenliği esaslarını içerir.</p>
  </div>

  <h2>👤 Yaş Şartı</h2>
  <p>Mikro AI'yı kullanabilmek için en az <span class="highlight">${ASGARI_YAS} yaşını</span> doldurmuş olmanız gerekir. 18 yaşından küçük kullanıcıların uygulamayı velisinin ya da yasal temsilcisinin bilgisi dahilinde kullanması beklenir. Veli hesabı oluşturmak için 18 yaşını doldurmuş olmak gerekir.</p>

  <h2>🔒 Gizlilik ve Veri Güvenliği</h2>
  <p>Yüklediğiniz fotoğraflar ve verileriniz, aktarım sırasında ve depolamada şifrelenerek güvenli sunucularda saklanır. Gönderdiğiniz soru fotoğrafları, çözüm üretmek amacıyla yapay zeka hizmetleriyle işlenir. Verileriniz reklam veya pazarlama amacıyla üçüncü taraflarla paylaşılmaz.</p>

  <h2>🗑️ Hesap ve Veri Silme</h2>
  <p>Hesabım sayfasından hesabınızı sildiğinizde fotoğraflarınız, çözümleriniz ve profil bilgileriniz silinir. Bu işlem geri alınamaz.</p>

  <h2>⚡ Hizmet Limitleri</h2>
  <ul>
    <li>Standart kullanım günlük <span class="highlight">3 soru</span> ile sınırlıdır.</li>
    <li>Premium üyeler için sınır <span class="highlight">50 soru/gün</span> olarak belirlenmiştir.</li>
    <li>Bu limitler sunucu stabilitesini korumak adına uygulanmaktadır.</li>
  </ul>

  <h2>📋 Sorumluluk Reddini Bildiririz</h2>
  <p>Yapay zeka çözümleri yüksek doğruluk oranına sahip olsa da, bu bir eğitim destek aracıdır. Sınav başarılarınızdaki nihai sorumluluk kullanıcıya aittir.</p>

  <h2>💎 Abonelik Şartları</h2>
  <p>Abonelikler ve ödeme işlemleri doğrudan App Store veya Play Store üzerinden yönetilir. İptal ve iade süreçleri ilgili mağaza politikalarına tabidir.</p>
`;
