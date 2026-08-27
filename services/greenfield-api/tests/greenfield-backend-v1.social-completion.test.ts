import {randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'kysely'
import {createDb, type ModulaDb} from '../src/database/client.js'
import {migrateUp} from '../src/database/migrate.js'
import {DiscoveryRepository} from '../src/domains/discovery/repository.js'
import {ModerationRepository} from '../src/domains/moderation/repository.js'
import {NotificationRepository} from '../src/domains/notifications/repository.js'
import {PostRepository} from '../src/domains/posts/repository.js'
import {ReactionService} from '../src/domains/reactions/service.js'
import {PostShareService} from '../src/domains/shares/service.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip

describeIfDb('Greenfield Backend V1 social completion', () => {
  let db: ModulaDb
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const owner = ids('owner', suffix)
  const viewer = ids('viewer', suffix)
  const moderator = ids('moderator', suffix)
  const visiblePostId = `social-visible-${suffix}`
  const reportedPostId = `social-reported-${suffix}`

  beforeAll(async () => {
    await migrateUp(databaseUrl!)
    db = createDb(databaseUrl!)
    await seedIdentity(db, owner)
    await seedIdentity(db, viewer)
    await seedIdentity(db, moderator)
    await seedPost(db, visiblePostId, owner.actorId)
    await seedPost(db, reportedPostId, owner.actorId)
  })

  afterAll(async () => db?.destroy())

  it('keeps one canonical reaction and records idempotent policy-checked shares', async () => {
    const reactions = new ReactionService(db)
    expect((await reactions.setReaction(viewer.actorId, visiblePostId, 'love')).viewerReaction).toBe('love')
    expect((await reactions.setReaction(viewer.actorId, visiblePostId, 'fire')).viewerReaction).toBe('fire')
    const rows = await db.selectFrom('greenfield_reactions').selectAll()
      .where('actor_id', '=', viewer.actorId).where('post_id', '=', visiblePostId).execute()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.reaction_type).toBe('fire')

    const shares = new PostShareService(db)
    const first = await shares.record({actorId: viewer.actorId, postId: visiblePostId, channel: 'copy-link', idempotencyKey: 'same-share'})
    const replay = await shares.record({actorId: viewer.actorId, postId: visiblePostId, channel: 'copy-link', idempotencyKey: 'same-share'})
    expect(replay.shareId).toBe(first.shareId)
    expect(await db.selectFrom('greenfield_post_shares').select('share_id').where('post_id', '=', visiblePostId).execute()).toHaveLength(1)
  })

  it('supports evidence-bearing report review and audited content removal', async () => {
    const moderation = new ModerationRepository(db)
    const report = await moderation.createReport(viewer.actorId, {
      targetType: 'post',
      targetId: reportedPostId,
      category: 'harassment',
      details: 'Evidence supplied for operator review',
      evidenceRefs: [{kind: 'asset', reference: 'asset.social-proof'}],
    })
    expect(report).toMatchObject({status: 'open', version: 1})
    expect(report.evidenceRefs).toEqual([{kind: 'asset', reference: 'asset.social-proof'}])
    const reviewed = await moderation.reviewReport({
      reportId: report.id,
      reviewerActorId: moderator.actorId,
      status: 'reviewing',
      expectedVersion: 1,
    })
    const result = await moderation.applyAction({
      reportId: report.id,
      reviewerActorId: moderator.actorId,
      actionType: 'content_removed',
      note: 'Removed after human review',
      expectedVersion: reviewed.version!,
    })
    expect(result.report).toMatchObject({status: 'resolved', resolution: 'Removed after human review'})
    expect(await new PostRepository(db).getById(reportedPostId, owner.actorId)).toBeNull()
    expect(await db.selectFrom('moderation_actions').select('id').where('report_id', '=', report.id).execute()).toHaveLength(2)
  })

  it('propagates blocking through profiles, posts, discovery, shares and notification reads', async () => {
    await db.insertInto('notifications').values({
      id: `notification-${suffix}`,
      recipient_actor_id: viewer.actorId,
      actor_id: owner.actorId,
      type: 'mention',
      category: 'social',
      channels: sql`${JSON.stringify(['in-app'])}::jsonb`,
      dedupe_key: null,
      aggregate_count: 1,
      aggregate_window_started_at: new Date(),
      last_aggregated_at: new Date(),
      resource_type: 'post',
      resource_id: visiblePostId,
      body: 'mentioned you',
      read_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      version: 1,
    }).execute()

    await new ModerationRepository(db).block(viewer.actorId, owner.actorId)
    expect(await new PostRepository(db).getById(visiblePostId, viewer.actorId)).toBeNull()
    expect((await new DiscoveryRepository(db).getDiscover(viewer.actorId)).suggestedProfiles.some(p => p.id === owner.profileId)).toBe(false)
    expect(await new NotificationRepository(db).listForActor(viewer.actorId, 20, null)).toHaveLength(0)
    await expect(new PostShareService(db).record({actorId: viewer.actorId, postId: visiblePostId, channel: 'native'})).rejects.toMatchObject({code: 'FORBIDDEN'})
  })
})

function ids(kind: string, suffix: string) {
  return {accountId: `social-${kind}-account-${suffix}`, actorId: `social-${kind}-actor-${suffix}`, profileId: `social-${kind}-profile-${suffix}`, handle: `social${kind}${suffix}`.slice(0, 24)}
}

async function seedIdentity(db: ModulaDb, identity: ReturnType<typeof ids>) {
  const now = new Date()
  await db.insertInto('greenfield_accounts').values({account_id: identity.accountId, primary_handle: identity.handle, status: 'active', created_at: now, updated_at: now}).execute()
  await db.insertInto('actors').values({id: identity.actorId, account_id: identity.accountId, kind: 'person', created_at: now, updated_at: now, deleted_at: null, version: 1}).execute()
  await db.insertInto('profiles').values({
    id: identity.profileId, actor_id: identity.actorId, handle: identity.handle, display_name: identity.handle,
    kind: 'person', bio: '', avatar_url: null, cover_url: null, cover_colour: null, pronouns: null,
    location_label: null, location_visibility: null, website_label: null, website_url: null, website_domain: null,
    website_visibility: null, focus_status_id: 'available', focus_status_label: 'Available', focus_status_message: '',
    focus_status_updated_at: now, visibility: 'public', module_count: 0, featured_module_ids: [], identity_claims: [],
    joined_at: now, created_at: now, updated_at: now, deleted_at: null, version: 1,
  }).execute()
}

async function seedPost(db: ModulaDb, id: string, actorId: string) {
  const now = new Date()
  await db.insertInto('posts').values({
    id, author_actor_id: actorId, kind: 'text', text: id, feed: 'following', audience: 'public', reply_permission: 'everyone',
    idempotency_key: null, link_domain: null, link_title: null, link_description: null, link_image: null, module_name: null,
    module_action_label: null, module_status: null, glow_colour: null, like_count: 0, reaction_count: 0, quote_count: 0,
    reply_count: 0, repost_count: 0, created_at: now, updated_at: now, deleted_at: null, version: 1,
  }).execute()
}
