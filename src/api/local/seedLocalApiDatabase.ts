import {parseAccountId, parsePostId, parseProfileId} from '@/api/contracts/identifiers'
import type {LocalApiDatabaseState, LocalFollowRecord, LocalPostRecord, LocalProfileRecord} from '@/api/local/LocalApiDatabase'
import {demoActivity} from '@/demo/demoActivity'
import {demoModules} from '@/demo/demoModules'
import {initialDemoPosts} from '@/demo/demoPosts'
import {demoReels} from '@/demo/demoReels'
import {demoProfileList, demoProfileRelations} from '@/features/profile/data/demoProfiles'
import {demoProfileModules} from '@/features/profile/data/demoProfileModules'
import type {ModulaProfile} from '@/features/profile/contracts'
import type {SocialPost} from '@/domain/social'

function profileById(id: string): ModulaProfile {
  const profile = demoProfileList.find(item => item.id === id)
  if (!profile) throw new Error(`Missing seed profile ${id}.`)
  return profile
}

function toProfileRecord(profile: ModulaProfile): LocalProfileRecord {
  const accountId =
    profile.id === 'profile-andrei'
      ? parseAccountId('account-andrei')
      : profile.id === 'profile-gaia'
        ? parseAccountId('account-gaia')
        : null
  return {
    ...profile,
    id: parseProfileId(profile.id),
    accountId,
  }
}

function toFeedMode(feed: 'following' | 'forYou' | 'modules') {
  return feed
}

/**
 * Profile module catalogs intentionally reuse marketplace ids across profiles
 * (same module featured on multiple people). Discover's featured rail is one
 * flat list, so flatten + slice must dedupe by id or React keys collide
 * (e.g. module-automations on Andrei + GAIA).
 */
function uniqueFeaturedModules(
  modules: (typeof demoProfileModules)[string],
  limit: number,
): (typeof demoProfileModules)[string] {
  const seen = new Set<string>()
  const unique: (typeof demoProfileModules)[string] = []
  for (const module of modules) {
    if (seen.has(module.id)) continue
    seen.add(module.id)
    unique.push(module)
    if (unique.length >= limit) break
  }
  return unique
}

function toPostRecord(post: (typeof initialDemoPosts)[number]): LocalPostRecord {
  const author = profileById(post.author.id)
  const base = {
    id: parsePostId(post.id),
    author,
    createdAt: post.createdAt,
    feed: toFeedMode(post.feed),
    text: post.text,
    liked: false,
    saved: false,
    reposted: false,
    likeCount: post.likeCount,
    replyCount: post.replyCount,
    repostCount: post.repostCount,
  }
  if (post.kind === 'media') {
    return {
      ...base,
      kind: 'media',
      media: post.media.map(item => ({
        id: item.id,
        kind: 'image' as const,
        url: item.uri ?? `local://seed/${item.id}`,
        title: item.title,
        colour: item.colour,
        aspectRatio: item.aspectRatio,
      })),
      glowColour: post.glowColour,
    }
  }
  if (post.kind === 'link') {
    return {
      ...base,
      kind: 'link',
      link: post.link,
    }
  }
  if (post.kind === 'module') {
    return {
      ...base,
      kind: 'module',
      module: post.module,
    }
  }
  return {
    ...base,
    kind: 'text',
    text: post.text,
  }
}

function seedFollows(): LocalFollowRecord[] {
  return Object.entries(demoProfileRelations.following).flatMap(([handle, ids]) => {
    const follower = demoProfileList.find(profile => profile.handle === handle)
    if (!follower) return []
    return ids.map(id => ({
      followerProfileId: parseProfileId(follower.id),
      followingProfileId: parseProfileId(id),
    }))
  })
}

function seedActivity(posts: SocialPost[]) {
  return demoActivity.map(item => ({
    ...item,
    actor: item.actor ? profileById(item.actor.id) : undefined,
    preview: item.preview ?? posts[0]?.text,
  }))
}

export function seedLocalApiDatabase(): LocalApiDatabaseState {
  const profiles = demoProfileList.map(toProfileRecord)
  const posts = initialDemoPosts.map(toPostRecord)
  const reels = demoReels.map(reel => ({
    ...reel,
    author: profileById(reel.author.id),
  }))
  return {
    accounts: [
      {
        id: parseAccountId('account-andrei'),
        accountId: 'account-andrei',
        email: 'andrei@modula.local',
        displayName: 'Andrei',
        primaryHandle: 'andrei.modula',
        status: 'active',
        createdAt: '2026-01-12T12:00:00.000Z',
        updatedAt: '2026-01-12T12:00:00.000Z',
        approvedDemo: true,
      },
      {
        id: parseAccountId('account-gaia'),
        accountId: 'account-gaia',
        email: 'gaia@modula.local',
        displayName: 'Gaia',
        primaryHandle: 'gaia.modula',
        status: 'active',
        createdAt: '2026-02-03T10:30:00.000Z',
        updatedAt: '2026-02-03T10:30:00.000Z',
        approvedDemo: true,
      },
    ],
    profiles,
    posts,
    comments: [
      {
        id: 'comment-local-bali-1',
        postId: parsePostId('post-showcase-bali'),
        authorId: 'profile-gaia',
        parentCommentId: null,
        rootCommentId: null,
        text: 'The light across the water is beautiful.',
        depth: 0,
        replyCount: 1,
        version: 1,
        createdAt: '2026-07-16T11:59:00.000Z',
        updatedAt: '2026-07-16T11:59:00.000Z',
        deletedAt: null,
      },
      {
        id: 'comment-local-bali-reply-1',
        postId: parsePostId('post-showcase-bali'),
        authorId: 'profile-andrei',
        parentCommentId: 'comment-local-bali-1',
        rootCommentId: 'comment-local-bali-1',
        text: 'A perfect calm moment.',
        depth: 1,
        replyCount: 0,
        version: 1,
        createdAt: '2026-07-16T12:01:00.000Z',
        updatedAt: '2026-07-16T12:01:00.000Z',
        deletedAt: null,
      },
      {
        id: 'comment-local-bali-2',
        postId: parsePostId('post-showcase-bali'),
        authorId: 'profile-builders',
        parentCommentId: null,
        rootCommentId: null,
        text: 'Saved for the next travel board.',
        depth: 0,
        replyCount: 0,
        version: 1,
        createdAt: '2026-07-16T12:03:00.000Z',
        updatedAt: '2026-07-16T12:03:00.000Z',
        deletedAt: null,
      },
      {
        id: 'comment-local-text-1',
        postId: parsePostId('post-local-1'),
        authorId: 'profile-gaia',
        parentCommentId: null,
        rootCommentId: null,
        text: 'Profile-first is the right foundation.',
        depth: 0,
        replyCount: 0,
        version: 1,
        createdAt: '2026-07-16T12:05:00.000Z',
        updatedAt: '2026-07-16T12:05:00.000Z',
        deletedAt: null,
      },
      {
        id: 'comment-local-post-v2-1',
        postId: parsePostId('post-local-owner-media'),
        authorId: 'profile-gaia',
        parentCommentId: null,
        rootCommentId: null,
        text: 'One interaction grammar makes every post easier to learn.',
        depth: 0,
        replyCount: 0,
        version: 1,
        createdAt: '2026-07-16T12:07:00.000Z',
        updatedAt: '2026-07-16T12:07:00.000Z',
        deletedAt: null,
      },
      {
        id: 'comment-local-post-v2-2',
        postId: parsePostId('post-local-owner-media'),
        authorId: 'profile-builders',
        parentCommentId: null,
        rootCommentId: null,
        text: 'The media finally feels like the primary surface.',
        depth: 0,
        replyCount: 0,
        version: 1,
        createdAt: '2026-07-16T12:08:00.000Z',
        updatedAt: '2026-07-16T12:08:00.000Z',
        deletedAt: null,
      },
      {
        id: 'comment-local-post-v2-3',
        postId: parsePostId('post-local-owner-media'),
        authorId: 'profile-design',
        parentCommentId: null,
        rootCommentId: null,
        text: 'Comments now feel connected to the post instead of routed away.',
        depth: 0,
        replyCount: 0,
        version: 1,
        createdAt: '2026-07-16T12:09:00.000Z',
        updatedAt: '2026-07-16T12:09:00.000Z',
        deletedAt: null,
      },
    ],
    follows: seedFollows(),
    likes: initialDemoPosts
      .filter(post => post.liked)
      .map(post => ({profileId: parseProfileId('profile-andrei'), postId: parsePostId(post.id)})),
    saves: initialDemoPosts
      .filter(post => post.saved)
      .map(post => ({profileId: parseProfileId('profile-andrei'), postId: parsePostId(post.id)})),
    reposts: initialDemoPosts
      .filter(post => post.reposted)
      .map(post => ({profileId: parseProfileId('profile-andrei'), postId: parsePostId(post.id)})),
    activity: seedActivity(posts),
    notificationPreferences: [
      {
        accountId: parseAccountId('account-andrei'),
        followEnabled: true,
        likeEnabled: true,
        reactionEnabled: true,
        repostEnabled: true,
        quoteEnabled: true,
        replyEnabled: true,
        commentEnabled: true,
        mentionEnabled: true,
        moduleEventEnabled: false,
        extensionEnabled: false,
        bundleStyle: 'focus',
        version: 1,
        updatedAt: '2026-07-26T00:00:00.000Z',
      },
    ],
    appearancePreferences: [],
    boardLayouts: [
      {
        accountId: parseAccountId('account-andrei'),
        boardWidgetIds: [
          'vault-notes',
          'product-hub',
          'saved',
          'profile',
          'settings',
          'activity',
        ],
        version: 1,
        updatedAt: '2026-07-26T00:00:00.000Z',
      },
    ],
    sessions: [],
    discover: {
      suggestedProfiles: profiles,
      trendingTopics: [
        {id: 'topic-profile-os', label: 'Profile OS', postCount: 1840},
        {id: 'topic-module-sdk', label: 'Module SDK', postCount: 820},
        {id: 'topic-composer-tools', label: 'Composer Tools', postCount: 534},
        {id: 'topic-board-workflows', label: 'Board workflows', postCount: 416},
        {id: 'topic-dimon-previews', label: 'DIMON previews', postCount: 208},
      ],
      featuredModules: uniqueFeaturedModules(
        Object.values(demoProfileModules).flat(),
        8,
      ),
      media: reels.map(reel => ({
        id: `media-${reel.id}`,
        kind: 'image',
        url: `local://reel/${reel.id}`,
        altText: reel.caption,
        colour: reel.colour,
        aspectRatio: 9 / 16,
        title: reel.source,
      })),
      reels,
    },
    reels,
    storyGroups: [],
    storyViews: [],
  }
}

export {demoModules as localSeedModulePreviews}
