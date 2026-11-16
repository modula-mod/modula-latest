import {hostname} from 'node:os'
import {loadConfig} from '../config/env.js'
import {createDb} from '../database/client.js'
import {HttpGithubReleaseSource} from '../modules/github-release-sync-service.js'
import {PublisherReleaseJobProcessor} from './release-job-processor.js'
import {PublisherReleaseJobRunner} from './release-job-runner.js'

/** Fetches, validates, and stores immutable approval candidates. It has no signing provider. */
async function main() {
  const config = loadConfig()
  const db = createDb(config.databaseUrl, error => console.error('release preparer database pool error', error.message), {
    applicationName: 'modula-release-preparer',
  })
  const processor = new PublisherReleaseJobProcessor(db, {
    source: new HttpGithubReleaseSource({token: process.env.GREENFIELD_MODULE_GITHUB_TOKEN ?? null}),
    config,
    githubEnabled: config.moduleGithubSyncEnabled,
    onlineSigningEnabled: process.env.MODULA_ONLINE_SIGNING_ENABLED === 'true',
  })
  const runner = new PublisherReleaseJobRunner(db, processor, {workerId: `publisher-release-preparer:${hostname()}:${process.pid}`})
  let stopping = false
  const stop = () => { stopping = true }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  while (!stopping) {
    await runner.reapExpiredLeases()
    const worked = await runner.runOnce().catch(error => { console.error('publisher release preparer error', (error as Error).message); return false })
    if (!worked) await new Promise(resolve => setTimeout(resolve, 2_000))
  }
  await db.destroy()
}

void main()
