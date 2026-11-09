import {hostname} from 'node:os'
import {loadConfig} from '../config/env.js'
import {createDb} from '../database/client.js'
import {HttpGithubReleaseSource} from '../modules/github-release-sync-service.js'
import {PublisherReleaseJobProcessor} from './release-job-processor.js'
import {PublisherReleaseJobRunner} from './release-job-runner.js'

/**
 * Publisher release console runner process (built into the API image:
 * `node dist/publisher/release-job-runner-main.js`). Not started by any deploy
 * manifest in this change; see the BUILDER-01 report.
 */
async function main() {
  const config = loadConfig()
  const db = createDb(config.databaseUrl)
  const processor = new PublisherReleaseJobProcessor(db, {
    source: new HttpGithubReleaseSource({token: process.env.GREENFIELD_MODULE_GITHUB_TOKEN ?? null}),
    config,
    githubEnabled: config.moduleGithubSyncEnabled,
  })
  const runner = new PublisherReleaseJobRunner(db, processor, {workerId: `publisher-release-runner:${hostname()}:${process.pid}`})
  let stopping = false
  const stop = () => { stopping = true }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  while (!stopping) {
    await runner.reapExpiredLeases()
    const worked = await runner.runOnce().catch(error => { console.error('publisher release runner error', (error as Error).message); return false })
    if (!worked) await new Promise(resolve => setTimeout(resolve, 2_000))
  }
  await db.destroy()
}

void main()
