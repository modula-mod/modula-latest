import {createHash, createPrivateKey, sign} from 'node:crypto'
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {basename, join, resolve} from 'node:path'
import {GreenfieldModuleManifestService} from '../src/modules/manifest-service.js'
import {verifyOptionalArchive} from '../src/modules/github-release-sync-service.js'
import {buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'
import {adapter, tarGz} from './prepare-web-game-release.js'

const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

/** Package one already-built web runtime through the same signed QA release transport as games. */
export function prepareWebRuntimeRelease(input: {
  productRoot: string
  outputDirectory: string
  releaseTag: string
  releaseCommit: string
  signingKeyPath: string
  signingKeyId: string
}) {
  if (!/^[A-Za-z0-9._-]{3,160}$/.test(input.releaseTag)
    || !/^[a-f0-9]{40}$/.test(input.releaseCommit)
    || !/^[A-Za-z0-9._:-]{3,160}$/.test(input.signingKeyId)) {
    throw new Error('Release tag, exact commit, or signer key ID is invalid')
  }
  const root = resolve(input.productRoot)
  const mpsBytes = readFileSync(join(root, 'modula.product.json'))
  const mps = JSON.parse(mpsBytes.toString('utf8')) as Record<string, any>
  if (mps.identity?.kind !== 'engine' || mps.distribution?.schema !== 'modula.package.1'
    || mps.distribution?.category !== 'web-runtime' || mps.distribution?.sharing !== 'public-immutable'
    || mps.source?.repository !== 'modula-mod/modula-game-lab' || mps.source?.commit !== input.releaseCommit
    || mps.frontend?.mode !== 'none' || mps.distribution?.artifact?.path !== 'runtime.tgz') {
    throw new Error('Runtime MPS identity, source, or immutable package contract is invalid')
  }
  const runtime = readFileSync(join(root, 'runtime.tgz'))
  if (digest(runtime) !== mps.distribution.artifact.sha256
    || runtime.length !== mps.distribution.artifact.compressedSizeBytes
    || mps.distribution.artifact.mediaType !== 'application/vnd.modula.web-runtime+tgz') {
    throw new Error('Runtime bytes differ from the MPS release contract')
  }
  verifyOptionalArchive(runtime, 'web-runtime')
  const filename = `${mps.identity.id}-${mps.identity.version}.tgz`
  const manifest = adapter(mps, input.releaseTag, input.releaseCommit, filename)
  new GreenfieldModuleManifestService().parse(manifest)
  const adapterBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  const files = new Map<string, Buffer>([
    ['modula.product.json', mpsBytes], ['module.manifest.json', adapterBytes],
    ['runtime.tgz', runtime], ['icon.svg', readFileSync(join(root, 'icon.svg'))],
    ['LICENSE', readFileSync(join(root, 'LICENSE'))],
    ['THIRD_PARTY_NOTICES.md', readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'))],
  ])
  const packageBytes = tarGz(files)
  if (packageBytes.length > 50 * 1024 * 1024) throw new Error('Runtime release exceeds 50 MiB')
  const key = createPrivateKey(readFileSync(input.signingKeyPath))
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('QA signer must be Ed25519')
  const statement = buildPublisherReleaseStatement({
    manifest, sourceSha: input.releaseCommit, artifactSha256: digest(packageBytes),
    productManifestSha256: digest(mpsBytes), frontendSha256: null,
    signingKeyId: input.signingKeyId,
  })
  const provenance = {
    productId: mps.identity.id, version: mps.identity.version,
    repository: mps.source.repository, releaseTag: input.releaseTag,
    releaseCommit: input.releaseCommit, packageFile: filename,
    packageChecksum: digest(packageBytes), productManifestChecksum: digest(mpsBytes),
    greenfieldManifestChecksum: manifest.integrity.manifestSha256,
    standardManifestChecksum: null, frontendArtifact: null, frontendChecksum: null,
    signature: {algorithm: 'Ed25519', keyId: input.signingKeyId,
      value: sign(null, statementBytes(statement), key).toString('base64url')},
  }
  const output = resolve(input.outputDirectory)
  mkdirSync(output, {recursive: true})
  const packagePath = join(output, filename)
  const provenancePath = join(output, `${input.releaseTag}.provenance.json`)
  writeFileSync(packagePath, packageBytes)
  writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`)
  return {packagePath, provenancePath, packageSha256: digest(packageBytes), runtimeSha256: digest(runtime)}
}

if (process.argv[1] && basename(process.argv[1]) === 'prepare-web-runtime-release.ts') {
  const args = Object.fromEntries(process.argv.slice(2).map(part => part.split('=', 2)))
  const required = ['root', 'output', 'tag', 'commit', 'key', 'key-id']
  if (required.some(key => !args[`--${key}`])) {
    throw new Error('Usage: tsx prepare-web-runtime-release.ts --root=... --output=... --tag=... --commit=<40hex> --key=<QA key path> --key-id=<registered QA signer>')
  }
  console.log(JSON.stringify(prepareWebRuntimeRelease({
    productRoot: args['--root']!, outputDirectory: args['--output']!,
    releaseTag: args['--tag']!, releaseCommit: args['--commit']!,
    signingKeyPath: args['--key']!, signingKeyId: args['--key-id']!,
  }), null, 2))
}
