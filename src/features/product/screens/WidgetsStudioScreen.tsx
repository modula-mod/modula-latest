import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const WIDGETS: Array<{name: string; icon: AppIconName; size: string}> = [
  {name: 'Tasks', icon: 'check', size: '1×1'},
  {name: 'Calendar', icon: 'event', size: '2×1'},
  {name: 'CRM pipeline', icon: 'people', size: '2×2'},
  {name: 'Notes', icon: 'saved', size: '1×1'},
  {name: 'Wallet', icon: 'security', size: '1×1'},
  {name: 'AI summary', icon: 'automation', size: '2×1'},
  {name: 'Team activity', icon: 'teams', size: '2×1'},
  {name: 'Recent files', icon: 'storage', size: '1×1'},
]

export function WidgetsStudioScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Widgets" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Lightweight blocks for Board & profiles.</AppText>
            <AppText variant="body" colour="textSecondary">
              Widgets install independently of full modules. Arrangement Preview — not persisted.
            </AppText>
          </View>

          <View style={[styles.grid, {gap: spacing[3]}]}>
            {WIDGETS.map(widget => (
              <Surface
                key={widget.name}
                variant="contained"
                style={[
                  styles.card,
                  {
                    padding: spacing[4],
                    gap: spacing[2],
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    minHeight: widget.size.startsWith('2×2') ? 160 : 120,
                    flexBasis: widget.size.startsWith('2') ? '100%' : '47%',
                  },
                ]}>
                <AppIcon name={widget.icon} colour={colours.accent} />
                <AppText variant="headline">{widget.name}</AppText>
                <AppText variant="caption" colour="textTertiary">
                  {widget.size} · Preview
                </AppText>
              </Surface>
            ))}
          </View>

          <AppButton onPress={() => router.push('/board' as Href)}>Place on Board</AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  card: {borderWidth: StyleSheet.hairlineWidth, flexGrow: 1, minWidth: 140},
})
