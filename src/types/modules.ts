import type {AppIconName} from '@/components/primitives/AppIcon'

export type DemoModule = {
  id: string
  name: string
  description: string
  status: string
  icon: AppIconName
  category: 'productivity' | 'intelligence' | 'commerce' | 'wellbeing'
}
