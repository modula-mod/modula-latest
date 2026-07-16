import {useRouter, type Href} from 'expo-router'
import {Pressable} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProfileHeaderRight() {
  const router = useRouter()
  const {colours} = useThemeTokens()

  return (
    <>
      <Pressable
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
        style={{
          alignItems: 'center',
          height: 44,
          justifyContent: 'center',
          width: 44,
        }}>
        <AppIcon name="share" colour={colours.textSecondary} size={22} />
      </Pressable>
      <Pressable
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
        style={{
          alignItems: 'center',
          height: 44,
          justifyContent: 'center',
          width: 44,
        }}>
        <AppIcon name="more" colour={colours.textSecondary} size={22} />
      </Pressable>
    </>
  )
}
