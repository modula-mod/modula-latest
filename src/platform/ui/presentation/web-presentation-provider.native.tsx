import type {PropsWithChildren} from 'react'

/** Native provider intentionally contains no Konsta import or presentation logic. */
export function WebPresentationProvider({children}: PropsWithChildren) {
  return children
}
