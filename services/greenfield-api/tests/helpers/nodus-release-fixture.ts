// Shared test-only Nodus release descriptor (fake digests, example.test hosts).
export const hex = (c: string) => c.repeat(64)
export const validDescriptor = {
  schemaVersion: 1,
  nodusVersion: '1.0.0',
  artifactHash: `sha256:${hex('a')}`,
  manifestURL: 'https://cdn.example.test/nodus/1.0.0/nodus-manifest.json',
  manifestSHA256: hex('b'),
  files: [
    {path: 'weights/model.safetensors', url: 'https://cdn.example.test/nodus/1.0.0/weights/model.safetensors', sha256: hex('c'), bytes: 1024},
    {path: 'config.json', url: 'https://cdn.example.test/nodus/1.0.0/config.json', sha256: hex('d'), bytes: 12},
  ],
}
