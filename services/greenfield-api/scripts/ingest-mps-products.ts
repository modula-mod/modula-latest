import {readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {createDb} from '../src/database/client.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'

type ProductName = 'notes' | 'formatting' | 'ai' | 'voice'

type MpsProduct = {
  name: ProductName
  productId: string
  version: string
  root: string
  bytes: string
}

const definitions: Array<{name: ProductName; productId: string; version: string; defaultDirectory: string; envName: string}> = [
  {name: 'notes', productId: 'digital.modula.vault-notes', version: '1.3.0', defaultDirectory: 'modula-vault-notes', envName: 'MODULA_VAULT_NOTES_ROOT'},
  {name: 'formatting', productId: 'digital.modula.vault-notes.formatting', version: '0.2.0', defaultDirectory: 'modula-vault-formatting', envName: 'MODULA_VAULT_FORMATTING_ROOT'},
  {name: 'ai', productId: 'digital.modula.vault-notes.ai', version: '0.2.0', defaultDirectory: 'modula-vault-ai', envName: 'MODULA_VAULT_AI_ROOT'},
  {name: 'voice', productId: 'digital.modula.vault-notes.voice', version: '0.2.0', defaultDirectory: 'modula-vault-voice', envName: 'MODULA_VAULT_VOICE_ROOT'},
]

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
for (const arg of args) {
  if (arg !== '--apply') fail(`Unknown argument: ${arg}`)
}

const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) fail('MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required')

const products = definitions.map(loadProduct)
const db = createDb(databaseUrl)
try {
  const ingest = new GreenfieldMpsIngestService(db)
  const results = []
  for (const product of products) {
    const existing = await ingest.get(product.productId, product.version)
    if (!apply) {
      results.push({
        productId: product.productId,
        version: product.version,
        action: existing ? 'already-ingested' : 'ingest',
        familyId: existing?.familyId ?? null,
      })
      continue
    }
    const ingested = await ingest.ingest({filename: 'modula.product.json', bytes: product.bytes})
    if (!ingested || ingested.productId !== product.productId || ingested.version !== product.version) {
      fail(`MPS ingest did not persist ${product.productId}@${product.version}`)
    }
    results.push({
      productId: ingested.productId,
      version: ingested.version,
      action: existing ? 're-ingested' : 'ingested',
      familyId: ingested.familyId,
      familyRole: ingested.familyRole,
      kind: ingested.kind,
      backendMode: ingested.backendMode,
    })
  }
  if (!apply) {
    process.exitCode = results.every(item => item.action === 'already-ingested') ? 0 : 3
  }
  console.log(JSON.stringify({mode: apply ? 'APPLIED' : 'DRY_RUN', products: results}, null, 2))
} finally {
  await db.destroy()
}

function loadProduct(definition: (typeof definitions)[number]): MpsProduct {
  const root = resolve(process.env[definition.envName] ?? join('/root/modula-mod', definition.defaultDirectory))
  const bytes = readFileSync(join(root, 'modula.product.json'), 'utf8')
  const parsed = JSON.parse(bytes) as {identity?: {id?: string; version?: string}}
  if (parsed.identity?.id !== definition.productId || parsed.identity?.version !== definition.version) {
    fail(`MPS identity mismatch in ${root}: ${parsed.identity?.id}@${parsed.identity?.version}`)
  }
  return {name: definition.name, productId: definition.productId, version: definition.version, root, bytes}
}

function fail(message: string): never {
  throw new Error(message)
}
