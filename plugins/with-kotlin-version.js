const {
  withGradleProperties,
  withProjectBuildGradle,
} = require('@expo/config-plugins');

const KOTLIN_VERSION_PROPERTY = 'android.kotlinVersion';
const KOTLIN_VERSION = '2.3.0';
const KOTLIN_GRADLE_PLUGIN = 'org.jetbrains.kotlin:kotlin-gradle-plugin';

module.exports = function withKotlinVersion(config) {
  config = withGradleProperties(config, (configWithGradleProperties) => {
    const properties = configWithGradleProperties.modResults;
    const existingProperty = properties.find(
      (property) =>
        property.type === 'property' &&
        property.key === KOTLIN_VERSION_PROPERTY,
    );

    if (existingProperty) {
      existingProperty.value = KOTLIN_VERSION;
    } else {
      properties.push({
        type: 'property',
        key: KOTLIN_VERSION_PROPERTY,
        value: KOTLIN_VERSION,
      });
    }

    return configWithGradleProperties;
  });

  // android.kotlinVersion configures Expo's catalog, but the root buildscript
  // also needs an explicit KGP dependency for Android library subprojects.
  return withProjectBuildGradle(config, (configWithProjectBuildGradle) => {
    const contents = configWithProjectBuildGradle.modResults.contents;
    const classpathPattern =
      /classpath\s*\(\s*(['"])org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::[^'"]*)?\1\s*\)/;

    if (!classpathPattern.test(contents)) {
      throw new Error(
        'Could not find the root Kotlin Gradle Plugin classpath to pin its version.',
      );
    }

    configWithProjectBuildGradle.modResults.contents = contents.replace(
      classpathPattern,
      `classpath('${KOTLIN_GRADLE_PLUGIN}:${KOTLIN_VERSION}')`,
    );

    return configWithProjectBuildGradle;
  });
};
