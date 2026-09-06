import type {IconName} from '@expo/ui'

/** SF Symbol names as typed by the installed `@expo/ui` (57.0.10). */
type SFSymbol = Extract<IconName, string>

/**
 * Canonical Modula semantic icon registry (7M-B).
 *
 * One semantic name → three render paths:
 * - iOS: SF Symbol via the installed `@expo/ui` universal Icon (typed —
 *   an invalid symbol name fails typecheck).
 * - Android + web: Modula-owned SVG path data (react-native-svg). No icon
 *   font is used for new UI, so there is no tofu/404 failure mode.
 *
 * Unknown semantic names fail typecheck via the `ModulaIconName` union.
 * Glyphs are 24×24 stroke-first drawings owned by Modula.
 */
export type ModulaIconPath = {
  d: string
  /** Filled path (dots, solid triangles). Stroked when false/omitted. */
  fill?: boolean
}

export type ModulaIconDefinition = {
  sf: SFSymbol
  paths: ModulaIconPath[]
}

const stroke = (d: string): ModulaIconPath => ({d})
const fill = (d: string): ModulaIconPath => ({d, fill: true})

const HEART = stroke(
  'M12 20.2C7.2 16.6 3.8 13.2 3.8 9.6c0-2.7 2-4.8 4.5-4.8 1.5 0 2.9.7 3.7 1.9.8-1.2 2.2-1.9 3.7-1.9 2.5 0 4.5 2.1 4.5 4.8 0 3.6-3.4 7-8.2 10.6z',
)
const PERSON_HEAD = stroke('M12 11.2a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z')
const PERSON_BODY = stroke('M5.2 19.8c.5-3.6 3.3-5.6 6.8-5.6s6.3 2 6.8 5.6')
const BOOKMARK = stroke('M7 3.8h10a1 1 0 0 1 1 1v15.4l-6-4.1-6 4.1V4.8a1 1 0 0 1 1-1z')
const SPARKLES: ModulaIconPath[] = [
  stroke('M11 4.5l1.7 4.3 4.3 1.7-4.3 1.7L11 16.5l-1.7-4.3L5 10.5l4.3-1.7L11 4.5z'),
  stroke('M17.8 14.8l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9.9-2z'),
]
const CUBE: ModulaIconPath[] = [
  stroke('M12 3.2l8 4.4v8.8l-8 4.4-8-4.4V7.6l8-4.4z'),
  stroke('M4 7.6l8 4.4 8-4.4'),
  stroke('M12 12v8.8'),
]

export const MODULA_ICONS = {
  home: {
    sf: 'house',
    paths: [
      stroke('M4 10.4L12 3.8l8 6.6'),
      stroke('M5.8 9.4v10.4h12.4V9.4'),
      stroke('M10 19.8v-5h4v5'),
    ],
  },
  discover: {
    sf: 'safari',
    paths: [
      stroke('M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2z'),
      stroke('M15.2 8.8l-1.8 4.6-4.6 1.8 1.8-4.6 4.6-1.8z'),
    ],
  },
  create: {
    sf: 'plus',
    paths: [stroke('M12 5v14'), stroke('M5 12h14')],
  },
  edit: {
    sf: 'square.and.pencil',
    paths: [
      stroke('M13.8 5.2l5 5L9 20H4v-5L13.8 5.2z'),
      stroke('M12.2 6.8l5 5'),
    ],
  },
  activity: {sf: 'heart', paths: [HEART]},
  like: {sf: 'heart', paths: [HEART]},
  reactionLike: {
    sf: 'hand.thumbsup',
    paths: [stroke('M8.5 20H5V10h3.5v10z'), stroke('M8.5 10l3.2-6c.8.2 1.4.9 1.4 1.8v3H18c1.3 0 2.2 1.2 1.9 2.5l-1.5 6.5c-.3 1.3-1.4 2.2-2.7 2.2H8.5V10z')],
  },
  reactionLove: {sf: 'heart', paths: [HEART]},
  reactionLaugh: {
    sf: 'face.smiling',
    paths: [stroke('M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z'), fill('M9.2 9.3a1 1 0 1 1-2 0 1 1 0 0 1 2 0z'), fill('M16.8 9.3a1 1 0 1 1-2 0 1 1 0 0 1 2 0z'), stroke('M7.8 14c1.2 2 2.6 3 4.2 3s3-1 4.2-3')],
  },
  reactionFire: {
    sf: 'flame',
    paths: [stroke('M13.2 3.2c.8 4.4-2.7 5.4-2.1 8.2.3 1.2 1.3 1.9 2.3 1.7 1.8-.4 2.5-2.3 2-4.5 2.8 2.2 4.2 4.6 3.6 7.1-.7 3.2-3.5 5.1-7 5.1s-6.3-2.1-7-5.3c-.7-3.4 1.3-6.8 4.9-9.5-.2 2.5.6 3.6 1.5 3.8.9-2.6.2-4.5 1.8-6.6z')],
  },
  reactionSupport: {sf: 'heart', paths: [HEART, stroke('M8 12h8')]},
  reactionCelebrate: {sf: 'sparkles', paths: SPARKLES},
  reactionInsightful: {
    sf: 'lightbulb',
    paths: [stroke('M8.2 14.6a6 6 0 1 1 7.6 0c-1.2.9-1.8 2-1.8 3.4h-4c0-1.4-.6-2.5-1.8-3.4z'), stroke('M10 21h4')],
  },
  reactionCurious: {
    sf: 'questionmark.circle',
    paths: [stroke('M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z'), stroke('M9.5 9a2.7 2.7 0 0 1 5.2.9c0 2-2.7 2.1-2.7 4'), fill('M13 17.2a1 1 0 1 1-2 0 1 1 0 0 1 2 0z')],
  },
  profile: {sf: 'person', paths: [PERSON_HEAD, PERSON_BODY]},
  account: {sf: 'person.crop.circle', paths: [PERSON_HEAD, PERSON_BODY]},
  menu: {
    sf: 'line.3.horizontal',
    paths: [stroke('M4 7h16'), stroke('M4 12h16'), stroke('M4 17h16')],
  },
  messages: {
    sf: 'bubble.left.and.bubble.right',
    paths: [
      stroke('M20 14a2 2 0 0 1-2 2H8.5L4 19.8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8z'),
      fill('M8.6 10a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z'),
      fill('M13.1 10a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z'),
      fill('M17.6 10a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z'),
    ],
  },
  search: {
    sf: 'magnifyingglass',
    paths: [
      stroke('M11 17.4a6.4 6.4 0 1 0 0-12.8 6.4 6.4 0 0 0 0 12.8z'),
      stroke('M15.7 15.7l4.8 4.8'),
    ],
  },
  more: {
    sf: 'ellipsis',
    paths: [
      fill('M6.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0z'),
      fill('M13.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0z'),
      fill('M20.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0z'),
    ],
  },
  comment: {
    sf: 'bubble.right',
    paths: [
      stroke('M20 14a2 2 0 0 1-2 2H8.5L4 19.8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8z'),
    ],
  },
  repost: {
    sf: 'arrow.2.squarepath',
    paths: [
      stroke('M16.8 2.8l2.9 2.9-2.9 2.9'),
      stroke('M19.7 5.7H9.2a4.2 4.2 0 0 0-4.2 4.2v1.1'),
      stroke('M7.2 21.2l-2.9-2.9 2.9-2.9'),
      stroke('M4.3 18.3h10.5a4.2 4.2 0 0 0 4.2-4.2V13'),
    ],
  },
  share: {
    sf: 'square.and.arrow.up',
    paths: [
      stroke('M12 3.2v11.6'),
      stroke('M8.4 6.6L12 3l3.6 3.6'),
      stroke('M7.4 10H6.2a2 2 0 0 0-2 2v6.8a2 2 0 0 0 2 2h11.6a2 2 0 0 0 2-2V12a2 2 0 0 0-2-2h-1.2'),
    ],
  },
  bookmark: {sf: 'bookmark', paths: [BOOKMARK]},
  saved: {sf: 'bookmark', paths: [BOOKMARK]},
  board: {
    sf: 'square.grid.2x2',
    paths: [
      stroke('M4.2 5.7a1.5 1.5 0 0 1 1.5-1.5h3.6a1.5 1.5 0 0 1 1.5 1.5v3.6a1.5 1.5 0 0 1-1.5 1.5H5.7a1.5 1.5 0 0 1-1.5-1.5V5.7z'),
      stroke('M13.2 5.7a1.5 1.5 0 0 1 1.5-1.5h3.6a1.5 1.5 0 0 1 1.5 1.5v3.6a1.5 1.5 0 0 1-1.5 1.5h-3.6a1.5 1.5 0 0 1-1.5-1.5V5.7z'),
      stroke('M4.2 14.7a1.5 1.5 0 0 1 1.5-1.5h3.6a1.5 1.5 0 0 1 1.5 1.5v3.6a1.5 1.5 0 0 1-1.5 1.5H5.7a1.5 1.5 0 0 1-1.5-1.5v-3.6z'),
      stroke('M13.2 14.7a1.5 1.5 0 0 1 1.5-1.5h3.6a1.5 1.5 0 0 1 1.5 1.5v3.6a1.5 1.5 0 0 1-1.5 1.5h-3.6a1.5 1.5 0 0 1-1.5-1.5v-3.6z'),
    ],
  },
  modules: {sf: 'square.stack.3d.up', paths: CUBE},
  module: {sf: 'shippingbox', paths: CUBE},
  marketplace: {
    sf: 'bag',
    paths: [
      stroke('M5.8 8h12.4l1.3 11a1.6 1.6 0 0 1-1.6 1.8H6.1A1.6 1.6 0 0 1 4.5 19l1.3-11z'),
      stroke('M9 8V6.4a3 3 0 0 1 6 0V8'),
    ],
  },
  settings: {
    sf: 'gearshape',
    paths: [
      stroke('M4 7.2h8.4'),
      stroke('M17.8 7.2H20'),
      stroke('M15.1 9.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'),
      stroke('M4 16.8h3.2'),
      stroke('M12.6 16.8H20'),
      stroke('M9.9 18.8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'),
    ],
  },
  appearance: {
    sf: 'paintpalette',
    paths: [
      stroke(
        'M12 3.6a8.4 8.4 0 1 0 0 16.8c1.2 0 2-.9 2-2 0-.6-.2-1-.6-1.4-.4-.4-.6-.8-.6-1.4 0-1.1.9-2 2-2h2.1a3.5 3.5 0 0 0 3.5-3.5c-.5-3.8-4-6.5-8.4-6.5z',
      ),
      fill('M8.6 10.6a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z'),
      fill('M11.4 7.4a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z'),
      fill('M15.8 7.4a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z'),
    ],
  },
  accessibility: {
    sf: 'figure.stand',
    paths: [
      stroke('M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2z'),
      fill('M13.4 7.6a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 0 1 2.8 0z'),
      stroke('M7.6 10.4c2.9.9 5.9.9 8.8 0'),
      stroke('M12 11.2v3.2'),
      stroke('M12 14.4l-1.9 4'),
      stroke('M12 14.4l1.9 4'),
    ],
  },
  privacy: {
    sf: 'lock',
    paths: [
      stroke('M6 10.6h12a1.5 1.5 0 0 1 1.5 1.5v6.4a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-6.4A1.5 1.5 0 0 1 6 10.6z'),
      stroke('M8.4 10.6V8a3.6 3.6 0 0 1 7.2 0v2.6'),
    ],
  },
  notifications: {
    sf: 'bell',
    paths: [
      stroke('M18.2 16H5.8c1.2-1.2 1.9-2.2 1.9-5.1A4.3 4.3 0 0 1 12 6.5a4.3 4.3 0 0 1 4.3 4.4c0 2.9.7 3.9 1.9 5.1z'),
      stroke('M12 4.4v2.1'),
      stroke('M10.3 19a1.8 1.8 0 0 0 3.4 0'),
    ],
  },
  integrations: {
    sf: 'point.3.connected.trianglepath.dotted',
    paths: [
      stroke('M12 7.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z'),
      stroke('M6 20.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z'),
      stroke('M18 20.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z'),
      stroke('M11 7l-4 9.8'),
      stroke('M13 7l4 9.8'),
      stroke('M7.9 18.5h8.2'),
    ],
  },
  storage: {
    sf: 'archivebox',
    paths: [
      stroke('M4.4 4.6h15.2a1 1 0 0 1 1 1v2.2a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1V5.6a1 1 0 0 1 1-1z'),
      stroke('M5.4 8.8v9a1.8 1.8 0 0 0 1.8 1.8h9.6a1.8 1.8 0 0 0 1.8-1.8v-9'),
      stroke('M10 12.6h4'),
    ],
  },
  security: {
    sf: 'checkmark.shield',
    paths: [
      stroke('M12 3.2l7.4 2.9v5.4c0 4.5-3 7.6-7.4 9.3-4.4-1.7-7.4-4.8-7.4-9.3V6.1L12 3.2z'),
      stroke('M8.9 12l2.2 2.2 4-4.4'),
    ],
  },
  developer: {
    sf: 'terminal',
    paths: [
      stroke('M3.6 6.8a1.8 1.8 0 0 1 1.8-1.8h13.2a1.8 1.8 0 0 1 1.8 1.8v10.4a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V6.8z'),
      stroke('M7 9.6l3 2.4-3 2.4'),
      stroke('M12.6 15h4.4'),
    ],
  },
  palette: {
    sf: 'drop',
    paths: [
      stroke('M12 3.8c3.4 4.4 5.4 6.9 5.4 9.4a5.4 5.4 0 1 1-10.8 0C6.6 10.7 8.6 8.2 12 3.8z'),
    ],
  },
  text: {
    sf: 'textformat.size',
    paths: [
      stroke('M5.6 18.5L10.8 5.2h.8l5.2 13.3'),
      stroke('M7.8 13.4h6.8'),
      stroke('M18 18.5v-7.2'),
    ],
  },
  contrast: {
    sf: 'circle.lefthalf.filled',
    paths: [
      stroke('M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2z'),
      fill('M12 3.4a8.6 8.6 0 0 1 0 17.2V3.4z'),
    ],
  },
  motion: {
    sf: 'waveform.path.ecg',
    paths: [stroke('M3 12.4h3.8l2.4-6 4 11.6 2.4-6H21')],
  },
  reset: {
    sf: 'arrow.counterclockwise',
    paths: [
      stroke('M6.2 5v4.8H11'),
      stroke('M6.5 9.8A7.3 7.3 0 1 1 4.7 14'),
    ],
  },
  warning: {
    sf: 'exclamationmark.triangle',
    paths: [
      stroke('M12 4.2l9 15.2H3l9-15.2z'),
      stroke('M12 10.2v4'),
      fill('M13.1 17a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z'),
    ],
  },
  info: {
    sf: 'info.circle',
    paths: [
      stroke('M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2z'),
      stroke('M12 11.2v5'),
      fill('M13.1 8.2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z'),
    ],
  },
  switch: {
    sf: 'switch.2',
    paths: [
      stroke('M7.8 16.2h8.4a4.2 4.2 0 0 0 0-8.4H7.8a4.2 4.2 0 0 0 0 8.4z'),
      stroke('M15.8 14.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'),
    ],
  },
  close: {
    sf: 'xmark',
    paths: [stroke('M6 6l12 12'), stroke('M18 6L6 18')],
  },
  back: {
    sf: 'chevron.left',
    paths: [stroke('M14.6 5.4L8 12l6.6 6.6')],
  },
  chevronRight: {
    sf: 'chevron.right',
    paths: [stroke('M9.4 5.4L16 12l-6.6 6.6')],
  },
  photo: {
    sf: 'photo',
    paths: [
      stroke('M3.6 6.8a1.8 1.8 0 0 1 1.8-1.8h13.2a1.8 1.8 0 0 1 1.8 1.8v10.4a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V6.8z'),
      fill('M10 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z'),
      stroke('M3.8 16.6l4.4-4.4 3.4 3.4 4-4.8 4.6 5.4'),
    ],
  },
  image: {
    sf: 'photo',
    paths: [
      stroke('M3.6 6.8a1.8 1.8 0 0 1 1.8-1.8h13.2a1.8 1.8 0 0 1 1.8 1.8v10.4a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V6.8z'),
      fill('M10 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z'),
      stroke('M3.8 16.6l4.4-4.4 3.4 3.4 4-4.8 4.6 5.4'),
    ],
  },
  camera: {
    sf: 'camera',
    paths: [
      stroke('M3.6 8.8A1.8 1.8 0 0 1 5.4 7h2.2l1.3-2.4h6.2L16.4 7h2.2a1.8 1.8 0 0 1 1.8 1.8v8.6a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V8.8z'),
      stroke('M12 16.3a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z'),
    ],
  },
  tools: {
    sf: 'wrench.adjustable',
    paths: [
      stroke(
        'M14.8 6.2a4.2 4.2 0 0 0-5.6 5L4 16.4V20h3.6l5.2-5.2a4.2 4.2 0 0 0 5-5.6L15 12l-3-3 2.8-2.8z',
      ),
    ],
  },
  link: {
    sf: 'link',
    paths: [
      stroke('M10.2 13.8a4.4 4.4 0 0 0 6.2.4l2.1-2.1a4.4 4.4 0 0 0-6.2-6.2l-1.2 1.2'),
      stroke('M13.8 10.2a4.4 4.4 0 0 0-6.2-.4L5.5 11.9a4.4 4.4 0 0 0 6.2 6.2l1.2-1.2'),
    ],
  },
  poll: {
    sf: 'chart.bar',
    paths: [stroke('M6 19.6V10'), stroke('M12 19.6V4.4'), stroke('M18 19.6v-5.8')],
  },
  gif: {sf: 'sparkles', paths: SPARKLES},
  sparkles: {sf: 'sparkles', paths: SPARKLES},
  event: {
    sf: 'calendar',
    paths: [
      stroke('M4.4 7.8A1.8 1.8 0 0 1 6.2 6h11.6a1.8 1.8 0 0 1 1.8 1.8v10.4a1.8 1.8 0 0 1-1.8 1.8H6.2a1.8 1.8 0 0 1-1.8-1.8V7.8z'),
      stroke('M4.4 10.6h15.2'),
      stroke('M8.4 4v4'),
      stroke('M15.6 4v4'),
    ],
  },
  automation: {
    sf: 'cpu',
    paths: [
      stroke('M7 8.5A1.5 1.5 0 0 1 8.5 7h7A1.5 1.5 0 0 1 17 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 15.5v-7z'),
      stroke('M10 10h4v4h-4v-4z'),
      stroke('M9.6 3.6V7'),
      stroke('M14.4 3.6V7'),
      stroke('M9.6 17v3.4'),
      stroke('M14.4 17v3.4'),
      stroke('M3.6 9.6H7'),
      stroke('M3.6 14.4H7'),
      stroke('M17 9.6h3.4'),
      stroke('M17 14.4h3.4'),
    ],
  },
  people: {
    sf: 'person.2',
    paths: [
      stroke('M9 11.4a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'),
      stroke('M3.6 19.4c.4-3 2.6-4.9 5.4-4.9s5 1.9 5.4 4.9'),
      stroke('M15.4 11.6a2.5 2.5 0 1 0-.8-4.9'),
      stroke('M16.4 14.7c2.3.4 3.8 2 4 4.3'),
    ],
  },
  teams: {
    sf: 'person.2.circle',
    paths: [
      stroke('M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2z'),
      stroke('M12 11.8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'),
      stroke('M7.4 17.6c.8-2.3 2.5-3.6 4.6-3.6s3.8 1.3 4.6 3.6'),
    ],
  },
  community: {
    sf: 'globe',
    paths: [
      stroke('M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2z'),
      stroke('M3.4 12h17.2'),
      stroke('M12 3.4c-4.3 4.8-4.3 12.4 0 17.2'),
      stroke('M12 3.4c4.3 4.8 4.3 12.4 0 17.2'),
    ],
  },
  check: {
    sf: 'checkmark',
    paths: [stroke('M5 12.6l4.4 4.4L19 7')],
  },
  verified: {
    sf: 'checkmark.seal',
    paths: [
      stroke('M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2z'),
      stroke('M8.7 12.2l2.3 2.3 4.3-4.7'),
    ],
  },
  play: {
    sf: 'play.fill',
    paths: [fill('M8.4 5.6v12.8L18.6 12 8.4 5.6z')],
  },
  pause: {
    sf: 'pause.fill',
    paths: [
      fill('M8.2 5.6h2.4v12.8H8.2V5.6z'),
      fill('M13.4 5.6h2.4v12.8h-2.4V5.6z'),
    ],
  },
  skipBack: {
    sf: 'backward.fill',
    paths: [stroke('M6.2 5.6v12.8'), fill('M18.8 5.6L9.4 12l9.4 6.4V5.6z')],
  },
  skipForward: {
    sf: 'forward.fill',
    paths: [stroke('M17.8 5.6v12.8'), fill('M5.2 5.6L14.6 12l-9.4 6.4V5.6z')],
  },
  send: {
    sf: 'paperplane',
    paths: [
      stroke('M20.6 3.4L3.6 10.4l6.5 3 3 6.6 7.5-16.6z'),
      stroke('M10.1 13.4l10.5-10'),
    ],
  },
  trash: {
    sf: 'trash',
    paths: [
      stroke('M4.4 6.6h15.2'),
      stroke('M9.2 6.6V5a1.2 1.2 0 0 1 1.2-1.2h3.2A1.2 1.2 0 0 1 14.8 5v1.6'),
      stroke('M6.4 6.6l.9 12.8a1.4 1.4 0 0 0 1.4 1.3h6.6a1.4 1.4 0 0 0 1.4-1.3l.9-12.8'),
      stroke('M10 10.4v6.2'),
      stroke('M14 10.4v6.2'),
    ],
  },
  arrowUp: {
    sf: 'arrow.up',
    paths: [stroke('M12 19.2V5'), stroke('M6 11l6-6 6 6')],
  },
  arrowDown: {
    sf: 'arrow.down',
    paths: [stroke('M12 4.8V19'), stroke('M6 13l6 6 6-6')],
  },
  mail: {
    sf: 'envelope',
    paths: [
      stroke('M3.6 7.3A1.8 1.8 0 0 1 5.4 5.5h13.2a1.8 1.8 0 0 1 1.8 1.8v9.4a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V7.3z'),
      stroke('M4.2 7.4l7.8 5.8 7.8-5.8'),
    ],
  },
  key: {
    sf: 'key',
    paths: [
      stroke('M8.2 18.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z'),
      stroke('M10.8 12L19.6 3.2'),
      stroke('M15.6 7.2l2.6 2.6'),
      stroke('M18.4 4.4l2 2'),
    ],
  },
  eye: {
    sf: 'eye',
    paths: [
      stroke('M2.8 12c2.4-4.3 5.8-6.5 9.2-6.5s6.8 2.2 9.2 6.5c-2.4 4.3-5.8 6.5-9.2 6.5S5.2 16.3 2.8 12z'),
      stroke('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'),
    ],
  },
  eyeOff: {
    sf: 'eye.slash',
    paths: [
      stroke('M2.8 12c2.4-4.3 5.8-6.5 9.2-6.5s6.8 2.2 9.2 6.5c-2.4 4.3-5.8 6.5-9.2 6.5S5.2 16.3 2.8 12z'),
      stroke('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'),
      stroke('M4.6 4.6l14.8 14.8'),
    ],
  },
  backspace: {
    sf: 'delete.left',
    paths: [
      stroke('M9.2 5.2h10.3a1.5 1.5 0 0 1 1.5 1.5v10.6a1.5 1.5 0 0 1-1.5 1.5H9.2L3 12l6.2-6.8z'),
      stroke('M12.2 9l6 6'),
      stroke('M18.2 9l-6 6'),
    ],
  },
  fingerprint: {
    sf: 'touchid',
    paths: [
      stroke('M7.2 9.4A5.2 5.2 0 0 1 12 6.2a5.2 5.2 0 0 1 5.2 5.2'),
      stroke('M5 12.1A7 7 0 0 1 12 5a7 7 0 0 1 7 7.1'),
      stroke('M8.6 12.1a3.4 3.4 0 0 1 6.8 0c0 4.6-1 7-2.1 8.2'),
      stroke('M11.9 11.3c.8 0 1.4.6 1.4 1.4 0 3.7-.7 5.8-1.5 7.4'),
      stroke('M8.1 14.1c.1 2.7-.6 4.6-1.4 5.8'),
    ],
  },
  scan: {
    sf: 'faceid',
    paths: [
      stroke('M4 9V5a1 1 0 0 1 1-1h4'),
      stroke('M15 4h4a1 1 0 0 1 1 1v4'),
      stroke('M20 15v4a1 1 0 0 1-1 1h-4'),
      stroke('M9 20H5a1 1 0 0 1-1-1v-4'),
      stroke('M8.5 11.5c.8-1 2-1.5 3.5-1.5s2.7.5 3.5 1.5'),
      stroke('M9 15c.8.7 1.8 1 3 1s2.2-.3 3-1'),
    ],
  },
  download: {
    sf: 'arrow.down.circle',
    paths: [
      stroke('M12 4.2v10.6'),
      stroke('M7.2 10.4l4.8 4.8 4.8-4.8'),
      stroke('M5 19.4h14'),
    ],
  },
  filter: {
    sf: 'line.3.horizontal.decrease',
    paths: [stroke('M4 7h16'), stroke('M7 12h10'), stroke('M10 17h4')],
  },
  folder: {
    sf: 'folder',
    paths: [
      stroke(
        'M3.6 6.6a1.8 1.8 0 0 1 1.8-1.8h4l2 2.4h7.2a1.8 1.8 0 0 1 1.8 1.8v8.4a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V6.6z',
      ),
    ],
  },
  note: {
    sf: 'note.text',
    paths: [
      stroke('M6.2 3.8h7.4l4.2 4.2v12.2H6.2V3.8z'),
      stroke('M13.6 3.8V8h4.2'),
      stroke('M9 12.2h6'),
      stroke('M9 15.6h6'),
    ],
  },
  clock: {
    sf: 'clock',
    paths: [
      stroke('M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2z'),
      stroke('M12 7.4V12l3.1 2.1'),
    ],
  },
  update: {
    sf: 'arrow.triangle.2.circlepath',
    paths: [
      stroke('M19.8 4.6v4.8H15'),
      stroke('M4.2 19.4v-4.8H9'),
      stroke('M5.6 9.2a7.3 7.3 0 0 1 12.6-2.4l1.6 1.8'),
      stroke('M18.4 14.8a7.3 7.3 0 0 1-12.6 2.4l-1.6-1.8'),
    ],
  },
} as const satisfies Record<string, ModulaIconDefinition>

export type ModulaIconName = keyof typeof MODULA_ICONS

export const MODULA_ICON_NAMES = Object.keys(MODULA_ICONS) as ModulaIconName[]

export function modulaIconDefinition(name: ModulaIconName): ModulaIconDefinition {
  return MODULA_ICONS[name] ?? MODULA_ICONS.module
}
