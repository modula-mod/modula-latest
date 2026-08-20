import {StyleSheet, View, useWindowDimensions} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {
  DEFAULT_PROFILE_VISIBILITY,
  PROFILE_VISIBILITY_LABELS,
  canViewerSeeProfileField,
  type ModulaProfile,
  type ProfileViewerContext,
} from '@/features/profile/contracts/profile'
import {openSafeExternalUrl} from '@/lib/safeExternalUrl'
import {PROFILE_LAYOUT} from '@/features/profile/model/profile-layout'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type MetadataCell = {
  key: string
  icon: ModulaIconName
  label: string
  accessibilityLabel: string
  onPress?: () => void
}

type ProfileMetadataGridProps = {
  profile: ModulaProfile
  viewer: ProfileViewerContext
  /** Owner visibility on the hero About page. The About tab still holds the full copy. */
  includeVisibility?: boolean
}

/**
 * Compact identity metadata. Two columns at normal width, no settings cards.
 * Missing fields collapse — never leave empty boxes.
 */
export function ProfileMetadataGrid({
  profile,
  viewer,
  includeVisibility = false,
}: ProfileMetadataGridProps) {
  const {colours, spacing} = useThemeTokens()
  const {fontScale} = useWindowDimensions()
  const cells = metadataCells(profile, viewer, includeVisibility)
  const stacked = fontScale >= PROFILE_LAYOUT.stackedFontScale
  const rows = stacked ? cells.map(cell => [cell]) : chunkPairs(cells)

  if (!cells.length) return null

  const hairline = StyleSheet.hairlineWidth
  const divider = colours.separator

  return (
    <View
      accessibilityRole="summary"
      style={styles.wrap}
      testID="profile-metadata-grid">
      {rows.map((row, rowIndex) => (
        <View key={row.map(cell => cell.key).join('-')} style={styles.rowBlock}>
          {rowIndex > 0 ? (
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={[styles.horizontalRule, {backgroundColor: divider, height: hairline}]}
            />
          ) : null}
          <View style={styles.row}>
            {row.map((cell, index) => (
              <View key={cell.key} style={styles.cellSlot}>
                {index > 0 ? (
                  <View
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                    style={[styles.verticalRule, {backgroundColor: divider, width: hairline}]}
                  />
                ) : null}
                <MetadataCellView cell={cell} gap={spacing[1]} />
              </View>
            ))}
          </View>
        </View>
      ))}
      {viewer.relationship !== 'owner' && profile.followsViewer ? (
        <AppText variant="caption" colour="textSecondary">
          Follows you
        </AppText>
      ) : null}
    </View>
  )
}

function MetadataCellView({
  cell,
  gap,
}: {
  cell: MetadataCell
  gap: number
}) {
  const {colours} = useThemeTokens()
  const body = (
    <View
      accessibilityElementsHidden={Boolean(cell.onPress)}
      importantForAccessibility={cell.onPress ? 'no-hide-descendants' : 'auto'}
      style={[styles.cell, {gap}]}>
      <ModulaIcon name={cell.icon} colour={colours.textSecondary} size={13} />
      <AppText variant="caption" colour="textSecondary" numberOfLines={2} style={styles.label}>
        {cell.label}
      </AppText>
    </View>
  )

  if (!cell.onPress) {
    return (
      <View accessibilityRole="text" accessibilityLabel={cell.accessibilityLabel} style={styles.press}>
        {body}
      </View>
    )
  }

  return (
    <AppPressable
      accessibilityLabel={cell.accessibilityLabel}
      accessibilityRole="link"
      onPress={cell.onPress}
      style={styles.press}>
      {body}
    </AppPressable>
  )
}

function metadataCells(
  profile: ModulaProfile,
  viewer: ProfileViewerContext,
  includeVisibility: boolean,
): MetadataCell[] {
  const locationVisible =
    profile.location &&
    canViewerSeeProfileField(profile.location.visibility, viewer.relationship)
  const websiteVisible =
    profile.website &&
    canViewerSeeProfileField(profile.website.visibility, viewer.relationship)
  const joined = new Date(profile.joinedAt).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })
  const joinedLong = new Date(profile.joinedAt).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const cells: MetadataCell[] = [
    {
      key: 'joined',
      icon: 'clock',
      label: `Joined ${joined}`,
      accessibilityLabel: `Joined ${joinedLong}`,
    },
  ]

  if (locationVisible && profile.location) {
    cells.push({
      key: 'location',
      icon: 'community',
      label: profile.location.label,
      accessibilityLabel: `Location ${profile.location.label}`,
    })
  }

  if (websiteVisible && profile.website) {
    const domain = profile.website.domain
    cells.push({
      key: 'website',
      icon: 'link',
      label: domain,
      accessibilityLabel: `Website ${domain}${profile.website.url ? `, ${profile.website.url}` : ''}`,
      onPress: () => void openSafeExternalUrl(profile.website?.url ?? ''),
    })
  }

  if (includeVisibility && viewer.relationship === 'owner') {
    const visibility = DEFAULT_PROFILE_VISIBILITY
    const visibilityLabel = PROFILE_VISIBILITY_LABELS[visibility]
    cells.push({
      key: 'visibility',
      icon: 'eye',
      label: visibilityLabel,
      accessibilityLabel: `Profile visibility ${visibilityLabel}`,
    })
  }

  return cells
}

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += 2) {
    rows.push(items.slice(index, index + 2))
  }
  return rows
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minHeight: 22,
    minWidth: 0,
  },
  cellSlot: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  horizontalRule: {
    marginVertical: 6,
    opacity: 0.7,
    width: '100%',
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  press: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    minWidth: 0,
  },
  rowBlock: {
    minWidth: 0,
  },
  verticalRule: {
    alignSelf: 'stretch',
    marginHorizontal: 8,
    opacity: 0.7,
  },
  wrap: {
    minWidth: 0,
  },
})
