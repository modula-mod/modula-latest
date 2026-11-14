import type {Kysely} from 'kysely'
import type {Database} from '../../src/database/types.js'

export async function authorizeFirstPartyPublisherFixture(
  db: Kysely<Database>,
  publisherId: string,
  displayName: string,
  namespace: string,
) {
  const now = new Date()
  await db.insertInto('greenfield_publishers').values({
    publisher_id: publisherId,
    display_name: displayName,
    website: null,
    status: 'verified',
    trust_level: 'firstParty',
    created_at: now,
    updated_at: now,
    verified_at: now,
    suspended_at: null,
    revoked_at: null,
  }).onConflict(oc => oc.column('publisher_id').doUpdateSet({
    display_name: displayName,
    status: 'verified',
    trust_level: 'firstParty',
    updated_at: now,
    verified_at: now,
    suspended_at: null,
    revoked_at: null,
  })).execute()

  const existingNamespace = await db.selectFrom('greenfield_publisher_namespaces')
    .select(['publisher_id', 'revoked_at'])
    .where('namespace', '=', namespace)
    .executeTakeFirst()
  if (existingNamespace && existingNamespace.publisher_id !== publisherId) {
    throw new Error(`Fixture namespace ${namespace} is already owned by ${existingNamespace.publisher_id}`)
  }
  if (existingNamespace) {
    await db.updateTable('greenfield_publisher_namespaces').set({verified_at: now, revoked_at: null})
      .where('namespace', '=', namespace)
      .where('publisher_id', '=', publisherId)
      .execute()
    return
  }
  await db.insertInto('greenfield_publisher_namespaces').values({
    namespace,
    publisher_id: publisherId,
    verification_method: 'testFixturePolicy',
    verification_evidence: {fixture: 'module-platform-02'},
    verified_at: now,
    revoked_at: null,
    created_at: now,
  }).execute()
}
