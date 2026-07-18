import {demoProfiles} from '@/demo/demoProfiles'
import type {DemoProfile} from '@/types/social'

export type DemoReel = {
  id: string
  author: DemoProfile
  caption: string
  source: string
  colour: string
  videoUri?: string
  liked: boolean
  likeCount: number
  replyCount: number
}

/** Short public samples for the expo-video Reels foundation (Preview). */
const SAMPLE_VIDEO_A =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
const SAMPLE_VIDEO_B =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'

export const demoReels: DemoReel[] = [
  {
    id: 'reel-board',
    author: demoProfiles.andrei,
    caption: 'A Board that feels like a personal launch surface, not a dashboard.',
    source: 'Board study',
    colour: '#369CAA',
    videoUri: SAMPLE_VIDEO_A,
    liked: false,
    likeCount: 128,
    replyCount: 14,
  },
  {
    id: 'reel-media',
    author: demoProfiles.design,
    caption: 'Media glows. Text breathes. Links contain.',
    source: 'Design note',
    colour: '#6A8F62',
    videoUri: SAMPLE_VIDEO_B,
    liked: true,
    likeCount: 244,
    replyCount: 19,
  },
  {
    id: 'reel-modules',
    author: demoProfiles.gaia,
    caption: 'Modules should feel installed into Modula, not linked externally.',
    source: 'Module preview',
    colour: '#5B7F95',
    liked: false,
    likeCount: 92,
    replyCount: 7,
  },
]
