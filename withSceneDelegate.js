// iOS 27'den itibaren, en yeni SDK ile derlenen uygulamalar UIScene yaşam döngüsünü kullanmak ZORUNDA; kullanmayan uygulama
// açılışta çöker (çökme kaydı: _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption, EXC_BREAKPOINT). TestFlight 1.0.0 (1)
// iOS 27.2.1'de bu yüzden açılmadı (iOS 26 yalnızca uyarır). Expo SDK 55 (canary) şablonu sahne kullanmıyor; bu eklenti:
//   1) Info.plist'e UIApplicationSceneManifest ekler (tek pencere; iPad'de çoklu pencere kapalı),
//   2) ios/<proje>/SceneDelegate.swift yazar ve Xcode projesine ekler: pencere + React Native burada başlatılır,
//      URL / kullanıcı etkinliği / ön-arka plan olayları AppDelegate'e (Expo abonelerine) aktarılır,
//   3) AppDelegate.swift'ten pencere oluşturma ve startReactNative çağrısını kaldırır (yoksa iki React Native örneği olur).
// SIRA ÖNEMLİ: @react-native-firebase eklentileri AppDelegate'te "factory.startReactNative(" satırını işaret noktası olarak
// kullanır. Expo eklentileri SONDAN BAŞA çalıştırır; bu eklenti app.json plugins listesinin BAŞINDA olmalı ki EN SON çalışsın.
// Beklenen satırlar bulunamazsa sessizce yanlış dosya üretmek yerine hata verir. Yeni paket eklemez.
const fs = require("fs");
const path = require("path");
const { withInfoPlist, withAppDelegate, withXcodeProject, IOSConfig } = require("@expo/config-plugins");

const ISARET = "kokGorunumDenetleyicisi"; // eklenti daha önce uygulandıysa AppDelegate'te bulunur

const SAHNE_KAYNAGI = `// Bu dosya withSceneDelegate.js eklentisi tarafından üretilir; elle değiştirme (ayrıntı o dosyada).
// iOS 27: UIScene yaşam döngüsü zorunlu. Pencere ve React Native burada başlatılır; olaylar AppDelegate'e aktarılır.
internal import Expo
import React
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var uygulama: AppDelegate? { UIApplication.shared.delegate as? AppDelegate }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let pencereSahnesi = scene as? UIWindowScene,
          let uygulama = uygulama,
          let factory = uygulama.reactNativeFactory else { return }

    let window = UIWindow(windowScene: pencereSahnesi)
    self.window = window
    // Bazı modüller (expo-system-ui, LogBox) pencereye UIApplication.shared.delegate?.window ile ulaşır.
    uygulama.window = window

    if let mevcutKok = uygulama.kokGorunumDenetleyicisi {
      // Sistem sahneyi kapatıp yeniden bağladıysa React Native'i İKİNCİ KEZ başlatma; mevcut görünümü yeni pencereye taşı.
      window.rootViewController = mevcutKok
      window.makeKeyAndVisible()
    } else {
      factory.startReactNative(
        withModuleName: "main",
        in: window,
        launchOptions: uygulama.launchOptions)
      uygulama.kokGorunumDenetleyicisi = window.rootViewController
    }

    if !connectionOptions.urlContexts.isEmpty {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    }
    if let etkinlik = connectionOptions.userActivities.first {
      self.scene(scene, continue: etkinlik)
    }
  }

  // Sahne kullanılınca UIKit URL'leri AppDelegate'e değil buraya gönderir; Expo aboneleri ve Linking için aktarılır.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let uygulama = uygulama else { return }
    for baglam in URLContexts {
      var secenekler: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: baglam.options.openInPlace]
      if let kaynak = baglam.options.sourceApplication { secenekler[.sourceApplication] = kaynak }
      if let ek = baglam.options.annotation { secenekler[.annotation] = ek }
      _ = uygulama.application(UIApplication.shared, open: baglam.url, options: secenekler)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = uygulama?.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    uygulama?.applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    uygulama?.applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    uygulama?.applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    uygulama?.applicationDidEnterBackground(UIApplication.shared)
  }
}
`;

// Info.plist: tek pencereli sahne yapılandırması.
const sahneManifestiEkle = (plist) => {
  plist.UIApplicationSceneManifest = {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [
        {
          UISceneConfigurationName: "Default Configuration",
          UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
        },
      ],
    },
  };
  return plist;
};

// AppDelegate.swift: pencere/React Native başlatma SceneDelegate'e taşınır. Beklenen satır yoksa HATA.
const appDelegateDuzenle = (kaynak) => {
  if (kaynak.includes(ISARET)) return kaynak; // zaten uygulanmış

  const pencereSatiri = /\n([ \t]*)var window: UIWindow\?\n/;
  const pencereOlustur = /\n([ \t]*)window = UIWindow\(frame: UIScreen\.main\.bounds\)\n/;
  const baslat = /\n[ \t]*factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)/;

  for (const [ad, desen] of [["var window", pencereSatiri], ["UIWindow(frame:)", pencereOlustur], ["factory.startReactNative", baslat]]) {
    if (!desen.test(kaynak)) {
      throw new Error(`withSceneDelegate: AppDelegate.swift içinde beklenen "${ad}" satırı bulunamadı; Expo şablonu değişmiş olabilir, eklentiyi güncelle.`);
    }
  }

  return kaynak
    .replace(
      pencereSatiri,
      (_, girinti) =>
        `\n${girinti}var window: UIWindow?\n` +
        `${girinti}// iOS 27: pencere ve React Native SceneDelegate.swift'te başlatılır (UIScene zorunlu). Bkz. withSceneDelegate.js\n` +
        `${girinti}var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n` +
        `${girinti}var ${ISARET}: UIViewController?\n`
    )
    .replace(pencereOlustur, (_, girinti) => `\n${girinti}self.launchOptions = launchOptions\n`)
    .replace(baslat, "");
};

// Xcode projesine SceneDelegate.swift'i ekler (yoksa) ve dosyayı yazar.
const projeyeEkle = (proje, iosKoku, projeAdi) => {
  const goreceYol = `${projeAdi}/SceneDelegate.swift`;
  fs.writeFileSync(path.join(iosKoku, goreceYol), SAHNE_KAYNAGI);
  if (!proje.hasFile(goreceYol)) {
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath: goreceYol, groupName: projeAdi, project: proje });
  }
  return proje;
};

const withSceneDelegate = (config) => {
  config = withInfoPlist(config, (c) => {
    c.modResults = sahneManifestiEkle(c.modResults);
    return c;
  });
  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== "swift") throw new Error("withSceneDelegate: yalnızca Swift AppDelegate desteklenir.");
    c.modResults.contents = appDelegateDuzenle(c.modResults.contents);
    return c;
  });
  config = withXcodeProject(config, (c) => {
    const projeAdi = IOSConfig.XcodeUtils.getProjectName(c.modRequest.projectRoot);
    c.modResults = projeyeEkle(c.modResults, c.modRequest.platformProjectRoot, projeAdi);
    return c;
  });
  return config;
};

module.exports = withSceneDelegate;
module.exports.yardimcilar = { SAHNE_KAYNAGI, sahneManifestiEkle, appDelegateDuzenle, projeyeEkle };
