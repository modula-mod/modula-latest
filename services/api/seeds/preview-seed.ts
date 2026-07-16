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
]

const follows: Array<[string, string]> = [
  ['actor-andrei', 'actor-gaia'], ['actor-andrei', 'actor-design'], ['actor-andrei', 'actor-builders'], ['actor-andrei', 'actor-garden'],
  ['actor-gaia', 'actor-andrei'], ['actor-gaia', 'actor-design'],
  ['actor-design', 'actor-andrei'], ['actor-design', 'actor-builders'], ['actor-design', 'actor-garden'],
  ['actor-builders', 'actor-andrei'], ['actor-builders', 'actor-gaia'], ['actor-builders', 'actor-design'],
  ['actor-garden', 'actor-andrei'], ['actor-garden', 'actor-design'], ['actor-garden', 'actor-builders'],
]

type SeedPost = {
  id: string; author: string; kind: 'text' | 'media' | 'link' | 'module'; feed: 'following' | 'forYou' | 'modules'
  text: string; likeCount: number; replyCount: number; repostCount: number; createdAt: string
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
]

export async function runSeed(connectionString: string): Promise<void> {
  const pool = new pg.Pool({connectionString})
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const table of ['post_media','post_likes','post_saves','post_reposts','follows','posts','profile_links','activity_items','reels','trending_topics','featured_modules','profiles','actors']) {
      await client.query(`DELETE FROM ${table}`)
    }
    for (const p of profiles) {
      await client.query(`INSERT INTO actors (id, kind, created_at, updated_at) VALUES ($1,$2,$3,$3)`, [p.actorId, p.actorKind, p.joinedAt])
      await client.query(
        `INSERT INTO profiles (
          id, actor_id, handle, display_name, kind, bio, pronouns,
          location_label, location_visibility, website_label, website_url, website_domain, website_visibility,
          focus_status_id, focus_status_label, focus_status_message, focus_status_updated_at,
          visibility, module_count, featured_module_ids, identity_claims, joined_at, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,'public',$9,$10,$11,CASE WHEN $9::text IS NULL THEN NULL ELSE 'public' END,
          $12,$13,$14,$15,'public',$16,$17::jsonb,'[]'::jsonb,$18,$18,$18
        )`,
        [p.profileId, p.actorId, p.handle, p.displayName, p.profileKind, p.bio, p.pronouns ?? null, p.location ?? null,
         p.website?.label ?? null, p.website?.url ?? null, p.website?.domain ?? null,
         p.focus.id, p.focus.label, p.focus.message, UPDATED, p.moduleCount, JSON.stringify(p.featured), p.joinedAt],
      )
      for (const [index, link] of p.links.entries()) {
        await client.query(
          `INSERT INTO profile_links (id, profile_id, label, url, domain, visibility, sort_order, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,'public',$6,$7,$7)`,
          [link.id, p.profileId, link.label, link.url, link.domain, index, p.joinedAt],
        )
      }
    }
    for (const [follower, followed] of follows) {
      await client.query(`INSERT INTO follows (id, follower_actor_id, followed_actor_id, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`,
        [`follow-${follower}-${followed}`, follower, followed])
    }
    for (const post of posts) {
      await client.query(
        `INSERT INTO posts (
          id, author_actor_id, kind, text, feed, audience, reply_permission,
          link_domain, link_title, link_description, module_name, module_action_label, module_status, glow_colour,
          like_count, reply_count, repost_count, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,'public','everyone',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)`,
        [post.id, post.author, post.kind, post.text, post.feed, post.link?.domain ?? null, post.link?.title ?? null, post.link?.description ?? null,
         post.module?.name ?? null, post.module?.actionLabel ?? null, post.module?.status ?? null, post.glow ?? null,
         post.likeCount, post.replyCount, post.repostCount, post.createdAt],
      )
      for (const [index, media] of (post.media ?? []).entries()) {
        await client.query(
          `INSERT INTO post_media (id, post_id, kind, title, colour, aspect_ratio, sort_order, created_at, updated_at)
           VALUES ($1,$2,'image',$3,$4,$5,$6,$7,$7)`,
          [media.id, post.id, media.title, media.colour, media.aspect, index, post.createdAt],
        )
      }
    }
    await client.query(`INSERT INTO post_likes (id, actor_id, post_id, created_at, updated_at) VALUES ('like-1','actor-andrei','post-local-owner-media',NOW(),NOW())`)
    await client.query(`INSERT INTO post_saves (id, actor_id, post_id, created_at, updated_at) VALUES ('save-1','actor-andrei','post-local-owner-module',NOW(),NOW())`)
    const topics: Array<[string, string, number]> = [
      ['topic-profile-os', 'Profile OS', 1840], ['topic-module-sdk', 'Module SDK', 820], ['topic-composer-tools', 'Composer Tools', 534],
      ['topic-board-workflows', 'Board workflows', 416], ['topic-dimon-previews', 'DIMON previews', 208],
    ]
    for (const [id, label, count] of topics) {
      await client.query(`INSERT INTO trending_topics (id, label, post_count, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`, [id, label, count])
    }
    const modules = [
      {id: 'module-vault-notes', name: 'Vault Notes', status: 'Profile preview'}, {id: 'module-tasks', name: 'Tasks', status: 'Preview'},
      {id: 'module-crm', name: 'CRM', status: 'Preview'}, {id: 'module-automations', name: 'Automations', status: 'Preview'},
      {id: 'module-sdk', name: 'Module SDK', status: 'Community preview'}, {id: 'module-marketplace', name: 'Marketplace', status: 'Browse'},
      {id: 'module-appearance-lab', name: 'Appearance Lab', status: 'Live'}, {id: 'module-runtime-tools', name: 'Runtime Tools', status: 'Preview'},
    ]
    for (const [index, mod] of modules.entries()) {
      await client.query(`INSERT INTO featured_modules (id, payload, sort_order, created_at, updated_at) VALUES ($1,$2::jsonb,$3,NOW(),NOW())`, [mod.id, JSON.stringify(mod), index])
    }
    const reels: Array<[string, string, string, string, string, number, number]> = [
      ['reel-1', 'actor-andrei', 'Profile OS walkthrough still', 'Modula Studio', '#369CAA', 120, 14],
      ['reel-2', 'actor-design', 'Material surfaces preview', 'Design Desk', '#8A6E55', 88, 9],
      ['reel-3', 'actor-garden', 'Garden trail collage', 'Digital Garden', '#5B8C5A', 54, 6],
    ]
    for (const [id, author, caption, source, colour, likes, replies] of reels) {
      await client.query(`INSERT INTO reels (id, author_actor_id, caption, source, colour, like_count, reply_count, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`, [id, author, caption, source, colour, likes, replies])
    }
    const activity: Array<[string, string, string, string, string, string | null]> = [
      ['activity-1', 'today', 'like', 'actor-gaia', 'liked your post', 'Profile should become the platform'],
      ['activity-2', 'today', 'follow', 'actor-builders', 'started following you', null],
      ['activity-3', 'earlier', 'moduleUpdate', 'actor-design', 'published a surface guidance update', 'Material study'],
      ['activity-4', 'earlier', 'mention', 'actor-garden', 'mentioned you in a trail note', 'Garden trails'],
    ]
    for (const [id, group, typ, actor, description, preview] of activity) {
      await client.query(`INSERT INTO activity_items (id, group_key, type, actor_id, description, preview, occurred_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())`, [id, group, typ, actor, description, preview])
    }
    await client.query(`INSERT INTO schema_metadata (key, value, updated_at) VALUES ('seed_version', 'phase5-preview-1', NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}
