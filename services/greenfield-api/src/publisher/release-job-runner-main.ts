import {hostname} from 'node:os'
import {createDb} from '../database/client.js'
import {RestrictedPublisherSigningRunner} from './restricted-signing-runner.js'
import {vaultTransitProviderFromEnvironment} from './signing-provider.js'

/**
 * Signing-only runner. It deliberately refuses the general API database URL:
 * deployment must provide the dedicated migration-092 runner credential.
 */
async function main() {
  const databaseUrl = process.env.MODULA_SIGNING_RUNNER_DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error('MODULA_SIGNING_RUNNER_DATABASE_URL is required for the signing-only runner')
  const signingProvider = vaultTransitProviderFromEnvironment()
  if (!signingProvider) throw new Error('A configured Vault Transit signing provider is required')
  const db = createDb(databaseUrl, error => console.error('signing runner database pool error', error.message), {
    applicationName: 'modula-signing-runner',
    max: 2,
  })
  const runner = new RestrictedPublisherSigningRunner(db, signingProvider, {workerId: `publisher-signing-runner:${hostname()}:${process.pid}`})
  let stopping = false
  const stop = () => { stopping = true }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  while (!stopping) {
    const worked = await runner.runOnce().catch(error => { console.error('publisher release runner error', (error as Error).message); return false })
    if (!worked) await new Promise(resolve => setTimeout(resolve, 2_000))
  }
  await db.destroy()
}

void main()
