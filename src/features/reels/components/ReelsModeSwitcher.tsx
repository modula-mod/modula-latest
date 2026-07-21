import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {ModulaProfile} from '@/features/profile/contracts'

export type ReelsFeedMode = 'reels' | 'friends'

type ReelsModeSwitcherProps = {
  mode: ReelsFeedMode
  onChange: (mode: ReelsFeedMode) => void
  friendFaces?: ModulaProfile[]
}

/**
 * Immersive Reels | Friends title control — media-overlay colours, no cards.
 */
export function ReelsModeSwitcher({
  mode,
  onChange,
  friendFaces = [],
}: ReelsModeSwitcherProps) {
  const {colours, spacing} = useThemeTokens()
  const faces = friendFaces.slice(0, 3)

  return (
    <View style={[styles.row, {gap: spacing[3]}]}>
      {(['reels', 'friends'] as const).map(next => {
        const selected = mode === next
        const label = next === 'reels' ? 'Reels' : 'Friends'
        return (
          <AppPressable
            key={next}
            accessibilityLabel={`${label}${selected ? ', selected' : ''}`}
            accessibilityRole="button"
            accessibilityState={{selected}}
            onPress={() => {
              if (selected) return
              void selectionHaptic()
              onChange(next)
            }}
            style={styles.tab}>
            <View style={[styles.tabInner, {gap: spacing[1]}]}>
              <AppText
                variant="headline"
                style={{
                  color: selected
                    ? colours.mediaOverlayText
                    : colours.mediaOverlaySecondary,
                  opacity: selected ? 1 : 0.72,
                }}>
                {label}
              </AppText>
              {next === 'friends' && faces.length > 0 ? (
                <View style={styles.faces}>
                  {faces.map((face, index) => (
                    <View
                      key={face.id}
                      style={[
                        styles.face,
                        {
                          marginLeft: index === 0 ? 0 : -8,
                          zIndex: faces.length - index,
                          borderColor: 'rgba(0,0,0,0.55)',
                        },
                      ]}>
                      <Avatar
                        name={face.displayName}
                        uri={face.avatarUri}
                        colour={face.coverColour}
                        size={18}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            <View
              style={[
                styles.underline,
                {
                  backgroundColor: selected ? colours.mediaOverlayText : 'transparent',
                },
              ]}
            />
          </AppPressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  face: {
    borderRadius: 999,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  faces: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  tab: {
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 4,
  },
  tabInner: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  underline: {
    borderRadius: 1,
    height: 2,
    marginTop: 4,
    width: '100%',
  },
})
