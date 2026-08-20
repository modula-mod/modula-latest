import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {PollPostContent} from '@/features/social/posts/types/post'
import {PostSurface} from '@/features/social/posts/components/post-surface'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function PollPostRenderer({content}: {content: PollPostContent}) {
  const {colours, spacing} = useThemeTokens()
  const [choice, setChoice] = useState<number | null>(content.viewerChoice ?? null)
  const total =
    content.totalVotes ??
    content.voteCounts?.reduce((sum, value) => sum + value, 0) ??
    content.poll.options.length * 120

  const percentages = useMemo(() => {
    if (!content.voteCounts?.length) {
      return content.poll.options.map((_, index) =>
        choice === index ? 100 : Math.max(8, 30 - index * 6),
      )
    }
    return content.voteCounts.map(count => Math.round((count / Math.max(total, 1)) * 100))
  }, [choice, content.poll.options, content.voteCounts, total])

  return (
    <View style={[styles.root, {padding: spacing[4]}]}>
      <PostSurface
        role="context"
        style={[
          styles.card,
          {
            borderColor: colours.borderStrong,
            gap: spacing[3],
            padding: spacing[4],
          },
        ]}>
        <AppText variant="headline" style={{color: colours.mediaOverlayText}}>
          {content.poll.question}
        </AppText>
        {content.poll.options.map((option, index) => {
          const voted = choice !== null
          const pct = percentages[index] ?? 0
          return (
            <AppPressable
              key={option}
              accessibilityLabel={option}
              accessibilityState={{selected: choice === index}}
              onPress={() => setChoice(index)}
              style={[
                styles.option,
                {
                  backgroundColor: colours.mediaOverlayControlBackground,
                  borderColor: choice === index ? colours.accent : colours.borderStrong,
                  overflow: 'hidden',
                },
              ]}>
              {voted ? (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: colours.accentSubtle,
                      width: `${pct}%`,
                    },
                  ]}
                />
              ) : null}
              <AppText variant="label" style={{color: colours.mediaOverlayText, zIndex: 1}}>
                {option}
              </AppText>
              {voted ? (
                <AppText variant="caption" style={{color: colours.mediaOverlaySecondary, zIndex: 1}}>
                  {pct}%
                </AppText>
              ) : null}
            </AppPressable>
          )
        })}
        <AppText variant="caption" style={{color: colours.mediaOverlaySecondary}}>
          {total.toLocaleString()} votes · {content.hoursLeft ?? 18}h left
        </AppText>
      </PostSurface>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    justifyContent: 'center',
  },
  option: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 14,
  },
  root: {
    ...StyleSheet.absoluteFill,
  },
})
