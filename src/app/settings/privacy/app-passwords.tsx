import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {AppButton} from '@/components/primitives/AppButton'
import {stubAction} from '@/lib/stubAction'
import {useTheme} from '@/theme/runtime/useTheme'

export default function Screen() {
  const {spacing} = useTheme()
  return (
    <AppScreen scroll>
      <AppText variant="title">App passwords</AppText>
      <AppText colour="textSecondary" style={{marginTop: spacing.sm, marginBottom: spacing.lg}}>
        App passwords and device tokens will appear here after auth.
      </AppText>
      <AppButton variant="secondary" onPress={() => stubAction('App passwords')}>
        Coming soon
      </AppButton>
    </AppScreen>
  )
}
