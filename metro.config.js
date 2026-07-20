const path = require('path')
const {getDefaultConfig} = require('expo/metro-config')

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

const skiaPackageJson = require.resolve('@shopify/react-native-skia/package.json')
const skiaRoot = path.dirname(skiaPackageJson)
const skiaCompiledEntry = path.join(skiaRoot, 'lib/module/index.js')

/**
 * Skia Metro resolution for Expo + pnpm:
 *
 * 1. Package entry must be the compiled `lib/module` build. Upstream
 *    `"react-native": "src/index.ts"` breaks under pnpm
 *    (`Unable to resolve module ./renderer/Offscreen`).
 * 2. Codegen native-component specs must stay on the TypeScript sources.
 *    The compiled `.js` strips `NativeProps`, which makes
 *    `@react-native/babel-plugin-codegen` throw
 *    "Could not find component config for native component".
 * 3. Fall back to Expo's default resolver so `@/` path aliases keep working.
 */
const expoResolveRequest = config.resolver.resolveRequest

const SKIA_CODEGEN_SPECS = {
  SkiaPictureViewNativeComponent: path.join(
    skiaRoot,
    'src/specs/SkiaPictureViewNativeComponent.ts',
  ),
  WebGPUViewNativeComponent: path.join(
    skiaRoot,
    'src/specs/WebGPUViewNativeComponent.ts',
  ),
}

function resolveSkiaCodegenSpec(moduleName) {
  for (const [name, filePath] of Object.entries(SKIA_CODEGEN_SPECS)) {
    if (moduleName.includes(name) && !moduleName.includes('.web')) {
      return filePath
    }
  }
  return null
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '@shopify/react-native-skia' ||
    moduleName === '@shopify/react-native-skia/lib/module' ||
    moduleName === '@shopify/react-native-skia/lib/module/index' ||
    moduleName === '@shopify/react-native-skia/lib/module/index.js'
  ) {
    return {
      type: 'sourceFile',
      filePath: skiaCompiledEntry,
    }
  }

  // Native platforms need the TS codegen specs; web keeps Skia's .web stubs.
  if (platform !== 'web') {
    const specPath = resolveSkiaCodegenSpec(moduleName)
    if (specPath) {
      return {
        type: 'sourceFile',
        filePath: specPath,
      }
    }
  }

  if (expoResolveRequest) {
    return expoResolveRequest(context, moduleName, platform)
  }

  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
