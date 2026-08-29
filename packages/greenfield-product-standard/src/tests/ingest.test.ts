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
