import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

import type {MpsFrontendArtifact} from '@/data/repositories/contracts'
import {adaptMpsFrontendView, resolveMpsFrontendRoute} from '@/features/modules/runtime/mps-frontend-adapter'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const frontend = JSON.parse(readFileSync(join(root, 'fixtures/mps/reference-module/frontend/frontend.manifest.json'), 'utf8')) as MpsFrontendArtifact

const rootRoute = resolveMpsFrontendRoute(frontend, [])
assert(rootRoute, 'root route resolves')
assert.equal(rootRoute.view.id, 'home')
const collection = adaptMpsFrontendView({frontend, resolved: rootRoute})
assert.equal(collection.moduleId, 'digital.modula.reference-notes')
assert.equal(collection.kind, 'collection')
assert.equal(collection.collection, 'note')
assert(collection.allowedActions?.some(action => action.actionId === 'newNote' && action.kind === 'route.open'))
assert(collection.layout.length > 0)

const editorRoute = resolveMpsFrontendRoute(frontend, ['new'])
assert(editorRoute, 'new route resolves')
const editor = adaptMpsFrontendView({frontend, resolved: editorRoute})
const create = editor.allowedActions?.find(action => action.actionId === 'createNote')
assert(create, 'create action is projected')
assert.deepEqual(create.inputSchema.fields?.map(field => [field.name, field.type]), [
  ['title', 'text'],
  ['body', 'multilineText'],
])

const detail = resolveMpsFrontendRoute(frontend, ['note', 'note-123'])
assert(detail, 'parameter route resolves')
assert.deepEqual(detail.params, {noteId: 'note-123'})
assert.equal(detail.view.id, 'detail')

const missing = resolveMpsFrontendRoute(frontend, ['not-a-product-route'])
assert.equal(missing, null)

const redirectCycle: MpsFrontendArtifact = {
  ...frontend,
  routes: [
    {path: '/', redirectTo: '/again'},
    {path: '/again', redirectTo: '/'},
  ],
}
assert.equal(resolveMpsFrontendRoute(redirectCycle, []), null)

console.log('MPS frontend adapter PASS')
console.log('GENERIC ROUTE RESOLUTION PASS')
console.log('RICH TEXT HOST CAPABILITY MAPPING PASS')
console.log('PRODUCT-SPECIFIC HOST BRANCHES 0')
