import assert from 'node:assert/strict'

import {resolvePresentation, resolveUnanchoredPresentation} from '../src/platform/ui/responsive/presentation-resolver'
import {snapPointsForSemanticDetents, webSnapPoints} from '../src/platform/ui/sheets/modula-sheet.types'

const base = {
  viewport: 'expanded' as const,
  pointer: 'fine' as const,
  hover: true,
  standalone: false,
  platform: 'web' as const,
}

assert.equal(resolvePresentation({...base, intent: 'actions'}), 'menu')
assert.equal(resolvePresentation({...base, intent: 'picker'}), 'popover')
assert.equal(resolvePresentation({...base, intent: 'filters'}), 'sheet')
assert.equal(resolvePresentation({...base, intent: 'tools'}), 'dialog')
assert.equal(resolveUnanchoredPresentation({...base, intent: 'actions'}), 'dialog')
assert.equal(resolvePresentation({...base, intent: 'actions', viewport: 'compact'}), 'drawer')
assert.equal(resolvePresentation({...base, intent: 'picker', viewport: 'medium', pointer: 'coarse', hover: false}), 'drawer')
assert.equal(resolvePresentation({...base, intent: 'configuration', platform: 'ios'}), 'sheet')
assert.equal(resolvePresentation({...base, intent: 'tools', platform: 'android'}), 'drawer')

assert.deepEqual(webSnapPoints(['half', 'full', {fraction: 2}, {height: 20}]), [0.56, 1, 1, '120px'])
assert.equal(snapPointsForSemanticDetents(['content']), undefined)
assert.deepEqual(snapPointsForSemanticDetents(['content', 'medium', 'large', 'full']), ['half', 'full'])

console.log('RESPONSIVE RESOLVER TESTS PASS')
console.log('DRAWER SNAP-POINT MAPPING TESTS PASS')
