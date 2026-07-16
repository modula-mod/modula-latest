export type ModulaButtonRole = 'primary' | 'secondary' | 'plain' | 'destructive'

/** Maps Modula roles to `@expo/ui` universal Button variants. */
export function universalVariantForRole(
  role: ModulaButtonRole,
): 'filled' | 'outlined' | 'text' {
  switch (role) {
    case 'primary':
    case 'destructive':
      return 'filled'
    case 'secondary':
      return 'outlined'
    case 'plain':
      return 'text'
  }
}
