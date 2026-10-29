import type {ConfigContext, ExpoConfig} from 'expo/config'

export default ({config}: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Modula',
  slug: 'modula',
  version: '0.1.0',
  userInterfaceStyle: 'automatic',
  web: {
    ...config.web,
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: ['expo-router'],
  experiments: {
    typedRoutes: true,
  },
})
