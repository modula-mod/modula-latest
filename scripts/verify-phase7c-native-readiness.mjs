#!/usr/bin/env node
import {check, finish, includes, json, maybeSh, read} from './phase7c-verifier-utils.mjs'

const pkg = json('package.json')
const deps = pkg.dependencies ?? {}
check(`expo version mismatch: ${deps.expo}`, deps.expo === '~57.0.8')
check(`expo-router version mismatch: ${deps['expo-router']}`, deps['expo-router'] === '~57.0.8')
check(`@expo/ui version mismatch: ${deps['@expo/ui']}`, deps['@expo/ui'] === '~57.0.7')
check(`react-native version mismatch: ${deps['react-native']}`, deps['react-native'] === '0.86.0')

includes('app.config.ts', [
  "bundleIdentifier: 'digital.modula.app'",
  "package: 'digital.modula.app'",
  "updates: {",
  'enabled: false',
  'typedRoutes: true',
  'expo-dev-client',
  'expo-image-picker',
  'expo-camera',
  'expo-video',
  'expo-secure-store',
], 'app config')

includes('src/platform/ui/README.md', [
  'never `@expo/ui/swift-ui` directly',
], 'platform UI policy')

const directImports = maybeSh([
  'rg',
  '-n',
  '@expo/ui/(swift-ui|jetpack-compose)',
  'src',
  '--glob',
  '!src/platform/**',
])
check(`feature-level direct Expo UI import:\n${directImports}`, !directImports)

const platformTabs = read('src/platform/ui/navigation/platform-tabs.native.tsx')
check('NativeTabs fallback missing', platformTabs.includes('NativeTabsFallback'))
check('custom liquid glass path missing', platformTabs.includes('LiquidGlassPlatformTabs'))

finish('Phase 7C native readiness verification')
