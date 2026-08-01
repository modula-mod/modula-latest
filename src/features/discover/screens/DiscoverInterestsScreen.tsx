import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {EmptyState} from '@/components/primitives/EmptyState'
import {useDiscoverQuery} from '@/features/discover/data'
import {selectionHaptic} from '@/lib/haptics'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Interests editor sheet — Preview local selection only. */
export function DiscoverInterestsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const discover = useDiscoverQuery()
  const options = useMemo(
    () => (discover.data?.trendingTopics ?? []).map(topic => topic.label),
    [discover.data?.trendingTopics],
  )
  const [selected, setSelected] = useState<string[]>([])

  const visibleSelected = selected.filter(interest => options.includes(interest))

  return (
    <View style={{flex: 1, backgroundColor: colours.canvas}}>
      <ModulaSheet
        isPresented
        onDismiss={() => (router.canGoBack() ? router.back() : router.replace('/discover'))}
        snapPoints={['half', 'full']}
        testID="interests-editor-sheet">
        <ScrollView contentContainerStyle={{gap: spacing[3], paddingBottom: spacing[6]}}>
          <AppText variant="headline">Edit interests</AppText>
          <AppText variant="caption" colour="textSecondary">
            Interests are derived from indexed Discover topics.
          </AppText>
          {options.length ? (
            <View style={[styles.wrap, {gap: spacing[2]}]}>
              {options.map(interest => {
                const on = visibleSelected.includes(interest)
                return (
                  <AppPressable
                    key={interest}
                    accessibilityLabel={`${interest}${on ? ', selected' : ''}`}
                    accessibilityState={{selected: on}}
                    onPress={() => {
                      void selectionHaptic()
                      setSelected(prev =>
                        on ? prev.filter(item => item !== interest) : [...prev, interest],
                      )
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: on ? colours.accentSubtle : colours.surfaceRaised,
                        borderColor: on ? colours.accent : colours.border,
                        borderRadius: radius.round,
                      },
                    ]}>
                    <AppText variant="label" style={{color: on ? colours.accent : colours.text}}>
                      {interest}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
          ) : (
            <EmptyState
              icon="discover"
              title="No indexed interests"
              description="The Discover service has not returned any topics to tune."
            />
          )}
          <AppPressable
            accessibilityLabel="Done editing interests"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/discover'))}
            style={[
              styles.done,
              {backgroundColor: colours.accent, borderRadius: radius.round},
            ]}>
            <AppText variant="label" style={{color: colours.accentForeground}}>
              Done
            </AppText>
          </AppPressable>
        </ScrollView>
      </ModulaSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  done: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
