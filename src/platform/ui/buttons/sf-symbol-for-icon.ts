import type {AppIconName} from '@/components/primitives/AppIcon'

/** AppIcon → SF Symbol for Expo UI SwiftUI Button / Menu triggers. */
export const SF_SYMBOL_FOR_ICON: Partial<Record<AppIconName, string>> = {
  back: 'chevron.left',
  more: 'ellipsis',
  share: 'square.and.arrow.up',
  create: 'plus',
  search: 'magnifyingglass',
  close: 'xmark',
  settings: 'gearshape',
  messages: 'bubble.left.and.bubble.right',
  menu: 'line.3.horizontal',
  photo: 'photo',
  play: 'play.fill',
  pause: 'pause.fill',
  skipBack: 'gobackward.10',
  skipForward: 'goforward.30',
  like: 'heart',
  comment: 'bubble.right',
  bookmark: 'bookmark',
  discover: 'safari',
  people: 'person.2',
  board: 'square.grid.2x2',
  appearance: 'paintbrush',
  home: 'house',
  activity: 'heart',
  profile: 'person',
  chevronRight: 'chevron.right',
  warning: 'exclamationmark.triangle',
  marketplace: 'bag',
  modules: 'square.stack.3d.up',
  developer: 'hammer',
  contrast: 'circle.lefthalf.filled',
  automation: 'cpu',
  privacy: 'lock.shield',
}

export function sfSymbolForIcon(icon: AppIconName): string {
  return SF_SYMBOL_FOR_ICON[icon] ?? 'circle'
}
