import {readFileSync} from 'node:fs'
import {join, resolve, sep} from 'node:path'
import {createDb} from '../src/database/client.js'
import {GreenfieldMpsIngestService} from '../src/product-standard/ingest-service.js'

type MpsProduct = {
  productId: string
  version: string
  root: string
  bytes: string
  frontend: {path: string; bytes: Buffer} | null
  schemas: Array<{path: string; bytes: Buffer}>
}

const {apply, roots} = parseArgs(process.argv.slice(2))
const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) fail('MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required')

const products = roots.map(loadProduct)
const identities = new Set<string>()
for (const product of products) {
  const identity = `${product.productId}@${product.version}`
  if (identities.has(identity)) fail(`Duplicate product root for ${identity}`)
  identities.add(identity)
}

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
    const ingested = await ingest.ingest({filename: 'modula.product.json', bytes: product.bytes, frontend: product.frontend, schemas: product.schemas})
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
  if (!apply) process.exitCode = results.every(item => item.action === 'already-ingested') ? 0 : 3
  console.log(JSON.stringify({mode: apply ? 'APPLIED' : 'DRY_RUN', products: results}, null, 2))
} finally {
  await db.destroy()
}

function parseArgs(args: string[]): {apply: boolean; roots: string[]} {
  let apply = false
  const roots: string[] = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!
    if (arg === '--apply') {
      apply = true
      continue
    }
    if (arg === '--product-root') {
      const root = args[index + 1]
      if (!root) fail('--product-root requires a repository path')
      roots.push(root)
      index += 1
      continue
    }
    if (arg.startsWith('--product-root=')) {
      roots.push(arg.slice('--product-root='.length))
      continue
    }
    fail(`Unknown argument: ${arg}`)
  }
  if (roots.length === 0) fail('At least one --product-root is required')
  return {apply, roots}
}

function loadProduct(inputRoot: string): MpsProduct {
  const root = resolve(inputRoot)
  const bytes = readFileSync(join(root, 'modula.product.json'), 'utf8')
  const parsed = JSON.parse(bytes) as {
    identity?: {id?: unknown; version?: unknown}
    frontend?: {mode?: unknown; artifact?: {path?: unknown}}
    backend?: {records?: Array<{schemaPath?: unknown}>}
  }
  const productId = typeof parsed.identity?.id === 'string' ? parsed.identity.id : ''
  const version = typeof parsed.identity?.version === 'string' ? parsed.identity.version : ''
  if (!productId || !version) fail(`MPS identity is incomplete in ${root}`)
  const artifactPath = typeof parsed.frontend?.artifact?.path === 'string' ? parsed.frontend.artifact.path : null
  const frontendFile = artifactPath ? resolveProductArtifact(root, artifactPath) : null
  const frontend = artifactPath && frontendFile ? {path: artifactPath, bytes: readFileSync(frontendFile)} : null
  if (parsed.frontend?.mode !== 'none' && !frontend) fail(`MPS frontend artifact is incomplete in ${root}`)
  const schemaPaths = [...new Set((parsed.backend?.records ?? [])
    .map(record => record.schemaPath)
    .filter((path): path is string => typeof path === 'string'))]
  const schemas = schemaPaths.map(path => ({path, bytes: readFileSync(resolveProductArtifact(root, path))}))
  return {productId, version, root, bytes, frontend, schemas}
}

function resolveProductArtifact(root: string, artifactPath: string): string {
  const file = resolve(root, artifactPath)
  if (!file.startsWith(`${root}${sep}`)) fail(`MPS artifact path escapes the product root: ${artifactPath}`)
  return file
}

function fail(message: string): never {
  throw new Error(message)
}
