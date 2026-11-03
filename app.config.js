module.exports = ({ config }) => {
  const googleMapsAndroidApiKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() ?? '';

  const androidConfig = config.android?.config ?? {};
  const googleMapsConfig = androidConfig.googleMaps ?? {};

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...androidConfig,
        ...(googleMapsAndroidApiKey
          ? {
              googleMaps: {
                ...googleMapsConfig,
                apiKey: googleMapsAndroidApiKey,
              },
            }
          : {}),
      },
    },
    plugins: [
      ...(config.plugins ?? []),
      './plugins/with-kotlin-version',
      ['expo-maps', {}],
    ],
    extra: {
      ...config.extra,
      googleMapsApiKeyConfigured: Boolean(googleMapsAndroidApiKey),
    },
  };
};
