const {getDefaultConfig} = require('expo/metro-config')
const {resolve: metroResolve} = require('metro-resolver')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

/**
 * Force @shopify/react-native-skia onto its compiled lib entry.
 * Upstream `"react-native": "src/index.ts"` breaks Metro under pnpm
 * (`Unable to resolve module ./renderer/Offscreen`).
 * A pnpm patch also rewrites that field; this resolver is belt-and-braces.
 */
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

  return metroResolve(
    {
      ...context,
      resolveRequest: null,
    },
    moduleName,
    platform,
  )
}

module.exports = config
