import type {MaterialTokens, SemanticColours, SurfaceRole} from '@/theme/contracts'

const ROLE_RADIUS: Record<SurfaceRole, number> = {
  canvas: 0,
  navigation: 0,
  content: 0,
  post: 0,
  card: 14,
  floating: 18,
  input: 16,
  modal: 24,
  media: 40,
  control: 999,
}

export function createSolidMaterial(
  role: SurfaceRole,
  colours: SemanticColours,
): MaterialTokens {
  const backgroundColor =
    role === 'canvas'
      ? colours.canvas
      : role === 'content' || role === 'post'
        ? colours.canvas
        : role === 'navigation' || role === 'modal'
          ? colours.surface1
          : role === 'input' || role === 'control'
            ? colours.surface2
            : colours.surface1

  return {
    backgroundColor,
    foregroundColor: colours.textMain,
    borderColor: role === 'post' ? colours.separator : colours.border,
    borderWidth: role === 'canvas' || role === 'content' ? 0 : 1,
    radius: ROLE_RADIUS[role],
    opacity: 1,
    blurIntensity: 0,
    blurTint: 'default',
    useNativeGlass: false,
    shadowColor: colours.shadow,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffsetY: 0,
    elevation: 0,
    innerHighlightColor: colours.surfaceOverlay,
    innerHighlightOpacity: 0,
    pressOpacity: 0.82,
    pressScale: 0.98,
  }
}
