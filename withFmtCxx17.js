// Xcode 27 derleyicisi, React Native'in bağımlılığı fmt 11.0.2'nin C++20'de kullandığı consteval'ı reddediyor
// ("call to consteval function ... is not a constant expression", yalnızca fmt/src/format.cc). React Native
// kaynak koddan derlenince (app.json: buildReactNativeFromSource) ortaya çıkar. Çözüm: YALNIZCA fmt hedefi
// C++17 ile derlenir; bu modda fmt consteval kullanmaz (base.h: FMT_CPLUSPLUS < 201709L → FMT_USE_CONSTEVAL 0),
// davranışı değişmez. Başka hiçbir hedefe dokunulmaz. react_native_post_install C++ standardını ayarladığı için
// blok ONDAN SONRA eklenir. Yeni paket eklemez, yalnızca derleme ayarı.
const { withPodfile } = require("@expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

module.exports = function withFmtCxx17(config) {
  return withPodfile(config, (config) => {
    config.modResults.contents = mergeContents({
      tag: "mikro-fmt-cxx17",
      src: config.modResults.contents,
      newSrc: [
        "    installer.pods_project.targets.each do |hedef|",
        "      next unless hedef.name == 'fmt'",
        "      hedef.build_configurations.each do |ayar|",
        "        ayar.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'",
        "      end",
        "    end",
      ].join("\n"),
      anchor: /:ccache_enabled => ccache_enabled\?\(podfile_properties\),/,
      offset: 2,
      comment: "#",
    }).contents;
    return config;
  });
};
