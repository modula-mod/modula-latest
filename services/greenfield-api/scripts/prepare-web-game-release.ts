import {createHash, createPrivateKey, sign} from 'node:crypto'
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {basename, join, resolve} from 'node:path'
import {gzipSync} from 'node:zlib'
import {
  GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
  createDefaultModuleSectionVersions,
  manifestChecksum,
  type GreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'
import {readTarGz} from '../src/lib/tar-gz.js'
import {GreenfieldModuleManifestService} from '../src/modules/manifest-service.js'
import {buildPublisherReleaseStatement, statementBytes} from '../src/modules/release-signing.js'
import {verifyWebGameArchive, webGamePermissionsFromMps} from '../src/modules/github-release-sync-service.js'

/**
 * Turns the generator's canonical MPS tarball into the registry's signed
 * GitHub-release transport. The GreenField adapter is generated from MPS and
 * checked by the same parser as server ingestion; it is never hand-edited.
 * This command prepares files only. Publishing and key registration are
 * explicit QA operations; no production signing key is read implicitly.
 */
export function prepareWebGameRelease(input: {
  generatorPackage: string
  outputDirectory: string
  releaseTag: string
  releaseCommit: string
  signingKeyPath: string
  signingKeyId: string
}): {packagePath: string; provenancePath: string; packageSha256: string; gameSha256: string} {
  if (!/^[A-Za-z0-9._-]{3,160}$/.test(input.releaseTag)
    || !/^[a-f0-9]{40}$/.test(input.releaseCommit)
    || !/^[A-Za-z0-9._:-]{3,160}$/.test(input.signingKeyId)) {
    throw new Error('Release tag, exact commit, or signer key ID is invalid')
  }
  const generatorBytes = readFileSync(input.generatorPackage)
  const files = readTarGz(generatorBytes, {maxUncompressedBytes: 200 * 1024 * 1024, maxEntries: 512})
  if (files.has('module.manifest.json') || [...files.keys()].some(path => path.startsWith('package/'))) {
    throw new Error('Expected one root-level canonical MPS package without an adapter')
  }
  const mpsBytes = files.get('modula.product.json')
  if (!mpsBytes) throw new Error('Generator package has no canonical MPS manifest')
  const mps = JSON.parse(mpsBytes.toString('utf8')) as Record<string, any>
  const productId = mps.identity?.id
  const version = mps.identity?.version
  if (mps.identity?.kind !== 'game' || mps.gameRuntime?.type !== 'web-mini-game'
    || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(productId ?? '')
    || !/^\d+\.\d+\.\d+$/.test(version ?? '')) {
    throw new Error('Only versioned MPS web games can enter this release path')
  }
  if (mps.source?.provider !== 'github' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(mps.source?.repository ?? '')) {
    throw new Error('MPS requires one GitHub source repository')
  }
  if (mps.source.commit !== input.releaseCommit) {
    throw new Error('Release tag commit must equal the canonical MPS source commit')
  }
  if (mps.compatibility?.host !== mps.gameRuntime.minimumHostVersion
    || mps.compatibility.host !== '>=1.1.0') {
    throw new Error('Web game host compatibility must match the accepted 1.1.0 runtime')
  }
  const frontendPath = mps.frontend?.artifact?.path
  const frontend = typeof frontendPath === 'string' ? files.get(frontendPath) : null
  const gamePath = mps.gameRuntime?.artifact?.path
  const game = typeof gamePath === 'string' ? files.get(gamePath) : null
  if (!frontend || !game || gamePath !== 'game/game.tgz'
    || sha256(frontend) !== mps.frontend.artifact.sha256
    || sha256(game) !== mps.gameRuntime.artifact.sha256) {
    throw new Error('Frontend or game artifact is missing or differs from MPS')
  }
  verifyWebGameArchive(game)
  const filename = `${productId}-${version}.tgz`
  const manifest = adapter(mps, input.releaseTag, input.releaseCommit, filename)
  new GreenfieldModuleManifestService().parse(manifest)
  const adapterBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  const releaseFiles = new Map(files)
  releaseFiles.set('module.manifest.json', adapterBytes)
  const packageBytes = tarGz(releaseFiles)
  if (packageBytes.length > 50 * 1024 * 1024) throw new Error('Registry package exceeds 50 MiB')
  const key = createPrivateKey(readFileSync(input.signingKeyPath))
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('QA signer must be Ed25519')
  const statement = buildPublisherReleaseStatement({
    manifest,
    sourceSha: input.releaseCommit,
    artifactSha256: sha256(packageBytes),
    productManifestSha256: sha256(mpsBytes),
    frontendSha256: sha256(frontend),
    signingKeyId: input.signingKeyId,
  })
  const signature = sign(null, statementBytes(statement), key).toString('base64url')
  const provenance = {
    productId,
    version,
    repository: mps.source.repository,
    releaseTag: input.releaseTag,
    releaseCommit: input.releaseCommit,
    packageFile: filename,
    packageChecksum: sha256(packageBytes),
    productManifestChecksum: sha256(mpsBytes),
    greenfieldManifestChecksum: manifest.integrity.manifestSha256,
    standardManifestChecksum: files.has('modula.module.json') ? sha256(files.get('modula.module.json')!) : null,
    frontendArtifact: frontendPath,
    frontendChecksum: sha256(frontend),
    signature: {algorithm: 'Ed25519', keyId: input.signingKeyId, value: signature},
  }
  const output = resolve(input.outputDirectory)
  mkdirSync(output, {recursive: true})
  const packagePath = join(output, filename)
  const provenancePath = join(output, `${input.releaseTag}.provenance.json`)
  writeFileSync(packagePath, packageBytes)
  writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`)
  // Return only public digests; neither the private key nor signing bytes log.
  return {packagePath, provenancePath, packageSha256: sha256(packageBytes), gameSha256: sha256(game)}
}

export function adapter(mps: Record<string, any>, tag: string, commit: string, filename: string): GreenfieldModuleManifest {
  const moduleId = mps.identity.id as string
  const version = mps.identity.version as string
  const manifest = {
    manifestVersion: GREENFIELD_MODULE_MANIFEST_STANDARD_2_VERSION,
    moduleId,
    name: mps.identity.displayName,
    description: mps.identity.description,
    version,
    standardVersion: '2.1.0',
    sectionVersions: createDefaultModuleSectionVersions(),
    publisher: {publisherId: mps.publisher.id, displayName: mps.publisher.displayName},
    source: {provider: 'github', repository: mps.source.repository, commit,
      manifestPath: 'module.manifest.json', releaseTag: tag, releaseAssetName: filename},
    license: {status: mps.publisher.id === 'modula' ? 'firstParty' : 'declared',
      spdx: mps.licence.spdx, evidenceIds: mps.licence.evidence},
    trust: {requestedLevel: mps.publisher.id === 'modula' ? 'firstParty' : 'verifiedPublisher'},
    compatibility: {minimumGreenfieldVersion: '0.1.0', minimumModulaHostVersion: '1.1.0',
      protocolVersions: ['greenfield.v1'], platforms: ['ios']},
    permissions: webGamePermissionsFromMps(mps),
    dependencies: [],
    contributions: {},
    dependencyGraph: {version: '2.0.0', requires: [], optional: [], recommended: [], conflicts: [], replaces: [], provides: []},
    capabilityDiscovery: {version: '2.0.0'},
    serviceRegistry: {version: '2.0.0', items: []},
    apiRegistry: {version: '2.0.0', items: []},
    hookRegistry: {version: '2.0.0', items: []},
    permissionModel: {version: '2.0.0', categories: {}},
    jobRegistry: {version: '2.0.0', items: []},
    storageModel: {version: '2.0.0', items: []},
    widgetRegistry: {version: '2.0.0', items: []},
    navigationRegistry: {version: '2.0.0', items: []},
    uiContributions: {version: '2.0.0', items: []},
    eventBus: {version: '2.0.0', items: []},
    extensionProduct: {version, kind: 'module', targets: [], extensionPoints: [], contributions: [],
      retention: {defaultMode: 'KEEP_DATA', supportsUserChoice: true}, graphPolicy: {maxDepth: 16, maxNodes: 256}},
    integrity: {manifestSha256: ''},
  } as GreenfieldModuleManifest
  manifest.integrity.manifestSha256 = manifestChecksum({...manifest, integrity: {...manifest.integrity, manifestSha256: ''}})
  return manifest
}

export function tarGz(files: Map<string, Buffer>): Buffer {
  const entries: Buffer[] = []
  for (const [path, bytes] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const name = `package/${path}`
    if (Buffer.byteLength(name) > 100 || !/^[A-Za-z0-9._/-]+$/.test(name) || name.split('/').includes('..')) {
      throw new Error(`Unsafe release member ${name}`)
    }
    const header = Buffer.alloc(512)
    header.write(name, 0, 100, 'utf8')
    header.write('0000644\0', 100)
    header.write('0000000\0', 108)
    header.write('0000000\0', 116)
    header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124)
    header.write('00000000000\0', 136)
    header.write('        ', 148)
    header.write('0', 156)
    header.write('ustar\0', 257)
    header.write('00', 263)
    let checksum = 0
    for (const byte of header) checksum += byte
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148)
    entries.push(header, bytes, Buffer.alloc(Math.ceil(bytes.length / 512) * 512 - bytes.length))
  }
  entries.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(entries), {mtime: 0})
}

function sha256(bytes: Buffer): string { return createHash('sha256').update(bytes).digest('hex') }

if (process.argv[1] && basename(process.argv[1]) === 'prepare-web-game-release.ts') {
  const args = Object.fromEntries(process.argv.slice(2).map(part => part.split('=', 2)))
  const required = ['package', 'output', 'tag', 'commit', 'key', 'key-id']
  if (required.some(key => !args[`--${key}`])) {
    throw new Error('Usage: tsx prepare-web-game-release.ts --package=... --output=... --tag=... --commit=<40hex> --key=<QA private key path> --key-id=<registered QA signer>')
  }
  const result = prepareWebGameRelease({generatorPackage: args['--package']!, outputDirectory: args['--output']!,
    releaseTag: args['--tag']!, releaseCommit: args['--commit']!, signingKeyPath: args['--key']!, signingKeyId: args['--key-id']!})
  console.log(JSON.stringify(result, null, 2))
}
