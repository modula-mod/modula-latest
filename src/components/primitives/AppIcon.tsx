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
  | 'send'
  | 'trash'

type IoniconName = ComponentProps<typeof Ionicons>['name']

const iconMap: Record<AppIconName, IoniconName> = {
  home: 'home-outline',
  discover: 'compass-outline',
  create: 'add',
  activity: 'heart-outline',
  profile: 'person-circle-outline',
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
  send: 'send-outline',
  trash: 'trash-outline',
}

type AppIconProps = {
  name: AppIconName
  size?: number
  colour: string
}

export function AppIcon({name, size = 22, colour}: AppIconProps) {
  return <Ionicons name={iconMap[name]} size={size} color={colour} />
}
