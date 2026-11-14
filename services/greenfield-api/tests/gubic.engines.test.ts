import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {gzipSync} from 'node:zlib'
import {describe, expect, it} from 'vitest'
import {
  GUBIC_ENGINE_DEFINITIONS,
  GUBIC_ENGINES,
  GUBIC_LATER_ENGINES,
  GUBIC_NON_ENGINE_RUNTIME_CATEGORIES,
  GUBIC_RUNTIME_CATEGORIES,
  gubicEngineAllowsGraphics,
  isGubicEngine,
  isGubicRuntimeCategory,
} from '@modula/greenfield-module-registry-contracts'
import * as manifest from '../src/gubic/manifest.js'
import {GubicManifestError, validateGubicManifest} from '../src/gubic/manifest.js'
import {assertWebGameRuntimeContract, verifyWebGameArchive} from '../src/modules/github-release-sync-service.js'

const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')

function runtime(overrides: Record<string, unknown> = {}): Record<string, any> {
  return {
    contractVersion: '1.0.0', type: 'web-mini-game', engine: 'html5', engineVersion: 'canvas-2d',
    entryPath: 'index.html', artifact: {path: 'game/game.tgz', sha256: 'a'.repeat(64), mediaType: 'application/vnd.modula.game-web+tgz'},
    compressedSizeLimitBytes: 50 * 1024 * 1024, minimumHostVersion: '>=1.1.0', offline: true,
    network: 'none', assetInventory: 'game.files.json', orientation: 'any', graphics: 'none', touchControls: 'pointer',
    ...overrides,
  }
}

function submission(engine: string) {
  return {
    schema: 'modula.gubic.game.v1', gameId: 'test.modula.gubic.reference-tap', version: '0.1.0', title: 'Reference Tap',
    genre: 'Arcade', categories: ['arcade'], runtime: {engine, entry: 'index.html', orientation: 'any'},
    bridge: {version: 1, capabilities: ['lifecycle']}, network: 'none', ageRating: '4+', monetisation: 'free', packageSizeBytes: 4096,
  }
}

function tarEntry(path: string, bytes: Buffer): Buffer {
  const header = Buffer.alloc(512)
  header.write(path, 0, 100)
  header.write('0000644\0', 100)
  header.write('0000000\0', 108)
  header.write('0000000\0', 116)
  header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124)
  header.write('00000000000\0', 136)
  header.fill(' ', 148, 156)
  header.write('0', 156)
  header.write('ustar\0', 257)
  header.write('00', 263)
  const sum = header.reduce((total, byte) => total + byte, 0)
  header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148)
  return Buffer.concat([header, bytes, Buffer.alloc(Math.ceil(bytes.length / 512) * 512 - bytes.length)])
}

describe('GUBIC shared engine definition', () => {
  it('is the one list used by submission manifests, catalogue categories and signed ingestion', () => {
    expect([...GUBIC_ENGINES]).toEqual(['html5', 'phaser', 'playcanvas'])
    expect(manifest.GUBIC_ENGINES).toBe(GUBIC_ENGINES)
    expect(manifest.GUBIC_LATER_ENGINES).toBe(GUBIC_LATER_ENGINES)
    expect(Object.keys(GUBIC_ENGINE_DEFINITIONS).sort()).toEqual([...GUBIC_ENGINES].sort())
    for (const engine of GUBIC_ENGINES) {
      expect(isGubicRuntimeCategory(GUBIC_ENGINE_DEFINITIONS[engine].catalogueRuntimeCategory)).toBe(true)
      expect(() => assertWebGameRuntimeContract(runtime({engine, graphics: GUBIC_ENGINE_DEFINITIONS[engine].graphics[0]}))).not.toThrow()
      expect(() => validateGubicManifest(submission(engine))).not.toThrow()
    }
    for (const later of GUBIC_LATER_ENGINES) expect(isGubicEngine(later)).toBe(false)
    expect(GUBIC_RUNTIME_CATEGORIES).toEqual([
      ...GUBIC_ENGINES.map(engine => GUBIC_ENGINE_DEFINITIONS[engine].catalogueRuntimeCategory),
      ...GUBIC_NON_ENGINE_RUNTIME_CATEGORIES,
    ])
  })

  it('matches the catalogue runtime_category CHECK constraint in migration 078', () => {
    const sql = readFileSync(join(import.meta.dirname, '../migrations/078_gubic_game_catalogue.sql'), 'utf8')
    const check = /runtime_category TEXT NOT NULL CHECK \(runtime_category IN \(([^)]*)\)\)/.exec(sql)
    expect(check).not.toBeNull()
    const values = [...check![1]!.matchAll(/'([^']+)'/g)].map(match => match[1])
    expect(values).toEqual([...GUBIC_RUNTIME_CATEGORIES])
  })

  it('accepts a plain html5 web game at signed ingestion with either graphics mode', () => {
    expect(() => assertWebGameRuntimeContract(runtime())).not.toThrow()
    expect(() => assertWebGameRuntimeContract(runtime({graphics: 'webgl2'}))).not.toThrow()
    expect(gubicEngineAllowsGraphics('html5', 'none')).toBe(true)
  })

  it('rejects unknown, later-phase and Skia engines at ingestion and submission', () => {
    for (const engine of ['unity', 'skia', 'canvaskit', 'godot', 'mmorpg-client', 'retro-emulation', 'HTML5', '', undefined]) {
      expect(() => assertWebGameRuntimeContract(runtime({engine})), String(engine)).toThrow(/runtime artifact contract is invalid/)
    }
    expect(() => validateGubicManifest(submission('unity'))).toThrow(GubicManifestError)
    expect(() => validateGubicManifest(submission('skia'))).toThrow(/runtime.engine must be one of html5, phaser, playcanvas/)
    expect(() => validateGubicManifest(submission('retro-emulation'))).toThrow(/later phase/)
  })

  it('keeps per-engine graphics rules (PlayCanvas still requires WebGL2)', () => {
    expect(() => assertWebGameRuntimeContract(runtime({engine: 'playcanvas', graphics: 'none'}))).toThrow(/contract is invalid/)
    expect(() => assertWebGameRuntimeContract(runtime({engine: 'playcanvas', graphics: 'webgl2'}))).not.toThrow()
    expect(() => assertWebGameRuntimeContract(runtime({graphics: 'webgpu'}))).toThrow(/contract is invalid/)
  })

  it('still requires the runtime dependency for contract 1.1.0', () => {
    const externalised = runtime({contractVersion: '1.1.0', runtimeDependency: {packageId: 'test.modula.gubic.runtime', versionRange: '^1.0.0'}})
    expect(() => assertWebGameRuntimeContract(externalised, {dependencies: []})).toThrow(/dependency closure/)
    expect(() => assertWebGameRuntimeContract(externalised, {dependencies: [{packageId: 'test.modula.gubic.runtime', versionRange: '^1.0.0'}]})).not.toThrow()
  })

  it('keeps the WebAssembly ban for html5 game archives', () => {
    const html = Buffer.from('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; connect-src \'none\'; object-src \'none\'">')
    const wasm = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
    const inventory = Buffer.from(JSON.stringify({schema: 'modula.game-files.1', files: {'index.html': sha256(html), 'canvaskit.wasm': sha256(wasm)}}))
    const archive = gzipSync(Buffer.concat([tarEntry('index.html', html), tarEntry('canvaskit.wasm', wasm), tarEntry('game.files.json', inventory), Buffer.alloc(1024)]))
    expect(() => verifyWebGameArchive(archive)).toThrow(/unsafe|native|forbidden/i)
  })
})
