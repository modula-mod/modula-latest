import {demoProfiles} from '@/demo/demoProfiles'
import type {DemoPost} from '@/types/social'

const now = Date.now()

function minutesAgo(minutes: number): string {
  return new Date(now - minutes * 60 * 1000).toISOString()
}

export const initialDemoPosts: DemoPost[] = [
  {
    id: 'post-local-1',
    kind: 'text',
    feed: 'following',
    author: demoProfiles.andrei,
    createdAt: minutesAgo(8),
    liked: false,
    saved: false,
    reposted: false,
    likeCount: 34,
    replyCount: 8,
    repostCount: 3,
    text: 'Phase 1 goal: make Modula feel like a real social operating shell before connecting any backend.',
  },
  {
    id: 'post-local-2',
    kind: 'media',
    feed: 'forYou',
    author: demoProfiles.design,
    createdAt: minutesAgo(24),
    liked: true,
    saved: false,
    reposted: false,
    likeCount: 148,
    replyCount: 18,
    repostCount: 12,
    text: 'Media surfaces should feel alive without requiring blur, video, or animation loops.',
    glowColour: '#369CAA',
    media: [
      {
        id: 'media-board-glow',
        kind: 'image',
        title: 'Board surface study',
        colour: '#369CAA',
        aspectRatio: 4 / 5,
      },
    ],
  },
  {
    id: 'post-local-3',
    kind: 'module',
    feed: 'modules',
    author: demoProfiles.gaia,
    createdAt: minutesAgo(51),
    liked: false,
    saved: true,
    reposted: false,
    likeCount: 86,
    replyCount: 11,
    repostCount: 9,
    text: 'Vault Notes is ready as a local module preview inside the shell.',
    module: {
      name: 'Vault Notes',
      actionLabel: 'Open preview',
      status: 'Local preview',
    },
  },
  {
    id: 'post-local-4',
    kind: 'link',
    feed: 'following',
    author: demoProfiles.garden,
    createdAt: minutesAgo(87),
    liked: false,
    saved: false,
    reposted: false,
    likeCount: 62,
    replyCount: 6,
    repostCount: 4,
    text: 'Saved links should become profile-owned knowledge surfaces, not loose bookmarks.',
    link: {
      domain: 'modula.local',
      title: 'Profile OS notes',
      description:
        'A local demonstration preview for turning links into profile, board, and module context.',
    },
  },
  {
    id: 'post-local-5',
    kind: 'text',
    feed: 'forYou',
    author: demoProfiles.builders,
    createdAt: minutesAgo(132),
    liked: false,
    saved: false,
    reposted: true,
    likeCount: 210,
    replyCount: 23,
    repostCount: 31,
    text: 'The Board should feel personal: focus, recent activity, modules, and next actions in one place.',
  },
]
