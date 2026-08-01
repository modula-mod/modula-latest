import {useMemo, useState, type ReactNode} from 'react'
import {Alert, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {useReelsQuery} from '@/features/reels/data'
import {
  buildAlgorithmMoreActions,
  runReelChromeAction,
} from '@/features/reels/reelActions'
import {
  SettingsSection,
  SettingsToggleRow,
} from '@/features/settings/components/SettingsRows'
import type {ReelItem} from '@/domain/discovery'
import {selectionHaptic} from '@/lib/haptics'
import {ChromeIconMenu} from '@/platform/ui/menus/chrome-icon-menu'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {HEADER_ICON_PAIR_GAP} from '@/platform/ui/navigation/plain-header-items'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/**
 * Reels ranking preferences — local Preview chips + chrome menus.
 * Inspired by IG “Your algorithm”, implemented with Modula primitives.
 */
export function YourAlgorithmScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const reels = useReelsQuery()
  const availableTags = useMemo(() => tagsFromReels(reels.data ?? []), [reels.data])
  const [selectedMoreOf, setSelectedMoreOf] = useState<string[]>([])
  const [lessOf, setLessOf] = useState<string[]>([])
  const [reducePolitical, setReducePolitical] = useState(false)
  const [warnSensitive, setWarnSensitive] = useState(true)

  const moreActions = useMemo(() => buildAlgorithmMoreActions(), [])
  const moreOf = selectedMoreOf.length ? selectedMoreOf : availableTags.slice(0, 5)
  const suggestions = availableTags.filter(tag => !moreOf.includes(tag)).slice(0, 6)
  const algorithmSummary = availableTags.length
    ? 'Reels preferences from your current feed'
    : 'No Reels ranking preferences available'

  const runChrome = (id: string) => {
    runReelChromeAction(id, {
      onPolitical: () => {
        Alert.alert(
          'Political content (Preview)',
          reducePolitical
            ? 'Political topics are currently reduced in your Reels preview. Adjust the toggle below.'
            : 'Political topics use the default mix. Use the toggle below to reduce them.',
        )
      },
      onSensitive: () => {
        Alert.alert(
          'Sensitive content (Preview)',
          warnSensitive
            ? 'Sensitive media shows a warning before playback in Preview. Adjust the toggle below.'
            : 'Sensitive media warnings are off in Preview. Adjust the toggle below.',
        )
      },
      onLearn: () => {
        Alert.alert(
          'Your algorithm (Preview)',
          'Modula ranks Reels from activity, follows, and the interests you tune here. This screen is local Preview — no remote ranking API yet.',
        )
      },
    })
  }

  const toggleMore = (tag: string) => {
    void selectionHaptic()
    setSelectedMoreOf(prev =>
      prev.includes(tag) ? prev.filter(item => item !== tag) : [...prev, tag],
    )
  }

  const addSuggestion = (tag: string) => {
    void selectionHaptic()
    setSelectedMoreOf(prev => (prev.includes(tag) ? prev : [...prev, tag]))
  }

  const addLess = () => {
    void selectionHaptic()
    const fallback = availableTags.find(tag => !lessOf.includes(tag)) ?? null
    if (!fallback) return
    setLessOf(prev => (prev.includes(fallback) ? prev : [...prev, fallback]))
  }

  const chipMenu = (bucket: 'more' | 'less') => [
    {
      id: 'remove',
      label: bucket === 'more' ? 'Remove interest' : 'Remove',
      style: 'destructive' as const,
    },
    {
      id: 'move',
      label: bucket === 'more' ? 'Move to see less' : 'Move to see more',
    },
  ]

  const headerRight = (
    <View style={[styles.headerActions, {gap: HEADER_ICON_PAIR_GAP}]}>
      <ChromeIconMenu
        systemImage="ellipsis"
        icon="more"
        accessibilityLabel="Algorithm options"
        title="Your algorithm"
        actions={moreActions}
        onAction={runChrome}
      />
      <ChromeIconMenu
        systemImage="line.3.horizontal.decrease"
        icon="settings"
        accessibilityLabel="Filter algorithm"
        title="Filters"
        actions={[
          {id: 'political', label: 'Political content'},
          {id: 'sensitive', label: 'Sensitive content'},
          {id: 'contentPrefs', label: 'More content preferences'},
        ]}
        onAction={runChrome}
      />
    </View>
  )

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Your algorithm" right={headerRight} />
      <FeatureErrorBoundary label="Your algorithm">
        <ScrollView
          contentContainerStyle={{
            gap: spacing[5],
            paddingHorizontal: spacing[4],
            paddingBottom: spacing[8],
          }}
          showsVerticalScrollIndicator={false}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="title2">{algorithmSummary}</AppText>
            <AppText variant="caption" colour="textSecondary">
              What you want to see more of. Based on your activity, summarized
              locally ›
            </AppText>
          </View>

          <ChipSection
            title="What you want to see more of"
            tags={moreOf}
            onChipPress={toggleMore}
            chipMenu={chipMenu('more')}
            onChipAction={(tag, id) => {
              if (id === 'remove') {
                setSelectedMoreOf(prev => prev.filter(item => item !== tag))
                return
              }
              if (id === 'move') {
                setSelectedMoreOf(prev => prev.filter(item => item !== tag))
                setLessOf(prev => (prev.includes(tag) ? prev : [...prev, tag]))
              }
            }}
            trailing={
              <>
                {suggestions.map(tag => (
                  <AppPressable
                    key={tag}
                    accessibilityLabel={`Add ${tag}`}
                    onPress={() => addSuggestion(tag)}
                    style={[
                      styles.chip,
                      {
                        borderColor: colours.border,
                        borderRadius: radius.round,
                        borderStyle: 'dashed',
                      },
                    ]}>
                    <AppText variant="label" colour="textSecondary">
                      + {tag}
                    </AppText>
                  </AppPressable>
                ))}
                <AppPressable
                  accessibilityLabel="Add interest"
                  onPress={() => router.push('/discover/interests' as Href)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colours.surfaceRaised,
                      borderColor: colours.border,
                      borderRadius: radius.round,
                    },
                  ]}>
                  <AppText variant="label">+ Add</AppText>
                </AppPressable>
              </>
            }
          />

          <ChipSection
            title="What you want to see less of"
            tags={lessOf}
            onChipPress={tag => {
              void selectionHaptic()
              setLessOf(prev => prev.filter(item => item !== tag))
            }}
            chipMenu={chipMenu('less')}
            onChipAction={(tag, id) => {
              if (id === 'remove') {
                setLessOf(prev => prev.filter(item => item !== tag))
                return
              }
              if (id === 'move') {
                setLessOf(prev => prev.filter(item => item !== tag))
                setSelectedMoreOf(prev => (prev.includes(tag) ? prev : [...prev, tag]))
              }
            }}
            trailing={
              <AppPressable
                accessibilityLabel="Add topic to see less"
                onPress={addLess}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                    borderRadius: radius.round,
                  },
                ]}>
                <AppText variant="label">+ Add</AppText>
              </AppPressable>
            }
          />

          <View style={{marginHorizontal: -spacing[4]}}>
            <SettingsSection title="Content controls">
              <SettingsToggleRow
                label="Reduce political content"
                description="Down-ranks contested political topics in Reels Preview."
                value={reducePolitical}
                onValueChange={setReducePolitical}
                preview
              />
              <SettingsToggleRow
                label="Warn on sensitive media"
                description="Show a confirmation before sensitive Reels play."
                value={warnSensitive}
                onValueChange={setWarnSensitive}
                preview
                last
              />
            </SettingsSection>
          </View>
        </ScrollView>
      </FeatureErrorBoundary>
    </View>
  )
}

function tagsFromReels(reels: ReelItem[]): string[] {
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'you'])
  const tags = new Map<string, number>()
  for (const reel of reels) {
    const words = `${reel.caption} ${reel.source}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
    for (const word of words) {
      const label = word[0].toUpperCase() + word.slice(1)
      tags.set(label, (tags.get(label) ?? 0) + 1)
    }
  }
  return Array.from(tags.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag)
}

function ChipSection({
  title,
  tags,
  onChipPress,
  chipMenu,
  onChipAction,
  trailing,
}: {
  title: string
  tags: string[]
  onChipPress: (tag: string) => void
  chipMenu: {id: string; label: string; style?: 'destructive'}[]
  onChipAction: (tag: string, actionId: string) => void
  trailing?: ReactNode
}) {
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <View style={{gap: spacing[3]}}>
      <AppText variant="headline">{title}</AppText>
      <View style={[styles.wrap, {gap: spacing[2]}]}>
        {tags.map(tag => (
          <ModulaContextMenu
            key={tag}
            accessibilityLabel={`${tag} options`}
            actions={chipMenu}
            onAction={id => onChipAction(tag, id)}>
            <AppPressable
              accessibilityLabel={tag}
              onPress={() => onChipPress(tag)}
              style={[
                styles.chip,
                {
                  backgroundColor: colours.surfaceRaised,
                  borderColor: colours.border,
                  borderRadius: radius.round,
                },
              ]}>
              <AppText variant="label">{tag}</AppText>
            </AppPressable>
          </ModulaContextMenu>
        ))}
        {trailing}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  screen: {
    flex: 1,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
