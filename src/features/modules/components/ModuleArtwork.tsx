import {StyleSheet, View} from 'react-native'
import Svg, {Circle, Line, Path, Rect} from 'react-native-svg'

import {AppText} from '@/components/primitives/AppText'
import {
  moduleArtworkPack,
  type ModuleArtworkKind,
  type ModuleArtworkPack,
} from '@/features/modules/identity/moduleArtwork'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModuleArtwork({
  moduleId,
  name,
  size = 64,
  variant = 'icon',
}: {
  moduleId: string
  name?: string
  size?: number
  variant?: 'icon' | 'hero'
}) {
  const pack = moduleArtworkPack(moduleId, name)
  const width = variant === 'hero' ? size * 1.6 : size
  const height = variant === 'hero' ? size : size
  return (
    <View
      accessibilityLabel={`${pack.name} artwork`}
      style={[
        styles.frame,
        {
          width,
          height,
          backgroundColor: pack.palette.wash,
          borderRadius: variant === 'hero' ? 18 : 14,
        },
      ]}>
      <ArtworkMark pack={pack} kind={pack.kind} size={Math.min(width, height)} />
    </View>
  )
}

function ArtworkMark({
  pack,
  kind,
  size,
}: {
  pack: ModuleArtworkPack
  kind: ModuleArtworkKind
  size: number
}) {
  const inset = size * 0.18
  const w = size - inset * 2
  const {ink, paper, stitch} = pack.palette
  if (kind === 'vault-notes') {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect x="14" y="12" width="36" height="42" rx="3" fill={paper} />
        <Path d="M14 12 L28 12 L28 22 L14 18 Z" fill={pack.palette.wash} />
        <Line x1="22" y1="30" x2="42" y2="30" stroke={ink} strokeWidth="1.4" strokeLinecap="round" />
        <Line x1="22" y1="36" x2="38" y2="36" stroke={ink} strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
        <Line x1="22" y1="42" x2="40" y2="42" stroke={ink} strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
        <Path
          d="M44 40 C44 34 38 32 38 38 C38 42 44 42 44 46"
          stroke={stitch ?? ink}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    )
  }
  if (kind === 'tasks') {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect x="16" y="14" width="32" height="36" rx="4" fill={paper} />
        <Path d="M22 26 L26 30 L34 22" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />
        <Line x1="22" y1="38" x2="42" y2="38" stroke={ink} strokeWidth="1.4" opacity="0.45" />
        <Line x1="22" y1="44" x2="36" y2="44" stroke={ink} strokeWidth="1.4" opacity="0.3" />
      </Svg>
    )
  }
  if (kind === 'crm') {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Rect x="12" y="22" width="28" height="18" rx="2" fill={paper} stroke={ink} strokeWidth="1" />
        <Rect x="24" y="28" width="28" height="18" rx="2" fill={pack.palette.wash} stroke={ink} strokeWidth="1" />
      </Svg>
    )
  }
  if (kind === 'gaia') {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Path d="M18 44 L28 18 L46 22 L40 48 Z" fill={paper} />
        <Path d="M28 18 L34 34 L18 44" stroke={ink} strokeWidth="1.2" fill="none" />
        <Path d="M34 34 L46 22" stroke={ink} strokeWidth="1.2" fill="none" />
      </Svg>
    )
  }
  if (kind === 'avatar-studio') {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Circle cx="32" cy="32" r="18" stroke={ink} strokeWidth="1.4" fill="none" />
        <Circle cx="32" cy="28" r="6" fill={paper} />
        <Path d="M22 42 C24 36 40 36 42 42" stroke={paper} strokeWidth="2" fill="none" />
      </Svg>
    )
  }
  if (kind === 'gubic') {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Path d="M32 12 L52 32 L32 52 L12 32 Z" fill={paper} stroke={ink} strokeWidth="1.2" />
      </Svg>
    )
  }
  return (
    <View style={[styles.fallback, {width: w, height: w, borderColor: ink}]}>
      <AppText variant="headline" style={{color: ink}}>
        {pack.name.slice(0, 1).toUpperCase()}
      </AppText>
    </View>
  )
}

export function ModuleArtworkTitle({moduleId, name}: {moduleId: string; name?: string}) {
  const pack = moduleArtworkPack(moduleId, name)
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[1]}}>
      <AppText variant="display">{pack.name}</AppText>
      <AppText variant="caption" colour="textSecondary">
        by {pack.publisher}
      </AppText>
      {pack.tagline ? (
        <AppText variant="body" colour="textSecondary">
          {pack.tagline}
        </AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
})
