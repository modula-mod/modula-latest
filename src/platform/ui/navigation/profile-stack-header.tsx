import {useRouter, type Href} from 'expo-router'
import {View} from 'react-native'

import {ChromeIconMenu} from '@/platform/ui/menus/chrome-icon-menu'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'

export function ProfileHeaderRight() {
  const router = useRouter()

  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 2}}>
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
    </View>
  )
}
