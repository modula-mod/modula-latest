import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const AGENTS: Array<{name: string; icon: AppIconName; scope: string}> = [
  {name: 'Summariser', icon: 'text', scope: 'Feed · Notes · Files'},
  {name: 'Scheduler', icon: 'event', scope: 'Calendar · Tasks'},
  {name: 'CRM Analyst', icon: 'people', scope: 'CRM module only'},
  {name: 'Content Assistant', icon: 'create', scope: 'Composer · Drafts'},
  {name: 'Automation Agent', icon: 'automation', scope: 'Approved workflows'},
  {name: 'Research Agent', icon: 'search', scope: 'Explicit queries'},
]

export function GaiaConsoleScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Gaia" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Intelligence with permission.</AppText>
            <AppText variant="body" colour="textSecondary">
              Gaia is planned. Agents below are directional — none run models or read private data in
              this build.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.banner,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.medium,
                backgroundColor: colours.accentSubtle,
              },
            ]}>
            <AppText variant="label">Permission rule</AppText>
            <AppText variant="caption" colour="textSecondary">
              Gaia must never silently access unrelated profile, module, or private storage.
            </AppText>
          </Surface>

          <View style={[styles.grid, {gap: spacing[3]}]}>
            {AGENTS.map(agent => (
              <Surface
                key={agent.name}
                variant="contained"
                style={[
                  styles.card,
                  {
                    padding: spacing[4],
                    gap: spacing[2],
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <AppIcon name={agent.icon} colour={colours.accent} />
                <AppText variant="headline">{agent.name}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  Scope · {agent.scope}
                </AppText>
                <AppText variant="caption" colour="textTertiary">
                  Status · Planned
                </AppText>
              </Surface>
            ))}
          </View>

          <AppButton onPress={() => router.push('/product/gaia-atlas' as Href)}>
            Open Gaia Atlas preview
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product' as Href)}>
            Back to capabilities
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  banner: {},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 150,
  },
})
