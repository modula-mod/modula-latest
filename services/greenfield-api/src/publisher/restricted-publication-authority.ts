import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'

/** Publication-only consumer. The database function derives and revalidates the next eligible job. */
export class RestrictedPublisherPublicationAuthority {
  constructor(private readonly db: ModulaDb) {}

  async runOnce(): Promise<boolean> {
    const result = await sql<{release_id: string | null}>`
      SELECT greenfield_publication_authority_publish_next() AS release_id
    `.execute(this.db)
    return result.rows[0]?.release_id !== null && result.rows[0]?.release_id !== undefined
  }
}
