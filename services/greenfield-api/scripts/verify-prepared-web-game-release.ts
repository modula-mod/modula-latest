import {createPublicKey, verify} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {basename} from 'node:path'
import {GreenfieldGithubReleaseSyncService, type GithubReleaseAsset, type GithubReleaseSource} from '../src/modules/github-release-sync-service.js'
import {buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'

/** Exercises the exact read-only ingest verifier before a QA release is uploaded. */
export async function verifyPreparedWebGameRelease(input: {
  packagePath: string
  provenancePath: string
  publicKeyPath: string
}): Promise<{productId: string; version: string; packageSha256: string; gameSha256: string; checks: string[]}> {
  const provenance = JSON.parse(readFileSync(input.provenancePath, 'utf8')) as Record<string, any>
  const packageBytes = readFileSync(input.packagePath)
  const provenanceBytes = readFileSync(input.provenancePath)
  if (basename(input.packagePath) !== provenance.packageFile
    || basename(input.provenancePath) !== `${provenance.releaseTag}.provenance.json`) {
    throw new Error('Prepared release filenames differ from signed provenance')
  }
  const assets: GithubReleaseAsset[] = [
    {name: provenance.packageFile, size: packageBytes.length, apiUrl: 'memory:package', digest: null},
    {name: `${provenance.releaseTag}.provenance.json`, size: provenanceBytes.length, apiUrl: 'memory:provenance', digest: null},
  ]
  const source: GithubReleaseSource = {
    async getRelease() { return {tagName: provenance.releaseTag, draft: false, prerelease: true, assets} },
    async resolveTagCommit() { return provenance.releaseCommit },
    async downloadAsset(asset) { return asset.apiUrl === 'memory:package' ? packageBytes : provenanceBytes },
  }
  const fetched = await new GreenfieldGithubReleaseSyncService(null as never, source)
    .fetchVerified({repository: provenance.repository, releaseTag: provenance.releaseTag})
  if (!fetched.game) throw new Error('Prepared release has no verified web game')
  const statement = buildPublisherReleaseStatement({
    manifest: fetched.manifest,
    sourceSha: fetched.releaseCommit,
    artifactSha256: fetched.packageSha256,
    productManifestSha256: fetched.evidence.productManifestSha256,
    frontendSha256: fetched.evidence.frontendSha256,
    signingKeyId: provenance.signature.keyId,
  })
  if (!verify(null, statementBytes(statement), createPublicKey(readFileSync(input.publicKeyPath)),
    Buffer.from(provenance.signature.value, 'base64url'))) {
    throw new Error('Prepared release signature does not verify with the supplied public key')
  }
  return {productId: fetched.productId, version: fetched.version, packageSha256: fetched.packageSha256,
    gameSha256: fetched.game.sha256, checks: [...fetched.checks, 'signature.ed25519']}
}

if (process.argv[1] && basename(process.argv[1]) === 'verify-prepared-web-game-release.ts') {
  const args = Object.fromEntries(process.argv.slice(2).map(part => part.split('=', 2)))
  if (!args['--package'] || !args['--provenance'] || !args['--public-key']) {
    throw new Error('Usage: tsx verify-prepared-web-game-release.ts --package=... --provenance=... --public-key=<QA public key path>')
  }
  console.log(JSON.stringify(await verifyPreparedWebGameRelease({packagePath: args['--package'],
    provenancePath: args['--provenance'], publicKeyPath: args['--public-key']}), null, 2))
}
