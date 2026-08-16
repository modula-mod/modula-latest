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
  sceneHeight,
}: {
  moduleId: string
  name?: string
  size?: number
  variant?: 'icon' | 'hero' | 'scene'
  sceneHeight?: number
}) {
  const pack = moduleArtworkPack(moduleId, name)
  if (variant === 'scene') {
    return (
      <View
        accessibilityLabel={`${pack.name} artwork`}
        style={[
          styles.scene,
          {backgroundColor: pack.palette.wash, height: sceneHeight ?? 210},
        ]}>
        <ArtworkScene pack={pack} kind={pack.kind} />
      </View>
    )
  }
  const width = variant === 'hero' ? size * 1.6 : size
  const height = size
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

function ArtworkScene({pack, kind}: {pack: ModuleArtworkPack; kind: ModuleArtworkKind}) {
  const {ink, paper, wash, stitch} = pack.palette
  if (kind === 'vault-notes') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
        <Rect x="0" y="0" width="320" height="180" fill={wash} />
        <Path d="M0 128 C80 108 160 148 320 118 L320 180 L0 180 Z" fill={paper} opacity="0.35" />
        <Rect x="168" y="36" width="118" height="132" rx="8" fill={wash} stroke={ink} strokeWidth="1" opacity="0.55" />
        <Path
          d="M48 28 H168 C176 28 182 34 182 42 V156 C182 164 176 170 168 170 H62 C54 170 48 164 48 156 V48 L68 28 Z"
          fill={paper}
        />
        <Path d="M48 48 H68 V28" fill="none" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
        <Path d="M78 64 H158" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        <Path d="M78 80 H148" stroke={ink} strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
        <Path d="M78 96 H154" stroke={ink} strokeWidth="1.6" strokeLinecap="round" opacity="0.4" />
        <Path d="M78 112 H132" stroke={ink} strokeWidth="1.6" strokeLinecap="round" opacity="0.28" />
        <Path
          d="M138 128 C138 118 150 116 154 126 C158 138 138 138 138 150"
          stroke={stitch ?? ink}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <Path d="M196 58 H262" stroke={ink} strokeWidth="1.4" opacity="0.25" strokeLinecap="round" />
        <Path d="M196 74 H248" stroke={ink} strokeWidth="1.4" opacity="0.18" strokeLinecap="round" />
      </Svg>
    )
  }
  if (kind === 'tasks') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">
        <Rect width="320" height="180" fill={wash} />
        <Rect x="58" y="28" width="204" height="124" rx="10" fill={paper} />
        <Path d="M84 62 L96 74 L118 50" stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <Line x1="84" y1="96" x2="228" y2="96" stroke={ink} strokeWidth="1.6" opacity="0.4" />
        <Line x1="84" y1="118" x2="196" y2="118" stroke={ink} strokeWidth="1.6" opacity="0.25" />
      </Svg>
    )
  }
  return (
    <View style={[styles.sceneFallback, {borderColor: ink}]}>
      <ArtworkMark pack={pack} kind={kind} size={96} />
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
        <Rect x="18" y="16" width="30" height="36" rx="3" fill={pack.palette.wash} />
        <Path d="M12 14 H40 C42 14 44 16 44 18 V50 C44 52 42 54 40 54 H16 C14 54 12 52 12 50 V20 L18 14 Z" fill={paper} />
        <Path d="M12 20 H18 V14" fill="none" stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        <Path d="M22 28 H38" stroke={ink} strokeWidth="1.3" strokeLinecap="round" />
        <Path d="M22 34 H34" stroke={ink} strokeWidth="1.15" strokeLinecap="round" opacity="0.55" />
        <Path d="M22 40 H36" stroke={ink} strokeWidth="1.15" strokeLinecap="round" opacity="0.35" />
        <Path
          d="M36 44 C36 40 40 39 41 43 C42 47 36 47 36 51"
          stroke={stitch ?? ink}
          strokeWidth="1.5"
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
  scene: {
    height: 210,
    overflow: 'hidden',
    width: '100%',
  },
  sceneFallback: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
})
