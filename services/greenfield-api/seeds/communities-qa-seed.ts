import pg from 'pg'

const FIXTURE_TIME = '2026-11-01T12:00:00.000Z'

const actors = [
  {
    accountId: 'qa-community-account-owner', actorId: 'qa-community-actor-owner', profileId: 'qa-community-profile-owner',
    handle: 'qa.builders.owner', displayName: 'QA Builders Owner', role: 'owner',
  },
  {
    accountId: 'qa-community-account-moderator', actorId: 'qa-community-actor-moderator', profileId: 'qa-community-profile-moderator',
    handle: 'qa.builders.moderator', displayName: 'QA Builders Moderator', role: 'moderator',
  },
  {
    accountId: 'qa-community-account-member', actorId: 'qa-community-actor-member', profileId: 'qa-community-profile-member',
    handle: 'qa.builders.member', displayName: 'QA Builders Member', role: 'member',
  },
] as const

export async function runCommunitiesQaSeed(connectionString: string): Promise<{communityId: string; actors: number}> {
  assertQaFixtureBoundary(connectionString)
  const pool = new pg.Pool({connectionString})
  const client = await pool.connect()
  const communityId = '6e13fae5-fb4c-43b7-a01c-71e8234d1815'
  try {
    await client.query('BEGIN')
    for (const actor of actors) {
      await client.query(
        `INSERT INTO greenfield_accounts (account_id, primary_handle, status, created_at, updated_at)
         VALUES ($1,$2,'active',$3,$3)
         ON CONFLICT (account_id) DO UPDATE SET status='active', updated_at=EXCLUDED.updated_at`,
        [actor.accountId, actor.handle, FIXTURE_TIME],
      )
      await client.query(
        `INSERT INTO greenfield_handles (handle, account_id, status, created_at)
         VALUES ($1,$2,'active',$3)
         ON CONFLICT (handle) DO NOTHING`,
        [actor.handle, actor.accountId, FIXTURE_TIME],
      )
      await client.query(
        `INSERT INTO greenfield_handle_history (history_id, account_id, handle, action, created_at)
         VALUES ($1,$2,$3,'claimed',$4)
         ON CONFLICT (history_id) DO NOTHING`,
        [`qa-community-history-${actor.role}`, actor.accountId, actor.handle, FIXTURE_TIME],
      )
      await client.query(
        `INSERT INTO actors (id, account_id, kind, created_at, updated_at, deleted_at, version)
         VALUES ($1,$2,'person',$3,$3,NULL,1)
         ON CONFLICT (id) DO UPDATE SET account_id=EXCLUDED.account_id, deleted_at=NULL, updated_at=EXCLUDED.updated_at`,
        [actor.actorId, actor.accountId, FIXTURE_TIME],
      )
      await client.query(
        `INSERT INTO profiles (
           id, actor_id, handle, display_name, kind, bio,
           focus_status_id, focus_status_label, focus_status_message, focus_status_updated_at,
           visibility, module_count, featured_module_ids, identity_claims,
           joined_at, created_at, updated_at, deleted_at, version
         ) VALUES ($1,$2,$3,$4,'professional',$5,'qa','QA fixture','Testing Communities',$6,
           'public',0,'[]'::jsonb,'[]'::jsonb,$6,$6,$6,NULL,1)
         ON CONFLICT (id) DO UPDATE SET
           handle=EXCLUDED.handle, display_name=EXCLUDED.display_name, bio=EXCLUDED.bio,
           updated_at=EXCLUDED.updated_at, deleted_at=NULL, version=profiles.version+1`,
        [actor.profileId, actor.actorId, actor.handle, actor.displayName, 'Fictitious isolated-QA Communities fixture account.', FIXTURE_TIME],
      )
    }

    await client.query(
      `INSERT INTO greenfield_communities (
         community_id, slug, owner_actor_id, name, description, category, visibility, discoverable,
         featured, membership_policy, posting_policy, icon_attachment_id, cover_attachment_id,
         created_at, updated_at, deleted_at, version
       ) VALUES ($1,'modula-builders-qa',$2,'Modula Builders',
         'Isolated QA community for exercising persistent membership, posts, polls and events.',
         'Technology','public',TRUE,TRUE,'open','members',NULL,NULL,$3,$3,NULL,1)
       ON CONFLICT (community_id) DO UPDATE SET
         description=EXCLUDED.description, updated_at=EXCLUDED.updated_at, deleted_at=NULL`,
      [communityId, actors[0].actorId, FIXTURE_TIME],
    )
    await client.query(
      `INSERT INTO greenfield_community_settings (
         community_id, allow_attachments, reactions_enabled, featured_posts_enabled,
         blocked_words, version, created_at, updated_at
       ) VALUES ($1,TRUE,TRUE,TRUE,ARRAY['qa-blocked-term']::text[],1,$2,$2)
       ON CONFLICT (community_id) DO UPDATE SET
         allow_attachments=TRUE, reactions_enabled=TRUE, featured_posts_enabled=TRUE,
         blocked_words=EXCLUDED.blocked_words, updated_at=EXCLUDED.updated_at`,
      [communityId, FIXTURE_TIME],
    )
    for (const actor of actors) {
      await client.query(
        `INSERT INTO greenfield_community_memberships (
           community_id, actor_id, role, status, joined_at, created_at, updated_at, version
         ) VALUES ($1,$2,$3,'active',$4,$4,$4,1)
         ON CONFLICT (community_id, actor_id) DO UPDATE SET
           role=EXCLUDED.role, status='active', joined_at=EXCLUDED.joined_at, updated_at=EXCLUDED.updated_at`,
        [communityId, actor.actorId, actor.role, FIXTURE_TIME],
      )
    }
    await client.query(
      `INSERT INTO posts (
         id, author_actor_id, kind, text, feed, audience, reply_permission, idempotency_key,
         like_count, reaction_count, quote_count, reply_count, repost_count,
         community_id, community_moderation_state, community_featured_at,
         created_at, updated_at, deleted_at, version
       ) VALUES ('9b637daa-9012-4b9c-b9dd-75e6c8a3f823',$1,'text',
         'Welcome to the isolated QA Modula Builders community.','following','public','everyone',
         'qa-community-builders-welcome',0,0,0,0,0,$2,'visible',$3,$3,$3,NULL,1)
       ON CONFLICT (id) DO UPDATE SET text=EXCLUDED.text, updated_at=EXCLUDED.updated_at, deleted_at=NULL`,
      [actors[0].actorId, communityId, FIXTURE_TIME],
    )
    await client.query(
      `INSERT INTO greenfield_community_polls (
         poll_id, community_id, creator_actor_id, question, closes_at, allow_vote_changes,
         results_visibility, status, created_at, updated_at, deleted_at, version
       ) VALUES ('d8af7f74-666c-4f2c-a1c8-37d742e1f747',$1,$2,
         'Which QA journey should the Builders community exercise next?',
         '2026-12-01T12:00:00.000Z',TRUE,'afterVote','open',$3,$3,NULL,1)
       ON CONFLICT (poll_id) DO UPDATE SET question=EXCLUDED.question, updated_at=EXCLUDED.updated_at, deleted_at=NULL`,
      [communityId, actors[1].actorId, FIXTURE_TIME],
    )
    await client.query(
      `INSERT INTO greenfield_community_poll_options (poll_id, option_id, position, text) VALUES
         ('d8af7f74-666c-4f2c-a1c8-37d742e1f747','40976620-75bf-4357-b2b2-23b999a3859c',0,'Module installation'),
         ('d8af7f74-666c-4f2c-a1c8-37d742e1f747','a8790f69-1c07-44c9-b388-46f6f14193d1',1,'Profile workflows'),
         ('d8af7f74-666c-4f2c-a1c8-37d742e1f747','5052afcf-f22b-4b1c-98b3-e24f0cbe4f4f',2,'Governance evidence')
       ON CONFLICT (poll_id, option_id) DO UPDATE SET position=EXCLUDED.position, text=EXCLUDED.text`,
    )
    await client.query(
      `INSERT INTO greenfield_community_events (
         event_id, community_id, creator_actor_id, title, description, starts_at, ends_at, timezone,
         location_type, location_name, online_url, cover_attachment_id, capacity, status,
         created_at, updated_at, deleted_at, version
       ) VALUES ('f8f8d07f-e8e7-4f67-adfd-a8a169b60466',$1,$2,'Modula Builders QA Review',
         'Fictitious isolated-QA event for RSVP and capacity verification.',
         '2026-12-10T18:00:00.000Z','2026-12-10T19:00:00.000Z','Europe/London',
         'online',NULL,'https://example.invalid/modula-builders-qa',NULL,25,'scheduled',$3,$3,NULL,1)
       ON CONFLICT (event_id) DO UPDATE SET description=EXCLUDED.description, updated_at=EXCLUDED.updated_at, deleted_at=NULL`,
      [communityId, actors[1].actorId, FIXTURE_TIME],
    )
    await client.query('COMMIT')
    return {communityId, actors: actors.length}
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

export function assertQaFixtureBoundary(connectionString: string): void {
  if (process.env.MODULA_QA_FIXTURES_ENABLED !== 'true') {
    throw new Error('QA Communities fixtures require MODULA_QA_FIXTURES_ENABLED=true')
  }
  const environment = (process.env.MODULA_ENVIRONMENT ?? '').toLocaleLowerCase()
  if (!['development', 'preview', 'test', 'qa'].includes(environment)) {
    throw new Error('QA Communities fixtures refuse non-QA environments')
  }
  const parsed = new URL(connectionString)
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)
  const qaNamed = /(qa|test|preview|feature[_-]reality)/i.test(parsed.pathname.replace(/^\//, ''))
  if (!loopback || !qaNamed) {
    throw new Error('QA Communities fixtures require a loopback PostgreSQL host and an explicitly QA/test-named database')
  }
}
