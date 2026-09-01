import assert from 'node:assert/strict'
import {existsSync, readFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

import type {MpsFrontendArtifact} from '@/data/repositories/contracts'
import {
  adaptMpsFrontendView,
  resolveMpsFrontendRoute,
  resolveRuntimeActionRoute,
  richTextDocumentFromText,
  richTextEditingText,
  shapeMpsActionInput,
} from '@/features/modules/runtime/mps-frontend-adapter'

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
assert.deepEqual(collection.toolbar?.map(action => action.actionId), ['newNote'])
assert.deepEqual(collection.recordListActionIds, ['openNote'])
assert.equal(collection.searchEnabled, true)
assert.equal(collection.layout.length, 0, 'record/query-only structures do not render empty nested panels')
const openNote = collection.allowedActions?.find(action => action.actionId === 'openNote')
assert(openNote, 'record list route action is projected')
assert.equal(resolveRuntimeActionRoute(openNote, {noteId: 'note/123'}), '/module/digital.modula.reference-notes/note/note%2F123')

const editorRoute = resolveMpsFrontendRoute(frontend, ['new'])
assert(editorRoute, 'new route resolves')
const editor = adaptMpsFrontendView({frontend, resolved: editorRoute})
const create = editor.allowedActions?.find(action => action.actionId === 'createNote')
assert(create, 'create action is projected')
assert.equal(editor.allowedActions?.some(action => action.actionId === 'updateNote'), false)
assert.deepEqual(create.successDestination, {kind: 'dismiss'})
assert.equal(editor.layout.length, 0, 'form controls are rendered once by the generic form host')
assert.deepEqual(create.inputSchema.fields?.map(field => [field.name, field.type]), [
  ['title', 'text'],
  ['body', 'richText'],
])

const detail = resolveMpsFrontendRoute(frontend, ['note', 'note-123'])
assert(detail, 'parameter route resolves')
assert.deepEqual(detail.params, {noteId: 'note-123'})
assert.equal(detail.view.id, 'detail')
const detailView = adaptMpsFrontendView({frontend, resolved: detail})
assert.deepEqual(detailView.recordBinding, {source: 'record.detail', collection: 'note', recordId: 'note-123'})
assert.equal(detailView.allowedActions?.some(action => action.actionId === 'createNote'), false)
assert.equal(detailView.allowedActions?.some(action => action.actionId === 'updateNote'), false)

const editRoute = resolveMpsFrontendRoute(frontend, ['note', 'note-123', 'edit'])
assert(editRoute, 'edit route resolves')
const editView = adaptMpsFrontendView({frontend, resolved: editRoute})
assert.equal(editView.allowedActions?.some(action => action.actionId === 'createNote'), false)
assert.equal(editView.allowedActions?.some(action => action.actionId === 'updateNote'), true)

const settingsRoute = resolveMpsFrontendRoute(frontend, ['settings'])
assert(settingsRoute, 'settings route resolves')
const settings = adaptMpsFrontendView({frontend, resolved: settingsRoute})
assert.deepEqual(settings.allowedActions?.find(action => action.actionId === 'saveSettings')?.inputSchema.fields?.map(field => [field.name, field.type]), [
  ['archiveOnDelete', 'boolean'],
])

const tasks = JSON.parse(JSON.stringify(frontend)) as MpsFrontendArtifact
tasks.productId = 'example.modula.reference-tasks'
tasks.views![0]!.bindings = [{
  id: 'tasks',
  query: {filters: {completed: false}, limit: 25, recordState: 'deleted'},
  recordType: 'task',
  source: 'record.query',
}]
const tasksRoute = resolveMpsFrontendRoute(tasks, [])
assert(tasksRoute, 'neutral tasks route resolves')
const tasksCollection = adaptMpsFrontendView({frontend: tasks, resolved: tasksRoute})
assert.equal(tasksCollection.collection, 'task')
assert.deepEqual(tasksCollection.query?.filters, {completed: false})
assert.equal(tasksCollection.query?.recordState, 'deleted')
assert.equal(tasksCollection.query?.defaultLimit, 25)

const shaped = shapeMpsActionInput({
  ...create,
  inputDefaults: {completed: false},
  inputTransforms: [{target: 'plainTextProjection', source: 'body', transform: 'richText.plainText@1'}],
}, {
  title: 'A task',
  body: richTextDocumentFromText('First paragraph\n\nSecond paragraph'),
})
assert.equal(shaped.completed, false)
assert.equal(shaped.plainTextProjection, 'First paragraph\nSecond paragraph')
assert.equal(richTextEditingText(shaped.body), 'First paragraph\nSecond paragraph')

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

const vaultRoot = [
  process.env.MODULA_VAULT_NOTES_ROOT,
  resolve(root, '../modula-mod/modula-vault-notes'),
  resolve(root, '../../modula-mod/modula-vault-notes'),
].find(candidate => candidate && existsSync(join(candidate, 'frontend/frontend.manifest.json')))
if (!vaultRoot && process.argv.includes('--require-vault')) throw new Error('Canonical Vault Notes product frontend is required for this verifier')
if (vaultRoot) {
  const vault = JSON.parse(readFileSync(join(vaultRoot, 'frontend/frontend.manifest.json'), 'utf8')) as MpsFrontendArtifact
  const vaultHomeRoute = resolveMpsFrontendRoute(vault, [])
  assert(vaultHomeRoute, 'Vault Notes home route resolves from its product artifact')
  const vaultHome = adaptMpsFrontendView({frontend: vault, resolved: vaultHomeRoute})
  assert.deepEqual(vaultHome.query?.filters, {archived: false})
  assert.equal(vaultHome.query?.recordState, 'active')
  assert.equal(vaultHome.layout.length, 0, 'Vault Notes collection does not emit empty structural cards')

  const vaultNewRoute = resolveMpsFrontendRoute(vault, ['new'])
  assert(vaultNewRoute, 'Vault Notes new-note route resolves')
  const vaultEditor = adaptMpsFrontendView({frontend: vault, resolved: vaultNewRoute})
  assert.deepEqual(vaultEditor.allowedActions?.find(action => action.actionId === 'createNote')?.inputSchema.fields?.map(field => [field.name, field.type]), [
    ['title', 'text'],
    ['document', 'richText'],
    ['folderId', 'recordReference'],
    ['tagIds', 'tags'],
  ])
  const vaultCreate = vaultEditor.allowedActions?.find(action => action.actionId === 'createNote')
  assert(vaultCreate, 'Vault Notes create action is product-owned')
  assert.deepEqual(vaultCreate.successDestination, {kind: 'dismiss'})
  assert.equal(vaultEditor.layout.length, 0, 'Vault Notes form controls are not duplicated as layout cards')
  const vaultInput = shapeMpsActionInput(vaultCreate, {title: 'Owned by Vault Notes', document: richTextDocumentFromText('Indexed safely')})
  assert.equal(vaultInput.plainTextProjection, 'Indexed safely')
  assert.equal(vaultInput.archived, false)
  assert.deepEqual(vaultInput.tagIds, [])

  const vaultTrashRoute = resolveMpsFrontendRoute(vault, ['trash'])
  assert(vaultTrashRoute, 'Vault Notes trash route resolves')
  const vaultTrash = adaptMpsFrontendView({frontend: vault, resolved: vaultTrashRoute})
  assert.equal(vaultTrash.query?.recordState, 'deleted')
  assert.deepEqual(vaultTrash.recordListActionIds, ['restoreNote', 'purgeNote'])
  assert.equal(vaultTrash.allowedActions?.find(action => action.actionId === 'purgeNote')?.destructive, true)
  console.log('VAULT NOTES PRODUCT FRONTEND PASS')
}

console.log('MPS frontend adapter PASS')
console.log('GENERIC ROUTE RESOLUTION PASS')
console.log('RICH TEXT HOST CAPABILITY MAPPING PASS')
console.log('PRODUCT-SPECIFIC HOST BRANCHES 0')
