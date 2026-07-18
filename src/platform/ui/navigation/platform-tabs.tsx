/**
 * TypeScript / non-platform fallback.
 * Metro resolves `platform-tabs.native.tsx` on iOS/Android and
 * `platform-tabs.web.tsx` on web — never silently bind the web tab rail on native.
 */
export {PlatformTabs} from '@/platform/ui/navigation/platform-tabs.native'
