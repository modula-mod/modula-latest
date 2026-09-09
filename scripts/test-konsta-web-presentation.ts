import assert from 'node:assert/strict'

import {
  resolveKonstaTheme,
  resolvePresentationClass,
} from '../src/platform/ui/adapters/konsta/konsta-theme'
import {DEFAULT_APPEARANCE_PREFERENCES} from '../src/theme/data/defaults'
import {
  isWebPresentation,
  mergeLocalAdaptivePreferences,
  migrateAppearancePreferences,
} from '../src/theme/storage/migrateAppearancePreferences'

assert.equal(resolveKonstaTheme('liquid'), 'ios')
assert.equal(resolveKonstaTheme('material'), 'material')
assert.equal(resolvePresentationClass('liquid'), 'k-ios')
assert.equal(resolvePresentationClass('material'), 'k-material')

assert.equal(DEFAULT_APPEARANCE_PREFERENCES.webPresentation, 'liquid')
assert.equal(migrateAppearancePreferences(null).webPresentation, 'liquid')
assert.equal(migrateAppearancePreferences({webPresentation: 'material'}).webPresentation, 'material')
assert.equal(migrateAppearancePreferences({webPresentation: 'ios'}).webPresentation, 'liquid')
assert.equal(isWebPresentation('liquid'), true)
assert.equal(isWebPresentation('material'), true)
assert.equal(isWebPresentation('ios'), false)

const remote = {...DEFAULT_APPEARANCE_PREFERENCES, webPresentation: 'liquid' as const}
const local = {...DEFAULT_APPEARANCE_PREFERENCES, webPresentation: 'material' as const}
assert.equal(mergeLocalAdaptivePreferences(remote, local).webPresentation, 'material')

console.log('konsta_web_presentation_unit_ok')
