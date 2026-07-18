import Ionicons from '@expo/vector-icons/Ionicons'
import type {ComponentProps} from 'react'

export type AppIconName =
  | 'home'
  | 'discover'
  | 'create'
  | 'activity'
  | 'profile'
  | 'menu'
  | 'messages'
  | 'search'
  | 'more'
  | 'like'
  | 'comment'
  | 'repost'
  | 'share'
  | 'bookmark'
  | 'board'
  | 'modules'
  | 'marketplace'
  | 'settings'
  | 'appearance'
  | 'accessibility'
  | 'privacy'
  | 'notifications'
  | 'integrations'
  | 'storage'
  | 'security'
  | 'developer'
  | 'account'
  | 'palette'
  | 'text'
  | 'contrast'
  | 'motion'
  | 'reset'
  | 'warning'
  | 'info'
  | 'switch'
  | 'close'
  | 'back'
  | 'photo'
  | 'camera'
  | 'tools'
  | 'link'
  | 'poll'
  | 'gif'
  | 'event'
  | 'automation'
  | 'people'
  | 'saved'
  | 'teams'
  | 'community'
  | 'check'
  | 'chevronRight'
  | 'play'
  | 'pause'
  | 'skipBack'
  | 'skipForward'
  | 'send'
  | 'trash'
  | 'arrowUp'
  | 'arrowDown'

type IoniconName = ComponentProps<typeof Ionicons>['name']

const iconMap: Record<AppIconName, IoniconName> = {
  home: 'home-outline',
  discover: 'compass-outline',
  create: 'add',
  activity: 'heart-outline',
  profile: 'person-outline',
  menu: 'menu-outline',
  messages: 'chatbubble-ellipses-outline',
  search: 'search-outline',
  more: 'ellipsis-horizontal',
  like: 'heart-outline',
  comment: 'chatbubble-outline',
  repost: 'repeat-outline',
  share: 'share-outline',
  bookmark: 'bookmark-outline',
  board: 'grid-outline',
  modules: 'cube-outline',
  marketplace: 'storefront-outline',
  settings: 'settings-outline',
  appearance: 'color-palette-outline',
  accessibility: 'accessibility-outline',
  privacy: 'lock-closed-outline',
  notifications: 'notifications-outline',
  integrations: 'git-network-outline',
  storage: 'archive-outline',
  security: 'shield-checkmark-outline',
  developer: 'terminal-outline',
  account: 'person-outline',
  palette: 'color-fill-outline',
  text: 'text-outline',
  contrast: 'contrast-outline',
  motion: 'pulse-outline',
  reset: 'refresh-outline',
  warning: 'warning-outline',
  info: 'information-circle-outline',
  switch: 'toggle-outline',
  close: 'close-outline',
  back: 'chevron-back',
  photo: 'image-outline',
  camera: 'camera-outline',
  tools: 'construct-outline',
  link: 'link-outline',
  poll: 'stats-chart-outline',
  gif: 'sparkles-outline',
  event: 'calendar-outline',
  automation: 'git-branch-outline',
  people: 'people-outline',
  saved: 'bookmark-outline',
  teams: 'people-circle-outline',
  community: 'planet-outline',
  check: 'checkmark-outline',
  chevronRight: 'chevron-forward',
  play: 'play',
  pause: 'pause',
  skipBack: 'play-back',
  skipForward: 'play-forward',
  send: 'send-outline',
  trash: 'trash-outline',
  arrowUp: 'arrow-up-outline',
  arrowDown: 'arrow-down-outline',
}

type AppIconProps = {
  name: AppIconName
  size?: number
  colour: string
}

export function AppIcon({name, size = 22, colour}: AppIconProps) {
  return <Ionicons name={iconMap[name]} size={size} color={colour} />
}
