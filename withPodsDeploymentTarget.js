// Xcode 27, iOS 15'in altını hedefleyen paket (Pod) hedeflerini derlemiyor. Bazı paketlerin küçük kaynak
// hedefleri hâlâ iOS 10–13'ü hedefliyor. Bu eklenti, yalnızca uygulamanın hedefinden (15.1) DÜŞÜK olan
// Pod hedeflerini 15.1'e yükseltir; daha yüksek hedeflere dokunmaz. Yeni paket eklemez, sadece derleme ayarı.
const { withPodfile } = require("@expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

const EN_DUSUK_IOS = "15.1";

module.exports = function withPodsDeploymentTarget(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = mergeContents({
      tag: "mikro-pods-deployment-target",
      src: config.modResults.contents,
      newSrc: [
        "    installer.pods_project.targets.each do |hedef|",
        "      hedef.build_configurations.each do |ayar|",
        "        mevcut = ayar.build_settings['IPHONEOS_DEPLOYMENT_TARGET']",
        `        if mevcut.nil? || Gem::Version.new(mevcut) < Gem::Version.new('${EN_DUSUK_IOS}')`,
        `          ayar.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${EN_DUSUK_IOS}'`,
        "        end",
        "      end",
        "    end",
      ].join("\n"),
      anchor: /post_install do \|installer\|/,
      offset: 1,
      comment: "#",
    }).contents;
    return config;
  });
};
