import {router, type Href} from 'expo-router'

/** Typed-routes-safe navigation until Expo regenerates Href unions. */
export function push(href: string): void {
  router.push(href as Href)
}

export function href(path: string): Href {
  return path as Href
}
