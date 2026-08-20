/**
 * Inverted (concave) radii — distinct from convex `radius`.
 *
 * Convex corners round a surface outward. Inverted corners cut into a surface
 * so a neighbouring object (avatar, media tray, selected metric) can sit in
 * the silhouette. Do not reuse `radius.lg` for a cutout.
 */
export const inverted = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  profile: 36,
} as const

export type InvertedRadiusToken = keyof typeof inverted
