/**
 * Publisher-side helper for the Modula release signing protocol v1.
 * Runs in the PUBLISHER's CI with the publisher's own Ed25519 key; the
 * registry never sees the private key. Prints the `signature` object to put
 * in the release provenance sidecar ({algorithm, keyId, value}).
 *
 *   MODULA_PUBLISHER_SIGNING_KEY_FILE=/run/secrets/modula-signing.pem \
 *   tsx scripts/sign-release-statement.ts --key-id acme-2026-01 \
 *     --manifest package/module.manifest.json --product package/modula.product.json \
 *     [--frontend package/frontend/app.json] --artifact acme-1.2.0.tgz --source-sha <40-hex>
 *
 * A KMS signer can instead sign the bytes printed by --print-statement.
 */
import {createHash, createPrivateKey, sign} from 'node:crypto'
import {readFileSync} from 'node:fs'
import type {GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}
function required(name: string): string {
  const value = arg(name)
  if (!value) throw new Error(`--${name} is required`)
  return value
}
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

const manifest = JSON.parse(readFileSync(required('manifest'), 'utf8')) as GreenfieldModuleManifest
const frontendPath = arg('frontend')
const statement = buildPublisherReleaseStatement({
  manifest,
  sourceSha: required('source-sha'),
  artifactSha256: sha256(readFileSync(required('artifact'))),
  productManifestSha256: arg('product') ? sha256(readFileSync(arg('product')!)) : null,
  frontendSha256: frontendPath ? sha256(readFileSync(frontendPath)) : null,
  signingKeyId: required('key-id'),
})
if (process.argv.includes('--print-statement')) {
  process.stdout.write(statementBytes(statement))
} else {
  const keyFile = process.env.MODULA_PUBLISHER_SIGNING_KEY_FILE
  if (!keyFile) throw new Error('MODULA_PUBLISHER_SIGNING_KEY_FILE must point at the publisher Ed25519 private key (PEM)')
  const key = createPrivateKey(readFileSync(keyFile))
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('The publisher signing key must be Ed25519')
  const value = sign(null, statementBytes(statement), key).toString('base64url')
  process.stdout.write(`${JSON.stringify({algorithm: 'Ed25519', keyId: statement.signingKeyId, value}, null, 2)}\n`)
}
