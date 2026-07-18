import {useRouter, type Href} from 'expo-router'
import {View} from 'react-native'

import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'

export function ProfileHeaderRight() {
  const router = useRouter()

  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 2}}>
      <ModulaMenu
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
        trigger={
          <ModulaIconButton
            icon="share"
            accessibilityLabel="Share profile"
            chrome="glass"
          />
        }
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
