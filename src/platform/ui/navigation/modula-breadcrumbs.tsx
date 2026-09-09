export type ModulaBreadcrumbItem = {
  id: string
  label: string
  onPress?: () => void
}

export type ModulaBreadcrumbsProps = {
  items: readonly ModulaBreadcrumbItem[]
  testID?: string
}

/** Breadcrumbs are an expanded-web hierarchy aid and intentionally hidden on native. */
export function ModulaBreadcrumbs(_props: ModulaBreadcrumbsProps) {
  return null
}
