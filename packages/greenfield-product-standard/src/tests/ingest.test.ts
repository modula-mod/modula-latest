import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {ingestProductManifest} from '../ingest.js'
import {projectGreenfieldProduct} from '../mapping.js'
import {validateMpsFrontendArtifact} from '../frontend.js'
import {toMpsEventType} from '../adapters.js'
import {greenfieldBackendModeFromMps, registryKindFromDeclared} from '../kinds.js'

const here = dirname(fileURLToPath(import.meta.url))

function fixture(name: string) {
  return readFileSync(join(here, '../../../..', 'fixtures/mps', name, 'modula.product.json'), 'utf8')
}

function validateFrontendMutation(mutator: (artifact: Record<string, unknown>) => void) {
  const product = ingestProductManifest({filename: 'modula.product.json', bytes: fixture('reference-module')}).product!
  const source = readFileSync(join(here, '../../../..', 'fixtures/mps/reference-module/frontend/frontend.manifest.json'), 'utf8')
  const artifact = JSON.parse(source) as Record<string, unknown>
  mutator(artifact)
  const bytes = Buffer.from(`${JSON.stringify(artifact)}\n`)
  return validateMpsFrontendArtifact({
    bytes,
    metadata: {...product.frontendArtifact!, sha256: createHash('sha256').update(bytes).digest('hex')},
    productId: product.productId,
    version: product.version,
    mode: 'declarative',
  })
}

test('kind aliases map developer names onto MPS registry kinds', () => {
  assert.equal(registryKindFromDeclared('backend-service'), 'service')
  assert.equal(registryKindFromDeclared('game-module'), 'game')
  assert.equal(greenfieldBackendModeFromMps('none'), 'frontend-only')
  assert.equal(greenfieldBackendModeFromMps('greenfield-records'), 'greenfield-managed')
})

test('event adapter produces MPS product event identifiers', () => {
  assert.equal(
    toMpsEventType('digital.modula.reference-notes', 'note.created'),
    'digital.modula.reference-notes.note.created.v1',
  )
})

test('reference module ingest is generic', () => {
  const result = ingestProductManifest({filename: 'modula.product.json', bytes: fixture('reference-module')})
  assert.equal(result.ok, true, result.diagnostics.map(item => item.message).join('; '))
  const projection = projectGreenfieldProduct(result.product!)
  assert.equal(projection.productId, 'digital.modula.reference-notes')
  assert.equal(projection.registryKind, 'module')
  assert.equal(projection.frontendMode, 'declarative')
  assert.equal(projection.frontendArtifact?.path, 'frontend/frontend.manifest.json')
  assert.match(projection.frontendArtifact?.sha256 ?? '', /^[a-f0-9]{64}$/)
  assert.equal(projection.backendMode, 'greenfield-records')
  assert.equal(projection.familyId, 'digital.modula.reference-vault')
  assert.equal(projection.protocol, 'greenfield.v1')
  assert.equal(projection.presentationAssets.length > 0, true)
})

test('frontend artifact is identity-bound, hash-bound, and rejects executable escape hatches', () => {
  const product = ingestProductManifest({filename: 'modula.product.json', bytes: fixture('reference-module')}).product!
  const bytes = readFileSync(join(here, '../../../..', 'fixtures/mps/reference-module/frontend/frontend.manifest.json'))
  const valid = validateMpsFrontendArtifact({
    bytes,
    metadata: product.frontendArtifact!,
    productId: product.productId,
    version: product.version,
    mode: 'declarative',
  })
  assert.equal(valid.ok, true, valid.diagnostics.map(item => item.message).join('; '))
  const tampered = validateMpsFrontendArtifact({
    bytes: Buffer.concat([bytes, Buffer.from(' ')]),
    metadata: product.frontendArtifact!,
    productId: product.productId,
    version: product.version,
    mode: 'declarative',
  })
  assert.equal(tampered.diagnostics.some(item => item.code === 'MPS-FRONTEND-013'), true)
  const executable = JSON.parse(bytes.toString('utf8'))
  executable.views[0].root.rawJs = 'alert(1)'
  const executableBytes = Buffer.from(`${JSON.stringify(executable)}\n`)
  const unsafe = validateMpsFrontendArtifact({
    bytes: executableBytes,
    metadata: {...product.frontendArtifact!, sha256: createHash('sha256').update(executableBytes).digest('hex')},
    productId: product.productId,
    version: product.version,
    mode: 'declarative',
  })
  assert.equal(unsafe.diagnostics.some(item => item.code === 'MPS-FRONTEND-SECURITY-001'), true)
})

test('frontend mirror accepts bounded query, lifecycle, defaults, and rich-text transforms', () => {
  const result = validateFrontendMutation(artifact => {
    const views = artifact.views as Record<string, unknown>[]
    const homeBindings = views[0]!.bindings as Array<Record<string, unknown>>
    homeBindings[0]!.query = {filters: {archived: false}, limit: 25, recordState: 'deleted'}
    const actions = artifact.actions as Array<Record<string, unknown>>
    actions.push(
      {id: 'restoreNote', family: 'record.restore', label: 'Restore', recordType: 'note'},
      {id: 'purgeNote', family: 'record.purge', label: 'Delete permanently', recordType: 'note', confirm: true},
    )
    const create = actions.find(action => action.id === 'createNote')!
    create.input = {
      defaults: {archived: false, tags: []},
      transforms: [{target: 'plainTextProjection', source: 'body', transform: 'richText.plainText@1'}],
    }
  })
  assert.equal(result.ok, true, result.diagnostics.map(item => item.message).join('; '))
})

test('frontend mirror accepts current generic record, revision, media, and toggle contracts', () => {
  const result = validateFrontendMutation(artifact => {
    artifact.capabilities = {required: ['ui.mediaAttach@1', 'ui.mediaOpen@1']}
    const views = artifact.views as Record<string, unknown>[]
    const bindings = views[0]!.bindings as Array<Record<string, unknown>>
    bindings.push(
      {id: 'revisions', source: 'record.revisions', recordType: 'note'},
      {id: 'revision', source: 'record.revision', recordType: 'note'},
      {id: 'media', source: 'record.media', recordType: 'note'},
    )
    const actions = artifact.actions as Array<Record<string, unknown>>
    actions.push(
      {id: 'toggleStar', family: 'record.toggle', label: 'Star', recordType: 'note', recordIdBinding: 'note', recordField: 'starred'},
      {id: 'attachFile', family: 'media.attach', label: 'Attach', recordType: 'note', recordIdBinding: 'note', capability: 'ui.mediaAttach@1'},
      {id: 'openFile', family: 'media.open', label: 'Open', capability: 'ui.mediaOpen@1'},
      {id: 'removeFile', family: 'media.detach', label: 'Remove', recordType: 'note', recordIdBinding: 'note', confirm: true},
    )
    actions.find(action => action.id === 'createNote')!.input = {
      transforms: [{target: 'slug', source: 'body', transform: 'text.slug@1'}],
    }
  })
  assert.equal(result.ok, true, result.diagnostics.map(item => item.message).join('; '))
})

test('frontend mirror rejects ungranted media and unsafe toggle or detach declarations', () => {
  const result = validateFrontendMutation(artifact => {
    const actions = artifact.actions as Array<Record<string, unknown>>
    actions.push(
      {id: 'badToggle', family: 'record.toggle', label: 'Toggle', recordType: 'note', recordField: 'metadata.starred'},
      {id: 'badAttach', family: 'media.attach', label: 'Attach', recordType: 'note', recordIdBinding: 'note', capability: 'ui.mediaAttach@1'},
      {id: 'badDetach', family: 'media.detach', label: 'Remove', recordType: 'note', recordIdBinding: 'note'},
    )
  })
  assert.equal(result.diagnostics.some(item => item.code === 'MPS-FRONTEND-146'), true)
  assert.equal(result.diagnostics.some(item => item.code === 'MPS-FRONTEND-143'), true)
  assert.equal(result.diagnostics.some(item => item.code === 'MPS-FRONTEND-145'), true)
})

test('frontend mirror rejects unsafe lifecycle and input shaping', () => {
  const purge = validateFrontendMutation(artifact => {
    const actions = artifact.actions as Array<Record<string, unknown>>
    actions.push({id: 'purgeNote', family: 'record.purge', label: 'Delete permanently', recordType: 'note'})
  })
  assert.equal(purge.diagnostics.some(item => item.code === 'MPS-FRONTEND-136'), true)

  const transform = validateFrontendMutation(artifact => {
    const actions = artifact.actions as Array<Record<string, unknown>>
    actions.find(action => action.id === 'createNote')!.input = {
      transforms: [{target: 'plainTextProjection', source: 'body', transform: 'javascript.eval'}],
    }
  })
  assert.equal(transform.diagnostics.some(item => item.code === 'MPS-FRONTEND-139'), true)

  const filter = validateFrontendMutation(artifact => {
    const views = artifact.views as Record<string, unknown>[]
    const homeBindings = views[0]!.bindings as Array<Record<string, unknown>>
    homeBindings[0]!.query = {filters: {archived: {not: true}}}
  })
  assert.equal(filter.diagnostics.some(item => item.code === 'MPS-FRONTEND-138'), true)
})

test('frontend mirror validates neutral semantic Product UI and capability declarations', () => {
  const accepted = validateFrontendMutation(artifact => {
    artifact.capabilities = {
      required: ['ui.richText@1'],
      optional: [{id: 'ui.graph', version: '1', fallback: {id: 'ui.record-table', version: '1'}}],
    }
    const views = artifact.views as Record<string, unknown>[]
    const root = views[0]!.root as Record<string, unknown>
    const children = root.children as unknown[]
    children.push({
      id: 'alpha.graph',
      type: 'Graph',
      version: '1.0.0',
      capability: {id: 'ui.graph', version: '1'},
      nodeBinding: 'alpha.nodes',
      edgeBinding: 'alpha.edges',
      layout: 'hierarchical',
    })
  })
  assert.equal(accepted.ok, true, accepted.diagnostics.map(item => item.message).join('; '))

  const requiredFallback = validateFrontendMutation(artifact => {
    artifact.capabilities = {required: [{id: 'ui.graph', version: '1', fallback: {id: 'ui.record-table', version: '1'}}]}
  })
  assert.equal(requiredFallback.diagnostics.some(item => item.code === 'MPS-FRONTEND-110'), true)

  const undeclared = validateFrontendMutation(artifact => {
    const views = artifact.views as Record<string, unknown>[]
    const root = views[0]!.root as Record<string, unknown>
    const children = root.children as unknown[]
    children.push({
      id: 'beta.graph', type: 'Graph', version: '1.0.0', capability: {id: 'ui.graph', version: '1'},
      nodeBinding: 'beta.nodes', edgeBinding: 'beta.edges',
    })
  })
  assert.equal(undeclared.diagnostics.some(item => item.code === 'MPS-FRONTEND-SEMANTIC-002'), true)
})

test('backend-free plugin does not bind fake infrastructure', () => {
  const result = ingestProductManifest({filename: 'modula.product.json', bytes: fixture('reference-plugin')})
  assert.equal(result.ok, true, result.diagnostics.map(item => item.message).join('; '))
  const projection = projectGreenfieldProduct(result.product!)
  assert.equal(projection.backendMode, 'none')
  assert.equal(projection.greenfieldBackendMode, 'frontend-only')
  assert.equal(projection.storageMode, null)
  assert.equal(projection.bindsFakeBackend, false)
})

test('legacy module.manifest.json normalizes into MPS then the same projection', () => {
  const legacy = {
    moduleId: 'example.acme.notes',
    name: 'Acme Notes',
    version: '1.2.0',
    publisher: {publisherId: 'acme', displayName: 'Acme'},
    source: {repository: 'acme/notes', commit: 'a'.repeat(40), manifestPath: 'module.manifest.json'},
    backend: {mode: 'frontend-only'},
    extensionProduct: {kind: 'plugin'},
  }
  const result = ingestProductManifest({
    filename: 'module.manifest.json',
    bytes: JSON.stringify(legacy),
  })
  assert.equal(result.ok, true, result.diagnostics.map(item => item.message).join('; '))
  assert.equal(result.product?.format, 'module.manifest.json@greenfield-v1')
  assert.equal(result.product?.kind, 'plugin')
  assert.equal(result.product?.backendMode, 'none')
})

test('secret values and arbitrary protocol ranges are rejected', () => {
  const secrets = ingestProductManifest({
    filename: 'modula.product.json',
    bytes: JSON.stringify({identity: {id: 'example.acme.x', kind: 'plugin', version: '1.0.0'}, apiKey: 'sk-live'}),
  })
  assert.equal(secrets.ok, false)
  const protocol = ingestProductManifest({
    filename: 'modula.product.json',
    bytes: JSON.stringify({
      identity: {id: 'example.acme.x', kind: 'plugin', version: '1.0.0', displayName: 'X'},
      publisher: {id: 'acme'},
      source: {repository: 'acme/x', commit: 'a'.repeat(40)},
      frontend: {mode: 'none'},
      backend: {mode: 'none'},
      compatibility: {greenfieldProtocol: '^1.0.0'},
    }),
  })
  assert.equal(protocol.ok, false)
  assert.equal(protocol.diagnostics.some(item => item.code === 'MPS-COMPAT-001'), true)
})

test('reference service, connector, engine, and game ingest without vendor special cases', () => {
  for (const name of ['reference-service', 'reference-connector', 'reference-engine', 'reference-game'] as const) {
    const result = ingestProductManifest({filename: 'modula.product.json', bytes: fixture(name)})
    assert.equal(result.ok, true, `${name}: ${result.diagnostics.map(item => item.message).join('; ')}`)
    const projection = projectGreenfieldProduct(result.product!)
    assert.equal(projection.bindsFakeBackend, false)
    assert.equal(projection.protocol, 'greenfield.v1')
  }
})

test('second notes provider is a distinct product, not a name branch', () => {
  const notes = projectGreenfieldProduct(ingestProductManifest({filename: 'modula.product.json', bytes: fixture('reference-module')}).product!)
  const alt = projectGreenfieldProduct(ingestProductManifest({filename: 'modula.product.json', bytes: fixture('reference-notes-alt')}).product!)
  assert.notEqual(notes.productId, alt.productId)
  assert.equal(notes.capabilities.providerRoles.includes('notes.provider'), true)
  assert.equal(alt.capabilities.providerRoles.includes('notes.provider'), true)
})

test('unsupported frontend and backend modes fail', () => {
  const frontend = ingestProductManifest({
    filename: 'modula.product.json',
    bytes: JSON.stringify({
      identity: {id: 'example.acme.x', kind: 'plugin', version: '1.0.0', displayName: 'X'},
      publisher: {id: 'acme'},
      source: {repository: 'acme/x', commit: 'a'.repeat(40)},
      frontend: {mode: 'remote-javascript'},
      backend: {mode: 'none'},
    }),
  })
  assert.equal(frontend.ok, false)
  assert.equal(frontend.diagnostics.some(item => item.code === 'MPS-FRONTEND-001'), true)
  const backend = ingestProductManifest({
    filename: 'modula.product.json',
    bytes: JSON.stringify({
      identity: {id: 'example.acme.x', kind: 'plugin', version: '1.0.0', displayName: 'X'},
      publisher: {id: 'acme'},
      source: {repository: 'acme/x', commit: 'a'.repeat(40)},
      frontend: {mode: 'none'},
      backend: {mode: 'arbitrary-http'},
    }),
  })
  assert.equal(backend.ok, false)
  assert.equal(backend.diagnostics.some(item => item.code === 'MPS-BACKEND-001'), true)
})
