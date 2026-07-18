const {getDefaultConfig} = require('expo/metro-config')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

/**
 * Force @shopify/react-native-skia onto its compiled lib entry.
 * Upstream `"react-native": "src/index.ts"` breaks Metro under pnpm
 * (`Unable to resolve module ./renderer/Offscreen`).
 * A pnpm patch also rewrites that field; this resolver is belt-and-braces.
 *
 * Important: fall back to Expo's default resolver (tsconfig `@/` paths).
 * Calling raw `metro-resolver` here drops Expo alias support.
 */
const expoResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '@shopify/react-native-skia' ||
    moduleName === '@shopify/react-native-skia/lib/module' ||
    moduleName === '@shopify/react-native-skia/lib/module/index' ||
    moduleName === '@shopify/react-native-skia/lib/module/index.js'
  ) {
    return {
      type: 'sourceFile',
      filePath: require.resolve('@shopify/react-native-skia/lib/module/index.js'),
    }
  }

  if (expoResolveRequest) {
    return expoResolveRequest(context, moduleName, platform)
  }

  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
