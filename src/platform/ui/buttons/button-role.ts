export type ModulaButtonRole =
  | 'primary'
  | 'secondary'
  | 'quiet'
  | 'plain'
  | 'destructive'
  | 'glass'
  | 'icon'

/** Maps Modula roles to `@expo/ui` universal Button variants. */
export function universalVariantForRole(
  role: ModulaButtonRole,
): 'filled' | 'outlined' | 'text' {
  switch (role) {
    case 'primary':
    case 'destructive':
      return 'filled'
    case 'secondary':
    case 'glass':
      return 'outlined'
    case 'quiet':
    case 'plain':
    case 'icon':
      return 'text'
  }
}
