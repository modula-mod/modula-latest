import {useRouter, type Href} from 'expo-router'
import {View} from 'react-native'

import {ChromeIconMenu} from '@/platform/ui/menus/chrome-icon-menu'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {
  HEADER_ICON_PAIR_GAP,
  plainHeaderCustomItem,
  plainHeaderSpacing,
  supportsPlainHeaderItems,
} from '@/platform/ui/navigation/plain-header-items'

function ProfileShareMenu() {
  const router = useRouter()
  return (
    <ChromeIconMenu
      systemImage="square.and.arrow.up"
      icon="share"
      accessibilityLabel="Share profile"
      title="Share"
      actions={[
        {id: 'share', label: 'Share profile'},
        {id: 'qr', label: 'QR / share sheet — Preview'},
        {id: 'copy', label: 'Copy profile link'},
      ]}
      onAction={id => {
        if (id === 'share' || id === 'qr') {
          router.push('/share-profile' as Href)
        }
      }}
    />
  )
}

function ProfileOverflowMenu() {
  const router = useRouter()
  return (
    <ChromeOverflowMenu
      accessibilityLabel="Open profile actions"
      title="Profile"
      actions={[
        {id: 'edit', label: 'Edit Profile'},
        {id: 'customize', label: 'Customize'},
        {id: 'settings', label: 'Settings'},
      ]}
      onAction={id => {
        if (id === 'edit') router.push('/profile/edit' as Href)
        if (id === 'customize') router.push('/profile/customize' as Href)
        if (id === 'settings') router.push('/settings' as Href)
      }}
    />
  )
}

/** Android / web fallback — one slot (may share a capsule on older paths). */
export function ProfileHeaderRight() {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
      <ProfileShareMenu />
      <ProfileOverflowMenu />
    </View>
  )
}

/** iOS 26+: share and more as separate plain items with a real gap. */
export function profileHeaderRightItems() {
  if (!supportsPlainHeaderItems()) return undefined
  return [
    plainHeaderCustomItem(<ProfileShareMenu />),
    plainHeaderSpacing(),
    plainHeaderCustomItem(<ProfileOverflowMenu />),
  ]
}
