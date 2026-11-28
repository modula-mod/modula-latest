import {createDb} from '../database/client.js'
import {RestrictedPublisherPublicationAuthority} from './restricted-publication-authority.js'

async function main() {
  const databaseUrl = process.env.MODULA_PUBLICATION_AUTHORITY_DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error('MODULA_PUBLICATION_AUTHORITY_DATABASE_URL is required')
  const db = createDb(databaseUrl, error => console.error('publication authority database pool error', error.message), {
    applicationName: 'modula-publication-authority', max: 2,
  })
  const authority = new RestrictedPublisherPublicationAuthority(db)
  let stopping = false
  const stop = () => { stopping = true }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  while (!stopping) {
    const worked = await authority.runOnce().catch(error => { console.error('publisher publication authority error', (error as Error).message); return false })
    if (!worked) await new Promise(resolve => setTimeout(resolve, 2_000))
  }
  await db.destroy()
}

void main()
