export type ExtensionManifest = {name: string; version: string; functions?: Array<{name: string; kind: 'remoteHttp' | 'background' | 'native'; url?: string}>; capabilities?: string[]}
export function validateManifest(value: unknown): ExtensionManifest {
  if (!value || typeof value !== 'object') throw Object.assign(new Error('Manifest must be an object'), {code: 'VALIDATION_FAILED'})
  const manifest = value as ExtensionManifest
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(manifest.name ?? '') || !/^\d+\.\d+\.\d+/.test(manifest.version ?? '')) throw Object.assign(new Error('Manifest name and semver version required'), {code: 'VALIDATION_FAILED'})
  if (manifest.functions?.some(fn => !fn.name || !['remoteHttp', 'background', 'native'].includes(fn.kind))) throw Object.assign(new Error('Invalid function manifest'), {code: 'VALIDATION_FAILED'})
  return manifest
}
