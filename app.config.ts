import type {ConfigContext, ExpoConfig} from 'expo/config'

export default ({config}: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Modula',
  slug: 'modula',
  scheme: 'modula',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  ios: {
    ...config.ios,
    bundleIdentifier: 'digital.modula.app',
    supportsTablet: true,
    icon: './assets/expo.icon',
  },
  android: {
    ...config.android,
    package: 'digital.modula.app',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    ...config.web,
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#369CAA',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
})
