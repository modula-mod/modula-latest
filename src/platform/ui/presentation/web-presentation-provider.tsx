import type {PropsWithChildren} from 'react'

/** Native/fallback provider: the browser presentation preference is ignored. */
export function WebPresentationProvider({children}: PropsWithChildren) {
  return children
}
