import {Badge} from 'konsta/react'
import type {ReactNode} from 'react'

import type {ModulaBadgeTone} from '@/platform/ui/identity/modula-badge'

export function KonstaBadge({icon, label, tone}: {icon?: ReactNode; label: string; tone: ModulaBadgeTone}) {
  return (
    <Badge className="modula-konsta-badge" data-tone={tone} small>
      {icon}
      <span>{label}</span>
    </Badge>
  )
}
