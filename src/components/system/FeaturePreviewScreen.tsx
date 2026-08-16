import type {ReactNode} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {shareModulaText} from '@/platform/ui/share/share-modula-text'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type FeaturePreviewCard = {
  title: string
  description: string
  icon: AppIconName
  actionLabel?: string
  onPress?: () => void
}

type FeaturePreviewScreenProps = {
  title: string
  description: string
  cards: FeaturePreviewCard[]
  aside?: ReactNode
}

export function FeaturePreviewScreen({
  title,
  description,
  cards,
  aside,
}: FeaturePreviewScreenProps) {
  const {spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()

  return (
    <View style={styles.screen}>
      <SecondaryScreenHeader
        title={title}
        onShare={() =>
          void shareModulaText({
            title,
            message: description,
          })
        }
      />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5], paddingBottom: tabPadding}]}
          keyboardShouldPersistTaps="handled">
          <AppText variant="body" colour="textSecondary">
            {description}
          </AppText>
          <View style={{gap: spacing[3]}}>
            {cards.map(card => (
              <PreviewCard key={card.title} card={card} />
            ))}
          </View>
          {aside}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

function PreviewCard({card}: {card: FeaturePreviewCard}) {
  const {colours, radius, spacing} = useThemeTokens()

  return (
    <Surface
      variant="contained"
      style={[styles.card, {gap: spacing[3], padding: spacing[4]}]}>
      <View
        style={[
          styles.icon,
          {
            backgroundColor: colours.accentSubtle,
            borderRadius: radius.medium,
          },
        ]}>
        <AppIcon name={card.icon} colour={colours.accent} size={22} />
      </View>
      <View style={styles.cardBody}>
        <AppText variant="headline">{card.title}</AppText>
        <AppText variant="body" colour="textSecondary">
          {card.description}
        </AppText>
      </View>
      {card.actionLabel ? (
        <AppPressable
          accessibilityLabel={card.actionLabel}
          onPress={card.onPress}
          style={[
            styles.action,
            {
              backgroundColor: colours.surfaceMuted,
              borderColor: colours.border,
              borderRadius: radius.round,
            },
          ]}>
          <AppText variant="label">{card.actionLabel}</AppText>
        </AppPressable>
      ) : null}
    </Surface>
  )
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  card: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  cardBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  icon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  screen: {
    flex: 1,
  },
})
