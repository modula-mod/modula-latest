import {useRouter, type Href} from 'expo-router'
import {View} from 'react-native'

import {ChromeCircleButton} from '@/components/primitives/ChromeCircleButton'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'

export function ProfileHeaderRight() {
  const router = useRouter()

  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
      <ChromeCircleButton
        icon="share"
        accessibilityLabel="Share profile"
        onPress={() => {
          void presentModulaActions({
            title: 'Share',
            actions: [
              {id: 'share', label: 'Share profile'},
              {id: 'qr', label: 'QR / share sheet — Preview'},
              {id: 'copy', label: 'Copy profile link'},
            ],
          }).then(id => {
            if (id === 'share' || id === 'qr') {
              router.push('/share-profile' as Href)
            }
          })
        }}
      />
      <ChromeCircleButton
        icon="more"
        accessibilityLabel="Open profile actions"
        onPress={() => {
          void presentModulaActions({
            title: 'Profile',
            actions: [
              {id: 'edit', label: 'Edit Profile'},
              {id: 'customize', label: 'Customize'},
              {id: 'settings', label: 'Settings'},
            ],
          }).then(id => {
            if (id === 'edit') router.push('/profile/edit' as Href)
            if (id === 'customize') router.push('/profile/customize' as Href)
            if (id === 'settings') router.push('/settings' as Href)
          })
        }}
      />
    </View>
  )
}
