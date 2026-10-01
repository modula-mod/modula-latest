/**
 * Server-side GitHub release ingestion (replaces the manual-checkout
 * publish-mps-products.ts flow). Fetches <tag>.provenance.json and the
 * release package from GitHub, verifies them, and (with --apply) imports,
 * verifies, optionally publishes (--publish) and ingests the release.
 *
 *   tsx scripts/sync-github-release.ts --repository owner/name --tag vault-notes-v1.7.0 [--apply] [--publish]
 *
 * Dry run by default (no database writes). GREENFIELD_MODULE_GITHUB_TOKEN is
 * optional (private repositories / rate limits) and is never printed.
 */
import {createDb} from '../src/database/client.js'
import {GreenfieldGithubReleaseSyncService, HttpGithubReleaseSource} from '../src/modules/github-release-sync-service.js'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const repository = arg('repository')
const releaseTag = arg('tag')
if (!repository || !releaseTag) throw new Error('--repository owner/name and --tag <release tag> are required')
const apply = process.argv.includes('--apply')
const databaseUrl = process.env.MODULA_DATABASE_MIGRATOR_URL ?? process.env.MODULA_DATABASE_URL
if (!databaseUrl) throw new Error('MODULA_DATABASE_MIGRATOR_URL or MODULA_DATABASE_URL is required')
const db = createDb(databaseUrl)
try {
  const service = new GreenfieldGithubReleaseSyncService(db, new HttpGithubReleaseSource({token: process.env.GREENFIELD_MODULE_GITHUB_TOKEN ?? null}))
  const result = await service.sync({repository, releaseTag, publish: process.argv.includes('--publish'), dryRun: !apply})
  console.log(JSON.stringify(result, null, 2))
} finally {
  await db.destroy()
}
