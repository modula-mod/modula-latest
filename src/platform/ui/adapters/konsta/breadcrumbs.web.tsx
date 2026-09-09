import {Breadcrumbs, BreadcrumbsItem, BreadcrumbsSeparator} from 'konsta/react'

export type KonstaBreadcrumbItem = {
  id: string
  label: string
  onPress?: () => void
}

export function KonstaBreadcrumbs({items, testID}: {items: readonly KonstaBreadcrumbItem[]; testID?: string}) {
  return (
    <Breadcrumbs
      aria-label="Breadcrumb"
      className="modula-konsta-breadcrumbs"
      component="ol"
      data-testid={testID}>
      {items.map((item, index) => {
        const current = index === items.length - 1
        return (
          <BreadcrumbsItem
            active={current}
            aria-current={current ? 'page' : undefined}
            component="li"
            key={item.id}
            role="listitem"
            tabIndex={-1}>
            {item.onPress && !current ? (
              <button className="modula-konsta-breadcrumb-action" onClick={item.onPress} type="button">
                {item.label}
              </button>
            ) : <span>{item.label}</span>}
            {!current ? <BreadcrumbsSeparator aria-hidden="true" /> : null}
          </BreadcrumbsItem>
        )
      })}
    </Breadcrumbs>
  )
}
