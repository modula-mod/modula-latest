import assert from 'node:assert/strict'

import {
  MODULA_ICONS,
  modulaIconDefinition,
  type ModulaIconName,
} from '@/platform/ui/icons/modula-icon-registry'

assert.equal(modulaIconDefinition('home'), MODULA_ICONS.home)
assert.equal(
  modulaIconDefinition(null as unknown as ModulaIconName),
  MODULA_ICONS.module,
  'null runtime icon input falls back to the generic module glyph',
)
assert.equal(
  modulaIconDefinition('not-a-semantic-icon' as ModulaIconName),
  MODULA_ICONS.module,
  'unknown runtime icon input falls back to the generic module glyph',
)

console.log('MODULA ICON RUNTIME FALLBACK PASS')
