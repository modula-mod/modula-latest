import pg from 'pg'

const UPDATED = '2026-07-16T09:00:00.000Z'

type SeedProfile = {
  actorId: string
  profileId: string
  handle: string
  displayName: string
  actorKind: 'person' | 'team' | 'organisation' | 'service'
  profileKind: 'person' | 'creator' | 'professional' | 'organisation' | 'team'
  bio: string
  pronouns?: string
  location?: string
  website?: {label: string; url: string; domain: string}
  focus: {id: string; label: string; message: string}
  moduleCount: number
  featured: string[]
  joinedAt: string
  links: Array<{id: string; label: string; url: string; domain: string}>
}

const profiles: SeedProfile[] = [
  {
    actorId: 'actor-andrei',
    profileId: 'profile-andrei',
    handle: 'andrei.modula',
    displayName: 'Andrei',
    actorKind: 'person',
    profileKind: 'person',
    bio: 'Building Modula - a modular Social Operating System where your profile becomes your platform.',
    pronouns: 'he/him',
    location: 'United Kingdom',
    website: {label: 'Modula', url: 'https://modula.digital', domain: 'modula.digital'},
    focus: {id: 'focused', label: 'Focused', message: 'Building Profile OS'},
    moduleCount: 14,
    featured: ['module-vault-notes', 'module-tasks', 'module-crm', 'module-automations'],
    joinedAt: '2026-01-12T12:00:00.000Z',
    links: [
      {id: 'link-andrei-github', label: 'GitHub', url: 'https://github.com/modula-labs', domain: 'github.com'},
      {id: 'link-andrei-updates', label: 'Build updates', url: 'https://modula.digital/updates', domain: 'modula.digital'},
    ],
  },
  {
    actorId: 'actor-gaia',
    profileId: 'profile-gaia',
    handle: 'gaia.modula',
    displayName: 'Gaia',
    actorKind: 'person',
    profileKind: 'professional',
    bio: 'AI and systems profile for local tools, execution layers and governed workflow previews.',
    location: 'Runtime layer',
    website: {label: 'GAIA runtime notes', url: 'https://modula.digital/gaia', domain: 'modula.digital'},
    focus: {id: 'available', label: 'Available', message: 'Local runtime preview'},
    moduleCount: 8,
    featured: ['module-runtime-tools', 'module-automations'],
    joinedAt: '2026-02-03T10:30:00.000Z',
    links: [],
  },
  {
    actorId: 'actor-design',
    profileId: 'profile-design',
    handle: 'design.modula',
    displayName: 'Modula Design',
    actorKind: 'organisation',
    profileKind: 'organisation',
    bio: 'Design organisation for theme inheritance, material rules and premium profile surfaces.',
    location: 'Design systems',
    website: {label: 'Design guidelines', url: 'https://modula.digital/design', domain: 'modula.digital'},
    focus: {id: 'live', label: 'Live', message: 'Publishing surface guidance'},
    moduleCount: 6,
    featured: ['module-appearance-lab', 'module-guidelines'],
    joinedAt: '2026-02-16T15:00:00.000Z',
    links: [{id: 'link-design-library', label: 'Surface library', url: 'https://modula.digital/surfaces', domain: 'modula.digital'}],
  },
  {
    actorId: 'actor-builders',
    profileId: 'profile-builders',
    handle: 'builders.modula',
    displayName: 'Builders',
    actorKind: 'team',
    profileKind: 'team',
    bio: 'Developer community shaping modules, Boards, automations and governed social workflows.',
    location: 'Modula community',
    focus: {id: 'busy', label: 'Busy', message: 'Testing module SDK previews'},
    moduleCount: 21,
    featured: ['module-sdk', 'module-marketplace'],
    joinedAt: '2026-03-04T11:15:00.000Z',
    links: [{id: 'link-builders-forum', label: 'Builder forum', url: 'https://modula.digital/builders', domain: 'modula.digital'}],
  },
  {
    actorId: 'actor-garden',
    profileId: 'profile-garden',
    handle: 'garden.modula',
    displayName: 'Digital Garden',
    actorKind: 'person',
    profileKind: 'creator',
    bio: 'Creator profile for notes, media collections, public links and saved knowledge trails.',
    location: 'Knowledge studio',
    website: {label: 'Garden notes', url: 'https://garden.modula.digital', domain: 'garden.modula.digital'},
    focus: {id: 'away', label: 'Away', message: 'Collecting references'},
    moduleCount: 9,
    featured: ['module-vault-notes', 'module-links'],
    joinedAt: '2026-03-22T17:45:00.000Z',
    links: [
      {id: 'link-garden-newsletter', label: 'Newsletter', url: 'https://garden.modula.digital/newsletter', domain: 'garden.modula.digital'},
      {id: 'link-garden-shop', label: 'Shop', url: 'https://garden.modula.digital/shop', domain: 'garden.modula.digital'},
    ],
  },
  {
    actorId: 'actor-phase6s-fixture',
    profileId: 'profile-phase6s-fixture',
    handle: 'phase6s.fixture.modula',
    displayName: 'Phase 6S Fixture',
    actorKind: 'service',
    profileKind: 'professional',
    bio: 'Non-secret VPS validation profile for Phase 6S social product fixtures.',
    location: 'Preview validation',
    focus: {id: 'validating', label: 'Validating', message: 'VPS acceptance fixtures'},
    moduleCount: 4,
    featured: ['module-sdk', 'module-marketplace'],
    joinedAt: '2026-07-16T09:00:00.000Z',
    links: [],
  },
]

const follows: Array<[string, string]> = [
  ['actor-andrei', 'actor-gaia'], ['actor-andrei', 'actor-design'], ['actor-andrei', 'actor-builders'], ['actor-andrei', 'actor-garden'],
  ['actor-gaia', 'actor-andrei'], ['actor-gaia', 'actor-design'],
  ['actor-design', 'actor-andrei'], ['actor-design', 'actor-builders'], ['actor-design', 'actor-garden'],
  ['actor-builders', 'actor-andrei'], ['actor-builders', 'actor-gaia'], ['actor-builders', 'actor-design'],
  ['actor-garden', 'actor-andrei'], ['actor-garden', 'actor-design'], ['actor-garden', 'actor-builders'],
  ['actor-phase6s-fixture', 'actor-andrei'], ['actor-andrei', 'actor-phase6s-fixture'],
]

type SeedPost = {
  id: string; author: string; kind: 'text' | 'media' | 'link' | 'module'; feed: 'following' | 'forYou' | 'modules'
  text: string; likeCount: number; replyCount: number; repostCount: number; createdAt: string
  audience?: 'public' | 'followers' | 'private'
  deletedAt?: string
  glow?: string
  media?: Array<{id: string; title: string; colour: string; aspect: string}>
  module?: {name: string; actionLabel: string; status: string}
  link?: {domain: string; title: string; description: string}
}

const posts: SeedPost[] = [
  {id: 'post-local-1', author: 'actor-andrei', kind: 'text', feed: 'following', text: 'Phase 1 goal: make Modula feel like a real social operating shell before connecting any backend.', likeCount: 34, replyCount: 8, repostCount: 3, createdAt: '2026-07-16T11:52:00.000Z'},
  {id: 'post-local-owner-media', author: 'actor-andrei', kind: 'media', feed: 'following', text: 'Profile should become the platform: identity, modules, media, links and governed tools in one place.', likeCount: 92, replyCount: 12, repostCount: 7, glow: '#369CAA', createdAt: '2026-07-16T11:46:00.000Z', media: [{id: 'media-profile-platform', title: 'Profile platform study', colour: '#369CAA', aspect: '1'}, {id: 'media-profile-tabs', title: 'Configurable tabs', colour: '#5B7F95', aspect: '1'}]},
  {id: 'post-local-owner-module', author: 'actor-andrei', kind: 'module', feed: 'modules', text: 'Vault Notes should feel attached to the profile without exposing private notes publicly.', likeCount: 77, replyCount: 9, repostCount: 5, module: {name: 'Vault Notes', actionLabel: 'Preview', status: 'Profile preview'}, createdAt: '2026-07-16T11:25:00.000Z'},
  {id: 'post-local-owner-link', author: 'actor-andrei', kind: 'link', feed: 'following', text: 'The public profile link remains illustrative until production routing is connected.', likeCount: 58, replyCount: 5, repostCount: 2, link: {domain: 'modula.digital', title: 'Profile OS direction', description: 'A local preview of how Modula profiles can host identity, tabs, modules and public links.'}, createdAt: '2026-07-16T11:17:00.000Z'},
  {id: 'post-local-design-1', author: 'actor-design', kind: 'media', feed: 'forYou', text: 'Surface materials should inherit from the theme contract, not ad-hoc hex values.', likeCount: 41, replyCount: 6, repostCount: 4, glow: '#8A6E55', createdAt: '2026-07-16T11:36:00.000Z', media: [{id: 'media-design-surface', title: 'Material study', colour: '#8A6E55', aspect: '1.4'}]},
  {id: 'post-local-gaia-1', author: 'actor-gaia', kind: 'text', feed: 'following', text: 'Governed local runtimes should expose clear capability boundaries before remote writes open.', likeCount: 63, replyCount: 11, repostCount: 5, createdAt: '2026-07-16T10:55:00.000Z'},
  {id: 'post-local-builders-1', author: 'actor-builders', kind: 'module', feed: 'modules', text: 'Module SDK previews need deterministic fixtures for Board and Automations flows.', likeCount: 29, replyCount: 4, repostCount: 2, module: {name: 'Module SDK', actionLabel: 'Explore', status: 'Community preview'}, createdAt: '2026-07-16T10:20:00.000Z'},
  {id: 'post-local-garden-1', author: 'actor-garden', kind: 'link', feed: 'forYou', text: 'Collecting references for knowledge trails that stay attached to creator profiles.', likeCount: 18, replyCount: 2, repostCount: 1, link: {domain: 'garden.modula.digital', title: 'Garden trails', description: 'Public notes and saved collections for Digital Garden.'}, createdAt: '2026-07-16T09:40:00.000Z'},
  {id: 'post-phase6s-quote-1', author: 'actor-gaia', kind: 'text', feed: 'following', text: 'Quote validation should preserve the quoted post boundary without leaking unavailable content.', likeCount: 0, replyCount: 0, repostCount: 0, createdAt: '2026-07-16T12:12:00.000Z'},
  {id: 'post-phase6s-private-quoted', author: 'actor-phase6s-fixture', kind: 'text', feed: 'following', text: 'Private quoted fixture: should not leak through public quote previews.', likeCount: 0, replyCount: 0, repostCount: 0, audience: 'private', createdAt: '2026-07-16T12:08:00.000Z'},
  {id: 'post-phase6s-deleted-1', author: 'actor-phase6s-fixture', kind: 'text', feed: 'following', text: 'Deleted post tombstone fixture.', likeCount: 0, replyCount: 0, repostCount: 0, deletedAt: '2026-07-16T12:15:00.000Z', createdAt: '2026-07-16T12:05:00.000Z'},
]

export async function runSeed(connectionString: string): Promise<void> {
  const pool = new pg.Pool({connectionString})
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO greenfield_accounts (account_id, primary_handle, status, created_at, updated_at)
       VALUES ('account-phase6s-fixture','phase6s.fixture.modula','active',$1,$1)
       ON CONFLICT (account_id) DO UPDATE SET status='active', updated_at=EXCLUDED.updated_at`,
      [UPDATED],
    )
    await client.query(
      `INSERT INTO greenfield_handles (handle, account_id, status, created_at)
       VALUES ('phase6s.fixture.modula','account-phase6s-fixture','active',$1)
       ON CONFLICT (handle) DO NOTHING`,
      [UPDATED],
    )
    await client.query(
      `INSERT INTO greenfield_handle_history (history_id, account_id, handle, action, created_at)
       VALUES ('handle-history-phase6s-fixture','account-phase6s-fixture','phase6s.fixture.modula','claimed',$1)
       ON CONFLICT (history_id) DO NOTHING`,
      [UPDATED],
    )
    await client.query(
      `INSERT INTO greenfield_appearance_preferences (
        account_id, mode, variant, surface, accent_id, custom_accent, text_scale,
        bold_text, reduce_motion, reduce_transparency, increase_contrast, version, updated_at
      )
      SELECT account_id, 'system', 'standard', 'native', 'modula', NULL, 1.00, FALSE, FALSE, FALSE, FALSE, 1, NOW()
      FROM greenfield_accounts
      ON CONFLICT (account_id) DO NOTHING`,
    )
    for (const p of profiles) {
      const accountId = p.actorId === 'actor-phase6s-fixture' ? 'account-phase6s-fixture' : null
      await client.query(
        `INSERT INTO actors (id, account_id, kind, created_at, updated_at, deleted_at, version)
         VALUES ($1,$2,$3,$4,$4,NULL,1)
         ON CONFLICT (id) DO UPDATE SET
           account_id = COALESCE(actors.account_id, EXCLUDED.account_id),
           kind = EXCLUDED.kind,
           updated_at = EXCLUDED.updated_at,
           deleted_at = NULL`,
        [p.actorId, accountId, p.actorKind, p.joinedAt],
      )
      await client.query(
        `INSERT INTO profiles (
          id, actor_id, handle, display_name, kind, bio, pronouns,
          location_label, location_visibility, website_label, website_url, website_domain, website_visibility,
          focus_status_id, focus_status_label, focus_status_message, focus_status_updated_at,
          visibility, module_count, featured_module_ids, identity_claims, joined_at, created_at, updated_at, deleted_at, version
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,'public',$9,$10,$11,CASE WHEN $9::text IS NULL THEN NULL ELSE 'public' END,
          $12,$13,$14,$15,'public',$16,$17::jsonb,'[]'::jsonb,$18,$18,$18,NULL,1
        )
        ON CONFLICT (id) DO UPDATE SET
          actor_id = EXCLUDED.actor_id,
          handle = EXCLUDED.handle,
          display_name = EXCLUDED.display_name,
          kind = EXCLUDED.kind,
          bio = EXCLUDED.bio,
          pronouns = EXCLUDED.pronouns,
          location_label = EXCLUDED.location_label,
          location_visibility = EXCLUDED.location_visibility,
          website_label = EXCLUDED.website_label,
          website_url = EXCLUDED.website_url,
          website_domain = EXCLUDED.website_domain,
          website_visibility = EXCLUDED.website_visibility,
          focus_status_id = EXCLUDED.focus_status_id,
          focus_status_label = EXCLUDED.focus_status_label,
          focus_status_message = EXCLUDED.focus_status_message,
          focus_status_updated_at = EXCLUDED.focus_status_updated_at,
          visibility = EXCLUDED.visibility,
          module_count = EXCLUDED.module_count,
          featured_module_ids = EXCLUDED.featured_module_ids,
          updated_at = EXCLUDED.updated_at,
          deleted_at = NULL,
          version = profiles.version + 1`,
        [p.profileId, p.actorId, p.handle, p.displayName, p.profileKind, p.bio, p.pronouns ?? null, p.location ?? null,
         p.website?.label ?? null, p.website?.url ?? null, p.website?.domain ?? null,
         p.focus.id, p.focus.label, p.focus.message, UPDATED, p.moduleCount, JSON.stringify(p.featured), p.joinedAt],
      )
      for (const [index, link] of p.links.entries()) {
        await client.query(
          `INSERT INTO profile_links (id, profile_id, label, url, domain, visibility, sort_order, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,'public',$6,$7,$7)
           ON CONFLICT (id) DO UPDATE SET
             label = EXCLUDED.label,
             url = EXCLUDED.url,
             domain = EXCLUDED.domain,
             visibility = EXCLUDED.visibility,
             sort_order = EXCLUDED.sort_order,
             updated_at = EXCLUDED.updated_at,
             deleted_at = NULL`,
          [link.id, p.profileId, link.label, link.url, link.domain, index, p.joinedAt],
        )
      }
    }
    for (const [follower, followed] of follows) {
      await client.query(
        `INSERT INTO follows (id, follower_actor_id, followed_actor_id, created_at, updated_at, deleted_at, version)
         VALUES ($1,$2,$3,NOW(),NOW(),NULL,1)
         ON CONFLICT (follower_actor_id, followed_actor_id) DO UPDATE SET deleted_at=NULL, updated_at=NOW(), version=follows.version + 1`,
        [`follow-${follower}-${followed}`, follower, followed])
    }
    for (const post of posts) {
      await client.query(
        `INSERT INTO posts (
          id, author_actor_id, kind, text, feed, audience, reply_permission,
          link_domain, link_title, link_description, module_name, module_action_label, module_status, glow_colour,
          like_count, reaction_count, quote_count, reply_count, repost_count, created_at, updated_at, deleted_at, version, idempotency_key, link_image
        ) VALUES ($1,$2,$3,$4,$5,$6,'everyone',$7,$8,$9,$10,$11,$12,$13,0,0,0,0,0,$14,$14,$15,1,NULL,NULL)
        ON CONFLICT (id) DO UPDATE SET
          author_actor_id = EXCLUDED.author_actor_id,
          kind = EXCLUDED.kind,
          text = EXCLUDED.text,
          feed = EXCLUDED.feed,
          audience = EXCLUDED.audience,
          reply_permission = EXCLUDED.reply_permission,
          link_domain = EXCLUDED.link_domain,
          link_title = EXCLUDED.link_title,
          link_description = EXCLUDED.link_description,
          module_name = EXCLUDED.module_name,
          module_action_label = EXCLUDED.module_action_label,
          module_status = EXCLUDED.module_status,
          glow_colour = EXCLUDED.glow_colour,
          updated_at = EXCLUDED.updated_at,
          deleted_at = EXCLUDED.deleted_at,
          version = posts.version + 1`,
        [post.id, post.author, post.kind, post.text, post.feed, post.audience ?? 'public', post.link?.domain ?? null,
         post.link?.title ?? null, post.link?.description ?? null, post.module?.name ?? null, post.module?.actionLabel ?? null,
         post.module?.status ?? null, post.glow ?? null, post.createdAt, post.deletedAt ?? null],
      )
      for (const [index, media] of (post.media ?? []).entries()) {
        await client.query(
          `INSERT INTO post_media (id, post_id, kind, title, colour, aspect_ratio, sort_order, created_at, updated_at)
           VALUES ($1,$2,'image',$3,$4,$5,$6,$7,$7)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             colour = EXCLUDED.colour,
             aspect_ratio = EXCLUDED.aspect_ratio,
             sort_order = EXCLUDED.sort_order,
             updated_at = EXCLUDED.updated_at,
             deleted_at = NULL`,
          [media.id, post.id, media.title, media.colour, media.aspect, index, post.createdAt],
        )
      }
    }
    const legacyLikes: Array<[string, string, string]> = [
      ['like-1', 'actor-andrei', 'post-local-owner-media'],
      ['like-phase6s-2', 'actor-gaia', 'post-local-owner-media'],
      ['like-phase6s-3', 'actor-design', 'post-local-gaia-1'],
    ]
    for (const [id, actor, postId] of legacyLikes) {
      await client.query(
        `INSERT INTO post_likes (id, actor_id, post_id, created_at, updated_at, deleted_at, version)
         VALUES ($1,$2,$3,NOW(),NOW(),NULL,1)
         ON CONFLICT (actor_id, post_id) DO UPDATE SET deleted_at=NULL, updated_at=NOW(), version=post_likes.version + 1`,
        [id, actor, postId],
      )
    }
    const reactions: Array<[string, string, string, string]> = [
      ['reaction-phase6s-1', 'actor-andrei', 'post-local-owner-media', 'like'],
      ['reaction-phase6s-2', 'actor-gaia', 'post-local-owner-media', 'love'],
      ['reaction-phase6s-3', 'actor-design', 'post-local-gaia-1', 'insightful'],
      ['reaction-phase6s-4', 'actor-builders', 'post-local-gaia-1', 'celebrate'],
      ['reaction-phase6s-5', 'actor-garden', 'post-phase6s-quote-1', 'support'],
    ]
    for (const [id, actor, postId, type] of reactions) {
      await client.query(
        `INSERT INTO greenfield_reactions (reaction_id, actor_id, post_id, reaction_type, created_at, updated_at)
         VALUES ($1,$2,$3,$4,NOW(),NOW())
         ON CONFLICT (actor_id, post_id) DO UPDATE SET reaction_type=EXCLUDED.reaction_type, updated_at=NOW()`,
        [id, actor, postId, type],
      )
    }
    const saves: Array<[string, string, string]> = [
      ['save-1', 'actor-andrei', 'post-local-owner-module'],
      ['save-phase6s-private-1', 'actor-gaia', 'post-local-owner-link'],
      ['save-phase6s-private-2', 'actor-phase6s-fixture', 'post-local-gaia-1'],
    ]
    for (const [id, actor, postId] of saves) {
      await client.query(
        `INSERT INTO post_saves (id, actor_id, post_id, created_at, updated_at, deleted_at, version)
         VALUES ($1,$2,$3,NOW(),NOW(),NULL,1)
         ON CONFLICT (actor_id, post_id) DO UPDATE SET deleted_at=NULL, updated_at=NOW(), version=post_saves.version + 1`,
        [id, actor, postId],
      )
    }
    const reposts: Array<[string, string, string]> = [
      ['repost-phase6s-1', 'actor-builders', 'post-local-gaia-1'],
      ['repost-phase6s-2', 'actor-garden', 'post-local-owner-media'],
    ]
    for (const [id, actor, postId] of reposts) {
      await client.query(
        `INSERT INTO post_reposts (id, actor_id, post_id, created_at, updated_at, deleted_at, version)
         VALUES ($1,$2,$3,NOW(),NOW(),NULL,1)
         ON CONFLICT (actor_id, post_id) DO UPDATE SET deleted_at=NULL, updated_at=NOW(), version=post_reposts.version + 1`,
        [id, actor, postId],
      )
    }
    await client.query(
      `INSERT INTO greenfield_quote_posts (post_id, quoted_post_id, commentary, created_at)
       VALUES
         ('post-phase6s-quote-1','post-local-owner-media','Quote validation should preserve the quoted post boundary without leaking unavailable content.',NOW())
       ON CONFLICT (post_id) DO UPDATE SET quoted_post_id=EXCLUDED.quoted_post_id, commentary=EXCLUDED.commentary`,
    )
    const comments: Array<[string, string, string, string | null, string | null, string, number, number, string | null, string | null]> = [
      ['comment-phase6s-top-1', 'post-local-owner-media', 'actor-gaia', null, null, 'Top-level Phase 6S comment fixture.', 0, 1, null, null],
      ['comment-phase6s-top-2', 'post-local-owner-media', 'actor-design', null, null, 'Second top-level comment fixture.', 0, 0, null, null],
      ['comment-phase6s-reply-1', 'post-local-owner-media', 'actor-andrei', 'comment-phase6s-top-1', 'comment-phase6s-top-1', 'Nested reply fixture.', 1, 1, null, null],
      ['comment-phase6s-reply-2', 'post-local-owner-media', 'actor-builders', 'comment-phase6s-reply-1', 'comment-phase6s-top-1', 'Second-level nested reply fixture.', 2, 0, null, null],
      ['comment-phase6s-tombstone', 'post-local-gaia-1', 'actor-design', null, null, 'Comment deleted', 0, 1, '2026-07-16T12:20:00.000Z', 'user'],
      ['comment-phase6s-tombstone-reply', 'post-local-gaia-1', 'actor-andrei', 'comment-phase6s-tombstone', 'comment-phase6s-tombstone', 'Reply kept below deleted comment.', 1, 0, null, null],
    ]
    for (const [id, postId, actor, parentId, rootId, text, depth, replyCount, deletedAt, deletionKind] of comments) {
      await client.query(
        `INSERT INTO greenfield_comments (
          comment_id, post_id, author_actor_id, parent_comment_id, root_comment_id, text, depth, reply_count,
          version, created_at, updated_at, deleted_at, deletion_kind
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,NOW(),NOW(),$9,$10)
        ON CONFLICT (comment_id) DO UPDATE SET
          post_id=EXCLUDED.post_id,
          author_actor_id=EXCLUDED.author_actor_id,
          parent_comment_id=EXCLUDED.parent_comment_id,
          root_comment_id=EXCLUDED.root_comment_id,
          text=EXCLUDED.text,
          depth=EXCLUDED.depth,
          reply_count=EXCLUDED.reply_count,
          updated_at=NOW(),
          deleted_at=EXCLUDED.deleted_at,
          deletion_kind=EXCLUDED.deletion_kind,
          version=greenfield_comments.version + 1`,
        [id, postId, actor, parentId, rootId, text, depth, replyCount, deletedAt, deletionKind],
      )
    }
    await client.query(
      `INSERT INTO greenfield_comment_reactions (reaction_id, actor_id, comment_id, reaction_type, created_at, updated_at)
       VALUES
         ('comment-reaction-phase6s-1','actor-andrei','comment-phase6s-top-1','like',NOW(),NOW()),
         ('comment-reaction-phase6s-2','actor-gaia','comment-phase6s-reply-1','support',NOW(),NOW())
       ON CONFLICT (actor_id, comment_id) DO UPDATE SET reaction_type=EXCLUDED.reaction_type, updated_at=NOW()`,
    )
    await client.query(
      `INSERT INTO notifications (
        id, recipient_actor_id, actor_id, type, resource_type, resource_id, body, read_at,
        created_at, updated_at, deleted_at, version, kind, subject_json
      )
      VALUES
        ('notification-phase6s-reaction','actor-andrei','actor-gaia','like','post','post-local-owner-media','Gaia reacted to your post',NULL,NOW(),NOW(),NULL,1,'reaction','{"postId":"post-local-owner-media"}'::jsonb),
        ('notification-phase6s-comment','actor-andrei','actor-design','reply','comment','comment-phase6s-top-2','Design commented on your post',NULL,NOW(),NOW(),NULL,1,'comment','{"commentId":"comment-phase6s-top-2"}'::jsonb),
        ('notification-phase6s-extension','actor-phase6s-fixture',NULL,'module_event','extension','modula.core.composerTools','Composer Tools changed state',NULL,NOW(),NOW(),NULL,1,'extension','{"extensionId":"modula.core.composerTools"}'::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        recipient_actor_id=EXCLUDED.recipient_actor_id,
        actor_id=EXCLUDED.actor_id,
        type=EXCLUDED.type,
        resource_type=EXCLUDED.resource_type,
        resource_id=EXCLUDED.resource_id,
        body=EXCLUDED.body,
        updated_at=NOW(),
        deleted_at=NULL,
        kind=EXCLUDED.kind,
        subject_json=EXCLUDED.subject_json`,
    )
    const topics: Array<[string, string, number]> = [
      ['topic-profile-os', 'Profile OS', 1840], ['topic-module-sdk', 'Module SDK', 820], ['topic-composer-tools', 'Composer Tools', 534],
      ['topic-board-workflows', 'Board workflows', 416], ['topic-dimon-previews', 'DIMON previews', 208],
    ]
    for (const [id, label, count] of topics) {
      await client.query(
        `INSERT INTO trending_topics (id, label, post_count, created_at, updated_at, deleted_at)
         VALUES ($1,$2,$3,NOW(),NOW(),NULL)
         ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label, post_count=EXCLUDED.post_count, updated_at=NOW(), deleted_at=NULL`,
        [id, label, count],
      )
    }
    const modules = [
      {id: 'module-vault-notes', name: 'Vault Notes', status: 'Profile preview'}, {id: 'module-tasks', name: 'Tasks', status: 'Preview'},
      {id: 'module-crm', name: 'CRM', status: 'Preview'}, {id: 'module-automations', name: 'Automations', status: 'Preview'},
      {id: 'module-sdk', name: 'Module SDK', status: 'Community preview'}, {id: 'module-marketplace', name: 'Marketplace', status: 'Browse'},
      {id: 'module-appearance-lab', name: 'Appearance Lab', status: 'Live'}, {id: 'module-runtime-tools', name: 'Runtime Tools', status: 'Preview'},
    ]
    for (const [index, mod] of modules.entries()) {
      await client.query(
        `INSERT INTO featured_modules (id, payload, sort_order, created_at, updated_at, deleted_at)
         VALUES ($1,$2::jsonb,$3,NOW(),NOW(),NULL)
         ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, sort_order=EXCLUDED.sort_order, updated_at=NOW(), deleted_at=NULL`,
        [mod.id, JSON.stringify(mod), index],
      )
    }
    const reels: Array<[string, string, string, string, string, number, number]> = [
      ['reel-1', 'actor-andrei', 'Profile OS walkthrough still', 'Modula Studio', '#369CAA', 120, 14],
      ['reel-2', 'actor-design', 'Material surfaces preview', 'Design Desk', '#8A6E55', 88, 9],
      ['reel-3', 'actor-garden', 'Garden trail collage', 'Digital Garden', '#5B8C5A', 54, 6],
    ]
    for (const [id, author, caption, source, colour, likes, replies] of reels) {
      await client.query(
        `INSERT INTO reels (id, author_actor_id, caption, source, colour, like_count, reply_count, created_at, updated_at, deleted_at, version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW(),NULL,1)
         ON CONFLICT (id) DO UPDATE SET
           author_actor_id=EXCLUDED.author_actor_id,
           caption=EXCLUDED.caption,
           source=EXCLUDED.source,
           colour=EXCLUDED.colour,
           like_count=EXCLUDED.like_count,
           reply_count=EXCLUDED.reply_count,
           updated_at=NOW(),
           deleted_at=NULL,
           version=reels.version + 1`,
        [id, author, caption, source, colour, likes, replies],
      )
    }
    const activity: Array<[string, string, string, string, string, string | null]> = [
      ['activity-1', 'today', 'like', 'actor-gaia', 'liked your post', 'Profile should become the platform'],
      ['activity-2', 'today', 'follow', 'actor-builders', 'started following you', null],
      ['activity-3', 'earlier', 'moduleUpdate', 'actor-design', 'published a surface guidance update', 'Material study'],
      ['activity-4', 'earlier', 'mention', 'actor-garden', 'mentioned you in a trail note', 'Garden trails'],
    ]
    for (const [id, group, typ, actor, description, preview] of activity) {
      await client.query(
        `INSERT INTO activity_items (id, group_key, type, actor_id, description, preview, occurred_at, created_at, deleted_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW(),NULL)
         ON CONFLICT (id) DO UPDATE SET
           group_key=EXCLUDED.group_key,
           type=EXCLUDED.type,
           actor_id=EXCLUDED.actor_id,
           description=EXCLUDED.description,
           preview=EXCLUDED.preview,
           occurred_at=NOW(),
           deleted_at=NULL`,
        [id, group, typ, actor, description, preview],
      )
    }
    await client.query(
      `INSERT INTO greenfield_extensions (extension_id, slug, publisher_account_id, status, created_at, updated_at)
       VALUES
         ('modula.core.composerTools','modula.core.composerTools','account-phase6s-fixture','published',NOW(),NOW()),
         ('modula.core.mediaFunctions','modula.core.mediaFunctions','account-phase6s-fixture','published',NOW(),NOW()),
         ('modula.core.moderationPlugin','modula.core.moderationPlugin','account-phase6s-fixture','published',NOW(),NOW()),
         ('modula.core.notificationPlugin','modula.core.notificationPlugin','account-phase6s-fixture','published',NOW(),NOW()),
         ('modula.core.appearanceSyncPlugin','modula.core.appearanceSyncPlugin','account-phase6s-fixture','published',NOW(),NOW())
       ON CONFLICT (slug) DO UPDATE SET
         publisher_account_id=COALESCE(greenfield_extensions.publisher_account_id, EXCLUDED.publisher_account_id),
         status='published',
         updated_at=NOW()`,
    )
    await client.query(
      `INSERT INTO greenfield_extension_versions (extension_version_id, extension_id, version, manifest, status, created_at)
       VALUES
         ('version-modula.core.composerTools-1.0.0','modula.core.composerTools','1.0.0','{"kind":"plugin","slug":"modula.core.composerTools","name":"Composer Tools","firstParty":true}'::jsonb,'published',NOW()),
         ('version-modula.core.mediaFunctions-1.0.0','modula.core.mediaFunctions','1.0.0','{"kind":"plugin","slug":"modula.core.mediaFunctions","name":"Media Functions","firstParty":true}'::jsonb,'published',NOW()),
         ('version-modula.core.moderationPlugin-1.0.0','modula.core.moderationPlugin','1.0.0','{"kind":"plugin","slug":"modula.core.moderationPlugin","name":"Moderation","firstParty":true}'::jsonb,'published',NOW()),
         ('version-modula.core.notificationPlugin-1.0.0','modula.core.notificationPlugin','1.0.0','{"kind":"plugin","slug":"modula.core.notificationPlugin","name":"Notifications","firstParty":true}'::jsonb,'published',NOW()),
         ('version-modula.core.appearanceSyncPlugin-1.0.0','modula.core.appearanceSyncPlugin','1.0.0','{"kind":"plugin","slug":"modula.core.appearanceSyncPlugin","name":"Appearance Sync","firstParty":true}'::jsonb,'published',NOW())
       ON CONFLICT (extension_id, version) DO UPDATE SET manifest=EXCLUDED.manifest, status='published'`,
    )
    await client.query(
      `INSERT INTO greenfield_plugins (plugin_id, extension_version_id, manifest, created_at)
       VALUES
         ('plugin-modula.core.composerTools','version-modula.core.composerTools-1.0.0','{"lifecycle":["install","enable","disable","uninstall"]}'::jsonb,NOW()),
         ('plugin-modula.core.mediaFunctions','version-modula.core.mediaFunctions-1.0.0','{"lifecycle":["enable"],"failureFixture":"timeout"}'::jsonb,NOW()),
         ('plugin-modula.core.moderationPlugin','version-modula.core.moderationPlugin-1.0.0','{"lifecycle":["enable"],"failureFixture":"throw"}'::jsonb,NOW())
       ON CONFLICT (plugin_id) DO UPDATE SET manifest=EXCLUDED.manifest`,
    )
    await client.query(
      `INSERT INTO greenfield_extension_installations (installation_id, extension_version_id, account_id, status, config, created_at, updated_at)
       VALUES
         ('installation-phase6s-composer','version-modula.core.composerTools-1.0.0','account-phase6s-fixture','enabled','{"fixture":true}'::jsonb,NOW(),NOW()),
         ('installation-phase6s-media','version-modula.core.mediaFunctions-1.0.0','account-phase6s-fixture','disabled','{"fixture":true}'::jsonb,NOW(),NOW()),
         ('installation-phase6s-moderation','version-modula.core.moderationPlugin-1.0.0','account-phase6s-fixture','failed','{"fixture":true}'::jsonb,NOW(),NOW())
       ON CONFLICT (extension_version_id, account_id) DO UPDATE SET
         status=EXCLUDED.status,
         config=EXCLUDED.config,
         updated_at=NOW()`,
    )
    await client.query(
      `INSERT INTO greenfield_extension_lifecycle_events (event_id, account_id, extension_id, event, from_status, to_status, detail, created_at)
       VALUES
         ('extension-event-phase6s-installed','account-phase6s-fixture','modula.core.composerTools','installed','installing','installed','{"fixture":true}'::jsonb,NOW()),
         ('extension-event-phase6s-enabled','account-phase6s-fixture','modula.core.composerTools','enabled','installed','enabled','{"fixture":true}'::jsonb,NOW()),
         ('extension-event-phase6s-disabled','account-phase6s-fixture','modula.core.mediaFunctions','disabled','enabled','disabled','{"fixture":true}'::jsonb,NOW()),
         ('extension-event-phase6s-failed','account-phase6s-fixture','modula.core.moderationPlugin','failed','enabled','failed','{"code":"PLUGIN_FAILED","fixture":true}'::jsonb,NOW())
       ON CONFLICT (event_id) DO NOTHING`,
    )
    await client.query(
      `INSERT INTO greenfield_extension_failures (failure_id, account_id, extension_id, installation_id, code, message, retryable, created_at)
       VALUES
         ('extension-failure-phase6s-plugin','account-phase6s-fixture','modula.core.moderationPlugin','installation-phase6s-moderation','PLUGIN_FAILED','Fixture plugin enable failure',FALSE,NOW())
       ON CONFLICT (failure_id) DO NOTHING`,
    )
    await client.query(
      `INSERT INTO greenfield_function_jobs (
        job_id, account_id, function_id, status, input, output, error_message, created_at, started_at, completed_at, expires_at
      )
      VALUES
        ('function-job-phase6s-example','account-phase6s-fixture','modula.function.linkPreview','queued','{"url":"https://modula.digital"}'::jsonb,NULL,NULL,NOW(),NULL,NULL,NOW() + INTERVAL '10 minutes'),
        ('function-job-phase6s-invalid-payload','account-phase6s-fixture','modula.function.linkPreview','queued','{"__phase6sFailureMode":"invalidPayload"}'::jsonb,NULL,NULL,NOW(),NULL,NULL,NOW() + INTERVAL '10 minutes'),
        ('function-job-phase6s-timeout','account-phase6s-fixture','modula.function.generatePostSummaryPreview','queued','{"__phase6sFailureMode":"timeout"}'::jsonb,NULL,NULL,NOW(),NULL,NULL,NOW() + INTERVAL '10 minutes'),
        ('function-job-phase6s-cancelled','account-phase6s-fixture','modula.function.validateMediaMetadata','cancelled','{"metadata":{"fixture":true}}'::jsonb,NULL,NULL,NOW(),NULL,NOW(),NOW() + INTERVAL '10 minutes')
      ON CONFLICT (job_id) DO NOTHING`,
    )
    await client.query(
      `INSERT INTO background_jobs (
        id, job_type, payload, status, priority, available_at, lease_owner, lease_expires_at,
        attempt_count, maximum_attempts, last_error, created_at, updated_at, completed_at
      )
      VALUES
        ('background-phase6s-plugin-throw','plugin.enable','{"accountId":"account-phase6s-fixture","extensionId":"modula.core.moderationPlugin","simulateFailure":true}'::jsonb,'pending',10,NOW(),NULL,NULL,0,1,NULL,NOW(),NOW(),NULL),
        ('background-phase6s-plugin-timeout','plugin.enable','{"accountId":"account-phase6s-fixture","extensionId":"modula.core.mediaFunctions","simulateTimeout":true}'::jsonb,'pending',10,NOW(),NULL,NULL,0,1,NULL,NOW(),NOW(),NULL),
        ('background-phase6s-function-invalid-payload','function.invoke','{"jobId":"function-job-phase6s-invalid-payload","accountId":"account-phase6s-fixture","functionId":"modula.function.linkPreview","input":{"__phase6sFailureMode":"invalidPayload"},"timeoutMs":1000}'::jsonb,'pending',10,NOW(),NULL,NULL,0,1,NULL,NOW(),NOW(),NULL),
        ('background-phase6s-function-timeout','function.invoke','{"jobId":"function-job-phase6s-timeout","accountId":"account-phase6s-fixture","functionId":"modula.function.generatePostSummaryPreview","input":{"__phase6sFailureMode":"timeout"},"timeoutMs":100}'::jsonb,'pending',10,NOW(),NULL,NULL,0,1,NULL,NOW(),NOW(),NULL),
        ('background-phase6s-function-example','function.invoke','{"jobId":"function-job-phase6s-example","accountId":"account-phase6s-fixture","functionId":"modula.function.linkPreview","input":{"url":"https://modula.digital"},"timeoutMs":10000}'::jsonb,'pending',10,NOW(),NULL,NULL,0,3,NULL,NOW(),NOW(),NULL)
      ON CONFLICT (id) DO UPDATE SET
        status='pending',
        available_at=NOW(),
        lease_owner=NULL,
        lease_expires_at=NULL,
        attempt_count=0,
        last_error=NULL,
        updated_at=NOW(),
        completed_at=NULL
      WHERE background_jobs.status = 'dead_letter'
        AND background_jobs.last_error LIKE 'Unsupported job type %'`,
    )
    await client.query(
      `UPDATE greenfield_comments c
       SET reply_count = counts.reply_count, updated_at = NOW()
       FROM (
         SELECT c.comment_id, COALESCE((SELECT COUNT(*) FROM greenfield_comments r WHERE r.parent_comment_id = c.comment_id AND r.deleted_at IS NULL), 0)::integer AS reply_count
         FROM greenfield_comments c
       ) counts
       WHERE c.comment_id = counts.comment_id`,
    )
    await client.query(
      `UPDATE posts p
       SET
         like_count = counts.like_count,
         reaction_count = counts.reaction_count,
         repost_count = counts.repost_count,
         quote_count = counts.quote_count,
         reply_count = counts.comment_count,
         updated_at = NOW()
       FROM (
         SELECT
           p.id,
           COALESCE((SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id AND l.deleted_at IS NULL), 0)::integer AS like_count,
           COALESCE((SELECT COUNT(*) FROM greenfield_reactions r WHERE r.post_id = p.id), 0)::integer AS reaction_count,
           COALESCE((SELECT COUNT(*) FROM post_reposts rp WHERE rp.post_id = p.id AND rp.deleted_at IS NULL), 0)::integer AS repost_count,
           COALESCE((SELECT COUNT(*) FROM greenfield_quote_posts q WHERE q.quoted_post_id = p.id), 0)::integer AS quote_count,
           COALESCE((SELECT COUNT(*) FROM greenfield_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL), 0)::integer AS comment_count
         FROM posts p
       ) counts
       WHERE p.id = counts.id`,
    )
    for (const profile of profiles) {
      await client.query(
        `INSERT INTO notification_preferences (
          id, actor_id, follow_enabled, like_enabled, repost_enabled, reply_enabled, mention_enabled, module_event_enabled, created_at, updated_at, version
        ) VALUES ($1,$2,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,NOW(),NOW(),1)
        ON CONFLICT (actor_id) DO NOTHING`,
        [`notif-pref-${profile.actorId}`, profile.actorId],
      )
      await client.query(
        `INSERT INTO atproto_publication_preferences (
          id, actor_id, enabled, default_mode, publish_profile_extension, publish_module_metadata, created_at, updated_at, version
        ) VALUES ($1,$2,FALSE,'modulaOnly',FALSE,FALSE,NOW(),NOW(),1)
        ON CONFLICT (actor_id) DO NOTHING`,
        [`at-pref-${profile.actorId}`, profile.actorId],
      )
    }
    await client.query(`INSERT INTO schema_metadata (key, value, updated_at) VALUES ('seed_version', 'phase6s-preview-1', NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}
