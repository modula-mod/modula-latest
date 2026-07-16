import {ScrollView, StyleSheet} from 'react-native'
import {router} from 'expo-router'
import {SafeAreaView} from 'react-native-safe-area-context'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ScreenHeader} from '@/shell/ScreenHeader'
import {useTheme} from '@/theme/runtime/useTheme'

const BOARD_CARDS = [
  {id: 'vault', title: 'Vault Notes', subtitle: 'Private notes module'},
  {id: 'tasks', title: 'Tasks', subtitle: 'Personal task surface'},
  {id: 'crm', title: 'CRM', subtitle: 'Relationships module'},
  {id: 'modules', title: 'Modules', subtitle: 'Installed capabilities'},
  {id: 'marketplace', title: 'Marketplace', subtitle: 'Discover extensions'},
  {id: 'settings', title: 'Settings', subtitle: 'Account and appearance'},
] as const

export default function BoardScreen() {
  const {colours, spacing, radius} = useTheme()

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colours.canvas}} edges={['top']}>
      <ScreenHeader
        title="Board"
        right={
          <AppPressable onPress={() => router.push('/settings')}>
            <AppText colour="accent">Settings</AppText>
          </AppPressable>
        }
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxxl,
          gap: spacing.md,
        }}>
        <AppText variant="caption" colour="textSecondary">
          Personal OS surface — cards foreshadow modules without a module host yet.
        </AppText>
        {BOARD_CARDS.map(card => (
          <AppPressable
            key={card.id}
            onPress={() => {
              if (card.id === 'settings') {
                router.push('/settings')
                return
              }
              if (card.id === 'modules') {
                router.push('/settings/modules')
                return
              }
              if (card.id === 'marketplace') {
                router.push('/settings/marketplace')
                return
              }
              router.push({
                pathname: '/coming-soon',
                params: {title: card.title},
              })
            }}
            style={[
              styles.card,
              {
                backgroundColor: colours.surfaceRaised,
                borderColor: colours.border,
                borderRadius: radius.lg,
                padding: spacing.lg,
              },
            ]}>
            <AppText variant="label">{card.title}</AppText>
            <AppText variant="caption" colour="textSecondary">
              {card.subtitle}
            </AppText>
          </AppPressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 4,
  },
})
