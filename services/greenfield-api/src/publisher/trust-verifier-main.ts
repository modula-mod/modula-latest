import {createDb} from '../database/client.js'
import {RestrictedPublisherTrustVerifier} from './restricted-trust-verifier.js'

async function main() {
  const databaseUrl = process.env.MODULA_TRUST_VERIFIER_DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error('MODULA_TRUST_VERIFIER_DATABASE_URL is required')
  const db = createDb(databaseUrl, error => console.error('trust verifier database pool error', error.message), {
    applicationName: 'modula-trust-verifier', max: 2,
  })
  const verifier = new RestrictedPublisherTrustVerifier(db)
  let stopping = false
  const stop = () => { stopping = true }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  while (!stopping) {
    const worked = await verifier.runOnce().catch(error => { console.error('publisher trust verifier error', (error as Error).message); return false })
    if (!worked) await new Promise(resolve => setTimeout(resolve, 2_000))
  }
  await db.destroy()
}

void main()
