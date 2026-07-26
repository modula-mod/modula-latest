import {mkdtemp, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {afterEach, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {PostMediaStorage} from '../src/domains/media/post-media-storage.js'

const pngPixel =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

let roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.map(root => rm(root, {recursive: true, force: true})))
  roots = []
})

describe('Phase 7C post media storage', () => {
  it('does not touch the media root for text-only posts', async () => {
    const storage = new PostMediaStorage(configFor('/proc/modula-unwritable-media-root'))

    await expect(storage.persistPostMedia({postId: 'post-text-only', media: []})).resolves.toEqual([])
  })

  it('persists and reads a bounded uploaded image', async () => {
    const root = await tempRoot()
    const storage = new PostMediaStorage(configFor(root))

    const [media] = await storage.persistPostMedia({
      postId: 'post-media-test',
      media: [
        {
          kind: 'image',
          base64: pngPixel,
          mimeType: 'image/png',
          width: 1,
          height: 1,
          altText: 'Tiny transparent image',
        },
      ],
    })

    expect(media?.url).toMatch(/^https:\/\/api\.example\.test\/v1\/media\/[0-9a-f-]+\.png$/)
    expect(media?.aspectRatio).toBe('1')
    expect(media?.altText).toBe('Tiny transparent image')
    const stored = await storage.readPostMedia(media!.fileName)
    expect(stored?.contentType).toBe('image/png')
    expect(stored?.bytes.length).toBeGreaterThan(0)
  })

  it('rejects missing upload bytes and oversized payloads', async () => {
    const root = await tempRoot()
    const storage = new PostMediaStorage(configFor(root, 8))

    await expect(
      storage.persistPostMedia({
        postId: 'post-media-empty',
        media: [{kind: 'image', base64: '', mimeType: 'image/png'}],
      }),
    ).rejects.toThrow(/required/)

    await expect(
      storage.persistPostMedia({
        postId: 'post-media-large',
        media: [{kind: 'image', base64: pngPixel, mimeType: 'image/png'}],
      }),
    ).rejects.toThrow(/too large/)
  })
})

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'modula-phase7c-media-'))
  roots.push(root)
  return root
}

function configFor(root: string, maxBytes = 1024) {
  return loadConfig({
    NODE_ENV: 'test',
    MODULA_ENVIRONMENT: 'development',
    MODULA_API_HOST: '127.0.0.1',
    MODULA_API_PORT: '4024',
    MODULA_PUBLIC_API_URL: 'https://api.example.test',
    MODULA_DATABASE_URL: 'postgres://modula:modula@127.0.0.1:5432/modula_test',
    MODULA_ALLOWED_ORIGINS: 'https://modula.digital',
    MODULA_MEDIA_ROOT: root,
    MODULA_MEDIA_UPLOAD_MAX_BYTES: String(maxBytes),
    MODULA_REQUEST_BODY_LIMIT_BYTES: '4096',
  })
}
