import type {PropsWithChildren} from 'react'

/** Native confirmations continue to use the platform Alert adapter. */
export function ModulaConfirmationProvider({children}: PropsWithChildren) {
  return children
}
