const { withAndroidStyles } = require("@expo/config-plugins");

module.exports = function withDisableForceDark(config) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults;

    // Android'in ana temasını buluyoruz
    const appTheme = styles.resources.style.find(
      (style) => style.$.name === "AppTheme"
    );

    // Eğer tema varsa, zorunlu karanlık mod özelliğini 'false' olarak ekliyoruz
    if (appTheme) {
      appTheme.item.push({
        $: { name: "android:forceDarkAllowed" },
        _: "false",
      });
    }

    return config;
  });
};
