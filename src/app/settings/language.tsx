import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {AppButton} from '@/components/primitives/AppButton'
import {stubAction} from '@/lib/stubAction'
import {useTheme} from '@/theme/runtime/useTheme'

export default function Screen() {
  const {spacing} = useTheme()
  return (
    <AppScreen scroll>
      <AppText variant="title">Languages</AppText>
      <AppText colour="textSecondary" style={{marginTop: spacing.sm, marginBottom: spacing.lg}}>
        App language and content translation preferences.
      </AppText>
      <AppButton variant="secondary" onPress={() => stubAction('Languages')}>
        Coming soon
      </AppButton>
    </AppScreen>
  )
}
