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
    associatedDomains: ['applinks:modula.digital', 'webcredentials:modula.digital'],
    // Tracked ios/ does not auto-merge plugin permission strings; keep Info.plist in sync.
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      NSCameraUsageDescription:
        'Modula uses the camera for Appearance Advanced living backdrop Preview. Nothing is recorded or uploaded.',
      NSPhotoLibraryUsageDescription:
        'Modula uses your photo library when you choose media for a post.',
      NSPhotoLibraryAddUsageDescription:
        'Modula saves media you explicitly choose to keep in your photo library.',
    },
  },
  android: {
    ...config.android,
    package: 'digital.modula.app',
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'modula.digital',
            pathPrefix: '/',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
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
      'expo-dev-client',
      {
        // Hide floating Tools FAB on product surfaces (shake / 3-finger still opens menu).
        // Requires a native rebuild to take full effect; runtime hide also runs at launch.
        toolsButton: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Modula uses your photo library when you choose media for a post.',
        cameraPermission:
          'Modula uses your camera when you choose to capture media for a post.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Modula uses the camera for Appearance Advanced living backdrop Preview. Nothing is recorded or uploaded.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-video',
      {
        supportsBackgroundPlayback: false,
        supportsPictureInPicture: false,
      },
    ],
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        // Brand ink + Modula mark — JS overlay continues the exit animation.
        backgroundColor: '#0B1416',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
        dark: {
          backgroundColor: '#0B1416',
          image: './assets/images/splash-icon.png',
          imageWidth: 120,
        },
      },
    ],
  ],
  updates: {
    enabled: false,
  },
  experiments: {
    typedRoutes: true,
  },
})
