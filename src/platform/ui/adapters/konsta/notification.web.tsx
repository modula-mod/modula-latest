import {Notification} from 'konsta/react'
import type {ReactNode} from 'react'

export function KonstaNotification({
  action,
  description,
  dismiss,
  icon,
  timestamp,
  title,
}: {
  action?: ReactNode
  description: string
  dismiss?: ReactNode
  icon?: ReactNode
  timestamp?: string
  title: string
}) {
  return (
    <Notification
      className="modula-konsta-notification"
      icon={icon}
      opened
      text={description}
      title={title}
      titleRightText={timestamp}>
      {action || dismiss ? (
        <div className="modula-konsta-notification-actions">{action}{dismiss}</div>
      ) : null}
    </Notification>
  )
}
