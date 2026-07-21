/**
 * TypeScript / non-platform fallback.
 * Metro resolves `modula-sheet.native.tsx` on iOS/Android and
 * `modula-sheet.web.tsx` on web — never silently bind the web Modal on native.
 */
export type {ModulaSheetProps} from '@/platform/ui/sheets/modula-sheet.types'
export {ModulaSheet} from '@/platform/ui/sheets/modula-sheet.native'
